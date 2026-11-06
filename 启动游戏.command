#!/bin/zsh
cd -- "$(dirname -- "$0")" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null 2>&1; then
  echo '需要先安装 Node.js 18 或更高版本：https://nodejs.org/'
  read -r '?按回车退出…'
  exit 1
fi
if curl -fsS http://localhost:4173/ 2>/dev/null | head -c 8000 | grep -q '沉星之序 · 星落之境'; then
  echo '游戏已在运行，请打开 http://localhost:4173'
  read -r '?按回车关闭此窗口…'
else
  echo '启动后请打开 http://localhost:4173'
  echo '按 Ctrl+C 停止服务。'
  node server.mjs
fi
