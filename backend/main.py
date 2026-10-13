import logging
import re
from datetime import date, timezone
from enum import Enum
from typing import Iterator, Optional

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, field_validator, model_validator
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from backend.database import create_db_engine, create_session_factory
from backend.models import Task as TaskRow

logger = logging.getLogger("task_flow")

MAX_TITLE_LENGTH = 100
MAX_DESCRIPTION_LENGTH = 2000

app = FastAPI(title="Task Flow API")

# 엔진을 만들 때는 DB에 접속하지 않는다. 접속 정보(.env)가 없으면 여기서 설정 오류로 시작이 멈춘다.
engine = create_db_engine()
SessionFactory = create_session_factory(engine)

# 개발 단계에서는 화면(5500번 포트)과 API(8000번 포트)의 출처가 달라 브라우저가 요청을 막는다.
# 화면 출처만 허용한다. 최종 배포에서는 Nginx가 같은 출처로 /api를 전달하므로 영향이 없다.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5500", "http://localhost:5500"],
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type"],
)


class Status(str, Enum):
    TODO = "TODO"
    DOING = "DOING"
    DONE = "DONE"


class Priority(str, Enum):
    HIGH = "HIGH"
    NORMAL = "NORMAL"
    LOW = "LOW"


def clean_title(value: str) -> str:
    value = value.strip()
    if not 1 <= len(value) <= MAX_TITLE_LENGTH:
        raise ValueError(f"title은 공백 제거 후 1~{MAX_TITLE_LENGTH}자여야 합니다.")
    return value


def clean_description(value: str) -> str:
    value = value.strip()
    if len(value) > MAX_DESCRIPTION_LENGTH:
        raise ValueError(f"description은 {MAX_DESCRIPTION_LENGTH}자 이하여야 합니다.")
    return value


def clean_due_date(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        raise ValueError("due_date는 YYYY-MM-DD 형식이어야 합니다.")
    try:
        date.fromisoformat(value)
    except ValueError:
        raise ValueError("due_date가 존재하지 않는 날짜입니다.")
    return value


class TaskCreate(BaseModel):
    # id, created_at 등 정해지지 않은 필드는 조용히 무시하지 않고 422로 거절한다.
    model_config = ConfigDict(extra="forbid")

    title: str
    description: str = ""
    status: Status = Status.TODO
    priority: Priority = Priority.NORMAL
    due_date: Optional[str] = None

    @field_validator("title")
    @classmethod
    def check_title(cls, value: str) -> str:
        return clean_title(value)

    @field_validator("description")
    @classmethod
    def check_description(cls, value: str) -> str:
        return clean_description(value)

    @field_validator("due_date")
    @classmethod
    def check_due_date(cls, value: Optional[str]) -> Optional[str]:
        return clean_due_date(value)


class TaskUpdate(BaseModel):
    # 보낸 필드만 바꾼다. 보내지 않은 필드는 model_fields_set에 없어 그대로 유지된다.
    model_config = ConfigDict(extra="forbid")

    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[Status] = None
    priority: Optional[Priority] = None
    due_date: Optional[str] = None

    @field_validator("title")
    @classmethod
    def check_title(cls, value: Optional[str]) -> Optional[str]:
        return value if value is None else clean_title(value)

    @field_validator("description")
    @classmethod
    def check_description(cls, value: Optional[str]) -> Optional[str]:
        return value if value is None else clean_description(value)

    @field_validator("due_date")
    @classmethod
    def check_due_date(cls, value: Optional[str]) -> Optional[str]:
        return clean_due_date(value)

    @model_validator(mode="after")
    def reject_null_for_required_fields(self):
        # due_date만 null(마감일 해제)을 허용한다. 나머지 필드의 명시적 null은 거절한다.
        for name in ("title", "description", "status", "priority"):
            if name in self.model_fields_set and getattr(self, name) is None:
                raise ValueError(f"{name}은 null로 바꿀 수 없습니다.")
        return self


class Task(BaseModel):
    id: int
    title: str
    description: str
    status: Status
    priority: Priority
    due_date: Optional[str]
    created_at: str


def get_session() -> Iterator[Session]:
    with SessionFactory() as session:
        yield session


@app.exception_handler(SQLAlchemyError)
def database_error_handler(request: Request, error: SQLAlchemyError):
    # 접속 정보 등 내부 내용이 응답에 섞이지 않도록 원인은 서버 로그에만 남긴다.
    logger.error("데이터베이스 오류: %s", error.__class__.__name__)
    return JSONResponse(status_code=503, content={"detail": "데이터베이스를 사용할 수 없습니다."})


def to_task(row: TaskRow) -> Task:
    return Task(
        id=row.id,
        title=row.title,
        description=row.description,
        status=row.status,
        priority=row.priority,
        due_date=row.due_date.isoformat() if row.due_date is not None else None,
        created_at=row.created_at.replace(tzinfo=timezone.utc).isoformat(),
    )


def get_row_or_404(session: Session, task_id: int) -> TaskRow:
    row = session.get(TaskRow, task_id)
    if row is None:
        raise HTTPException(status_code=404, detail="해당 id의 할 일이 없습니다.")
    return row


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/tasks", response_model=list[Task])
def list_tasks(
    q: Optional[str] = None,
    status: Optional[Status] = None,
    priority: Optional[Priority] = None,
    session: Session = Depends(get_session),
):
    # 보낸 조건을 모두 만족하는 항목만 돌려준다(AND). q는 대소문자·앞뒤 공백을 무시한다.
    query = (q or "").strip().lower()
    statement = select(TaskRow).order_by(TaskRow.id)
    if query:
        # 대소문자만 무시하고 악센트는 구분한다. %, _ 같은 문자는 글자 그대로 찾는다.
        statement = statement.where(
            func.lower(TaskRow.title).collate("utf8mb4_bin").contains(query, autoescape=True)
        )
    if status is not None:
        statement = statement.where(TaskRow.status == status.value)
    if priority is not None:
        statement = statement.where(TaskRow.priority == priority.value)
    return [to_task(row) for row in session.scalars(statement)]


@app.post("/api/tasks", response_model=Task, status_code=201)
def create_task(payload: TaskCreate, session: Session = Depends(get_session)):
    row = TaskRow(
        title=payload.title,
        description=payload.description,
        status=payload.status.value,
        priority=payload.priority.value,
        due_date=date.fromisoformat(payload.due_date) if payload.due_date else None,
    )
    session.add(row)
    session.commit()
    session.refresh(row)  # DB에 실제로 저장된 값(id, created_at)을 다시 읽는다.
    return to_task(row)


@app.patch("/api/tasks/{task_id}", response_model=Task)
def update_task(task_id: int, payload: TaskUpdate, session: Session = Depends(get_session)):
    changes = payload.model_dump(exclude_unset=True)
    row = get_row_or_404(session, task_id)
    for name, value in changes.items():
        if name in ("status", "priority"):
            value = value.value
        elif name == "due_date":
            value = date.fromisoformat(value) if value is not None else None
        setattr(row, name, value)
    session.commit()
    session.refresh(row)
    return to_task(row)


@app.delete("/api/tasks/{task_id}", status_code=204)
def delete_task(task_id: int, session: Session = Depends(get_session)):
    row = get_row_or_404(session, task_id)
    session.delete(row)
    session.commit()
    return Response(status_code=204)
