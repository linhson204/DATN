# Recommendation Service (Python)

Python service for recommendation training and scoring, aligned with backend contracts in `AI_CONTEXT.md`.

## 1. Setup

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Create `.env` from `.env.example` and update `MYSQL_URL`.

## 2. Extract interactions

```bash
python -m data.data_pipeline
```

Optional wishlist signal:

```bash
python -m data.data_pipeline --include-wishlist
```

## 3. Train and export artifact

```bash
python -m training.train
```

Artifacts are saved under `models/saved/`:

- `lightfm_model.joblib`
- `dataset.pkl`
- `item_features.joblib`
- `user_id_map.json`
- `item_id_map.json`
- `metrics.json`

## 4. Run API

```bash
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

### POST /score

Request:

```json
{
  "user_id": "a1b2c3d4-0000-0000-0000-000000000001",
  "candidate_product_ids": [
    "f1e2d3c4-0000-0000-0000-000000000099",
    "f1e2d3c4-0000-0000-0000-000000000100"
  ]
}
```

Response:

```json
{
  "scores": [
    {"product_id": "f1e2d3c4-0000-0000-0000-000000000099", "score": 0.92},
    {"product_id": "f1e2d3c4-0000-0000-0000-000000000100", "score": 0.71}
  ]
}
```