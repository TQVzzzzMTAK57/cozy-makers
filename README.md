# SeaDrone – AI Drowning Detection

Hệ thống phát hiện đuối nước từ ảnh/video drone bằng YOLO. Người dùng quản lý drone, tải ảnh/video lên, xem kết quả nhận diện (kèm toạ độ GPS nếu ảnh có EXIF) và nhận cảnh báo khi phát hiện đối tượng nguy hiểm. Có thể so sánh hai model YOLO11 và YOLO26 trên cùng một file.

## Kiến trúc

| Thành phần | Công nghệ | Thư mục |
|---|---|---|
| Frontend | React + Vite + TypeScript + shadcn/ui + Tailwind | `src/` |
| Backend API | Node.js + Express + PostgreSQL (`pg`) | `server/` |
| Nhận diện | Python + Ultralytics YOLO + OpenCV (+ PyAV để xuất H.264) | `detect/detect.py` |

Backend gọi `detect/detect.py` cho mỗi lần upload, lưu kết quả vào PostgreSQL và file vào `server/uploads/`.

## Yêu cầu

- Node.js 18+ và npm
- PostgreSQL 12+
- Python 3.9+ với các gói: `ultralytics opencv-python pillow av`
- File model đặt trong `detect/` (không commit vào git):
  - `best4.pt` – YOLO11
  - `best_yolo26.pt` – YOLO26

## Cài đặt

```bash
# 1. Frontend
npm install

# 2. Backend
cd server
npm install
cp .env.example .env      # Windows: copy .env.example .env
```

Sửa `server/.env`:

- `PG_*`: thông tin kết nối PostgreSQL (tạo sẵn database `seadrone`).
- `JWT_SECRET`: **bắt buộc**, chuỗi ngẫu nhiên dài. Tạo bằng:
  `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
- `ADMIN_PASSWORD` (tuỳ chọn): mật khẩu cho tài khoản `admin` được tạo lần đầu. Nếu bỏ trống, server tạo mật khẩu ngẫu nhiên và in ra log **một lần duy nhất**.

Bảng dữ liệu được tạo tự động khi backend khởi động. File `server/seadrone_postgres.sql` chỉ dùng khi muốn tạo schema thủ công (vd. xem ERD trong pgAdmin).

```bash
# 3. Python
pip install ultralytics opencv-python pillow av
```

## Chạy

**Windows:** `./start.ps1` (dừng bằng `./stop.ps1`).

**Thủ công:**

```bash
cd server && npm start     # API: http://localhost:3001
npm run dev                # Web: http://localhost:5173
```

Quên mật khẩu hoặc cần mở khoá tài khoản:

```bash
cd server
npm run set-password -- admin              # tạo mật khẩu ngẫu nhiên
npm run set-password -- admin MatKhauMoi   # đặt mật khẩu cụ thể
```

## Biến môi trường tuỳ chọn

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `PORT` | `3001` | Cổng backend |
| `PYTHON_BIN` | `python` (Windows) / `python3` | Lệnh Python chạy `detect.py` |
| `DETECT_TIMEOUT_MS` | `1800000` (30 phút) | Thời gian tối đa cho một lần nhận diện |
| `ALERT_LABELS` | `drowning,drown,person_distress,swimmer,person` | Nhãn sinh cảnh báo |
| `ALERT_MIN_CONFIDENCE` | `0.60` | Độ tin cậy tối thiểu để sinh cảnh báo |
| `DEMO_USER_PASSWORD` | – | Nếu đặt, tạo thêm tài khoản demo `user1` khi DB trống |
| `VITE_BACKEND_URL` (frontend) | `http://localhost:3001` | Địa chỉ backend để tải video trực tiếp |

## Bảo mật

- File trong `/uploads` chỉ chủ sở hữu prediction (hoặc admin) xem được. Frontend gắn token vào URL ảnh/video (`?token=`) vì thẻ `<img>`/`<video>` không gửi được header.
- Khoá tài khoản hoặc đổi quyền có hiệu lực ngay, không cần chờ token hết hạn.
- Server từ chối khởi động nếu thiếu `JWT_SECRET`.

## Kiểm tra

```bash
npm run lint
npm test
npm run build
```
