const MAX_TITLE_LENGTH = 100;
const STORAGE_KEY = "task-flow-v1";
const STATUSES = [
  { value: "TODO", label: "할 일" },
  { value: "DOING", label: "진행 중" },
  { value: "DONE", label: "완료" },
];
const DEFAULT_STATUS = "TODO";

const form = document.getElementById("task-form");
const input = document.getElementById("title-input");
const errorMessage = document.getElementById("error-message");
const taskList = document.getElementById("task-list");
const emptyMessage = document.getElementById("empty-message");

let tasks = [];
let nextId = 1;
let storageError = "";

function isValidStatus(status) {
  return STATUSES.some((s) => s.value === status);
}

function isValidTask(task) {
  return (
    task !== null &&
    typeof task === "object" &&
    Number.isInteger(task.id) &&
    task.id > 0 &&
    typeof task.title === "string" &&
    (task.status === undefined || isValidStatus(task.status))
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
  // T02에서 저장된 항목에는 status가 없으므로 기본값을 채운다.
  return {
    tasks: parsed.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status || DEFAULT_STATUS,
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

function editTitle(id) {
  if (storageError) {
    errorMessage.textContent = storageError;
    return;
  }
  const target = tasks.find((t) => t.id === id);
  if (!target) {
    return;
  }
  const answer = window.prompt("제목을 수정하세요.", target.title);
  if (answer === null) {
    return;
  }
  const result = validateTitle(answer);
  if (result.error) {
    errorMessage.textContent = result.error;
    return;
  }
  commit(tasks.map((t) => (t.id === id ? { ...t, title: result.title } : t)));
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

function render() {
  taskList.replaceChildren();
  for (const task of tasks) {
    const li = document.createElement("li");
    li.dataset.id = String(task.id);
    if (task.status === "DONE") {
      li.classList.add("done");
    }

    const title = document.createElement("span");
    title.className = "title";
    title.textContent = task.title;

    const actions = document.createElement("span");
    actions.className = "actions";
    actions.appendChild(createStatusSelect(task));
    actions.appendChild(createButton("수정", () => editTitle(task.id)));
    actions.appendChild(createButton("삭제", () => deleteTask(task.id)));

    li.appendChild(title);
    li.appendChild(actions);
    taskList.appendChild(li);
  }
  emptyMessage.hidden = tasks.length > 0;
}

form.addEventListener("submit", function (event) {
  event.preventDefault();
  if (storageError) {
    errorMessage.textContent = storageError;
    return;
  }
  const result = validateTitle(input.value);
  if (result.error) {
    errorMessage.textContent = result.error;
    return;
  }
  const newTask = { id: nextId, title: result.title, status: DEFAULT_STATUS };
  if (!commit(tasks.concat(newTask))) {
    return;
  }
  nextId += 1;
  input.value = "";
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
