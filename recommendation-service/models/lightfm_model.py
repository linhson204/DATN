from __future__ import annotations

import json
import logging
import unicodedata
from pathlib import Path
from typing import Iterable, Optional, Sequence

import joblib
import numpy as np
import pandas as pd
from lightfm import LightFM
from lightfm.data import Dataset
from scipy import sparse

from config import settings
from data.season import ALL_SEASONS, get_current_season, get_adjacent_seasons

logger = logging.getLogger(__name__)


class LightFMRecommender:
    def __init__(
        self,
        no_components: int = 64,
        loss: str = "warp",
        learning_rate: float = 0.05,
        item_alpha: float = 1e-5,
        user_alpha: float = 1e-5,
        epochs: int = 80,
        num_threads: int = 4,
        random_state: int | None = None,
    ) -> None:
        self.no_components = no_components
        self.loss = loss
        self.learning_rate = learning_rate
        self.item_alpha = item_alpha
        self.user_alpha = user_alpha
        self.epochs = epochs
        self.num_threads = num_threads
        self.random_state = random_state

        self.model: Optional[LightFM] = None
        self.dataset: Optional[Dataset] = None
        self.item_features: Optional[sparse.spmatrix] = None
        self.user_features: Optional[sparse.spmatrix] = None
        self.interactions_csr: Optional[sparse.csr_matrix] = None

        self.user_id_map: dict[str, int] = {}
        self.item_id_map: dict[str, int] = {}
        self._index_to_item: dict[int, str] = {}
        self.user_order_history: dict[str, list[str]] = {}
        # Mapping product_id -> danh sách mùa, dùng cho season boosting tại inference-time
        self.item_seasons: dict[str, list[str]] = {}
        # Mapping product_id -> target gender và user_id -> gender để boost khi khớp giới tính
        self.item_target_genders: dict[str, str] = {}
        self.user_genders: dict[str, str] = {}

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
            random_state=self.random_state,
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
        self.user_order_history = self._build_order_history(interactions)
        self.item_target_genders = self._extract_item_gender_map(item_tuples)
        self.user_genders = self._extract_user_gender_map(user_tuples)

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

    @staticmethod
    def _normalize_gender(value: object) -> Optional[str]:
        """Chuẩn hóa gender về 'MALE', 'FEMALE' hoặc 'UNISEX'"""
        if value is None:
            return None

        token = str(value).strip().lower()
        if not token:
            return None

        if ":" in token:
            prefix, suffix = token.split(":", 1)
            if prefix in {"gender", "user_gender"}:
                token = suffix.strip()

        token = "".join(
            ch for ch in unicodedata.normalize("NFKD", token)
            if not unicodedata.combining(ch)
        )

        aliases = {
            "m": "MALE",
            "male": "MALE",
            "man": "MALE",
            "men": "MALE",
            "nam": "MALE",
            "boy": "MALE",
            "boys": "MALE",
            "f": "FEMALE",
            "female": "FEMALE",
            "woman": "FEMALE",
            "women": "FEMALE",
            "nu": "FEMALE",
            "girl": "FEMALE",
            "girls": "FEMALE",
            "unisex": "UNISEX",
            "uni": "UNISEX",
            "both": "UNISEX",
            "all": "UNISEX",
        }
        if token in aliases:
            return aliases[token]

        token_upper = token.upper()
        if token_upper in {"MALE", "FEMALE", "UNISEX"}:
            return token_upper
        return None

    @classmethod
    def _extract_item_gender_map(cls, item_tuples: Iterable[tuple[str, list[str]]]) -> dict[str, str]:
        """Xây dựng mapping product_id -> gender từ item_feature_tuples"""
        mapping: dict[str, str] = {}
        for item_id, features in item_tuples:
            for feature in features:
                if not feature.startswith("gender:"):
                    continue
                normalized = cls._normalize_gender(feature)
                if normalized:
                    mapping[str(item_id)] = normalized
                break
        return mapping

    @classmethod
    def _extract_user_gender_map(cls, user_tuples: Iterable[tuple[str, list[str]]]) -> dict[str, str]:
        """Xây dựng mapping user_id -> gender từ user_feature_tuples"""
        mapping: dict[str, str] = {}
        for user_id, features in user_tuples:
            for feature in features:
                if not feature.startswith("user_gender:"):
                    continue
                normalized = cls._normalize_gender(feature)
                if normalized:
                    mapping[str(user_id)] = normalized
                break
        return mapping

    def _resolve_user_gender(self, user_id: str, user_gender: Optional[str] = None) -> Optional[str]:
        explicit = self._normalize_gender(user_gender)
        if explicit:
            return explicit
        return self.user_genders.get(str(user_id))

    @staticmethod
    def _dedupe_preserve_order(values: Sequence[str]) -> list[str]:
        """Loại bỏ các giá trị trùng lặp trong danh sách nhưng vẫn giữ nguyên thứ tự"""
        seen: set[str] = set()
        result: list[str] = []
        for value in values:
            token = str(value)
            if not token or token in seen:
                continue
            seen.add(token)
            result.append(token)
        return result

    def _build_order_history(self, interactions: pd.DataFrame) -> dict[str, list[str]]:
        """Xây dựng order history cho từng user"""
        required_cols = {"user_id", "product_id"}
        if interactions.empty or not required_cols.issubset(interactions.columns):
            return {}

        order_rows = interactions.copy()
        order_rows["user_id"] = order_rows["user_id"].astype(str)
        order_rows["product_id"] = order_rows["product_id"].astype(str)

        if "signal" in order_rows.columns:
            order_rows["signal"] = order_rows["signal"].astype(str).str.upper()
            order_rows = order_rows[order_rows["signal"] == "ORDER"]

        if order_rows.empty:
            return {}

        if "created_at" in order_rows.columns:
            order_rows["created_at"] = pd.to_datetime(order_rows["created_at"], errors="coerce")
            order_rows = order_rows.sort_values("created_at", ascending=False, kind="stable")

        history: dict[str, list[str]] = {}
        for user_id, group in order_rows.groupby("user_id", sort=False):
            history[str(user_id)] = self._dedupe_preserve_order(group["product_id"].tolist())
        return history

    def _order_similarity_boosts(
        self,
        ordered_item_ids: Sequence[str],
        top_n: int,
        boost_weight: float,
    ) -> dict[str, float]:
        """Tính order similarity boost cho từng sản phẩm"""
        if top_n <= 0 or boost_weight <= 0 or not ordered_item_ids:
            return {}

        ordered_set = {str(product_id) for product_id in ordered_item_ids}
        boosts: dict[str, float] = {}
        for source_product_id in ordered_set:
            for similar_product_id, _ in self.similar_items(source_product_id, top_n=top_n):
                if similar_product_id in ordered_set:
                    continue
                boosts[similar_product_id] = boosts.get(similar_product_id, 0.0) + float(boost_weight)
        return boosts


    '''Kiểm tra mô hình đã được huấn luyện (fitted) hay chưa trước khi thực hiện các thao tác dự đoán.'''
    def _require_fitted(self) -> None:
        if self.model is None or self.dataset is None:
            raise RuntimeError("Model is not fitted. Train or load artifacts first.")

    def score_candidates(
        self,
        user_id: str,
        candidate_product_ids: Sequence[str],
        user_gender: str | None = None,
        season_boost_weight: float = 0.0,
        gender_match_boost_weight: float = 0.0,
        order_similarity_top_n: int | None = None,
        order_similarity_boost_weight: float | None = None,
    ) -> list[tuple[str, float]]:
        """
        Chấm điểm (Score) một danh sách cụ thể các ứng viên sản phẩm cho một user.

        API: POST /score
        Lưu ý: Phương thức này KHÔNG lọc bỏ những sản phẩm user đã tương tác,
        vì hệ thống Backend đã gọi cụ thể danh sách này và muốn biết điểm số của toàn bộ danh sách.

        Tham số:
            season_boost_weight: Trọng số boost mùa (0 = tắt boosting).
            gender_match_boost_weight: Trọng số boost theo mức độ khớp giới tính.
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
        ordered_item_ids = self.user_order_history.get(str(user_id), [])
        purchased_set = set(ordered_item_ids)
        purchased_penalty = float(settings.order_purchased_item_penalty)
        for product_id in deduped_ids:
            if product_id in purchased_set:
                scores[product_id] = purchased_penalty
                continue
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
                if pid in purchased_set:
                    boosted[pid] = raw_score
                    continue
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

        # --- Gender-Match Boosting (additive offset) ---
        # Chỉ tăng điểm khi giới tính sản phẩm khớp giới tính user, không trừ điểm nhóm khác.
        resolved_gender = self._resolve_user_gender(user_id=user_id, user_gender=user_gender)
        if gender_match_boost_weight > 0 and resolved_gender and self.item_target_genders:
            raw_values = np.array(list(scores.values()), dtype=float)
            score_std = float(np.std(raw_values)) if len(raw_values) > 1 else 1.0
            offset = gender_match_boost_weight * score_std

            boosted: dict[str, float] = {}
            for pid, raw_score in scores.items():
                if pid in purchased_set:
                    boosted[pid] = raw_score
                    continue
                if self.item_target_genders.get(pid) == resolved_gender:
                    boosted[pid] = raw_score + offset
                else:
                    boosted[pid] = raw_score
            scores = boosted
            logger.debug(
                "Gender-match boost applied (user_gender=%s, offset=+%.4f)",
                resolved_gender,
                offset,
            )

        return sorted(scores.items(), key=lambda item: item[1], reverse=True)

    def recommend_for_user(
        self,
        user_id: str,
        top_n: int = 30,
        exclude_interacted: bool = True,
        user_gender: str | None = None,
        season_boost_weight: float = 0.0,
        gender_match_boost_weight: float = 0.0,
        order_similarity_top_n: int | None = None,
        order_similarity_boost_weight: float | None = None,
    ) -> list[tuple[str, float]]:
        """
        Gợi ý top_n sản phẩm phù hợp nhất cho người dùng (Personalized Recommendations).

        API: GET /recommend/{user_id}

        Tham số:
            user_id: Mã định danh của người dùng (External UUID).
            top_n: Số lượng sản phẩm trả về.
            exclude_interacted: Gán bằng True để loại bỏ những sản phẩm người dùng đã mua.
            user_gender: Giới tính user truyền từ API (nếu có) để ưu tiên sản phẩm cùng giới.
            season_boost_weight: Trọng số boost theo mùa (0 = tắt, mặc định lấy từ settings).
            gender_match_boost_weight: Trọng số boost theo mức độ khớp giới tính.
            order_similarity_top_n: Số sản phẩm tương tự lấy cho mỗi sản phẩm đã mua.
            order_similarity_boost_weight: Điểm cộng cho mỗi sản phẩm tương tự.
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

        ordered_item_ids = self.user_order_history.get(str(user_id), [])
        purchased_set = set(ordered_item_ids)
        purchased_penalty = float(settings.order_purchased_item_penalty)
        if exclude_interacted and ordered_item_ids:
            for product_id in ordered_item_ids:
                item_idx = self.item_id_map.get(product_id)
                if item_idx is not None:
                    predictions[item_idx] = purchased_penalty

        similarity_top_n = int(order_similarity_top_n or settings.order_similarity_top_n)
        similarity_boost_weight = float(
            order_similarity_boost_weight if order_similarity_boost_weight is not None else settings.order_similarity_boost_weight
        )
        if ordered_item_ids:
            boosts = self._order_similarity_boosts(
                ordered_item_ids,
                top_n=similarity_top_n,
                boost_weight=similarity_boost_weight,
            )
            for product_id, boost in boosts.items():
                item_idx = self.item_id_map.get(product_id)
                if item_idx is None or product_id in purchased_set or not np.isfinite(predictions[item_idx]):
                    continue
                predictions[item_idx] += boost

        # --- Season Boosting: cộng/trừ offset thay vì nhân để đúng với score âm ---
        if season_boost_weight > 0 and self.item_seasons:
            current_season = get_current_season()
            finite_mask = np.isfinite(predictions)
            finite_vals = predictions[finite_mask]
            score_std = float(np.std(finite_vals)) if finite_vals.size > 1 else 1.0
            offset = season_boost_weight * score_std
            adjacent = get_adjacent_seasons(current_season)
            for item_id, item_idx in self.item_id_map.items():
                if item_id in purchased_set:
                    continue
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

        # --- Gender-Match Boosting: chỉ cộng điểm cho item cùng giới user ---
        resolved_gender = self._resolve_user_gender(user_id=user_id, user_gender=user_gender)
        if gender_match_boost_weight > 0 and resolved_gender and self.item_target_genders:
            finite_mask = np.isfinite(predictions)
            finite_vals = predictions[finite_mask]
            score_std = float(np.std(finite_vals)) if finite_vals.size > 1 else 1.0
            offset = gender_match_boost_weight * score_std
            for item_id, item_idx in self.item_id_map.items():
                if item_id in purchased_set:
                    continue
                if not np.isfinite(predictions[item_idx]):
                    continue
                if self.item_target_genders.get(item_id) == resolved_gender:
                    predictions[item_idx] += offset

            logger.debug(
                "Gender-match boost applied (user_gender=%s, offset=+%.4f)",
                resolved_gender,
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

    def similar_items(
        self,
        product_id: str,
        top_n: int = 20,
        min_score: float | None = None,
    ) -> list[tuple[str, float]]:
        """
        Return top_n similar items using item embeddings and cosine similarity.
        """
        self._require_fitted()

        item_index = self.item_id_map.get(str(product_id))
        if item_index is None:
            return []

        _, item_embeddings = self.model.get_item_representations(self.item_features)
        if item_embeddings is None or item_embeddings.size == 0:
            return []

        target_vec = item_embeddings[item_index]
        target_norm = float(np.linalg.norm(target_vec))
        if target_norm == 0.0:
            return []

        norms = np.linalg.norm(item_embeddings, axis=1)
        denom = norms * target_norm
        denom = np.where(denom == 0.0, 1.0, denom)
        scores = item_embeddings @ target_vec / denom
        scores[item_index] = -np.inf

        if min_score is not None:
            threshold = float(min_score)
            scores = np.where(scores >= threshold, scores, -np.inf)

        valid_mask = np.isfinite(scores)
        valid_count = int(valid_mask.sum())
        if valid_count == 0:
            return []

        effective_top_n = max(1, min(top_n, valid_count))
        top_indices = np.argpartition(scores, -effective_top_n)[-effective_top_n:]
        top_indices = top_indices[np.argsort(scores[top_indices])[::-1]]

        return [
            (self._index_to_item[int(idx)], float(scores[int(idx)]))
            for idx in top_indices
            if np.isfinite(scores[int(idx)])
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
        joblib.dump(self.user_order_history, output_dir / "user_order_history.joblib")

        with (output_dir / "user_id_map.json").open("w", encoding="utf-8") as user_fp:
            json.dump(self.user_id_map, user_fp, ensure_ascii=True)

        with (output_dir / "item_id_map.json").open("w", encoding="utf-8") as item_fp:
            json.dump(self.item_id_map, item_fp, ensure_ascii=True)

        # Lưu mapping product_id -> seasons để dùng khi inference (season boosting)
        with (output_dir / "item_seasons.json").open("w", encoding="utf-8") as seasons_fp:
            json.dump(self.item_seasons, seasons_fp, ensure_ascii=True)

        # Lưu map giới tính item/user để boost theo giới tính tại inference-time
        with (output_dir / "item_target_genders.json").open("w", encoding="utf-8") as item_gender_fp:
            json.dump(self.item_target_genders, item_gender_fp, ensure_ascii=True)

        with (output_dir / "user_genders.json").open("w", encoding="utf-8") as user_gender_fp:
            json.dump(self.user_genders, user_gender_fp, ensure_ascii=True)

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

        user_order_history: dict[str, list[str]] = {}
        order_history_path = output_dir / "user_order_history.joblib"
        if order_history_path.exists():
            raw_order_history = joblib.load(order_history_path)
            user_order_history = {
                str(user_id): [str(product_id) for product_id in product_ids]
                for user_id, product_ids in raw_order_history.items()
            }
            logger.info("Order history loaded: %d users", len(user_order_history))
        else:
            logger.info("user_order_history.joblib not found — order-based exclusion disabled")

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

        item_target_genders: dict[str, str] = {}
        item_genders_path = output_dir / "item_target_genders.json"
        if item_genders_path.exists():
            with item_genders_path.open("r", encoding="utf-8") as item_genders_fp:
                raw_item_genders = json.load(item_genders_fp)
            item_target_genders = {
                str(item_id): normalized
                for item_id, value in raw_item_genders.items()
                if (normalized := cls._normalize_gender(value)) is not None
            }
            logger.info("Item gender map loaded: %d items", len(item_target_genders))
        else:
            logger.info("item_target_genders.json not found — item gender boost may be limited")

        user_genders: dict[str, str] = {}
        user_genders_path = output_dir / "user_genders.json"
        if user_genders_path.exists():
            with user_genders_path.open("r", encoding="utf-8") as user_genders_fp:
                raw_user_genders = json.load(user_genders_fp)
            user_genders = {
                str(user_id): normalized
                for user_id, value in raw_user_genders.items()
                if (normalized := cls._normalize_gender(value)) is not None
            }
            logger.info("User gender map loaded: %d users", len(user_genders))
        else:
            logger.info("user_genders.json not found — using API hint or inferred user features")

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
        recommender.item_target_genders = item_target_genders
        recommender.user_genders = user_genders

        logger.info(
            "Artifacts loaded from %s — %d users, %d items",
            output_dir,
            len(user_id_map),
            len(item_id_map),
        )
        return recommender