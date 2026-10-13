const MAX_TITLE_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 2000;
const STATUSES = [
  { value: "TODO", label: "할 일" },
  { value: "DOING", label: "진행 중" },
  { value: "DONE", label: "완료" },
];
const PRIORITIES = [
  { value: "HIGH", label: "높음" },
  { value: "NORMAL", label: "보통" },
  { value: "LOW", label: "낮음" },
];
const DEFAULT_PRIORITY = "NORMAL";

// 개발 단계(화면 5500번 포트)에서는 API 서버(8000번 포트)를 직접 부르고,
// 그 외(Nginx 등으로 같은 주소에서 서비스할 때)에는 같은 출처의 /api를 부른다.
const API_BASE = window.location.port === "5500" ? "http://127.0.0.1:8000" : "";

const form = document.getElementById("task-form");
const input = document.getElementById("title-input");
const descriptionInput = document.getElementById("description-input");
const priorityInput = document.getElementById("priority-input");
const dueDateInput = document.getElementById("due-date-input");
const searchInput = document.getElementById("search-input");
const statusFilter = document.getElementById("status-filter");
const priorityFilter = document.getElementById("priority-filter");
const errorMessage = document.getElementById("error-message");
const taskList = document.getElementById("task-list");
const emptyMessage = document.getElementById("empty-message");
const submitButton = form.querySelector("button[type=submit]");

let tasks = [];
// "loading" → 첫 목록을 받기 전, "ok" → 서버 목록을 받음, "failed" → 마지막 목록 조회가 실패함
let loadState = "loading";

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function isValidStatus(status) {
  return STATUSES.some((s) => s.value === status);
}

function isValidPriority(priority) {
  return PRIORITIES.some((p) => p.value === priority);
}

// YYYY-MM-DD 형식이면서 실제로 존재하는 날짜인지 확인한다.
function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

// 로컬 달력 기준 오늘 날짜(YYYY-MM-DD)
function todayLocal() {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return now.getFullYear() + "-" + mm + "-" + dd;
}

function isOverdue(task) {
  return task.due_date !== null && task.status !== "DONE" && task.due_date < todayLocal();
}

function validateTitle(rawTitle) {
  const title = rawTitle.trim();
  if (title.length === 0) {
    return { error: "제목을 입력해 주세요." };
  }
  if (title.length > MAX_TITLE_LENGTH) {
    return { error: "제목은 " + MAX_TITLE_LENGTH + "자 이하로 입력해 주세요." };
  }
  return { title: title };
}

function validateDescription(rawDescription) {
  const description = rawDescription.trim();
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return { error: "설명은 " + MAX_DESCRIPTION_LENGTH + "자 이하로 입력해 주세요." };
  }
  return { description: description };
}

function validateDueDate(rawDueDate) {
  if (rawDueDate === "") {
    return { due_date: null };
  }
  if (!isValidDate(rawDueDate)) {
    return { error: "마감일은 YYYY-MM-DD 형식의 올바른 날짜여야 합니다." };
  }
  return { due_date: rawDueDate };
}

// ---- API 호출 ----

function messageForStatus(status, data) {
  if (status === 404) {
    return "해당 할 일을 찾을 수 없습니다. 목록을 새로 불러옵니다.";
  }
  if (status === 422 && data && Array.isArray(data.detail) && data.detail.length > 0) {
    return "입력값이 올바르지 않습니다. " + String(data.detail[0].msg).replace(/^Value error, /, "");
  }
  return "요청을 처리하지 못했습니다. (코드 " + status + ")";
}

async function request(method, path, body) {
  const options = { method: method };
  if (body !== undefined) {
    options.headers = { "Content-Type": "application/json" };
    options.body = JSON.stringify(body);
  }
  let response;
  try {
    response = await fetch(API_BASE + path, options);
  } catch (e) {
    throw new ApiError(0, "서버에 연결할 수 없습니다. API 서버가 실행 중인지 확인해 주세요.");
  }
  if (response.status === 204) {
    return null;
  }
  let data = null;
  try {
    data = await response.json();
  } catch (e) {
    data = null;
  }
  if (!response.ok) {
    throw new ApiError(response.status, messageForStatus(response.status, data));
  }
  return data;
}

function showError(error) {
  errorMessage.textContent = error.message;
}

// 서버의 목록을 받아 화면에 반영한다. 실패하면 기존 목록은 그대로 두고 오류만 표시한다.
async function loadTasks() {
  try {
    tasks = await request("GET", "/api/tasks");
    loadState = "ok";
  } catch (error) {
    loadState = "failed";
    showError(error);
  }
  render();
}

// 서버에 변경을 요청하고, 성공하면 서버의 목록을 다시 받아 화면을 맞춘다.
async function mutate(action) {
  try {
    await action();
  } catch (error) {
    showError(error);
    if (error.status === 404) {
      await loadTasks();
    } else {
      render();
    }
    return false;
  }
  errorMessage.textContent = "";
  await loadTasks();
  return true;
}

function changeStatus(id, status) {
  if (!isValidStatus(status)) {
    return;
  }
  mutate(() => request("PATCH", "/api/tasks/" + id, { status: status }));
}

// 제목과 설명을 차례로 수정한다. 어느 단계에서든 취소하면 아무것도 바꾸지 않는다.
function editTask(id) {
  const target = tasks.find((t) => t.id === id);
  if (!target) {
    return;
  }
  const titleAnswer = window.prompt("제목을 수정하세요.", target.title);
  if (titleAnswer === null) {
    return;
  }
  const titleResult = validateTitle(titleAnswer);
  if (titleResult.error) {
    errorMessage.textContent = titleResult.error;
    return;
  }
  const descriptionAnswer = window.prompt("설명을 수정하세요. (비워도 됩니다)", target.description);
  if (descriptionAnswer === null) {
    return;
  }
  const descriptionResult = validateDescription(descriptionAnswer);
  if (descriptionResult.error) {
    errorMessage.textContent = descriptionResult.error;
    return;
  }
  mutate(() =>
    request("PATCH", "/api/tasks/" + id, {
      title: titleResult.title,
      description: descriptionResult.description,
    })
  );
}

function deleteTask(id) {
  const target = tasks.find((t) => t.id === id);
  if (!target) {
    return;
  }
  if (!window.confirm("이 할 일을 삭제할까요?\n" + target.title)) {
    return;
  }
  mutate(() => request("DELETE", "/api/tasks/" + id));
}

// ---- 화면 ----

function createStatusSelect(task) {
  const select = document.createElement("select");
  select.setAttribute("aria-label", "상태");
  for (const s of STATUSES) {
    const option = document.createElement("option");
    option.value = s.value;
    option.textContent = s.label;
    select.appendChild(option);
  }
  select.value = task.status;
  select.addEventListener("change", function () {
    changeStatus(task.id, select.value);
  });
  return select;
}

function createButton(label, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function createBadge(text, className) {
  const badge = document.createElement("span");
  badge.className = "badge " + className;
  badge.textContent = text;
  return badge;
}

function priorityLabel(priority) {
  return PRIORITIES.find((p) => p.value === priority).label;
}

// 제목 검색, 상태 필터, 우선순위 필터를 모두 만족하는 항목만 남긴다(AND).
// 필터 값은 화면 상태일 뿐이며 저장하지 않는다. 항목 조작은 항상 id로 처리한다.
function getVisibleTasks() {
  const query = searchInput.value.trim().toLowerCase();
  const status = statusFilter.value;
  const priority = priorityFilter.value;
  return tasks.filter(
    (t) =>
      (query === "" || t.title.toLowerCase().includes(query)) &&
      (status === "" || t.status === status) &&
      (priority === "" || t.priority === priority)
  );
}

function emptyText() {
  if (tasks.length > 0) {
    return "조건에 맞는 할 일이 없습니다.";
  }
  if (loadState === "loading") {
    return "목록을 불러오는 중입니다...";
  }
  if (loadState === "failed") {
    return "목록을 불러오지 못했습니다.";
  }
  return "등록된 할 일이 없습니다.";
}

function render() {
  taskList.replaceChildren();
  const visibleTasks = getVisibleTasks();
  for (const task of visibleTasks) {
    const li = document.createElement("li");
    li.dataset.id = String(task.id);
    if (task.status === "DONE") {
      li.classList.add("done");
    }
    const overdue = isOverdue(task);
    if (overdue) {
      li.classList.add("overdue");
    }

    const body = document.createElement("div");
    body.className = "body";

    const title = document.createElement("span");
    title.className = "title";
    title.textContent = task.title;
    body.appendChild(title);

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.appendChild(createBadge("우선순위 " + priorityLabel(task.priority), "priority-" + task.priority));
    if (task.due_date !== null) {
      meta.appendChild(createBadge("마감 " + task.due_date, "due"));
    }
    if (overdue) {
      meta.appendChild(createBadge("지연", "overdue-badge"));
    }
    body.appendChild(meta);

    if (task.description !== "") {
      const description = document.createElement("p");
      description.className = "description";
      description.textContent = task.description;
      body.appendChild(description);
    }

    const actions = document.createElement("span");
    actions.className = "actions";
    actions.appendChild(createStatusSelect(task));
    actions.appendChild(createButton("수정", () => editTask(task.id)));
    actions.appendChild(createButton("삭제", () => deleteTask(task.id)));

    li.appendChild(body);
    li.appendChild(actions);
    taskList.appendChild(li);
  }
  emptyMessage.textContent = emptyText();
  emptyMessage.hidden = visibleTasks.length > 0;
}

form.addEventListener("submit", async function (event) {
  event.preventDefault();
  if (submitButton.disabled) {
    return;
  }
  const titleResult = validateTitle(input.value);
  if (titleResult.error) {
    errorMessage.textContent = titleResult.error;
    return;
  }
  const descriptionResult = validateDescription(descriptionInput.value);
  if (descriptionResult.error) {
    errorMessage.textContent = descriptionResult.error;
    return;
  }
  if (!isValidPriority(priorityInput.value)) {
    errorMessage.textContent = "우선순위를 올바르게 선택해 주세요.";
    return;
  }
  const dueDateResult = validateDueDate(dueDateInput.value);
  if (dueDateResult.error) {
    errorMessage.textContent = dueDateResult.error;
    return;
  }
  // 응답을 기다리는 동안 버튼을 막아 같은 항목이 두 번 등록되지 않게 한다.
  submitButton.disabled = true;
  const created = await mutate(() =>
    request("POST", "/api/tasks", {
      title: titleResult.title,
      description: descriptionResult.description,
      priority: priorityInput.value,
      due_date: dueDateResult.due_date,
    })
  );
  submitButton.disabled = false;
  if (created) {
    input.value = "";
    descriptionInput.value = "";
    priorityInput.value = DEFAULT_PRIORITY;
    dueDateInput.value = "";
    input.focus();
  }
});

searchInput.addEventListener("input", render);
statusFilter.addEventListener("change", render);
priorityFilter.addEventListener("change", render);

render();
loadTasks();
