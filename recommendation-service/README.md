# Recommendation Service (Python)

Dịch vụ Python dùng để huấn luyện và chấm điểm gợi ý sản phẩm, đồng bộ với các hợp đồng backend trong `AI_CONTEXT.md`.

## Yêu cầu trước khi cài đặt

- Python 3.11.
- WSL trên Windows nếu bạn chạy dự án từ ổ `D:`.
- MySQL đang chạy và có thể truy cập từ WSL.
- Có file `.env` ở thư mục gốc của dự án.

## 1. Tạo và kích hoạt môi trường ảo

Hãy dùng môi trường ảo WSL nằm ngoài ổ Windows được mount. Vị trí được khuyên dùng là:

```bash
python3.11 -m venv ~/.venvs/recommendation-service311
source ~/.venvs/recommendation-service311/bin/activate
```

Nếu môi trường đã tồn tại, chỉ cần kích hoạt lại:

```bash
source ~/.venvs/recommendation-service311/bin/activate
```

## 2. Cài đặt thư viện phụ thuộc

```bash
pip install -r requirements.txt
```

Nếu `pip` báo lỗi gói sau một lần cài bị hỏng trước đó, hãy tạo lại môi trường ảo thay vì cài đè lên môi trường cũ.

## 3. Cấu hình biến môi trường

Sao chép `.env.example` thành `.env` rồi cập nhật URL database:

```bash
cp .env.example .env
```

Sau đó đặt `MYSQL_URL` trỏ tới MySQL mà WSL có thể kết nối. Với repo này, giá trị thường là IP của máy trong mạng nội bộ, không phải `localhost`.

Các cấu hình `.env` quan trọng:

- `MYSQL_URL`: chuỗi kết nối MySQL.
- `VIEW_LOOKBACK_DAYS`: số ngày dùng khi lấy dữ liệu view.
- `ORDER_LOOKBACK_DAYS`: số ngày dùng khi lấy dữ liệu order.
- `LIGHTFM_NUM_THREADS`: số luồng CPU dùng cho LightFM.

## 4. Trích xuất dữ liệu tương tác

Chạy pipeline sau khi database đã truy cập được:

```bash
python -m data.data_pipeline
```

Lệnh này đọc dữ liệu tương tác từ MySQL và ghi kết quả ra `data/interactions.csv`.

## 5. Huấn luyện và xuất mô hình

Sau khi có `data/interactions.csv`, chạy huấn luyện và xuất artifact:

```bash
python -m training.train
```

Các file được lưu trong `models/saved/`:

- `lightfm_model.joblib`
- `dataset.pkl`
- `item_features.joblib`
- `user_id_map.json`
- `item_id_map.json`
- `metrics.json`

## 6. Chạy API

Khởi động ứng dụng FastAPI bằng Uvicorn:

```bash
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

## 7. Quy trình sử dụng khuyến nghị

Thứ tự thường dùng là:

1. Kích hoạt môi trường ảo WSL.
2. Cài đặt thư viện phụ thuộc.
3. Cấu hình `.env`.
4. Chạy `python -m data.data_pipeline`.
5. Chạy `python -m training.train`.
6. Khởi động API bằng `uvicorn`.

## 8. Khắc phục lỗi thường gặp

- Nếu gặp lỗi import `pandas` hoặc `pydantic`, đừng dùng venv tạo trên ổ Windows được mount. Hãy tạo lại môi trường trong `~/.venvs` trên WSL.
- Nếu MySQL không truy cập được từ WSL, hãy kiểm tra IP trong `MYSQL_URL` và đảm bảo database cho phép kết nối từ mạng WSL.
- Nếu pipeline không trả về dòng nào, hãy kiểm tra dữ liệu nguồn có hoạt động view/order/wishlist trong khoảng lookback đã cấu hình hay không.

### POST /score

Yêu cầu:

```json
{
  "user_id": "a1b2c3d4-0000-0000-0000-000000000001",
  "candidate_product_ids": [
    "f1e2d3c4-0000-0000-0000-000000000099",
    "f1e2d3c4-0000-0000-0000-000000000100"
  ]
}
```

Phản hồi:

```json
{
  "scores": [
    { "product_id": "f1e2d3c4-0000-0000-0000-000000000099", "score": 0.92 },
    { "product_id": "f1e2d3c4-0000-0000-0000-000000000100", "score": 0.71 }
  ]
}
```
