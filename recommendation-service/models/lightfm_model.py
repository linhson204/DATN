from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Iterable, Optional, Sequence

import joblib
import numpy as np
import pandas as pd
from lightfm import LightFM
from lightfm.data import Dataset
from scipy import sparse

from data.season import ALL_SEASONS, get_current_season, get_adjacent_seasons

logger = logging.getLogger(__name__)


class LightFMRecommender:
    def __init__(
        self,
        no_components: int = 64,
        loss: str = "warp",
        learning_rate: float = 0.05,
        item_alpha: float = 1e-6,
        user_alpha: float = 1e-6,
        epochs: int = 30,
        num_threads: int = 4,
    ) -> None:
        self.no_components = no_components
        self.loss = loss
        self.learning_rate = learning_rate
        self.item_alpha = item_alpha
        self.user_alpha = user_alpha
        self.epochs = epochs
        self.num_threads = num_threads

        self.model: Optional[LightFM] = None
        self.dataset: Optional[Dataset] = None
        self.item_features: Optional[sparse.spmatrix] = None
        self.user_features: Optional[sparse.spmatrix] = None
        self.interactions_csr: Optional[sparse.csr_matrix] = None

        self.user_id_map: dict[str, int] = {}
        self.item_id_map: dict[str, int] = {}
        self._index_to_item: dict[int, str] = {}
        # Mapping product_id -> danh sách mùa, dùng cho season boosting tại inference-time
        self.item_seasons: dict[str, list[str]] = {}

    def fit(
        self,
        interactions: pd.DataFrame,
        item_feature_tuples: Optional[Iterable[tuple[str, list[str]]]] = None,
        user_feature_tuples: Optional[Iterable[tuple[str, list[str]]]] = None,
    ) -> "LightFMRecommender":
        """
        Huấn luyện (Train) mô hình LightFM dựa trên dữ liệu tương tác của người dùng.
        Hàm này sẽ:
        1. Xử lý tập trung các ID (user_id, product_id) để map thành index chạy từ 0 đến N.
        2. Tích hợp metadata sản phẩm (item_features) nếu có, giúp giải quyết một phần bài toán cold-start.
        3. Tích hợp metadata user (user_features: giới tính/nhóm tuổi) nếu có.
        4. Khởi tạo đối tượng LightFM và gọi hàm `.fit()`.
        """
        required_cols = {"user_id", "product_id", "weight"}
        if not required_cols.issubset(interactions.columns):
            raise ValueError(f"interactions must include {required_cols}")
        if interactions.empty:
            raise ValueError("interactions dataframe is empty")

        train_df = interactions[["user_id", "product_id", "weight"]].copy()
        train_df["user_id"] = train_df["user_id"].astype(str)
        train_df["product_id"] = train_df["product_id"].astype(str)
        train_df["weight"] = train_df["weight"].astype(float)

        users = train_df["user_id"].unique().tolist()
        items = train_df["product_id"].unique().tolist()

        item_tuples = list(item_feature_tuples or [])
        item_feature_tokens = sorted({feature for _, features in item_tuples for feature in features})

        user_tuples = list(user_feature_tuples or [])
        user_feature_tokens = sorted({feature for _, features in user_tuples for feature in features})

        dataset = Dataset()
        dataset.fit(
            users=users,
            items=items,
            user_features=user_feature_tokens,
            item_features=item_feature_tokens,
        )

        interactions_matrix, weights_matrix = dataset.build_interactions(
            (row.user_id, row.product_id, row.weight) for row in train_df.itertuples(index=False)
        )
        interactions_csr = interactions_matrix.tocsr()

        allow_items = set(items)
        filtered_tuples = [(item_id, features) for item_id, features in item_tuples if item_id in allow_items]
        item_features = (
            dataset.build_item_features(filtered_tuples, normalize=True)
            if filtered_tuples
            else None
        )

        allow_users = set(users)
        filtered_user_tuples = [
            (user_id, features)
            for user_id, features in user_tuples
            if user_id in allow_users and features
        ]
        user_features = (
            dataset.build_user_features(filtered_user_tuples, normalize=True)
            if filtered_user_tuples
            else None
        )

        model = LightFM(
            no_components=self.no_components,
            loss=self.loss,
            learning_rate=self.learning_rate,
            item_alpha=self.item_alpha,
            user_alpha=self.user_alpha,
        )
        model.fit(
            interactions=interactions_matrix,
            sample_weight=weights_matrix,
            item_features=item_features,
            user_features=user_features,
            epochs=self.epochs,
            num_threads=self.num_threads,
        )

        self.model = model
        self.dataset = dataset
        self.item_features = item_features
        self.user_features = user_features
        self.interactions_csr = interactions_csr
        self.user_id_map, _, self.item_id_map, _ = dataset.mapping()
        self._index_to_item = {idx: item_id for item_id, idx in self.item_id_map.items()}

        logger.info(
            "Model fitted: %d users, %d items, %d interactions",
            len(users),
            len(items),
            interactions_csr.nnz,
        )
        return self

    def set_item_seasons(self, item_seasons: dict[str, list[str]]) -> None:
        """Gán mapping product_id -> mùa để dùng cho season boosting tại inference-time."""
        self.item_seasons = item_seasons
        logger.info("Season map loaded: %d products with season info", len(item_seasons))

    '''Kiểm tra mô hình đã được huấn luyện (fitted) hay chưa trước khi thực hiện các thao tác dự đoán.'''
    def _require_fitted(self) -> None:
        if self.model is None or self.dataset is None:
            raise RuntimeError("Model is not fitted. Train or load artifacts first.")

    def score_candidates(
        self,
        user_id: str,
        candidate_product_ids: Sequence[str],
        season_boost_weight: float = 0.0,
    ) -> list[tuple[str, float]]:
        """
        Chấm điểm (Score) một danh sách cụ thể các ứng viên sản phẩm cho một user.

        API: POST /score
        Lưu ý: Phương thức này KHÔNG lọc bỏ những sản phẩm user đã tương tác,
        vì hệ thống Backend đã gọi cụ thể danh sách này và muốn biết điểm số của toàn bộ danh sách.

        Tham số:
            season_boost_weight: Trọng số boost mùa (0 = tắt boosting).
        """
        self._require_fitted()
        # Loại bỏ trùng lặp và làm sạch candidate_product_ids, đồng thời giữ nguyên thứ tự ban đầu.
        deduped_ids = list(dict.fromkeys(str(pid) for pid in candidate_product_ids))
        if not deduped_ids:
            return []

        scores = {product_id: 0.0 for product_id in deduped_ids}

        user_index = self.user_id_map.get(str(user_id))
        if user_index is None:
            logger.warning("Unknown user_id=%s, returning zero scores for all candidates", user_id)
            return sorted(scores.items(), key=lambda item: item[1], reverse=True)

        known_item_ids: list[str] = []
        item_indices: list[int] = []
        for product_id in deduped_ids:
            item_index = self.item_id_map.get(product_id)
            if item_index is not None:
                known_item_ids.append(product_id)
                item_indices.append(item_index)

        if known_item_ids:
            predictions = self.model.predict(
                user_ids=np.repeat(user_index, len(item_indices)),
                item_ids=np.array(item_indices),
                user_features=self.user_features,
                item_features=self.item_features,
                num_threads=self.num_threads,
            )
            for product_id, value in zip(known_item_ids, predictions):
                scores[product_id] = float(value)

        unknown_count = len(deduped_ids) - len(known_item_ids)
        if unknown_count > 0:
            logger.info(
                "user_id=%s: %d/%d candidate items unknown to the model",
                user_id,
                unknown_count,
                len(deduped_ids),
            )

        # --- Season Boosting (additive offset) ---
        # LightFM scores có thể âm → không được nhân mà phải cộng/trừ offset
        # offset = boost_weight * std(scores) để scale tự động theo phân phối điểm
        if season_boost_weight > 0 and self.item_seasons:
            current_season = get_current_season()
            raw_values = np.array(list(scores.values()), dtype=float)
            score_std = float(np.std(raw_values)) if len(raw_values) > 1 else 1.0
            offset = season_boost_weight * score_std
            adjacent = get_adjacent_seasons(current_season)
            boosted: dict[str, float] = {}
            for pid, raw_score in scores.items():
                item_seasons = self.item_seasons.get(pid, [])
                if current_season in item_seasons:
                    boosted[pid] = raw_score + offset        # đúng mùa → cộng
                elif any(s in adjacent for s in item_seasons):
                    boosted[pid] = raw_score                 # giao mùa → giữ nguyên
                elif item_seasons:                           # trái mùa → trừ
                    boosted[pid] = raw_score - offset
                else:
                    boosted[pid] = raw_score                 # không có info mùa → giữ nguyên
            scores = boosted
            logger.debug(
                "Season boost applied (season=%s, offset=±%.4f)",
                current_season,
                offset,
            )

        return sorted(scores.items(), key=lambda item: item[1], reverse=True)

    def recommend_for_user(
        self,
        user_id: str,
        top_n: int = 20,
        exclude_interacted: bool = True,
        season_boost_weight: float = 0.0,
    ) -> list[tuple[str, float]]:
        """
        Gợi ý top_n sản phẩm phù hợp nhất cho người dùng (Personalized Recommendations).

        API: GET /recommend/{user_id}

        Tham số:
            user_id: Mã định danh của người dùng (External UUID).
            top_n: Số lượng sản phẩm trả về.
            exclude_interacted: Gán bằng True để loại bỏ những sản phẩm người dùng đã xem/mua (tương tác)
                trong file log (interactions_csr) nhằm tránh gợi ý lại các đồ cũ.
            season_boost_weight: Trọng số boost theo mùa (0 = tắt, mặc định lấy từ settings).
        """
        self._require_fitted()

        user_index = self.user_id_map.get(str(user_id))
        if user_index is None:
            return []

        item_count = len(self.item_id_map)
        if item_count == 0:
            return []

        item_indices = np.arange(item_count)
        predictions = self.model.predict(
            user_ids=np.repeat(user_index, item_count),
            item_ids=item_indices,
            user_features=self.user_features,
            item_features=self.item_features,
            num_threads=self.num_threads,
        )

        # Loại bỏ những sản phẩm đã tương tác nếu exclude_interacted=True và interactions_csr có sẵn
        if exclude_interacted and self.interactions_csr is not None:
            user_interactions = self.interactions_csr[user_index].toarray().ravel()
            predictions[user_interactions > 0] = -np.inf

        # --- Season Boosting: cộng/trừ offset thay vì nhân để đúng với score âm ---
        if season_boost_weight > 0 and self.item_seasons:
            current_season = get_current_season()
            finite_mask = np.isfinite(predictions)
            finite_vals = predictions[finite_mask]
            score_std = float(np.std(finite_vals)) if finite_vals.size > 1 else 1.0
            offset = season_boost_weight * score_std
            adjacent = get_adjacent_seasons(current_season)
            for item_id, item_idx in self.item_id_map.items():
                if not np.isfinite(predictions[item_idx]):
                    continue
                item_seasons = self.item_seasons.get(item_id, [])
                if current_season in item_seasons:
                    predictions[item_idx] += offset        # đúng mùa → cộng
                elif item_seasons and not any(s in adjacent for s in item_seasons):
                    predictions[item_idx] -= offset        # trái mùa hoàn toàn → trừ
                # giao mùa hoặc không có info → giữ nguyên
            logger.debug(
                "Season boost applied (season=%s, offset=±%.4f)",
                current_season,
                offset,
            )

        valid_mask = np.isfinite(predictions)
        valid_count = int(valid_mask.sum())
        if valid_count == 0:
            return []

        effective_top_n = max(1, min(top_n, valid_count))
        top_indices = np.argpartition(predictions, -effective_top_n)[-effective_top_n:]
        top_indices = top_indices[np.argsort(predictions[top_indices])[::-1]]

        return [
            (self._index_to_item[int(idx)], float(predictions[int(idx)]))
            for idx in top_indices
            if np.isfinite(predictions[int(idx)])
        ]

    def save_artifacts(self, artifact_dir: Path | str) -> None:
        self._require_fitted()
        output_dir = Path(artifact_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        joblib.dump(self.model, output_dir / "lightfm_model.joblib")
        joblib.dump(self.dataset, output_dir / "dataset.pkl")
        joblib.dump(self.item_features, output_dir / "item_features.joblib")
        joblib.dump(self.user_features, output_dir / "user_features.joblib")
        joblib.dump(self.interactions_csr, output_dir / "interactions.joblib")

        with (output_dir / "user_id_map.json").open("w", encoding="utf-8") as user_fp:
            json.dump(self.user_id_map, user_fp, ensure_ascii=True)

        with (output_dir / "item_id_map.json").open("w", encoding="utf-8") as item_fp:
            json.dump(self.item_id_map, item_fp, ensure_ascii=True)

        # Lưu mapping product_id -> seasons để dùng khi inference (season boosting)
        with (output_dir / "item_seasons.json").open("w", encoding="utf-8") as seasons_fp:
            json.dump(self.item_seasons, seasons_fp, ensure_ascii=True)

        logger.info("Artifacts saved to %s", output_dir)

    '''
    hàm load lại toàn bộ “tài sản” (artifacts) của model đã train để dùng cho inference 
    (recommend/score). 
    Hiểu đơn giản: Train xong → lưu file → deploy → dùng hàm này để load lại mà không cần 
    phải train lại từ đầu.
    '''
    @classmethod
    def load_artifacts(
        cls,
        artifact_dir: Path | str,
        num_threads: int = 4,
    ) -> "LightFMRecommender":
        output_dir = Path(artifact_dir)

        model = joblib.load(output_dir / "lightfm_model.joblib")   # model đã train
        dataset = joblib.load(output_dir / "dataset.pkl")         # dataset chứa mapping user/item và các thông tin cần thiết để xây dựng ma trận tương tác
        item_features = joblib.load(output_dir / "item_features.joblib")    # ma trận đặc trưng của item (nếu có)

        user_features = None
        user_features_path = output_dir / "user_features.joblib"
        if user_features_path.exists():
            user_features = joblib.load(user_features_path)
        else:
            logger.info("user_features.joblib not found — running without explicit user features")

        # interactions_csr là ma trận tương tác user-item ở dạng sparse matrix, 
        # được dùng để lọc bỏ những sản phẩm đã tương tác khi gợi ý (nếu exclude_interacted=True).
        interactions_csr = None
        interactions_path = output_dir / "interactions.joblib"
        if interactions_path.exists():
            interactions_csr = joblib.load(interactions_path)
        else:
            logger.warning("interactions.joblib not found — interacted-item filtering disabled")

        with (output_dir / "user_id_map.json").open("r", encoding="utf-8") as user_fp:
            user_id_map = {key: int(value) for key, value in json.load(user_fp).items()}

        with (output_dir / "item_id_map.json").open("r", encoding="utf-8") as item_fp:
            item_id_map = {key: int(value) for key, value in json.load(item_fp).items()}

        # Load item_seasons mapping nếu có (artifact này được tạo từ phiên bản mới)
        item_seasons: dict[str, list[str]] = {}
        seasons_path = output_dir / "item_seasons.json"
        if seasons_path.exists():
            with seasons_path.open("r", encoding="utf-8") as seasons_fp:
                item_seasons = json.load(seasons_fp)
            logger.info("Season map loaded: %d products with season info", len(item_seasons))
        else:
            logger.info("item_seasons.json not found — season boosting disabled")

        # Khởi tạo instance của LightFMRecommender với các artifact đã load vào bộ nhớ để sẵn sàng cho việc dự đoán (inference).
        recommender = cls(num_threads=num_threads)

        # Gán các artifact đã load vào instance của recommender để có thể sử dụng cho các phương thức recommend/score.
        recommender.model = model
        recommender.dataset = dataset
        recommender.item_features = item_features
        recommender.user_features = user_features
        recommender.interactions_csr = interactions_csr
        recommender.user_id_map = user_id_map
        recommender.item_id_map = item_id_map
        recommender._index_to_item = {idx: item_id for item_id, idx in item_id_map.items()}
        recommender.item_seasons = item_seasons

        logger.info(
            "Artifacts loaded from %s — %d users, %d items",
            output_dir,
            len(user_id_map),
            len(item_id_map),
        )
        return recommender