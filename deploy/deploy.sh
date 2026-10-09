#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# OneSoul ERP / POS - 生產環境一鍵部署與滾動更新腳本
# 使用方式: chmod +x deploy/deploy.sh && ./deploy/deploy.sh
# ─────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${ROOT_DIR}"

echo "=========================================================="
echo "   🚀 OneSoul ERP / POS 旗艦系統 - 雲端生產環境自動部署"
echo "=========================================================="

# 1. 檢查並自動安裝 Docker 環境
if ! command -v docker &> /dev/null; then
    echo "⚠️ 未偵測到 Docker，正在自動安裝 Docker 與 Compose 外掛..."
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker "$USER" 2>/dev/null || true
    echo "✅ Docker 安裝完成！"
fi

# 2. 檢查 .env 環境變數檔案
if [ ! -f "${ROOT_DIR}/.env.prod" ]; then
    echo "⚠️ 未找到 .env.prod，正在從範本生成預設生產環境變數..."
    cat << 'EOF' > "${ROOT_DIR}/.env.prod"
# OneSoul Production Environment Variables
DB_USER=postgres
DB_PASSWORD=onesoul_prod_secret_2026
DB_NAME=onesoul_pos
EOF
    echo "✅ 已生成 .env.prod"
fi

# 3. 建置前端與後端容器映像檔
echo "📦 正在建置 Docker 容器映像檔 (Fastify Core + Admin SPA)..."
docker compose --env-file "${ROOT_DIR}/.env.prod" -f "${ROOT_DIR}/docker-compose.prod.yml" build

# 4. 啟動所有服務
echo "🚀 正在啟動生產環境服務群 (PostgreSQL + Backend + Admin)..."
docker compose --env-file "${ROOT_DIR}/.env.prod" -f "${ROOT_DIR}/docker-compose.prod.yml" up -d

# 5. 等待健康檢查
echo "⏳ 等待資料庫與後端服務就緒..."
sleep 5

# 6. 狀態檢查
echo "=========================================================="
echo "                   📊 目前容器運行狀態"
echo "=========================================================="
docker compose -f "${ROOT_DIR}/docker-compose.prod.yml" ps

echo ""
echo "=========================================================="
echo "                   🎉 容器群部署完成！"
echo "=========================================================="
echo "內部服務接聽埠："
echo "  - PostgreSQL: 127.0.0.1:5432"
echo "  - Backend API: 127.0.0.1:3000"
echo "  - Admin SPA:   127.0.0.1:8080"
echo ""
echo "下一步（首次部署）："
echo "  1. 複製 Nginx 設定："
echo "     sudo cp deploy/nginx/erp.boochlin.com.conf /etc/nginx/sites-available/"
echo "     sudo ln -sf /etc/nginx/sites-available/erp.boochlin.com.conf /etc/nginx/sites-enabled/"
echo "     sudo nginx -t && sudo systemctl reload nginx"
echo ""
echo "  2. 申請免費 Let's Encrypt SSL 憑證："
echo "     sudo certbot --nginx -d erp.boochlin.com"
echo "=========================================================="
