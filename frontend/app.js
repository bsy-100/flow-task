const MAX_TITLE_LENGTH = 100;

const form = document.getElementById("task-form");
const input = document.getElementById("title-input");
const errorMessage = document.getElementById("error-message");
const taskList = document.getElementById("task-list");
const emptyMessage = document.getElementById("empty-message");

const tasks = [];
let nextId = 1;

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
  const result = validateTitle(input.value);
  if (result.error) {
    errorMessage.textContent = result.error;
    return;
  }
  errorMessage.textContent = "";
  tasks.push({ id: nextId++, title: result.title });
  input.value = "";
  input.focus();
  render();
});

render();
