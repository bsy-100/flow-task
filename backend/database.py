import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.engine import URL, Engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

# 프로젝트 루트의 .env를 읽는다. 이미 설정된 환경변수는 덮어쓰지 않는다.
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

REQUIRED_VARS = ("DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD")


class Base(DeclarativeBase):
    pass


class ConfigError(Exception):
    pass


def build_url() -> URL:
    missing = [name for name in REQUIRED_VARS if not os.environ.get(name)]
    if missing:
        raise ConfigError(".env에 다음 값이 없습니다: " + ", ".join(missing))
    try:
        port = int(os.environ["DB_PORT"])
    except ValueError:
        raise ConfigError("DB_PORT는 숫자여야 합니다.")
    return URL.create(
        "mysql+pymysql",
        username=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
        host=os.environ["DB_HOST"],
        port=port,
        database=os.environ["DB_NAME"],
        query={"charset": "utf8mb4"},
    )


def create_db_engine() -> Engine:
    # 엔진을 만들 때는 접속하지 않는다. 실제 접속은 처음 쿼리를 보낼 때 일어난다.
    return create_engine(build_url(), pool_pre_ping=True)


def create_session_factory(engine: Engine) -> sessionmaker:
    return sessionmaker(bind=engine, expire_on_commit=False)
