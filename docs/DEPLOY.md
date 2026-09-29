# DEPLOY - server công ty (Docker Compose)

Tài liệu này thay thế hoàn toàn bản cũ (Supabase + Vercel).
Cách deploy đã chốt: Docker Compose trên 1 server Ubuntu do công ty cấp, không dùng Supabase, không dùng Vercel.
Nguồn thông tin: `D:\_project\DDC_dieu-phoi\deploy-chuan-bi-lam-viec-voi-IT.md` (các ràng buộc R1-R14), `docs/csp-header-bao-mat.md` (header bảo mật, CSP Report-Only).

---

## 1. Tổng quan

Sơ đồ luồng request:

```
Người dùng --HTTPS (443)--> Nginx --http://127.0.0.1:<APP_PORT>--> container "app" (Next.js)
                                                                    |
                                                                    v
                                                            container "db" (PostgreSQL 16)
                                                                    |
                                                              volume "pgdata"

Thư mục backup (pg_dump hằng ngày) nằm trên ổ dữ liệu của server, ngoài các container.
```

Quy ước cổng dùng xuyên suốt tài liệu này: `<APP_PORT>` là cổng TRÊN HOST mà Docker publish ra `127.0.0.1` cho service `app` (biến `APP_PORT` trong `.env.docker`, mặc định `3005` theo `.env.docker.example`).
Mọi lệnh Nginx/`curl` chạy trên host ở tài liệu này đều nhắm vào `127.0.0.1:<APP_PORT>` - thay bằng đúng con số bạn đặt (giữ mặc định thì gõ `3005`).
Bên trong container, Next.js luôn tự nghe cổng nội bộ cố định `3000` (không đổi, không liên quan `APP_PORT`) - đây là con số duy nhất còn xuất hiện trong `docker-compose.yml`.
**Không bao giờ bỏ tiền tố `127.0.0.1:` trong mục `ports` của `docker-compose.yml`**: bỏ đi nghĩa là bind ra `0.0.0.0`, lộ cổng app ra ngoài mạng, vượt qua cả `ufw`.

R1 (`deploy-chuan-bi-lam-viec-voi-IT.md` mục 4): chỉ chạy **1 bản app duy nhất** trên 1 máy.
Không đặt sau load balancer, không chạy nhiều container `app` cùng lúc.
App vẫn giữ một số trạng thái trong bộ nhớ tiến trình (bộ đếm giới hạn đăng nhập, giới hạn tần suất) nên chạy nhiều bản sẽ làm các giới hạn đó sai lệch.

Hệ thống KHÔNG còn tính năng ảnh hiện trường: không còn thư mục `data/uploads`, không còn bảng ảnh nào được dùng, không còn volume upload trong Docker Compose.
Hệ thống KHÔNG còn gọi Vietcombank lấy tỷ giá: tỷ giá chỉ nhập tay ở trang Quản trị.
Vì vậy server không cần mở đường ra `vietcombank.com.vn` (khác với bản cũ của `deploy-chuan-bi-lam-viec-voi-IT.md` mục 4 R4, xem mục 2 dưới đây).

---

## 2. Chuẩn bị server

1. Hệ điều hành: Ubuntu Server 24.04 LTS.
2. Đặt múi giờ Việt Nam và bật đồng bộ giờ tự động:
   ```bash
   sudo timedatectl set-timezone Asia/Ho_Chi_Minh
   timedatectl status   # kiểm "NTP service: active"
   ```
3. Thêm swap 4 GB (đề phòng máy ít RAM lúc build ảnh Docker):
   ```bash
   sudo fallocate -l 4G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
   ```
4. Tường lửa theo R9 (`deploy-chuan-bi-lam-viec-voi-IT.md` mục 4): chỉ mở cổng 443 và 80 (chuyển hướng sang 443); cổng 22 chỉ cho phép từ IP/VPN của IT; **không mở cổng 5432 (database) và `<APP_PORT>` (app)** ra ngoài.
   ```bash
   sudo ufw default deny incoming
   sudo ufw allow OpenSSH        # hoặc giới hạn theo IP của IT
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw enable
   ```
5. Cài Docker Engine + Docker Compose plugin theo kho chính thức của Docker cho Ubuntu (không dùng gói `docker.io` của Ubuntu, bản đó cũ hơn):
   ```bash
   curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
   echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list
   sudo apt-get update
   sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
   docker compose version
   ```
6. Kiểm mạng ra ngoài theo R4 (`deploy-chuan-bi-lam-viec-voi-IT.md` mục 4), đã **bỏ `vietcombank.com.vn`** so với bản cũ (không còn tính năng lấy tỷ giá tự động): server cần gọi được `registry.npmjs.org`, `github.com`, `binaries.prisma.sh`, `fonts.googleapis.com`, `fonts.gstatic.com`, máy chủ SMTP gửi email cảnh báo.
   Nếu mạng công ty soi SSL (chặn bằng chứng chỉ tự ký), xin IT cấp chứng chỉ CA gốc của công ty hoặc bỏ soi SSL cho server này.

---

## 3. Lấy code

```bash
sudo mkdir -p /opt/ddc-control-tower
sudo chown "$USER":"$USER" /opt/ddc-control-tower
git clone <URL-repo-git> /opt/ddc-control-tower
cd /opt/ddc-control-tower
git checkout <tag-hoac-commit-phat-hanh>
```

Dùng tag hoặc commit hash cụ thể khi phát hành, không deploy thẳng nhánh `main` đang chạy (để biết chính xác bản nào đang chạy, xem mục 12).

---

## 4. Biến môi trường

Copy file mẫu rồi điền giá trị thật:

```bash
cp .env.docker.example .env.docker
chmod 600 .env.docker
```

Bảng đầy đủ mọi biến của `.env.docker.example`:

| Biến | Bắt buộc? | Cách sinh / ví dụ |
|---|---|---|
| `POSTGRES_PASSWORD` | Bắt buộc | `openssl rand -hex 24` (chỉ chữ và số, mật khẩu nằm trong URL kết nối) |
| `PG_MAJOR` | Tuỳ chọn (mặc định `16`) | Giữ `16` trừ khi đã kiểm bản khác |
| `APP_PORT` | Tuỳ chọn (mặc định `3005`) | Server chỉ dùng nội bộ (Nginx gọi `127.0.0.1:<APP_PORT>`, xem quy ước ở mục 1), đổi nếu cổng đó đã có người dùng |
| `APP_IMAGE_TAG` | Tuỳ chọn (mặc định `local`) | Đặt bằng `git rev-parse --short HEAD` khi build cho production (mục 5, 12) |
| `NEXTAUTH_URL` | Bắt buộc | Production: `https://<ten-mien>`, không có đường dẫn phía sau |
| `NEXTAUTH_SECRET` | Bắt buộc | `openssl rand -base64 32` (tối thiểu 32 ký tự) |
| `NOTIFY_SECRET_KEY` | Bắt buộc | `openssl rand -base64 32` (đúng 32 byte sau khi giải base64 - dùng mã hoá webhook/mật khẩu SMTP đã lưu) |
| `CRON_SECRET` | Bắt buộc | `openssl rand -base64 32` (tối thiểu 32 ký tự - cron gọi `/api/cron/alerts_daily`) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Tuỳ chọn (điền đủ cả hai hoặc để trống cả hai) | Xem mục 8 |
| `TRUSTED_PROXY_HOPS` | Tuỳ chọn (mặc định `1`) | Số tầng reverse proxy tin cậy phía trước app - 1 Nginx trực tiếp thì để `1` |
| `EXTRA_CA_FILE` | Tuỳ chọn (mặc định file rỗng) | Chỉ cần trên máy dev bị soi SSL; **để trống trên server thật** |
| `BACKUP_DIR` | Tuỳ chọn (mặc định `./.backups`) | Trỏ sang ổ dữ liệu bền, không phải ổ hệ điều hành (mục 11) |
| `BACKUP_KEEP_DAYS` | Tuỳ chọn (mặc định `14`) | Tối thiểu 14 ngày (R3) |

App tự kiểm 6 biến bắt buộc lúc khởi động (`instrumentation.ts` + `src/lib/env-check.ts`): `DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `NOTIFY_SECRET_KEY`, `CRON_SECRET`.
Hai biến `DATABASE_URL`/`DIRECT_URL` do `docker-compose.yml` tự ráp từ `POSTGRES_PASSWORD`, không cần điền tay.
Thiếu hoặc sai bất kỳ biến nào trong 6 biến đó, ở môi trường production app **DỪNG KHI KHỞI ĐỘNG NGAY**, ghi 1 dòng log JSON `event: "env.invalid"` liệt kê tên biến và lý do (không bao giờ in giá trị).

Cất bản sao an toàn 4 khoá `POSTGRES_PASSWORD`, `NEXTAUTH_SECRET`, `NOTIFY_SECRET_KEY`, `CRON_SECRET` ở nơi khác ngoài server (R13): mất `NOTIFY_SECRET_KEY` thì không giải mã lại được webhook/mật khẩu SMTP đã lưu trong database, phải cấu hình lại từ đầu.

---

## 5. Build, migrate, chạy

```bash
cd /opt/ddc-control-tower
APP_IMAGE_TAG=$(git rev-parse --short HEAD) docker compose --env-file .env.docker up -d --build
```

Migrate chạy tự động qua service `migrate` (thoát mã 0 rồi mới cho service `app` khởi động, theo `depends_on: service_completed_successfully`).
Kiểm trạng thái:

```bash
docker compose ps                     # "migrate" Exited (0), "app" phải chuyển sang "healthy" trong khoảng 2 phút
curl http://127.0.0.1:<APP_PORT>/api/health/db   # {"status":"ok","db":"ok"}
```

---

## 6. Nginx + HTTPS

Ví dụ server block đầy đủ (thay `<ten-mien>` bằng tên miền thật, ví dụ `controltower.daidung.vn`; thay `<APP_PORT>` bằng giá trị `APP_PORT` thật trong `.env.docker`, mặc định `3005`, xem quy ước cổng ở mục 1; thay đường dẫn chứng chỉ theo IT cấp hoặc certbot):

```nginx
limit_req_zone $binary_remote_addr zone=csp_report:10m rate=5r/s;
limit_req_zone $binary_remote_addr zone=quen_mat_khau:10m rate=1r/s;

server {
    listen 80;
    server_name <ten-mien>;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name <ten-mien>;

    ssl_certificate     /etc/ssl/certs/<ten-mien>.crt;
    ssl_certificate_key /etc/ssl/private/<ten-mien>.key;

    client_max_body_size 12m;
    proxy_read_timeout 120s;

    # Không thêm hay ghi đè header CSP ở đây - app tự gắn CSP Report-Only (docs/csp-header-bao-mat.md).

    location / {
        proxy_pass http://127.0.0.1:<APP_PORT>;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        # TRUSTED_PROXY_HOPS=1: proxy PHẢI nối thêm IP khách vào CUỐI X-Forwarded-For.
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header x-middleware-subrequest "";
        add_header X-Content-Type-Options nosniff always;
        add_header Strict-Transport-Security "max-age=31536000" always;
    }

    # HTML và RSC render động theo phiên + nonce CSP - KHÔNG cache, chỉ cache file tĩnh.
    location /_next/static/ {
        proxy_pass http://127.0.0.1:<APP_PORT>;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        add_header Cache-Control "public, max-age=31536000, immutable";
        add_header X-Content-Type-Options nosniff always;
        add_header Strict-Transport-Security "max-age=31536000" always;
    }

    location /api/csp-report {
        proxy_pass http://127.0.0.1:<APP_PORT>;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        client_max_body_size 32k;
        limit_req zone=csp_report burst=10 nodelay;
        add_header X-Content-Type-Options nosniff always;
        add_header Strict-Transport-Security "max-age=31536000" always;
    }

    # Gioi han tan suat form "quen mat khau" (Server Action POST vao chinh URL trang, ca 2 ngon ngu).
    location ~ ^/(vi|en)/quen-mat-khau$ {
        proxy_pass http://127.0.0.1:<APP_PORT>;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header x-middleware-subrequest "";
        limit_req zone=quen_mat_khau burst=5 nodelay;
        add_header X-Content-Type-Options nosniff always;
        add_header Strict-Transport-Security "max-age=31536000" always;
    }

    # /api/health/db khong duoc cong khai ra Internet (chi IT giam sat + localhost) - rate limit
    # rieng cua app (per-IP truoc, toan cuc sau) chi chan lam dung, khong thay cho gioi han o day.
    location = /api/health/db {
        allow <IP giam sat IT>;
        allow 127.0.0.1;
        deny all;
        proxy_pass http://127.0.0.1:<APP_PORT>;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        add_header X-Content-Type-Options nosniff always;
        add_header Strict-Transport-Security "max-age=31536000" always;
    }
}
```

Ghi chú bắt buộc đọc (`docs/csp-header-bao-mat.md` mục 3-4):

- Nginx có "bẫy thừa kế `add_header`": một `location` có `add_header` riêng thì MỌI `add_header` ở cấp `server` bị bỏ qua hết, không cộng dồn.
  Vì vậy phải lặp lại `nosniff` và HSTS trong TỪNG `location` có `add_header`, như ví dụ trên.
- Không thêm hay ghi đè header CSP ở Nginx, app đã tự gắn CSP Report-Only kèm nonce theo từng request.
- Không cache HTML/RSC ở proxy, chỉ cache `/_next/static/`.
- Thay `<IP giam sat IT>` bằng IP/CIDR thật của máy IT dùng để giám sát `/api/health/db` (mục 15).
  Healthcheck bên trong `docker-compose.yml` gọi thẳng `http://127.0.0.1:3000` từ TRONG container `app`, không đi qua Nginx, nên không bị chặn bởi `allow`/`deny` ở đây.

Kiểm sau cùng:

```bash
curl -I https://<ten-mien>/                    # đủ nosniff, HSTS, không có X-Powered-By
curl -I https://<ten-mien>/_next/static/...    # đủ header + Cache-Control
curl -s https://<ten-mien>/api/health          # {"status":"ok", ..., "clientIpResolved": true}
```

`clientIpResolved: true` xác nhận Nginx đã nối đúng `X-Forwarded-For`; nếu `false`, kiểm lại dòng `proxy_set_header X-Forwarded-For` ở trên (R7).

---

## 7. Tài khoản admin đầu tiên

DB mới tinh chưa có tài khoản nào, nên chưa ai gọi được `createAccountAction` (yêu cầu đã đăng nhập với vai trò admin).
Dùng lệnh dòng lệnh chạy 1 lần:

```bash
docker compose --env-file .env.docker run --rm tools npm run create-admin -- <email> [ten]
```

Lệnh in ra mật khẩu tạm **ĐÚNG 1 LẦN**, chép lại ngay.
Đăng nhập bằng email + mật khẩu tạm đó, rồi **đổi mật khẩu ngay** (menu tài khoản > Đổi mật khẩu).
Gọi lại lệnh với email đã tồn tại sẽ báo lỗi và KHÔNG ghi đè tài khoản cũ.
Nếu admin duy nhất bị khoá (sai mật khẩu 5 lần), dùng lệnh ở mục 14, không chạy lại `create-admin`.
Các tài khoản còn lại (BOD, nhập liệu, xem) do chính admin tạo ở trang Quản trị sau khi đăng nhập.

**KHÔNG BAO GIỜ chạy `docker compose run --rm tools npx prisma db seed` trên production** - lệnh này xoá sạch dữ liệu thật rồi nạp dữ liệu giả, chỉ dùng ở máy dev/staging (Phụ lục A).

---

## 8. Google OAuth cho domain thật

Làm theo `docs/HUONG_DAN_GOOGLE_OAUTH.md`, tạo OAuth Client với redirect URI `https://<ten-mien>/api/auth/callback/google`.
Điền đủ cả hai biến `GOOGLE_CLIENT_ID` và `GOOGLE_CLIENT_SECRET` vào `.env.docker` (để trống cả hai thì nút Google tự ẩn, không được điền 1 trong 2 - app dừng khi khởi động nếu chỉ có 1 biến).
Admin phải thêm email của người dùng ở trang Quản trị TRƯỚC KHI người đó bấm đăng nhập Google lần đầu, email lạ sẽ bị từ chối dù xác thực Google thành công.

---

## 9. SMTP bắt buộc

Cấu hình kênh gửi email ở trang Quản trị > Thông báo.
Chức năng "quên mật khẩu" dùng kênh email hợp lệ có id nhỏ nhất, kể cả khi kênh đó đang TẮT gửi cảnh báo thường (tắt cảnh báo không tắt quên mật khẩu).
Sau khi cấu hình, thử ngay bằng chức năng quên mật khẩu với 1 tài khoản thật.
Gửi lỗi thì xem log JSON có `event: "auth_mail.send_failed"` (chỉ có `errCode`, không lộ nội dung/địa chỉ).

---

## 10. Cron

Chỉ còn đúng 1 việc quét cảnh báo tự động, giờ chạy 06:00, cộng thêm dòng backup 02:00 (mục 11):

```cron
0 2 * * * cd /opt/ddc-control-tower && docker compose --env-file .env.docker run --rm backup >> /var/log/ddc-backup.log 2>&1
0 6 * * * cd /opt/ddc-control-tower && curl -fsS -X POST -H "Authorization: Bearer $(cat /etc/ddc-control-tower/cron-secret)" https://<ten-mien>/api/cron/alerts_daily
```

Đọc `CRON_SECRET` từ 1 file quyền `600` riêng (ví dụ `/etc/ddc-control-tower/cron-secret`), không ghi thẳng bí mật vào crontab (ai `crontab -l` cũng đọc được).
Server đã đặt múi giờ `Asia/Ho_Chi_Minh` ở mục 2 nên `0 2` và `0 6` đúng là 02:00 và 06:00 giờ Việt Nam.
App vẫn tự chạy "lười" `alerts_daily` mỗi khi có người mở app cách lần chạy gần nhất trên 10 phút (`src/server/jobs.ts`, hàm `runDueJobs`) - dòng cron 06:00 chỉ để CHẮC CHẮN chạy đúng giờ kể cả khi không ai mở app buổi sáng sớm.

---

## 11. Backup và khôi phục

Lệnh backup (`scripts/backup/pg-backup.sh`) chạy tự động lúc 02:00 mỗi ngày qua dòng cron ở mục 10, và có thể chạy tay bất cứ lúc nào:

```bash
docker compose --env-file .env.docker run --rm backup
```

Mỗi lần chạy tạo 1 file `.dump` (định dạng `pg_dump --format=custom`) + 1 file `.dump.sha256`, tự xoá bản cũ hơn `BACKUP_KEEP_DAYS` (mặc định 14 ngày), có khoá chống chạy trùng.
`/var/log/ddc-backup.log` cần `logrotate` để không phình ổ đĩa, tạo file `/etc/logrotate.d/ddc-backup`:

```
/var/log/ddc-backup.log {
    weekly
    rotate 8
    compress
    missingok
}
```

`BACKUP_DIR` (trong `.env.docker`) phải trỏ sang ổ dữ liệu bền, không phải ổ hệ điều hành.

Khoá chống chạy trùng (`$BACKUP_DIR/.lock`) tự dọn khi script kết thúc bình thường (kể cả bị `docker stop`/Ctrl+C) và tự coi là "khoá cũ" (stale) nếu tồn tại quá 6 giờ liên tục - lúc đó script tự xoá khoá cũ và chạy tiếp, ghi log `backup.stale_lock_removed`.
Nếu thấy `lock_busy` LẶP LẠI nhiều ngày liên tiếp trong `/var/log/ddc-backup.log` (khác với 1 lần đơn lẻ do trùng giờ chạy tay), nghĩa là có bất thường (ví dụ tiến trình bị SIGKILL do hết RAM/OOM, khoá không đi qua được đường dọn tự động).
Gỡ khoá tay khi cần: `docker compose --env-file .env.docker run --rm --entrypoint sh backup -c 'rmdir /backups/.lock'` (chỉ làm khi chắc chắn không có tiến trình backup nào khác đang thật sự chạy).

Chép bản backup sang NAS mỗi ngày, ví dụ thêm dòng cron sau dòng backup:

```bash
rsync -a --delete-after /đường/dẫn/BACKUP_DIR/ <NAS_PATH>/
```

Thử khôi phục thật mỗi tháng bằng `scripts/backup/pg-restore-test.sh` (lý tưởng chạy trên staging, không phải production):

```bash
docker compose --env-file .env.docker run --rm backup /scripts/pg-restore-test.sh
```

Script tạo 1 database TẠM (tên có `_restore_test_`), khôi phục file backup mới nhất vào đó, kiểm số bảng + số dòng + trạng thái migration, rồi luôn xoá database tạm khi xong - KHÔNG BAO GIỜ đụng vào database thật đang chạy.

Quy trình khôi phục thật khi có sự cố (từng lệnh, làm đúng thứ tự; `<ten-file>` là tên file `.dump` muốn khôi phục, `<BACKUP_DIR>` là đúng giá trị `BACKUP_DIR` trong `.env.docker`, đường dẫn thật trên server):

```bash
set -e                                                                       # BẮT BUỘC: dừng ngay nếu 1 lệnh bất kỳ lỗi, không chạy lệnh sau
docker compose --env-file .env.docker stop app
docker compose --env-file .env.docker run --rm backup                       # backup bản hiện tại trước khi ghi đè
(cd "<BACKUP_DIR>" && sha256sum -c <ten-file>.dump.sha256)                   # BẮT BUỘC kiểm bản dump TRƯỚC khi xoá DB thật
docker compose --env-file .env.docker exec db dropdb --force -U ddc ddc_control_tower
docker compose --env-file .env.docker exec db createdb -U ddc ddc_control_tower
docker compose --env-file .env.docker run --rm --entrypoint pg_restore backup \
  --no-owner --no-privileges --exit-on-error -d ddc_control_tower /backups/<ten-file>.dump
docker compose --env-file .env.docker start app
curl -f http://127.0.0.1:<APP_PORT>/api/health/db
```

Dùng service `backup` (không phải `db`) để chạy `pg_restore`: service này đã mount đúng `${BACKUP_DIR}` vào `/backups` và có sẵn `PGHOST`/`PGUSER`/`PGPASSWORD`/`PGDATABASE`, không cần khai lại `-v` hay mật khẩu (khác bản cũ từng mount cứng `$(pwd)/.backups`, sai với `BACKUP_DIR` thật trỏ ổ dữ liệu bền).
Kiểm sha256 PHẢI làm trước `dropdb --force`: quy trình cũ xoá DB thật trước khi biết bản dump có hỏng hay không, lỡ hỏng thì mất luôn dữ liệu.
Dòng `set -e` ở đầu khối là BẮT BUỘC khi dán cả khối vào 1 file script hoặc paste nguyên khối vào shell có hỗ trợ `set -e` (bash): thiếu dòng này thì `sha256sum -c` báo sai vẫn không chặn được `dropdb --force` chạy tiếp ngay sau đó, mất tác dụng của bước kiểm.
Nếu dán TỪNG DÒNG một cách thủ công (không dùng `set -e`), phải tự dừng ngay khi bất kỳ dòng nào báo lỗi, đặc biệt là dòng `sha256sum -c`.

Khôi phục xong DB vẫn cần đúng `NOTIFY_SECRET_KEY` CŨ (giá trị đang có trong `.env.docker` lúc backup) - đổi khoá này thì phải cấu hình lại toàn bộ kênh thông báo (webhook, mật khẩu SMTP) vì không giải mã lại được giá trị cũ đã lưu.

---

## 12. Cập nhật phiên bản

1. Báo trước cho người dùng (R12): mỗi lần cập nhật gián đoạn khoảng 1-2 phút.
2. Backup trước khi migrate (mục 11).
3. ```bash
   git fetch
   git checkout <tag-moi>
   APP_IMAGE_TAG=$(git rev-parse --short HEAD) docker compose --env-file .env.docker up -d --build
   ```
4. Kiểm `docker compose ps` (mọi service khoẻ) và `curl http://127.0.0.1:<APP_PORT>/api/health/db`.

---

## 13. Rollback

- Chưa có migration mới trong bản vừa lên: quay lại ảnh cũ, KHÔNG build lại:
  ```bash
  APP_IMAGE_TAG=<tag-cu> docker compose --env-file .env.docker up -d --no-build
  ```
- Bản mới ĐÃ chạy migration: migration chỉ tiến, không tự lùi.
  Phải khôi phục database từ bản backup chụp NGAY TRƯỚC lúc cập nhật (mục 11), rồi mới chạy lại ảnh cũ như trên.
- Giữ ít nhất 2 ảnh Docker gần nhất (`docker image prune` không xoá ảnh đang có tag, chỉ xoá ảnh "dangling" không tag).

---

## 14. Mở khoá tài khoản

Dùng khi một tài khoản (kể cả chính admin) bị khoá sau 5 lần đăng nhập sai:

```bash
docker compose --env-file .env.docker run --rm tools npm run unlock-account -- <email>
```

---

## 15. Theo dõi sau deploy

Xem log realtime:

```bash
docker compose logs -f app
docker compose logs -f app | jq 'select(.level=="error")'
```

Danh sách sự kiện (`event`) cần chú ý trong log JSON: `env.invalid` (app vừa dừng vì thiếu/sai biến môi trường), `request.unhandled` (lỗi request chưa bắt), `health.db_down` (mất kết nối DB), `auth_mail.send_failed` (gửi email lỗi), `notify.*` (gửi thông báo lỗi), `jobs.*` (job nền lỗi), `alert_engine.failed`, `client_ip.unresolved` (Nginx chưa nối đúng `X-Forwarded-For`), `csp_report.violation` (trình duyệt báo vi phạm CSP Report-Only).

IT giám sát `https://<ten-mien>/api/health/db` mỗi phút (từ đúng IP đã khai `allow` ở mục 6): 200 nghĩa là ổn, 503 nghĩa là mất kết nối database, 403 nghĩa là gọi từ IP chưa được phép.
IT giám sát ổ đĩa đầy 80%.
Giám sát thường trực (không chỉ trong checklist 1-2 tuần đầu bên dưới): file `.dump` mới nhất trong `BACKUP_DIR` không được cũ hơn 26 giờ (backup chạy 1 lần/ngày lúc 02:00, 26 giờ cho phép trễ 2 giờ trước khi báo động) - nếu cũ hơn, xem cách xử lý khoá `.lock` kẹt ở mục 11.

Log của MỌI container (`app`, `db`, `migrate`, `tools`, `backup`) tự xoay vòng bởi Docker (`json-file`, tối đa 10 MB x 14 file mỗi container, khoảng 140 MB/container) - **KHÔNG cần cron dọn log tay cho container**, chỉ log của lệnh cron backup (`/var/log/ddc-backup.log`) mới cần `logrotate` như mục 11.
Kiểm cấu hình xoay vòng log của 1 container:

```bash
docker inspect --format '{{json .HostConfig.LogConfig}}' <ten-container>
```

Checklist 1-2 tuần đầu sau go-live:

- Đăng nhập thử đủ 3 vai trò (admin, nhập liệu, xem).
- Nhập liệu thật, import Excel.
- Thử "quên mật khẩu" bằng 1 tài khoản thật.
- Xác nhận cảnh báo 06:00 có chạy (`docker compose logs app` có dòng `jobs.*` hoặc bảng `job_run`).
- Xác nhận backup có file `.dump` mới mỗi ngày trong `BACKUP_DIR`.

---

## Phụ lục A: chạy compose trên máy dev Windows

Dùng để thử toàn bộ hạ tầng trên máy cá nhân trước khi động vào server thật, KHÔNG áp dụng cho production.

```powershell
copy .env.docker.example .env.docker
# Dien POSTGRES_PASSWORD, NEXTAUTH_SECRET, NOTIFY_SECRET_KEY, CRON_SECRET (gia tri sinh ngau nhien).
# May bi soi SSL: dat EXTRA_CA_FILE=D:/_project/DDC_dieu-phoi/tools/win-root-ca.pem
docker compose --env-file .env.docker up -d --build
curl http://127.0.0.1:3005/api/health/db
```

Chỉ ở máy dev, seed dữ liệu demo để thử giao diện:

```powershell
docker compose --env-file .env.docker run --rm tools npx prisma db seed
```

`APP_PORT` mặc định `3005` (tránh trùng cổng 3000-3003, 3010 các tài khoản khác đang dùng), đổi được qua biến `APP_PORT` trong `.env.docker`.
