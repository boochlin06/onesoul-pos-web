#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# OneSoul ERP / POS - 每日 PostgreSQL 資料庫自動安全備份腳本
# 建議設定 crontab: 0 3 * * * /path/to/deploy/scripts/backup_db.sh >> /var/log/onesoul_backup.log 2>&1
# ─────────────────────────────────────────────────────────────

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/onesoul_postgres}"
RETENTION_DAYS=14
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="onesoul_pos_backup_${TIMESTAMP}.sql.gz"
CONTAINER_NAME="onesoul-postgres"
DB_NAME="${DB_NAME:-onesoul_pos}"
DB_USER="${DB_USER:-postgres}"

mkdir -p "${BACKUP_DIR}"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🚀 開始備份 OneSoul PostgreSQL 資料庫..."

# 檢查容器是否存活
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🛑 錯誤：容器 ${CONTAINER_NAME} 未在運行中！" >&2
  exit 1
fi

# 執行備份並即時壓縮
docker exec -t "${CONTAINER_NAME}" pg_dump -U "${DB_USER}" "${DB_NAME}" | gzip > "${BACKUP_DIR}/${FILENAME}"

FILE_SIZE=$(du -h "${BACKUP_DIR}/${FILENAME}" | cut -f1)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ 資料庫備份成功：${BACKUP_DIR}/${FILENAME} (${FILE_SIZE})"

# 自動清理保留天數超過 14 天的備份
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🧹 正在清理 ${RETENTION_DAYS} 天前的舊備份檔案..."
find "${BACKUP_DIR}" -type f -name "onesoul_pos_backup_*.sql.gz" -mtime +"${RETENTION_DAYS}" -exec rm -f {} \;

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🏁 備份與維護程序圓滿完成！"
