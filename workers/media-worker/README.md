# Cloudflare Media Worker & R2 Storage

Service Cloudflare Worker chiu trach nhiem tiep nhan, xac thuc, luu tru va phuc vu anh san pham (WebP) su dung Cloudflare R2 Bucket.

---

## 1. Tong quan kien truc
- **Runtime:** Cloudflare Workers (V8 isolates).
- **Storage:** Cloudflare R2 Bucket (`cloudstock-product-media`), binding: `PRODUCT_MEDIA_BUCKET`.
- **Dinh dang anh cho phep:** Chi ho tro `image/webp`.
- **Gioi han dung luong:** Toi da 2MB cho moi tep tin anh san pham da nen.
- **Cache Strategy:** Phuc vu GET `/media/*` voi tieu de `Cache-Control: public, max-age=31536000, immutable` va ETag.

---

## 2. Danh sach Endpoints

### 2.1. `GET /health`
Kiem tra trang thai hoat dong va binding R2 bucket cua worker.
- Response 200:
```json
{
  "status": "ok",
  "service": "cc-media-worker",
  "bucket_bound": true,
  "timestamp": 1773668100000
}
```

### 2.2. `POST /upload`
Tai len anh san pham WebP len R2 Storage.
- Headers bat buoc:
  - `Content-Type: image/webp`
  - `Authorization: Bearer <UPLOAD_SECRET>` (neu `UPLOAD_SECRET` duoc cau hinh)
- Payload: Binary WebP (toi da 2MB).
- Response 201:
```json
{
  "success": true,
  "key": "products/1773668100000_a1b2c3d4.webp",
  "url": "https://media.cloudstock.app/products/1773668100000_a1b2c3d4.webp",
  "size": 145020
}
```
- Ma loi:
  - `400 Bad Request`: Payload rong hoac loi phan tich.
  - `401 Unauthorized`: Sai hoac thieu secret token.
  - `413 Payload Too Large`: Payload vuot qua 2MB.
  - `415 Unsupported Media Type`: Content-Type khong phai `image/webp`.

### 2.3. `GET /media/*`
Lay va cache anh tu R2 Bucket.
- URL vi du: `/media/products/1773668100000_a1b2c3d4.webp`
- Response 200: Binary image kem theo tieu de:
  - `Content-Type: image/webp`
  - `Cache-Control: public, max-age=31536000, immutable`
  - `ETag: "..."`
- Ma loi:
  - `400 Bad Request`: Khoa tep tin khong hop le hoac co chua dau `..`.
  - `404 Not Found`: Tep tin khong ton tai trong R2.

---

## 3. Scripts va Kiem thu

Chay cac lenh tu thu muc `workers/media-worker`:
- Kiem tra kieu du lieu: `npm run type-check`
- Chay bo kiem thu unit tests: `npm test`
- Khoi chay worker o che do development: `npm run dev`
- Trien khai len Cloudflare: `npm run deploy`
