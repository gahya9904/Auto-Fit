#!/bin/bash
# AutoFit OCR 서버 설치·갱신 스크립트 (네이버 클라우드 Ubuntu 24.04, root 로 실행)
#
#   사용: bash /root/setup_server.sh <공인IP>
#
# 미리 올려 둘 파일 (PC 에서 deploy/deploy.sh 가 올려 줌)
#   /root/autofit-ocr.tar.gz : 코드 묶음 (ocr/ server/ schema/ deploy/ requirements-server.txt)
#   /root/autofit-ocr.env    : 키 5개만 담은 .env (처음 설치하거나 키가 바뀔 때만 필요)
#
# 하는 일
#   1) 커널 자동 업데이트 막기 (NCP 안내: 커널 업데이트로 생긴 장애는 복구 지원 안 함)
#   2) Python·Caddy 설치 → 코드 풀기 → 가상환경에 라이브러리 설치
#   3) OCR 서버를 systemd 서비스로 등록 (죽으면 3초 뒤 자동 재시작, 재부팅해도 자동 시작)
#   4) Caddy 로 HTTPS 인증서 자동 발급 (<공인IP 하이픈>.sslip.io 주소)
set -euo pipefail

PUBLIC_IP="${1:?공인 IP 를 넣어 주세요. 예: bash setup_server.sh 101.79.1.2}"
DOMAIN="${PUBLIC_IP//./-}.sslip.io"
APP_DIR=/opt/autofit-ocr
export DEBIAN_FRONTEND=noninteractive

echo "== 1/4 커널 고정"
apt-mark hold linux-generic linux-image-generic linux-headers-generic \
  linux-virtual linux-image-virtual linux-headers-virtual >/dev/null 2>&1 || true

echo "== 2/4 패키지 설치"
apt-get update -q
apt-get install -y -q python3-venv python3-pip caddy

id autofit >/dev/null 2>&1 || useradd --system --home-dir "$APP_DIR" --shell /usr/sbin/nologin autofit
mkdir -p "$APP_DIR"
# 코드만 교체한다 (.env 와 .venv 는 그대로 둔다)
rm -rf "$APP_DIR/ocr" "$APP_DIR/server" "$APP_DIR/schema" "$APP_DIR/deploy"
tar -xzf /root/autofit-ocr.tar.gz -C "$APP_DIR"
if [ -f /root/autofit-ocr.env ]; then
  install -m 600 /root/autofit-ocr.env "$APP_DIR/.env"
  rm -f /root/autofit-ocr.env
fi
test -f "$APP_DIR/.env" || { echo "!! $APP_DIR/.env 가 없습니다"; exit 1; }
chown -R autofit:autofit "$APP_DIR"

[ -x "$APP_DIR/.venv/bin/python" ] || sudo -u autofit python3 -m venv "$APP_DIR/.venv"
sudo -u autofit "$APP_DIR/.venv/bin/pip" install -q --upgrade pip
sudo -u autofit "$APP_DIR/.venv/bin/pip" install -q -r "$APP_DIR/requirements-server.txt"

echo "== 3/4 OCR 서비스 등록"
install -m 644 "$APP_DIR/deploy/autofit-ocr.service" /etc/systemd/system/autofit-ocr.service
systemctl daemon-reload
systemctl enable autofit-ocr >/dev/null
systemctl restart autofit-ocr

echo "== 4/4 HTTPS (Caddy) 설정: https://$DOMAIN"
sed "s/__DOMAIN__/$DOMAIN/" "$APP_DIR/deploy/Caddyfile" > /etc/caddy/Caddyfile
systemctl enable caddy >/dev/null
systemctl restart caddy

sleep 3
systemctl is-active autofit-ocr caddy
curl -s http://127.0.0.1:8000/health; echo
echo "완료: https://$DOMAIN"
