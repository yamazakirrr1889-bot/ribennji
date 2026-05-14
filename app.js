const STORAGE_KEY = "ribennji.tasks.v2";

const statuses = [
  { id: "todo", label: "未着手" },
  { id: "doing", label: "進行中" },
  { id: "review", label: "確認" },
  { id: "done", label: "完了" },
];

const priorities = {
  low: { label: "低", rank: 1 },
  medium: { label: "中", rank: 2 },
  high: { label: "高", rank: 3 },
};

const state = {
  tasks: loadTasks(),
  view: "board",
  statusFilter: "all",
  priorityFilter: "all",
  search: "",
  sort: "due",
};

const elements = {
  totalCount: document.querySelector("#totalCount"),
  activeCount: document.querySelector("#activeCount"),
  soonCount: document.querySelector("#soonCount"),
  overdueCount: document.querySelector("#overdueCount"),
  taskForm: document.querySelector("#taskForm"),
  taskFormPanel: document.querySelector(".task-form-panel"),
  quickAddButton: document.querySelector("#quickAddButton"),
  closeFormButton: document.querySelector("#closeFormButton"),
  searchInput: document.querySelector("#searchInput"),
  priorityFilter: document.querySelector("#priorityFilter"),
  sortSelect: document.querySelector("#sortSelect"),
  boardView: document.querySelector("#boardView"),
  listView: document.querySelector("#listView"),
  focusView: document.querySelector("#focusView"),
  emptyState: document.querySelector("#emptyState"),
  cardTemplate: document.querySelector("#taskCardTemplate"),
  editDialog: document.querySelector("#editDialog"),
  editForm: document.querySelector("#editForm"),
  dialogCloseButton: document.querySelector("#dialogCloseButton"),
  deleteButton: document.querySelector("#deleteButton"),
  exportButton: document.querySelector("#exportButton"),
  importInput: document.querySelector("#importInput"),
};

render();

elements.taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const task = {
    id: crypto.randomUUID(),
    title: formData.get("title").trim(),
    project: formData.get("project").trim(),
    due: formData.get("due"),
    status: formData.get("status"),
    priority: formData.get("priority"),
    notes: formData.get("notes").trim(),
    createdAt: new Date().toISOString(),
  };

  if (!task.title) return;

  state.tasks.unshift(task);
  saveTasks();
  event.currentTarget.reset();
  document.querySelector('input[name="priority"][value="medium"]').checked = true;
  elements.taskFormPanel.classList.remove("is-open");
  render();
});

elements.quickAddButton.addEventListener("click", () => {
  elements.taskFormPanel.classList.add("is-open");
  document.querySelector("#titleInput").focus();
});

elements.closeFormButton.addEventListener("click", () => {
  elements.taskFormPanel.classList.remove("is-open");
});

elements.searchInput.addEventListener("input", (event) => {
  state.search = event.target.value;
  render();
});

elements.priorityFilter.addEventListener("change", (event) => {
  state.priorityFilter = event.target.value;
  render();
});

elements.sortSelect.addEventListener("change", (event) => {
  state.sort = event.target.value;
  render();
});

document.querySelectorAll(".tab-button").forEach((button) => {
  button.addEventListener("click", () => {
    state.view = button.dataset.view;
    document.querySelectorAll(".tab-button").forEach((tab) => {
      const isActive = tab === button;
      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-selected", String(isActive));
    });
    render();
  });
});

document.querySelectorAll(".filter-chip").forEach((button) => {
  button.addEventListener("click", () => {
    state.statusFilter = button.dataset.status;
    document.querySelectorAll(".filter-chip").forEach((chip) => {
      chip.classList.toggle("is-active", chip === button);
    });
    render();
  });
});

elements.dialogCloseButton.addEventListener("click", () => {
  elements.editDialog.close();
});

elements.editForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const id = document.querySelector("#editIdInput").value;
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;

  task.title = document.querySelector("#editTitleInput").value.trim();
  task.project = document.querySelector("#editProjectInput").value.trim();
  task.due = document.querySelector("#editDueInput").value;
  task.status = document.querySelector("#editStatusInput").value;
  task.priority = document.querySelector('input[name="editPriority"]:checked').value;
  task.notes = document.querySelector("#editNotesInput").value.trim();

  if (!task.title) return;

  saveTasks();
  elements.editDialog.close();
  render();
});

elements.deleteButton.addEventListener("click", () => {
  const id = document.querySelector("#editIdInput").value;
  state.tasks = state.tasks.filter((task) => task.id !== id);
  saveTasks();
  elements.editDialog.close();
  render();
});

elements.exportButton.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state.tasks, null, 2)], {
    type: "application/json",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "ribennji-tasks.json";
  link.click();
  URL.revokeObjectURL(link.href);
});

elements.importInput.addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file) return;

  try {
    const imported = JSON.parse(await file.text());
    if (!Array.isArray(imported)) throw new Error("Invalid task file");
    state.tasks = imported.filter(isTaskLike);
    saveTasks();
    render();
  } catch (error) {
    window.alert("読み込みできませんでした。");
  } finally {
    event.target.value = "";
  }
});

function render() {
  renderSummary();
  const tasks = getVisibleTasks();
  const hasTasks = tasks.length > 0;

  elements.boardView.hidden = state.view !== "board" || !hasTasks;
  elements.listView.hidden = state.view !== "list" || !hasTasks;
  elements.focusView.hidden = state.view !== "focus" || !hasTasks;
  elements.emptyState.hidden = hasTasks;

  if (state.view === "board") renderBoard(tasks);
  if (state.view === "list") renderList(tasks);
  if (state.view === "focus") renderFocus(tasks);
}

function renderSummary() {
  const now = startOfToday();
  const soon = addDays(now, 3);
  const activeTasks = state.tasks.filter((task) => task.status !== "done");
  const soonTasks = activeTasks.filter((task) => {
    const due = parseDate(task.due);
    return due && due >= now && due <= soon;
  });
  const overdueTasks = activeTasks.filter((task) => {
    const due = parseDate(task.due);
    return due && due < now;
  });

  elements.totalCount.textContent = String(state.tasks.length);
  elements.activeCount.textContent = String(activeTasks.length);
  elements.soonCount.textContent = String(soonTasks.length);
  elements.overdueCount.textContent = String(overdueTasks.length);
}

function renderBoard(tasks) {
  elements.boardView.replaceChildren();

  statuses.forEach((status) => {
    const column = document.createElement("section");
    column.className = "board-column";
    column.dataset.status = status.id;

    const head = document.createElement("div");
    head.className = "column-head";
    head.innerHTML = `<h2>${status.label}</h2><span class="column-count">0</span>`;

    const body = document.createElement("div");
    body.className = "column-body";
    body.addEventListener("dragover", (event) => {
      event.preventDefault();
      column.classList.add("is-over");
    });
    body.addEventListener("dragleave", () => {
      column.classList.remove("is-over");
    });
    body.addEventListener("drop", (event) => {
      event.preventDefault();
      column.classList.remove("is-over");
      const task = state.tasks.find((item) => item.id === event.dataTransfer.getData("text/plain"));
      if (!task) return;
      task.status = status.id;
      saveTasks();
      render();
    });

    const columnTasks = tasks.filter((task) => task.status === status.id);
    head.querySelector(".column-count").textContent = String(columnTasks.length);
    columnTasks.forEach((task) => body.append(createTaskCard(task)));

    column.append(head, body);
    elements.boardView.append(column);
  });
}

function renderList(tasks) {
  elements.listView.replaceChildren();

  tasks.forEach((task) => {
    const row = document.createElement("article");
    row.className = "list-row";
    row.innerHTML = `
      <div class="list-title">
        <strong>${escapeHtml(task.title)}</strong>
        <span>${escapeHtml(task.notes || "メモなし")}</span>
      </div>
      <span>${escapeHtml(task.project || "未分類")}</span>
      <span class="priority-pill ${task.priority}">${priorities[task.priority].label}</span>
      <span class="status-badge">${getStatusLabel(task.status)}</span>
      <button class="icon-button" type="button" title="編集" aria-label="編集">
        <span aria-hidden="true">✎</span>
      </button>
    `;
    row.querySelector("button").addEventListener("click", () => openEditDialog(task.id));
    elements.listView.append(row);
  });
}

function renderFocus(tasks) {
  elements.focusView.replaceChildren();
  const activeTasks = tasks.filter((task) => task.status !== "done");
  const [mainTask, ...rest] = activeTasks.length > 0 ? activeTasks : tasks;
  if (!mainTask) return;

  const main = document.createElement("section");
  main.className = "focus-main";
  main.innerHTML = `
    <div class="focus-title">
      <strong>${escapeHtml(mainTask.title)}</strong>
      <span>${escapeHtml(mainTask.project || "未分類")} · ${getStatusLabel(mainTask.status)}</span>
    </div>
    <span class="priority-pill ${mainTask.priority}">${priorities[mainTask.priority].label}</span>
    <p class="focus-notes">${escapeHtml(mainTask.notes || "メモなし")}</p>
    <div class="task-meta">${createMetaHtml(mainTask)}</div>
    <div class="focus-actions">
      <button class="primary-button" type="button" data-action="next">
        <span aria-hidden="true">→</span>
        <span>次へ</span>
      </button>
      <button class="secondary-button" type="button" data-action="edit">
        <span aria-hidden="true">✎</span>
        <span>編集</span>
      </button>
    </div>
  `;
  main.querySelector('[data-action="next"]').addEventListener("click", () => moveStatus(mainTask.id, 1));
  main.querySelector('[data-action="edit"]').addEventListener("click", () => openEditDialog(mainTask.id));

  const side = document.createElement("aside");
  side.className = "focus-side";
  rest.slice(0, 6).forEach((task) => {
    const button = document.createElement("button");
    button.className = "focus-mini";
    button.type = "button";
    button.innerHTML = `
      <strong>${escapeHtml(task.title)}</strong>
      <span>${escapeHtml(task.project || "未分類")} · ${formatDue(task)}</span>
    `;
    button.addEventListener("click", () => openEditDialog(task.id));
    side.append(button);
  });

  elements.focusView.append(main, side);
}

function createTaskCard(task) {
  const node = elements.cardTemplate.content.firstElementChild.cloneNode(true);
  node.dataset.id = task.id;
  node.classList.add(`priority-${task.priority}`);
  node.classList.toggle("is-overdue", isOverdue(task));
  node.querySelector("h3").textContent = task.title;
  node.querySelector(".task-notes").textContent = task.notes || "メモなし";
  node.querySelector(".task-meta").innerHTML = createMetaHtml(task);

  const priorityPill = node.querySelector(".priority-pill");
  priorityPill.classList.add(task.priority);
  priorityPill.textContent = priorities[task.priority].label;

  node.querySelector(".task-edit").addEventListener("click", () => openEditDialog(task.id));
  node.querySelector(".status-prev").addEventListener("click", () => moveStatus(task.id, -1));
  node.querySelector(".task-complete").addEventListener("click", () => setStatus(task.id, "done"));
  node.querySelector(".status-next").addEventListener("click", () => moveStatus(task.id, 1));

  node.addEventListener("dragstart", (event) => {
    node.classList.add("is-dragging");
    event.dataTransfer.setData("text/plain", task.id);
  });
  node.addEventListener("dragend", () => {
    node.classList.remove("is-dragging");
  });

  return node;
}

function createMetaHtml(task) {
  const dueClass = isOverdue(task) ? "danger" : isSoon(task) ? "soon" : "";
  return `
    <span class="meta-pill">${escapeHtml(task.project || "未分類")}</span>
    <span class="meta-pill ${dueClass}">${formatDue(task)}</span>
  `;
}

function openEditDialog(id) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;

  document.querySelector("#editIdInput").value = task.id;
  document.querySelector("#editTitleInput").value = task.title;
  document.querySelector("#editProjectInput").value = task.project;
  document.querySelector("#editDueInput").value = task.due;
  document.querySelector("#editStatusInput").value = task.status;
  document.querySelector(`#editForm input[name="editPriority"][value="${task.priority}"]`).checked = true;
  document.querySelector("#editNotesInput").value = task.notes;

  elements.editDialog.showModal();
}

function moveStatus(id, direction) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;
  const index = statuses.findIndex((status) => status.id === task.status);
  const nextIndex = Math.max(0, Math.min(statuses.length - 1, index + direction));
  task.status = statuses[nextIndex].id;
  saveTasks();
  render();
}

function setStatus(id, status) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;
  task.status = status;
  saveTasks();
  render();
}

function getVisibleTasks() {
  const query = state.search.trim().toLowerCase();
  return state.tasks
    .filter((task) => state.statusFilter === "all" || task.status === state.statusFilter)
    .filter((task) => state.priorityFilter === "all" || task.priority === state.priorityFilter)
    .filter((task) => {
      if (!query) return true;
      return [task.title, task.project, task.notes].some((value) => value.toLowerCase().includes(query));
    })
    .sort(sortTasks);
}

function sortTasks(a, b) {
  if (state.sort === "priority") {
    return priorities[b.priority].rank - priorities[a.priority].rank || compareDates(a.due, b.due);
  }
  if (state.sort === "created") {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  }
  return compareDates(a.due, b.due) || priorities[b.priority].rank - priorities[a.priority].rank;
}

function compareDates(a, b) {
  const aDate = a ? new Date(`${a}T00:00:00`).getTime() : Number.POSITIVE_INFINITY;
  const bDate = b ? new Date(`${b}T00:00:00`).getTime() : Number.POSITIVE_INFINITY;
  return aDate - bDate;
}

function loadTasks() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (Array.isArray(saved)) return saved.filter(isTaskLike);
  } catch (error) {
    localStorage.removeItem(STORAGE_KEY);
  }

  return createSeedTasks();
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
}

function createSeedTasks() {
  const today = startOfToday();
  return [
    {
      id: crypto.randomUUID(),
      title: "初回リリースのタスクを整理する",
      project: "Ribennji",
      due: toDateInput(addDays(today, 1)),
      status: "todo",
      priority: "high",
      notes: "必要な画面、データ項目、優先順位を決める。",
      createdAt: new Date().toISOString(),
    },
    {
      id: crypto.randomUUID(),
      title: "README に使い方を書く",
      project: "Docs",
      due: toDateInput(addDays(today, 3)),
      status: "doing",
      priority: "medium",
      notes: "ローカルでの開き方と今後の予定を残す。",
      createdAt: new Date(Date.now() - 120000).toISOString(),
    },
    {
      id: crypto.randomUUID(),
      title: "完了タスクの見え方を確認する",
      project: "UI",
      due: toDateInput(today),
      status: "done",
      priority: "low",
      notes: "一覧、ボード、集中ビューで違和感がないか見る。",
      createdAt: new Date(Date.now() - 240000).toISOString(),
    },
  ];
}

function isTaskLike(task) {
  return Boolean(
    task &&
      typeof task.id === "string" &&
      typeof task.title === "string" &&
      statuses.some((status) => status.id === task.status) &&
      Object.prototype.hasOwnProperty.call(priorities, task.priority)
  );
}

function formatDue(task) {
  if (!task.due) return "期限なし";
  const date = parseDate(task.due);
  if (!date) return "期限なし";

  const today = startOfToday();
  const diff = Math.round((date - today) / 86400000);
  if (diff === 0) return "今日";
  if (diff === 1) return "明日";
  if (diff === -1) return "昨日";
  if (diff < 0) return `${Math.abs(diff)}日超過`;
  return `${diff}日後`;
}

function getStatusLabel(statusId) {
  return statuses.find((status) => status.id === statusId)?.label || statusId;
}

function isOverdue(task) {
  const due = parseDate(task.due);
  return Boolean(due && due < startOfToday() && task.status !== "done");
}

function isSoon(task) {
  const due = parseDate(task.due);
  const today = startOfToday();
  return Boolean(due && due >= today && due <= addDays(today, 3) && task.status !== "done");
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
