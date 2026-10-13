const MAX_TITLE_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 2000;
const STORAGE_KEY = "task-flow-v1";
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
const DEFAULT_STATUS = "TODO";
const DEFAULT_PRIORITY = "NORMAL";

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

let tasks = [];
let nextId = 1;
let storageError = "";

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

// 이전 단계(T02·T03)에서 저장된 항목에는 없는 필드가 있을 수 있어 선택값으로 허용한다.
function isValidTask(task) {
  return (
    task !== null &&
    typeof task === "object" &&
    Number.isInteger(task.id) &&
    task.id > 0 &&
    typeof task.title === "string" &&
    (task.status === undefined || isValidStatus(task.status)) &&
    (task.description === undefined ||
      (typeof task.description === "string" && task.description.length <= MAX_DESCRIPTION_LENGTH)) &&
    (task.priority === undefined || isValidPriority(task.priority)) &&
    (task.due_date === undefined || task.due_date === null || isValidDate(task.due_date)) &&
    (task.created_at === undefined || task.created_at === null || typeof task.created_at === "string")
  );
}

function loadTasks() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    return { error: "브라우저 저장소를 읽을 수 없습니다. 저장하지 않습니다." };
  }
  if (raw === null) {
    return { tasks: [] };
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return { error: "저장된 데이터가 손상되어 불러오지 못했습니다. 기존 값은 그대로 두었습니다." };
  }
  if (!Array.isArray(parsed) || !parsed.every(isValidTask)) {
    return { error: "저장된 데이터 형식이 올바르지 않습니다. 기존 값은 그대로 두었습니다." };
  }
  // 없는 필드는 기본값으로 채워 화면에서만 사용한다. 저장값은 바꾸지 않는다.
  return {
    tasks: parsed.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description || "",
      status: task.status || DEFAULT_STATUS,
      priority: task.priority || DEFAULT_PRIORITY,
      due_date: task.due_date || null,
      created_at: task.created_at || null,
    })),
  };
}

function saveTasks(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch (e) {
    return false;
  }
}

// 새 목록을 저장한 뒤에만 화면 상태에 반영한다. 저장에 실패하면 기존 목록을 유지한다.
function commit(newTasks) {
  if (!saveTasks(newTasks)) {
    errorMessage.textContent = "저장하지 못했습니다. 다시 시도해 주세요.";
    return false;
  }
  tasks = newTasks;
  errorMessage.textContent = "";
  render();
  return true;
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

function changeStatus(id, status) {
  if (storageError) {
    errorMessage.textContent = storageError;
    render();
    return;
  }
  if (!isValidStatus(status)) {
    return;
  }
  const changed = commit(tasks.map((t) => (t.id === id ? { ...t, status: status } : t)));
  if (!changed) {
    render();
  }
}

// 제목과 설명을 차례로 수정한다. 어느 단계에서든 취소하면 아무것도 바꾸지 않는다.
function editTask(id) {
  if (storageError) {
    errorMessage.textContent = storageError;
    return;
  }
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
  commit(
    tasks.map((t) =>
      t.id === id ? { ...t, title: titleResult.title, description: descriptionResult.description } : t
    )
  );
}

function deleteTask(id) {
  if (storageError) {
    errorMessage.textContent = storageError;
    return;
  }
  const target = tasks.find((t) => t.id === id);
  if (!target) {
    return;
  }
  if (!window.confirm("이 할 일을 삭제할까요?\n" + target.title)) {
    return;
  }
  commit(tasks.filter((t) => t.id !== id));
}

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
  emptyMessage.textContent =
    tasks.length === 0 ? "등록된 할 일이 없습니다." : "조건에 맞는 할 일이 없습니다.";
  emptyMessage.hidden = visibleTasks.length > 0;
}

searchInput.addEventListener("input", render);
statusFilter.addEventListener("change", render);
priorityFilter.addEventListener("change", render);

form.addEventListener("submit", function (event) {
  event.preventDefault();
  if (storageError) {
    errorMessage.textContent = storageError;
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
  const newTask = {
    id: nextId,
    title: titleResult.title,
    description: descriptionResult.description,
    status: DEFAULT_STATUS,
    priority: priorityInput.value,
    due_date: dueDateResult.due_date,
    created_at: new Date().toISOString(),
  };
  if (!commit(tasks.concat(newTask))) {
    return;
  }
  nextId += 1;
  input.value = "";
  descriptionInput.value = "";
  priorityInput.value = DEFAULT_PRIORITY;
  dueDateInput.value = "";
  input.focus();
});

const loaded = loadTasks();
if (loaded.error) {
  storageError = loaded.error;
  errorMessage.textContent = storageError;
} else {
  tasks = loaded.tasks;
  nextId = tasks.reduce((max, task) => Math.max(max, task.id), 0) + 1;
}
render();
