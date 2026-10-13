#!/usr/bin/env bash
# Task Flow 전용 MariaDB 데이터베이스와 사용자를 만든다. 여러 번 실행해도 안전하다.
# 사용법: 프로젝트 루트에서 bash db/create_db.sh  (관리자 권한 sudo 비밀번호가 필요하다)
# 접속 정보는 .env에서 읽고, 비밀번호는 화면에 출력하지 않는다.
set -euo pipefail

cd "$(dirname "$0")/.."
if [ ! -f .env ]; then
  echo "[오류] .env가 없습니다. .env.example을 복사해 값을 채운 뒤 다시 실행하세요." >&2
  exit 1
fi
set -a
. ./.env
set +a

for name in DB_NAME DB_USER DB_PASSWORD; do
  if [ -z "${!name:-}" ]; then
    echo "[오류] .env에 $name 값이 없습니다." >&2
    exit 1
  fi
done
if [ "$DB_PASSWORD" = "change-me" ]; then
  echo "[오류] DB_PASSWORD가 예시 값(change-me)입니다. 실제 값으로 바꾸세요." >&2
  exit 1
fi
# SQL에 그대로 들어가므로 이름은 영문 소문자·숫자·밑줄, 비밀번호는 영문·숫자만 허용한다.
if ! [[ "$DB_NAME" =~ ^[a-z0-9_]+$ && "$DB_USER" =~ ^[a-z0-9_]+$ ]]; then
  echo "[오류] DB_NAME, DB_USER는 영문 소문자·숫자·밑줄만 사용할 수 있습니다." >&2
  exit 1
fi
if ! [[ "$DB_PASSWORD" =~ ^[A-Za-z0-9]+$ ]]; then
  echo "[오류] DB_PASSWORD는 영문과 숫자만 사용할 수 있습니다." >&2
  exit 1
fi

# 이 데이터베이스에만 권한을 주고, 접속은 이 컴퓨터(localhost, 127.0.0.1)에서만 허용한다.
sudo mariadb <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
CREATE USER IF NOT EXISTS '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASSWORD}';
ALTER USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
ALTER USER '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL

echo "[완료] 데이터베이스 '${DB_NAME}'와 사용자 '${DB_USER}'를 준비했습니다."
