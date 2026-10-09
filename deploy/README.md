# OneSoul ERP / POS 旗艦系統 - DigitalOcean Droplet 生產環境部署手冊

本手冊說明如何將 OneSoul ERP / POS 系統以 **Docker Compose** 容器化架構部署至現有的 **DigitalOcean Droplet**，並透過宿主機已有的 Nginx 反向代理配置專屬子網域 **`erp.boochlin.com`**，實現零額外主機月費、無干擾共存、以及自動 Let's Encrypt SSL 加密。

---

## 🏛️ 架構拓撲圖 (Topology)

```
[使用者 / 竹北門市 POS / 金山門市]
          │
          │ HTTPS (443)
          ▼
[GoDaddy DNS: erp.boochlin.com -> Droplet IP]
          │
          ▼
[DigitalOcean Droplet 宿主機]
   ├── 宿主機 Nginx (監聽 80 / 443，自動 Let's Encrypt SSL)
   │     ├── boochlin.com        ──> 現有 WordPress 網站 (不受任何影響)
   │     └── erp.boochlin.com    ──> 內部轉發至 Docker 容器
   │           ├── location /     ──> http://127.0.0.1:8080 (onesoul-admin 前端)
   │           └── location /api/ ──> http://127.0.0.1:3000 (onesoul-backend 後端)
   │
   └── Docker 內部容器網路 (onesoul-network)
         ├── [onesoul-admin]    (Nginx:alpine, 監聽 8080, 提供 Vite SPA)
         ├── [onesoul-backend]  (Fastify Node.js, 監聽 3000, 提供 RESTful & SSE)
         └── [onesoul-postgres] (PostgreSQL 16, 內部通訊, 掛載本地 Volume)
```

---

## 步驟一：GoDaddy DNS 設定（新增子網域）

1. 登入 [GoDaddy DNS 管理後台](https://dcc.godaddy.com/manage/dns)。
2. 找到網域 **`boochlin.com`** 的 DNS 紀錄清單。
3. 點選 **「新增紀錄 (Add Record)」**：
   - **類型 (Type)**：`A`
   - **名稱 (Name)**：`erp`
   - **值 (Value / IP Address)**：`你的 DigitalOcean Droplet 公網 IP`（例如 `159.89.xxx.xxx`）
   - **TTL**：`1/2 小時` (或預設)
4. 儲存設定。通常 1~5 分鐘內即可全球生效（可在終端機執行 `ping erp.boochlin.com` 確認是否指向 Droplet IP）。

---

## 步驟二：在 Droplet 上拉取代碼並一鍵啟動容器

登入 DigitalOcean Droplet 終端機：

```bash
# 1. 複製專案庫到 Droplet
cd /var/www  # 或你習慣的目錄，例如 ~/code
git clone <你的 GitHub 倉庫網址> onesoul_dev
cd onesoul_dev

# 2. 執行一鍵生產部署腳本
chmod +x deploy/deploy.sh
./deploy/deploy.sh
```

> **說明**：
> - 腳本會自動建立 `.env.prod`（若尚未建立），並自動建置前端與後端映像檔。
> - 啟動三個隔離容器：`onesoul-postgres`、`onesoul-backend`、`onesoul-admin`。
> - 外部公網無法直接存取 3000、5432、8080，保障最高資安隔離。

---

## 步驟三：設定宿主機 Nginx 反向代理與 SSL 憑證

因宿主機已有 Nginx 運行現有 WordPress，我們僅需新增一個虛擬主機設定檔：

```bash
# 1. 複製 Nginx 設定範本至 sites-available
sudo cp deploy/nginx/erp.boochlin.com.conf /etc/nginx/sites-available/

# 2. 建立啟用軟連結
sudo ln -sf /etc/nginx/sites-available/erp.boochlin.com.conf /etc/nginx/sites-enabled/

# 3. 測試 Nginx 設定語法是否正確
sudo nginx -t

# 4. 重新載入 Nginx
sudo systemctl reload nginx

# 5. 使用 Certbot 一鍵申請 Let's Encrypt 免費 SSL 憑證 (自動設定 HTTPS 與自動續期)
sudo certbot --nginx -d erp.boochlin.com
```

完成後，直接開啟瀏覽器訪問 **`https://erp.boochlin.com`**，即可直接進入 OneSoul ERP 旗艦後台！

---

## 步驟四：設定每日資料庫自動安全備份 (Crontab)

為防止硬碟損毀或誤操作，設定每天凌晨 03:00 自動將 PostgreSQL 匯出並壓縮保留 14 天：

```bash
# 1. 給予備份腳本執行權限
chmod +x /path/to/onesoul_dev/deploy/scripts/backup_db.sh

# 2. 編輯 crontab
crontab -e

# 3. 在最下方加入以下排程 (請替換為實際專案路徑)：
0 3 * * * /path/to/onesoul_dev/deploy/scripts/backup_db.sh >> /var/log/onesoul_backup.log 2>&1
```

備份檔案會自動存放在 `/var/backups/onesoul_postgres/`，並自動刪除 14 天以前的舊檔。

---

## 步驟五：日常維護與快速更新

當未來有新功能或代碼修改需要更新時，只需在 Droplet 執行：

```bash
cd /path/to/onesoul_dev

# 拉取最新代碼並滾動更新
git pull
./deploy/deploy.sh
```

### 常用檢視指令
```bash
# 查看容器運行狀態
docker compose -f docker-compose.prod.yml ps

# 查看後端即時日誌
docker compose -f docker-compose.prod.yml logs -f backend

# 查看前端即時日誌
docker compose -f docker-compose.prod.yml logs -f admin

# 查看資料庫狀態
docker compose -f docker-compose.prod.yml logs -f postgres
```
