# AI Context For Recommendation Service (Python)

## 1) Muc tieu file nay

Tai lieu nay giup AI/codegen hieu nhanh backend Java hien tai de viet Python recommendation service dung ngu canh, tranh lech schema hoac contract.

## 2) Hien trang backend Java (BE)

### Recommendation endpoint hien co

- Base path: /v1/recommendations
- Endpoint hien co: GET /candidates/{productId}
- Controller goi truc tiep CandidateGenerationService.generateCandidates(seedProductId)

### Candidate generation hien tai (rule-based)

Service: CandidateGenerationService

Nguon candidates:

1. CLUSTER (co-viewed)
2. SAME_BRAND
3. SAME_CATEGORY
4. SIMILAR_PRICE
5. COMPATIBLE_MATERIAL

Hard filter:

- product status = true
- totalStock > 0
- gender compatible
- materialQualityScore >= seed material quality (neu co)

Ranking hien tai:

- Sap xep theo so luong nguon (sources.size) giam dan
- Cat theo maxTotalCandidates

### CLUSTER (co-viewed) - giai thich

- BE hien tai lay co-view theo cung user trong cua so lookback (recommendation.cluster-lookback-days).
- Python pipeline co the bo sung bien the session-based theo cua so 30 phut de tao signal co-view.

Query tham khao cho session-based co-view:

```sql
SELECT a.product_id AS seed_product_id,
       b.product_id AS co_view_product_id,
       COUNT(*) AS co_view_count
FROM product_view_log a
JOIN product_view_log b
  ON a.user_id = b.user_id
 AND a.product_id <> b.product_id
 AND ABS(TIMESTAMPDIFF(MINUTE, a.created_at, b.created_at)) <= 30
GROUP BY a.product_id, b.product_id;
```

## 3) Cau hinh BE lien quan recommendation

Trong application.properties:

- recommendation.price-range-percent=30
- recommendation.candidates-per-source=20
- recommendation.max-total-candidates=50
- recommendation.cluster-lookback-days=30
- recommendation.material-score-tolerance=15

## 4) Schema va du lieu lien quan train AI

### Database

- Engine: MySQL 8.x
- Charset: utf8mb4
- user_id / product_id: VARCHAR(36) hoac CHAR(36) theo schema - UUID dang xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

Luu y dialect: dung cu phap MySQL (LIMIT, DATE_SUB, TIMESTAMPDIFF), khong dung ILIKE.

### Bang product_view_log

| Cot              | Kieu        | Ghi chu                              |
| ---------------- | ----------- | ------------------------------------ |
| id               | CHAR(36) PK | UUID                                 |
| user_id          | CHAR(36)    | UUID, NOT NULL                       |
| product_id       | CHAR(36)    | UUID, NOT NULL                       |
| view_type        | VARCHAR(20) | QUICK_VIEW / DETAIL_VIEW / DEEP_VIEW |
| duration_seconds | INT         | Co the NULL theo schema hien tai     |
| created_at       | TIMESTAMP   | DEFAULT CURRENT_TIMESTAMP            |

### Bang orders

| Cot              | Kieu          | Ghi chu                                        |
| ---------------- | ------------- | ---------------------------------------------- |
| id               | CHAR(36) PK   | UUID                                           |
| user_id          | CHAR(36)      | UUID, NOT NULL                                 |
| delivery_info_id | CHAR(36)      | FK -> delivery_infos.id                        |
| status           | VARCHAR(50)   | PENDING/CONFIRMED/SHIPPING/DELIVERED/CANCELLED |
| shipping_fee     | DECIMAL(12,2) | NOT NULL                                       |
| total_amount     | DECIMAL(12,2) | NOT NULL                                       |
| created_at       | DATETIME      | DEFAULT CURRENT_TIMESTAMP                      |
| updated_at       | DATETIME      | ON UPDATE CURRENT_TIMESTAMP                    |

### Bang order_items

| Cot        | Kieu          | Ghi chu                        |
| ---------- | ------------- | ------------------------------ |
| id         | CHAR(36) PK   | UUID                           |
| order_id   | CHAR(36)      | FK -> orders.id                |
| variant_id | CHAR(36)      | FK -> product_variants.id      |
| product_id | CHAR(36)      | FK -> products.id, co the NULL |
| quantity   | INT           | CHECK quantity > 0             |
| unit_price | DECIMAL(12,2) | NOT NULL                       |
| line_total | DECIMAL(12,2) | NOT NULL                       |

### Bang products (feature chinh)

| Cot            | Kieu          | Ghi chu                      |
| -------------- | ------------- | ---------------------------- |
| id             | CHAR(36) PK   | UUID                         |
| name           | VARCHAR(255)  |                              |
| brand          | VARCHAR(150)  |                              |
| category_id    | CHAR(36)      | FK -> product_categories.id  |
| target_gender  | VARCHAR(20)   | MALE/FEMALE/UNISEX           |
| sale_price     | DECIMAL(12,2) |                              |
| total_stock    | INT           |                              |
| material_id    | CHAR(36)      | FK -> material_dictionary.id |
| view_count     | INT           | popularity signal            |
| purchase_count | INT           | positive signal manh         |
| status         | BOOLEAN       |                              |

### Bang bo tro nen dung them

- product_categories: article_type, sub_category, master_category
- wishlist (neu dung explicit signal): user_id, product_id, created_at

## 5) Quy tac view_type hien tai trong BE

Tu ProductViewLogService.resolveViewType(durationSeconds):

- 6 < duration < 60 -> QUICK_VIEW
- 60 <= duration < 210 -> DETAIL_VIEW
- duration >= 210 -> DEEP_VIEW

Python pipeline phai dung dung moc nay de dong bo voi data phat sinh tu BE.

## 6) Material dictionary state (quan trong)

- Model Java hien tai chi dung quality_score.
- Cac cot mo rong breathability_score, durability_score, softness_score, warmth_score da bi loai khoi luong chinh.
- Migration moi da them buoc don cot du de schema nhat quan.

## 7) API contract - context theo phase

- Phase 1: BE tu chay rule-based (CandidateGenerationService hien tai).
- Phase 2: Python pipeline train model, export artifact.
- Phase 3: FastAPI /score chay, BE goi re-ranking cho endpoint thu nghiem.
- Phase 4: BE tich hop day du, /score la primary ranking cho recommendations.

### 7.1 POST /score (uu tien cho Phase 4)

Input:

```json
{
  "user_id": "uuid",
  "candidate_product_ids": ["uuid-1", "uuid-2", "uuid-3"]
}
```

Output:

```json
{
  "scores": [
    { "product_id": "uuid-1", "score": 0.92 },
    { "product_id": "uuid-3", "score": 0.85 },
    { "product_id": "uuid-2", "score": 0.71 }
  ]
}
```

### 7.2 GET /recommend/{user_id}?top_n=20&gender=MALE

- Tra top-N truc tiep tu model.
- Dung khi khong co seed product hoac can feed personalized home.
- Neu user chua co trong model (cold-start): tu dong fallback sang popular/trending.
- Response co them truong "strategy" cho biet nguon goi y:
  - "personalized" — LightFM model
  - "popular_by_gender:MALE" — popular theo gioi tinh
  - "trending" — san pham xu huong 7 ngay gan
  - "popular" — popular toan he thong

### 7.3 POST /admin/reload

- Reload toan bo model artifacts tu disk ma khong can restart server.
- Goi sau khi train lai model.

## 8) Du lieu train de xuat

### Interaction weight goi y

- QUICK_VIEW = 1.0
- DETAIL_VIEW = 2.0
- DEEP_VIEW = 3.0
- WISHLIST = 3.0 (neu su dung)
- ORDER = 5.0 \* log(1 + quantity)

### Ly do uu tien signal (priority rationale)

- ORDER co y nghia chuyen doi thuc te, nen uu tien cao nhat.
- DEEP_VIEW va WISHLIST cho thay muc do quan tam cao, nhung chua chac mua.
- DETAIL_VIEW la quan tam trung binh, tot hon QUICK_VIEW.
- QUICK_VIEW la tin hieu yeu, chu yeu de mo rong do phu va tranh cold-start.

### Split

- Time-based split (khong random)
- Vi du: train 80 ngay, validate/test 10 ngay cuoi

## 9) Cac metric nen bao cao

### Accuracy metrics

- Precision@10
- Recall@20
- NDCG@10

### Beyond-accuracy metrics

- Catalog Coverage@10 — bao nhieu % san pham trong catalog duoc recommend it nhat 1 lan
- Novelty@10 — muc do moi la cua recommendation (mean(-log2(popularity)))

### So sanh voi baseline:

- Most popular
- LightFM hybrid (model chinh)

## 10) Cau truc project Python (trong folder recommendation-service)

- requirements.txt
- config.py
- main.py (entry point → api.main.run_server)
- data/
  - data_pipeline.py — extract views/orders/wishlist tu MySQL
  - feature_engineering.py — item features + co-view + price buckets
- models/
  - lightfm_model.py — LightFM hybrid model (main)
  - fallback.py — Cold-start fallback (popular/trending/by-gender)
  - saved/ — model artifacts output
- training/
  - train.py — full pipeline: LightFM + fallback + evaluate
  - evaluate.py — precision/recall/NDCG + coverage + novelty
- api/
  - main.py — FastAPI endpoints
  - schemas.py — Pydantic request/response models
  - dependencies.py — artifact loading + reload
- notebooks/

## 11) LightFM default hyperparameters (starting point)

- no_components: 64
- loss: warp
- learning_rate: 0.05
- epochs: 30
- num_threads: 4
- item_alpha: 1e-6
- user_alpha: 1e-6

## 12) Model artifact format (models/saved/)

### LightFM artifacts

- lightfm_model.joblib — LightFM model object
- dataset.pkl — LightFM Dataset (dung lai khi build feature)
- item_features.joblib — sparse matrix item features
- interactions.joblib — training interactions matrix (dung de filter items da tuong tac)
- user_id_map.json → {"uuid-string": int_index}
- item_id_map.json → {"uuid-string": int_index}

### Fallback artifact

- fallback.json — popular/trending/by-gender item lists

### Evaluation

- metrics.json — precision/recall/NDCG/coverage/novelty cho popular baseline va LightFM

## 13) Vi du data mau (dung de test pipeline)

product_view_log:

```json
{
  "user_id": "a1b2c3d4-0000-0000-0000-000000000001",
  "product_id": "f1e2d3c4-0000-0000-0000-000000000099",
  "view_type": "DETAIL_VIEW",
  "duration_seconds": 130,
  "created_at": "2025-03-01 10:23:45"
}
```

order_items:

```json
{
  "order_id": "ord-0000-0001",
  "product_id": "f1e2d3c4-0000-0000-0000-000000000099",
  "quantity": 2,
  "unit_price": 350000.0
}
```

## 14) Quy tac an toan khi AI sinh code trong repo nay

1. Khong sua migration da chay tren DB (V1_xx cu).
2. Neu can doi schema, tao migration moi tang version.
3. Khong phu thuoc vao target/classes khi doc migration; luon lay src/main/resources/db/migration la source of truth.
4. Python service phai dung UUID string cho user_id/product_id de khop BE.
5. Neu Python service down, BE phai co fallback ve rule-based ranking.

## 15) Lenh chay thuong dung

Java BE:

- Build Java: mvn -DskipTests compile
- Run Java: mvn spring-boot:run
- Flyway info (plugin):
  - mvn flyway:info '-Dflyway.url=jdbc:mysql://localhost:3306/test' '-Dflyway.user=root' '-Dflyway.password=\*\*\*'

Python Recommendation Service:

- Extract data: python -m data.data_pipeline
- Train model (full pipeline): python -m training.train
- Run API server: python main.py
- Reload model (API dang chay): curl -X POST http://localhost:8000/admin/reload
