"""Item-based Collaborative Filtering (cosine similarity)

Module này cung cấp một mô hình CF độc lập giữa các sản phẩm, được sử dụng cho tính năng
"Sản phẩm tương tự" (GET /similar/{product_id}).

Mô hình này được huấn luyện song song với mô hình LightFM chính trong quá trình huấn luyện
và các thành phần của nó được lưu/tải độc lập.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

import joblib
import numpy as np
import pandas as pd
from scipy.sparse import csr_matrix
from sklearn.metrics.pairwise import cosine_similarity

logger = logging.getLogger(__name__)


class ItemCollaborativeFiltering:
    def __init__(self) -> None:
        self.user_to_index: dict[str, int] = {}
        self.item_to_index: dict[str, int] = {}
        self.index_to_item: dict[int, str] = {}
        self.similarity: Optional[csr_matrix] = None

    def fit(self, interactions: pd.DataFrame) -> "ItemCollaborativeFiltering":
        """
        Huấn luyện mô hình ItemCF dựa trên ma trận tương tác.
        Đầu vào là tập dữ liệu (user_id, product_id, weight).
        Các bước thực hiện:
        1. Tạo các mapping từ ID hệ thống sang index ma trận cho User và Item.
        2. Tạo một ma trận thưa (Sparse Matrix) từ scipy (csr_matrix).
        3. Tính toán ma trận độ tương đồng Cosine (Cosine Similarity) cho các cột (Items).
        """
        required_cols = {"user_id", "product_id", "weight"}
        if not required_cols.issubset(interactions.columns):
            raise ValueError(f"interactions must include {required_cols}")

        users = interactions["user_id"].astype("category")
        items = interactions["product_id"].astype("category")

        self.user_to_index = {value: idx for idx, value in enumerate(users.cat.categories)}
        self.item_to_index = {value: idx for idx, value in enumerate(items.cat.categories)}
        self.index_to_item = {idx: value for value, idx in self.item_to_index.items()}

        matrix = csr_matrix(
            (
                interactions["weight"].astype(float).to_numpy(),
                (users.cat.codes.to_numpy(), items.cat.codes.to_numpy()),
            ),
            shape=(len(self.user_to_index), len(self.item_to_index)),
        )
        self.similarity = cosine_similarity(matrix.T, dense_output=False)

        logger.info(
            "ItemCF fitted: %d users, %d items, similarity nnz=%d",
            len(self.user_to_index),
            len(self.item_to_index),
            self.similarity.nnz,
        )
        return self

    def recommend(self, seed_product_id: str, top_n: int = 20) -> list[tuple[str, float]]:
        """
        Dự đoán và trả về top_n sản phẩm có độ tương đồng cao nhất với seed_product_id.
        Kết quả trả ra là một danh sách các tuple dạng: (product_id, điểm_số_tương_đồng).
        """
        if self.similarity is None:
            raise RuntimeError("Model has not been fitted")

        seed_idx = self.item_to_index.get(seed_product_id)
        if seed_idx is None:
            return []

        row = self.similarity.getrow(seed_idx)
        pairs = [
            (self.index_to_item[item_idx], float(score))
            for item_idx, score in zip(row.indices, row.data)
            if item_idx != seed_idx
        ]
        pairs.sort(key=lambda item: item[1], reverse=True)
        return pairs[:top_n]

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------

    def save_artifacts(self, path: Path | str) -> None:
        output = Path(path)
        output.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(
            {
                "similarity": self.similarity,
                "item_to_index": self.item_to_index,
                "index_to_item": self.index_to_item,
            },
            output,
        )
        logger.info("ItemCF artifacts saved to %s", output)

    @classmethod
    def load_artifacts(cls, path: Path | str) -> "ItemCollaborativeFiltering":
        input_path = Path(path)
        if not input_path.exists():
            raise FileNotFoundError(f"ItemCF artifacts not found at {input_path}")

        data = joblib.load(input_path)
        instance = cls()
        instance.similarity = data["similarity"]
        instance.item_to_index = data["item_to_index"]
        instance.index_to_item = data["index_to_item"]

        logger.info(
            "ItemCF artifacts loaded from %s (%d items)",
            input_path,
            len(instance.item_to_index),
        )
        return instance