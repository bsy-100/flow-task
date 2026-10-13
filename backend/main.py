import re
import threading
from datetime import date, datetime, timezone
from enum import Enum
from typing import Optional

from fastapi import FastAPI, HTTPException, Response
from pydantic import BaseModel, ConfigDict, field_validator, model_validator

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


# 메모리 저장소. API를 재시작하면 데이터가 사라지는 것이 정상이다(PRD).
_tasks: list[Task] = []
_next_id = 1
_lock = threading.Lock()


def _find_index(task_id: int) -> int:
    for index, task in enumerate(_tasks):
        if task.id == task_id:
            return index
    raise HTTPException(status_code=404, detail="해당 id의 할 일이 없습니다.")


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/tasks", response_model=list[Task])
def list_tasks(
    q: Optional[str] = None,
    status: Optional[Status] = None,
    priority: Optional[Priority] = None,
):
    # 보낸 조건을 모두 만족하는 항목만 돌려준다(AND). q는 대소문자·앞뒤 공백을 무시한다.
    query = (q or "").strip().lower()
    with _lock:
        return [
            task
            for task in _tasks
            if (query == "" or query in task.title.lower())
            and (status is None or task.status == status)
            and (priority is None or task.priority == priority)
        ]


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


@app.patch("/api/tasks/{task_id}", response_model=Task)
def update_task(task_id: int, payload: TaskUpdate):
    changes = payload.model_dump(exclude_unset=True)
    with _lock:
        index = _find_index(task_id)
        updated = _tasks[index].model_copy(update=changes)
        _tasks[index] = updated
        return updated


@app.delete("/api/tasks/{task_id}", status_code=204)
def delete_task(task_id: int):
    with _lock:
        del _tasks[_find_index(task_id)]
    return Response(status_code=204)
