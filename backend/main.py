import re
import threading
from datetime import date, datetime, timezone
from enum import Enum
from typing import Optional

from fastapi import FastAPI
from pydantic import BaseModel, ConfigDict, field_validator

MAX_TITLE_LENGTH = 100
MAX_DESCRIPTION_LENGTH = 2000

app = FastAPI(title="Task Flow API")


class Status(str, Enum):
    TODO = "TODO"
    DOING = "DOING"
    DONE = "DONE"


class Priority(str, Enum):
    HIGH = "HIGH"
    NORMAL = "NORMAL"
    LOW = "LOW"


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
        value = value.strip()
        if not 1 <= len(value) <= MAX_TITLE_LENGTH:
            raise ValueError(f"title은 공백 제거 후 1~{MAX_TITLE_LENGTH}자여야 합니다.")
        return value

    @field_validator("description")
    @classmethod
    def check_description(cls, value: str) -> str:
        value = value.strip()
        if len(value) > MAX_DESCRIPTION_LENGTH:
            raise ValueError(f"description은 {MAX_DESCRIPTION_LENGTH}자 이하여야 합니다.")
        return value

    @field_validator("due_date")
    @classmethod
    def check_due_date(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
            raise ValueError("due_date는 YYYY-MM-DD 형식이어야 합니다.")
        try:
            date.fromisoformat(value)
        except ValueError:
            raise ValueError("due_date가 존재하지 않는 날짜입니다.")
        return value


class Task(BaseModel):
    id: int
    title: str
    description: str
    status: Status
    priority: Priority
    due_date: Optional[str]
    created_at: str


# T06 메모리 저장소. API를 재시작하면 데이터가 사라지는 것이 정상이다(PRD).
_tasks: list[Task] = []
_next_id = 1
_lock = threading.Lock()


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/tasks", response_model=list[Task])
def list_tasks():
    with _lock:
        return list(_tasks)


@app.post("/api/tasks", response_model=Task, status_code=201)
def create_task(payload: TaskCreate):
    global _next_id
    with _lock:
        task = Task(
            id=_next_id,
            title=payload.title,
            description=payload.description,
            status=payload.status,
            priority=payload.priority,
            due_date=payload.due_date,
            created_at=datetime.now(timezone.utc).isoformat(),
        )
        _next_id += 1
        _tasks.append(task)
        return task
