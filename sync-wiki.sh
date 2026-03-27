#!/bin/bash
# sync-wiki.sh — 一鍵同步 docs/ 到 GitHub Wiki
# 用法：./sync-wiki.sh

set -e

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
WIKI_DIR="$REPO_DIR/../onesoul-pos-web.wiki"

# 確認 wiki repo 存在
if [ ! -d "$WIKI_DIR/.git" ]; then
  echo "⚡ Wiki repo 不存在，正在 clone..."
  git clone https://github.com/boochlin06/onesoul-pos-web.wiki.git "$WIKI_DIR"
fi

# 複製 wiki 模板（Home + Sidebar）
cp "$REPO_DIR/wiki/Home.md" "$WIKI_DIR/"
cp "$REPO_DIR/wiki/_Sidebar.md" "$WIKI_DIR/"

# 同步 docs → wiki（中文重命名）
cp "$REPO_DIR/docs/介紹.md" "$WIKI_DIR/專案介紹.md"
cp "$REPO_DIR/docs/操作流程.md" "$WIKI_DIR/操作流程.md"
cp "$REPO_DIR/docs/DEPLOY.md" "$WIKI_DIR/部署手冊.md"
cp "$REPO_DIR/docs/更新日誌.md" "$WIKI_DIR/更新日誌.md"
cp "$REPO_DIR/docs/change.md" "$WIKI_DIR/變更紀錄.md"

# Push
cd "$WIKI_DIR"
git add -A

if git diff --cached --quiet; then
  echo "✅ Wiki 已是最新，無需更新"
else
  git commit -m "docs: 同步 Wiki $(date '+%Y-%m-%d %H:%M')"
  git push
  echo "✅ Wiki 已更新！"
fi
