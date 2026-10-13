from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import Date, DateTime, Enum, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


def utc_now() -> datetime:
    # MariaDB DATETIME에는 시간대가 없으므로 UTC 기준 값으로 저장한다.
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Task(Base):
    __tablename__ = "tasks"

    # 수정과 삭제는 화면 순번이 아닌 이 id로 처리한다. 삭제한 id는 다시 쓰지 않는다.
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(String(2000), nullable=False, default="", server_default="")
    status: Mapped[str] = mapped_column(
        Enum("TODO", "DOING", "DONE", name="task_status"),
        nullable=False,
        default="TODO",
        server_default="TODO",
    )
    priority: Mapped[str] = mapped_column(
        Enum("HIGH", "NORMAL", "LOW", name="task_priority"),
        nullable=False,
        default="NORMAL",
        server_default="NORMAL",
    )
    due_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    # 앱은 utc_now()로 값을 넣고, SQL로 직접 넣을 때도 UTC 현재 시각이 들어가도록 DB 기본값을 둔다.
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=utc_now, server_default=text("(UTC_TIMESTAMP())")
    )
