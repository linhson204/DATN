# Hệ gợi ý thương mại điện tử trong website bán quần áo và phụ kiện
# Hướng dẫn Cài đặt & Chạy Dự án

Dự án gồm **3 thành phần** chạy song song:

| Thành phần | Công nghệ | Cổng mặc định |
|---|---|---|
| **BE** – Backend API | Spring Boot 3.5 / Java 21 / MySQL | `8081` |
| **FE** – Frontend | React 19 + TypeScript + Vite | `5173` |
| **recommendation-service** – AI gợi ý sản phẩm | Python 3.11 / FastAPI / LightFM | `8000` |

---

## Yêu cầu hệ thống

| Công cụ | Phiên bản tối thiểu | Ghi chú |
|---|---|---|
| Java JDK | 21 | Cần `JAVA_HOME` |
| Maven | 3.9+ | Đi kèm `mvnw` trong thư mục `BE/` |
| Node.js | 18+ | Kèm npm |
| Python | 3.11 | Dùng trong WSL nếu chạy trên Windows |
| MySQL | 8.0+ | Cần tạo database trước |
| WSL (Windows) | 2 | Bắt buộc cho recommendation-service |

---

## Tổng quan kiến trúc

```
FE (Vite :5173)
      │  REST/HTTP
      ▼
BE (Spring Boot :8081)
      │  HTTP (nội bộ)
      ▼
recommendation-service (FastAPI :8000)
      │  MySQL
      ▼
MySQL Database (:3306)
```

---

## 1. Cài đặt & Cấu hình Database (MySQL)

### 1.1 Tạo database

Đăng nhập MySQL và chạy:

```sql
CREATE DATABASE test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

> **Lưu ý:** Tên database mặc định là `test` (xem `application.properties`). Bạn có thể đổi tên nhưng phải cập nhật file cấu hình tương ứng.

### 1.2 Cấp quyền user

```sql
CREATE USER 'root'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON test.* TO 'root'@'localhost';
FLUSH PRIVILEGES;
```

### 1.3 Migration tự động (Flyway)

Backend sử dụng **Flyway** để tự động tạo bảng và nạp dữ liệu mẫu khi khởi động. Các migration nằm tại:

```
BE/src/main/resources/db/migration/
├── V1_01__create_user_role_table.sql
├── V1_02__create_users_table.sql
├── ...
├── V1_13__add_data_product.sql        (~5 MB dữ liệu sản phẩm)
├── V1_14__add_data_product_view_log.sql (~19 MB log xem)
├── V1_15__add_data_wishlist.sql
├── V1_16__add_data_order.sql
└── V1_17__add_data_review_prrduct.sql
```

> ⚠️ Lần đầu khởi động có thể **mất vài phút** do Flyway nạp lượng dữ liệu lớn (~40 MB SQL).

---

## 2. Backend (Spring Boot)

### 2.1 Cấu hình

Mở file [`BE/src/main/resources/application.properties`](BE/src/main/resources/application.properties) và chỉnh các thông số sau:

```properties
# Cổng server
server.port=8081

# Kết nối MySQL
spring.datasource.url=jdbc:mysql://localhost:3306/test?useUnicode=true&characterEncoding=UTF-8&useSSL=false
spring.datasource.username=root
spring.datasource.password=YOUR_MYSQL_PASSWORD

# JWT Secret (có thể giữ nguyên hoặc thay bằng chuỗi hex 64 ký tự khác)
jwt.secret=efd8ead261474a1aed160bf6015d2e5b32c4764ddd7a5cc5c0e864e904f7a951

# Mail SMTP (Gmail App Password)
spring.mail.username=your_email@gmail.com
spring.mail.password=your_app_password

# Google OAuth2
spring.security.oauth2.client.registration.google.client-id=YOUR_GOOGLE_CLIENT_ID
spring.security.oauth2.client.registration.google.client-secret=YOUR_GOOGLE_CLIENT_SECRET

# Địa chỉ Python Recommendation Service
python.service.url=http://localhost:8000
```

### 2.2 Chạy Backend

```powershell
# Trong thư mục BE/
cd BE

# Chạy với Maven Wrapper (Windows)
.\mvnw.cmd spring-boot:run

# Hoặc build trước rồi chạy JAR
.\mvnw.cmd clean package -DskipTests
java -jar target\demo-0.0.1-SNAPSHOT.jar
```

Backend sẽ khởi động tại: **http://localhost:8081**

### 2.3 Kiểm tra hoạt động

```powershell
curl http://localhost:8081/v1/products
```

---

## 3. Frontend (React + Vite)

### 3.1 Cấu hình biến môi trường

```powershell
cd FE
copy .env.example .env
```

Nội dung file `.env`:

```env
VITE_BE_BASE_URL=http://localhost:8081
VITE_REC_BASE_URL=http://localhost:8000
```

### 3.2 Cài đặt thư viện

```powershell
cd FE
npm install
```

### 3.3 Chạy Frontend (Development)

```powershell
npm run dev
```

Frontend sẽ chạy tại: **http://localhost:5173**

### 3.4 Build Production (tuỳ chọn)

```powershell
npm run build
npm run preview
```

---

## 4. Recommendation Service (Python / WSL)

> ⚠️ **Bắt buộc dùng WSL trên Windows.** Không tạo venv trên ổ `D:` vì sẽ gây lỗi import `pandas`, `pydantic`.

### 4.1 Mở WSL và điều hướng tới dự án

```bash
wsl
cd /mnt/d/DATN/recommendation-service
```

### 4.2 Tạo môi trường ảo Python (lần đầu)

```bash
python3.11 -m venv ~/.venvs/recommendation-service311
source ~/.venvs/recommendation-service311/bin/activate
```

> Những lần sau chỉ cần kích hoạt lại:
> ```bash
> source ~/.venvs/recommendation-service311/bin/activate
> ```

### 4.3 Cài đặt thư viện

```bash
pip install -r requirements.txt
```

Các thư viện chính:
- `fastapi`, `uvicorn` – API server
- `lightfm` – Thuật toán gợi ý sản phẩm
- `pandas`, `numpy`, `scikit-learn` – Xử lý dữ liệu
- `SQLAlchemy`, `PyMySQL` – Kết nối MySQL
- `pydantic`, `python-dotenv` – Cấu hình

### 4.4 Cấu hình biến môi trường

```bash
cp .env.example .env
nano .env   # hoặc dùng editor bất kỳ
```

Nội dung cần điền:

```env
# IP của máy Windows (không phải localhost vì chạy trong WSL)
MYSQL_URL=mysql+pymysql://root:YOUR_PASSWORD@192.168.x.x:3306/test

VIEW_LOOKBACK_DAYS=90
ORDER_LOOKBACK_DAYS=180
LIGHTFM_NUM_THREADS=4
```

> **Tìm IP máy Windows từ WSL:**
> ```bash
> cat /etc/resolv.conf | grep nameserver
> ```
> Hoặc trong PowerShell: `ipconfig` → lấy IPv4 của adapter WSL.

### 4.5 Trích xuất dữ liệu tương tác

```bash
python -m data.data_pipeline
```

Kết quả ghi ra `data/interactions.csv`.

### 4.6 Huấn luyện mô hình

```bash
python -m training.train
```

Các file mô hình được lưu tại `models/saved/`:

```
models/saved/
├── lightfm_model.joblib
├── dataset.pkl
├── item_features.joblib
├── user_id_map.json
├── item_id_map.json
└── metrics.json
```

### 4.7 Chạy API

```bash
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

API sẽ chạy tại: **http://localhost:8000**

Tài liệu API tự động: **http://localhost:8000/docs**

---

## 5. Thứ tự khởi động đúng

Để dự án hoạt động đầy đủ, hãy khởi động theo thứ tự:

```
1. MySQL           → đảm bảo database đang chạy
2. Backend (BE)    → Flyway chạy migration, Spring Boot khởi động
3. Rec Service     → train model nếu chưa có, rồi uvicorn
4. Frontend (FE)   → npm run dev
```

---

## 6. Thông tin cổng & URL

| Dịch vụ | URL | Ghi chú |
|---|---|---|
| Frontend | http://localhost:5173 | React UI |
| Backend API | http://localhost:8081 | Spring Boot REST |
| Recommendation API | http://localhost:8000 | FastAPI |
| Recommendation Docs | http://localhost:8000/docs | Swagger UI tự động |
| MySQL | localhost:3306 | Database |

---

## 7. Thanh toán & Dịch vụ ngoài (Tuỳ chọn)

Dự án tích hợp sẵn các cổng thanh toán ở chế độ **sandbox** (test):

### ZaloPay

```properties
zalopay.enabled=true
zalopay.app-id=2553
zalopay.key1=...
zalopay.key2=...
# Cần ngrok để nhận callback:
zalopay.callback-url=https://YOUR_NGROK_URL/v1/payments/zalopay/callback
```

### MoMo

```properties
momo.enabled=true
momo.partner-code=MOMOBKUN20180529
# Cần ngrok để nhận callback:
momo.callback-url=https://YOUR_NGROK_URL/v1/payments/momo/callback
```

> **Dùng ngrok để nhận callback thanh toán:**
> ```powershell
> ngrok http 8081
> ```
> Sau đó dán URL ngrok vào `zalopay.callback-url` và `momo.callback-url` trong `application.properties`.

### Google OAuth2

1. Tạo OAuth2 Client tại [Google Cloud Console](https://console.cloud.google.com/)
2. Thêm `http://localhost:8081/login/oauth2/code/google` vào Authorized Redirect URIs
3. Cập nhật `client-id` và `client-secret` trong `application.properties`

### Goong Maps API

```properties
goong.api.key=YOUR_GOONG_API_KEY
```

Đăng ký tại [goong.io](https://goong.io/).

---

## 8. Khắc phục lỗi thường gặp

### Backend

| Lỗi | Nguyên nhân | Cách xử lý |
|---|---|---|
| `Access denied for user 'root'` | Sai mật khẩu MySQL | Kiểm tra `spring.datasource.password` |
| `Flyway migration failed` | Schema không khớp | Chạy `DROP DATABASE test; CREATE DATABASE test;` rồi restart |
| Port 8081 already in use | Tiến trình khác đang dùng | `netstat -ano \| findstr :8081` rồi kill process |

### Frontend

| Lỗi | Nguyên nhân | Cách xử lý |
|---|---|---|
| `CORS error` | Backend chưa bật CORS cho port 5173 | Kiểm tra cấu hình CORS trong BE |
| `Cannot find module` | Chưa chạy `npm install` | Chạy lại `npm install` |
| Blank page | `.env` chưa cấu hình | Kiểm tra file `.env` trong `FE/` |

### Recommendation Service

| Lỗi | Nguyên nhân | Cách xử lý |
|---|---|---|
| `ImportError: pandas` | Venv tạo trên ổ Windows | Tạo lại venv trong `~/.venvs` trên WSL |
| `MySQL not accessible` | Dùng `localhost` thay vì IP máy Windows | Dùng IP thật của host Windows trong `MYSQL_URL` |
| `No rows returned from pipeline` | Không có dữ liệu trong lookback window | Giảm `VIEW_LOOKBACK_DAYS` hoặc kiểm tra data |
| `model not found` | Chưa train | Chạy `python -m training.train` |

---

## 9. Cấu trúc thư mục dự án

```
DATN/
├── BE/                          # Backend Spring Boot
│   ├── src/main/java/           # Java source code
│   ├── src/main/resources/
│   │   ├── application.properties  # Cấu hình chính
│   │   └── db/migration/        # Flyway SQL migrations (V1_01 → V1_17)
│   └── pom.xml                  # Maven dependencies
│
├── FE/                          # Frontend React + Vite
│   ├── src/                     # TypeScript/React source
│   ├── .env.example             # Template biến môi trường
│   └── package.json
│
├── recommendation-service/      # AI Recommendation (Python)
│   ├── api/                     # FastAPI endpoints
│   ├── data/                    # Data pipeline
│   ├── training/                # LightFM training scripts
│   ├── models/saved/            # Trained model artifacts
│   ├── .env.example             # Template biến môi trường
│   └── requirements.txt
│
└── Data/                        # Scripts tạo dữ liệu mẫu
    ├── generate_*.py            # Script sinh dữ liệu
    └── import_*.sql             # SQL import sẵn
```
