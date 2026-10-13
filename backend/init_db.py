"""tasks 테이블을 만든다. 실행: python -m backend.init_db

이미 있는 테이블과 데이터는 건드리지 않고, 없는 테이블만 만든다.
"""
import sys

from sqlalchemy import inspect
from sqlalchemy.exc import SQLAlchemyError

from backend import models  # noqa: F401  (Base에 테이블 정의를 등록하기 위해 불러온다)
from backend.database import Base, ConfigError, create_db_engine


def main() -> int:
    try:
        engine = create_db_engine()
        before = set(inspect(engine).get_table_names())
        Base.metadata.create_all(engine)  # 이미 있는 테이블은 건너뛴다(삭제·변경 없음)
        after = set(inspect(engine).get_table_names())
    except ConfigError as error:
        print(f"[설정 오류] {error}", file=sys.stderr)
        return 1
    except SQLAlchemyError as error:
        # 접속 정보(비밀번호 포함)가 노출되지 않도록 원인 메시지 한 줄만 출력한다.
        reason = str(getattr(error, "orig", error)).splitlines()[0]
        print(f"[DB 오류] {reason}", file=sys.stderr)
        return 1

    for table in sorted(Base.metadata.tables):
        state = "이미 있음(변경 없음)" if table in before else "새로 만듦"
        print(f"테이블 {table}: {state}")
    print("현재 테이블:", ", ".join(sorted(after)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
