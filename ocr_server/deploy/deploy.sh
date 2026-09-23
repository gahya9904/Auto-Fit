#!/bin/bash
# PC(Git Bash)에서 실행: 코드 묶기 → 네이버 클라우드 서버로 올리기 → 설치 스크립트 실행
#
#   처음 설치:  bash deploy/deploy.sh <공인IP> --with-env
#   코드 갱신:  bash deploy/deploy.sh <공인IP>
#
# --with-env : .env 에서 서버에 필요한 키 5개만 골라 SSH 로 바로 보낸다 (PC 에 사본을 만들지 않음)
set -euo pipefail

IP="${1:?공인 IP 를 넣어 주세요}"
WITH_ENV="${2:-}"
KEY="$HOME/.ssh/autofit_ocr_ncp"
SSH_OPTS=(-i "$KEY" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15)
cd "$(dirname "$0")/.."

BUNDLE="$(mktemp -d)/autofit-ocr.tar.gz"
tar --exclude='__pycache__' -czf "$BUNDLE" ocr server schema deploy requirements-server.txt
scp "${SSH_OPTS[@]}" "$BUNDLE" deploy/setup_server.sh root@"$IP":/root/
rm -f "$BUNDLE"

if [ "$WITH_ENV" = "--with-env" ]; then
  grep -E '^(AUTOFIT_CLOVA_OCR_URL|AUTOFIT_CLOVA_OCR_SECRET|AUTOFIT_CLOVA_TEMPLATE_URL|AUTOFIT_CLOVA_TEMPLATE_SECRET|AUTOFIT_OCR_SERVER_TOKEN)=' .env | tr -d '\r' \
    | ssh "${SSH_OPTS[@]}" root@"$IP" "umask 077; cat > /root/autofit-ocr.env"
fi

ssh "${SSH_OPTS[@]}" root@"$IP" "bash /root/setup_server.sh $IP"
