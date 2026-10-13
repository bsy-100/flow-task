const MAX_TITLE_LENGTH = 100;
const STORAGE_KEY = "task-flow-v1";

const form = document.getElementById("task-form");
const input = document.getElementById("title-input");
const errorMessage = document.getElementById("error-message");
const taskList = document.getElementById("task-list");
const emptyMessage = document.getElementById("empty-message");

let tasks = [];
let nextId = 1;
let storageError = "";

function isValidTask(task) {
  return (
    task !== null &&
    typeof task === "object" &&
    Number.isInteger(task.id) &&
    task.id > 0 &&
    typeof task.title === "string"
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
  return { tasks: parsed };
}

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    return true;
  } catch (e) {
    return false;
  }
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

function render() {
  taskList.replaceChildren();
  for (const task of tasks) {
    const li = document.createElement("li");
    li.textContent = task.title;
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
  const newTask = { id: nextId, title: result.title };
  tasks.push(newTask);
  if (!saveTasks()) {
    tasks.pop();
    errorMessage.textContent = "저장하지 못했습니다. 다시 시도해 주세요.";
    return;
  }
  nextId += 1;
  errorMessage.textContent = "";
  input.value = "";
  input.focus();
  render();
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
