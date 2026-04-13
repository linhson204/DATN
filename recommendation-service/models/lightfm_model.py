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
        self.interactions_csr: Optional[sparse.csr_matrix] = None

        self.user_id_map: dict[str, int] = {}
        self.item_id_map: dict[str, int] = {}
        self._index_to_item: dict[int, str] = {}

    def fit(
        self,
        interactions: pd.DataFrame,
        item_feature_tuples: Optional[Iterable[tuple[str, list[str]]]] = None,
    ) -> "LightFMRecommender":
        """
        Huấn luyện (Train) mô hình LightFM dựa trên dữ liệu tương tác của người dùng.
        Hàm này sẽ:
        1. Xử lý tập trung các ID (user_id, product_id) để map thành index chạy từ 0 đến N.
        2. Tích hợp metadata sản phẩm (item_features) nếu có, giúp giải quyết một phần bài toán cold-start.
        3. Khởi tạo đối tượng LightFM và gọi hàm `.fit()`.
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

        tuples = list(item_feature_tuples or [])
        feature_tokens = sorted({feature for _, features in tuples for feature in features})

        dataset = Dataset()
        dataset.fit(users=users, items=items, item_features=feature_tokens)

        interactions_csr, weights_csr = dataset.build_interactions(
            (row.user_id, row.product_id, row.weight) for row in train_df.itertuples(index=False)
        )

        allow_items = set(items)
        filtered_tuples = [(item_id, features) for item_id, features in tuples if item_id in allow_items]
        item_features = (
            dataset.build_item_features(filtered_tuples, normalize=True)
            if filtered_tuples
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
            interactions=interactions_csr,
            sample_weight=weights_csr,
            item_features=item_features,
            epochs=self.epochs,
            num_threads=self.num_threads,
        )

        self.model = model
        self.dataset = dataset
        self.item_features = item_features
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

    '''Kiểm tra mô hình đã được huấn luyện (fitted) hay chưa trước khi thực hiện các thao tác dự đoán.'''
    def _require_fitted(self) -> None:
        if self.model is None or self.dataset is None:
            raise RuntimeError("Model is not fitted. Train or load artifacts first.")

    def score_candidates(self, user_id: str, candidate_product_ids: Sequence[str]) -> list[tuple[str, float]]:
        """
        Chấm điểm (Score) một danh sách cụ thể các ứng viên sản phẩm cho một user.
        
        API: POST /score
        Lưu ý: Phương thức này KHÔNG lọc bỏ những sản phẩm user đã tương tác,
        vì hệ thống Backend đã gọi cụ thể danh sách này và muốn biết điểm số của toàn bộ danh sách.
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

        return sorted(scores.items(), key=lambda item: item[1], reverse=True)

    def recommend_for_user(
        self,
        user_id: str,
        top_n: int = 20,
        exclude_interacted: bool = True,
    ) -> list[tuple[str, float]]:
        """
        Gợi ý top_n sản phẩm phù hợp nhất cho người dùng (Personalized Recommendations).
        
        API: GET /recommend/{user_id}
        
        Tham số:
            user_id: Mã định danh của người dùng (External UUID).
            top_n: Số lượng sản phẩm trả về.
            exclude_interacted: Gán bằng True để loại bỏ những sản phẩm người dùng đã xem/mua (tương tác)
                trong file log (interactions_csr) nhằm tránh gợi ý lại các đồ cũ.
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
            item_features=self.item_features,
            num_threads=self.num_threads,
        )

        # Loại bỏ những sản phẩm đã tương tác nếu exclude_interacted=True và interactions_csr có sẵn
        if exclude_interacted and self.interactions_csr is not None:
            user_interactions = self.interactions_csr[user_index].toarray().ravel()
            predictions[user_interactions > 0] = -np.inf

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
        joblib.dump(self.interactions_csr, output_dir / "interactions.joblib")

        with (output_dir / "user_id_map.json").open("w", encoding="utf-8") as user_fp:
            json.dump(self.user_id_map, user_fp, ensure_ascii=True)

        with (output_dir / "item_id_map.json").open("w", encoding="utf-8") as item_fp:
            json.dump(self.item_id_map, item_fp, ensure_ascii=True)

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

        # Khởi tạo instance của LightFMRecommender với các artifact đã load vào bộ nhớ để sẵn sàng cho việc dự đoán (inference).
        recommender = cls(num_threads=num_threads)

        # Gán các artifact đã load vào instance của recommender để có thể sử dụng cho các phương thức recommend/score.
        recommender.model = model
        recommender.dataset = dataset
        recommender.item_features = item_features
        recommender.interactions_csr = interactions_csr
        recommender.user_id_map = user_id_map
        recommender.item_id_map = item_id_map
        recommender._index_to_item = {idx: item_id for item_id, idx in item_id_map.items()}

        logger.info(
            "Artifacts loaded from %s — %d users, %d items",
            output_dir,
            len(user_id_map),
            len(item_id_map),
        )
        return recommender