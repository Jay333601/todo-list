/**
 * TaskFlow — Modern Vanilla JS To-Do Application
 * Implements complete CRUD operations backed by localStorage.
 */

// ============================================================================
// 1. Application State & Constants
// ============================================================================
const STORAGE_KEY_TASKS = 'taskflow_tasks_v1';
const STORAGE_KEY_THEME = 'taskflow_theme_v1';

let tasks = [];
let currentFilter = 'all'; // 'all' | 'active' | 'completed'
let searchQuery = '';
let editingTaskId = null;  // Tracks which task is currently in inline edit mode

// ============================================================================
// 2. DOM Element References
// ============================================================================
const taskForm = document.getElementById('task-form');
const titleInput = document.getElementById('task-title');
const notesInput = document.getElementById('task-notes');
const priorityInput = document.getElementById('task-priority');
const dueDateInput = document.getElementById('task-due-date');

const searchInput = document.getElementById('search-input');
const filterBtns = document.querySelectorAll('.filter-btn');
const activeCountEl = document.getElementById('active-count');
const clearCompletedBtn = document.getElementById('clear-completed-btn');

const taskListEl = document.getElementById('task-list');
const emptyStateEl = document.getElementById('empty-state');
const emptyTitleEl = document.getElementById('empty-title');
const emptySubtitleEl = document.getElementById('empty-subtitle');
const themeToggleBtn = document.getElementById('theme-toggle');

// ============================================================================
// 3. LocalStorage & Theme Helpers
// ============================================================================

/**
 * Loads tasks from localStorage into the application state array.
 */
function loadTasksFromStorage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_TASKS);
    tasks = stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to parse tasks from localStorage:', error);
    tasks = [];
  }
}

/**
 * Saves the current tasks array to localStorage.
 */
function saveTasksToStorage() {
  localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(tasks));
}

/**
 * Initializes and persists Light / Dark theme preference.
 */
function initTheme() {
  const savedTheme = localStorage.getItem(STORAGE_KEY_THEME) || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', nextTheme);
  localStorage.setItem(STORAGE_KEY_THEME, nextTheme);
}

// ============================================================================
// 4. CRUD Operations
// ============================================================================

/**
 * CREATE: Creates a new task object, saves to localStorage, and re-renders.
 */
function createTask(title, notes, priority, dueDate) {
  const cleanTitle = title.trim();
  if (!cleanTitle) return;

  const newTask = {
    id: Date.now(),
    title: cleanTitle,
    notes: notes.trim(),
    priority: priority || 'Medium',
    dueDate: dueDate || '',
    completed: false,
    createdAt: new Date().toISOString()
  };

  // Add newest task to the top of the list
  tasks.unshift(newTask);
  saveTasksToStorage();
  renderTasks();
}

/**
 * READ: Filters tasks by status & search query, updates counters, and renders DOM.
 */
function renderTasks() {
  // 1. Update active tasks counter
  const activeTasksCount = tasks.filter(t => !t.completed).length;
  const completedTasksCount = tasks.length - activeTasksCount;
  activeCountEl.textContent = `${activeTasksCount} ${activeTasksCount === 1 ? 'task' : 'tasks'} remaining`;

  // Show or hide the "Clear Completed" button depending on if completed tasks exist
  clearCompletedBtn.style.visibility = completedTasksCount > 0 ? 'visible' : 'hidden';

  // 2. Filter tasks based on active tab ('all', 'active', 'completed') and search query
  const filteredTasks = tasks.filter(task => {
    const matchesStatus =
      currentFilter === 'all' ||
      (currentFilter === 'active' && !task.completed) ||
      (currentFilter === 'completed' && task.completed);

    const matchesSearch = task.title
      .toLowerCase()
      .includes(searchQuery.trim().toLowerCase());

    return matchesStatus && matchesSearch;
  });

  // 3. Clear current task list container
  taskListEl.innerHTML = '';

  // 4. Handle Empty State if no tasks match
  if (filteredTasks.length === 0) {
    emptyStateEl.classList.remove('hidden');

    if (tasks.length === 0) {
      emptyTitleEl.textContent = 'No tasks yet';
      emptySubtitleEl.textContent = 'Add a task above to start organizing your day.';
    } else if (searchQuery.trim() !== '') {
      emptyTitleEl.textContent = 'No matching tasks found';
      emptySubtitleEl.textContent = `No tasks match "${searchQuery}". Try a different search term.`;
    } else if (currentFilter === 'active') {
      emptyTitleEl.textContent = 'All caught up!';
      emptySubtitleEl.textContent = 'You have no active tasks remaining.';
    } else if (currentFilter === 'completed') {
      emptyTitleEl.textContent = 'No completed tasks';
      emptySubtitleEl.textContent = 'Check off a task to see it appear here.';
    }
    return;
  }

  emptyStateEl.classList.add('hidden');

  // 5. Render each task card into the DOM
  filteredTasks.forEach(task => {
    const card = document.createElement('div');

    if (editingTaskId === task.id) {
      card.className = 'task-card editing';
      card.innerHTML = getInlineEditTemplate(task);
    } else {
      card.className = `task-card ${task.completed ? 'completed' : ''}`;
      card.innerHTML = getTaskCardTemplate(task);
    }

    taskListEl.appendChild(card);
  });
}

/**
 * UPDATE (Edit): Saves modified fields for a specific task ID and exits edit mode.
 */
function updateTask(id, updatedFields) {
  const cleanTitle = updatedFields.title.trim();
  if (!cleanTitle) return;

  tasks = tasks.map(task => {
    if (task.id === id) {
      return {
        ...task,
        title: cleanTitle,
        notes: updatedFields.notes.trim(),
        priority: updatedFields.priority,
        dueDate: updatedFields.dueDate
      };
    }
    return task;
  });

  editingTaskId = null;
  saveTasksToStorage();
  renderTasks();
}

/**
 * UPDATE (Toggle Status): Flips the completed boolean state of a task by ID.
 */
function toggleComplete(id) {
  tasks = tasks.map(task => {
    if (task.id === id) {
      return { ...task, completed: !task.completed };
    }
    return task;
  });

  saveTasksToStorage();
  renderTasks();
}

/**
 * DELETE (Single): Removes a specific task by ID from state and localStorage.
 */
function deleteTask(id) {
  tasks = tasks.filter(task => task.id !== id);
  if (editingTaskId === id) {
    editingTaskId = null;
  }
  saveTasksToStorage();
  renderTasks();
}

/**
 * DELETE (Bulk): Removes all completed tasks at once.
 */
function clearCompleted() {
  tasks = tasks.filter(task => !task.completed);
  saveTasksToStorage();
  renderTasks();
}

// ============================================================================
// 5. HTML Templates & Formatting Utilities
// ============================================================================

/**
 * Escapes HTML special characters to prevent XSS injection.
 */
function escapeHTML(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Formats a YYYY-MM-DD date string into a friendly format (e.g., "Nov 24, 2026").
 */
function formatDueDate(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);
  return dateObj.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Checks if a task's due date is before today and not yet completed.
 */
function isOverdue(dateStr, completed) {
  if (!dateStr || completed) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [year, month, day] = dateStr.split('-').map(Number);
  const due = new Date(year, month - 1, day);
  return due < today;
}

/**
 * Generates HTML markup for a standard Task Card.
 */
function getTaskCardTemplate(task) {
  const priorityClass = `badge-${task.priority.toLowerCase()}`;
  const overdue = isOverdue(task.dueDate, task.completed);

  return `
    <div class="task-left">
      <button
        type="button"
        class="checkbox-btn"
        data-action="toggle"
        data-id="${task.id}"
        aria-label="${task.completed ? 'Mark task as incomplete' : 'Mark task as complete'}"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </button>

      <div class="task-content">
        <div class="task-header">
          <span class="task-title">${escapeHTML(task.title)}</span>
        </div>

        ${task.notes ? `<p class="task-notes">${escapeHTML(task.notes)}</p>` : ''}

        <div class="task-meta">
          <span class="badge ${priorityClass}">${escapeHTML(task.priority)} Priority</span>

          ${task.dueDate ? `
            <span class="meta-item ${overdue ? 'overdue' : ''}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              ${overdue ? 'Overdue • ' : 'Due '}${formatDueDate(task.dueDate)}
            </span>
          ` : ''}
        </div>
      </div>
    </div>

    <div class="task-actions">
      <button
        type="button"
        class="action-btn edit-btn"
        data-action="edit"
        data-id="${task.id}"
        title="Edit Task"
        aria-label="Edit Task"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
      </button>

      <button
        type="button"
        class="action-btn delete-btn"
        data-action="delete"
        data-id="${task.id}"
        title="Delete Task"
        aria-label="Delete Task"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          <line x1="10" y1="11" x2="10" y2="17"></line>
          <line x1="14" y1="11" x2="14" y2="17"></line>
        </svg>
      </button>
    </div>
  `;
}

/**
 * Generates HTML markup for the Inline Edit Form inside a task card.
 */
function getInlineEditTemplate(task) {
  return `
    <form class="inline-edit-form" data-id="${task.id}">
      <div class="form-group">
        <label>Task Title <span class="required">*</span></label>
        <input type="text" name="edit-title" value="${escapeHTML(task.title)}" required autocomplete="off">
      </div>

      <div class="form-group">
        <label>Description / Notes</label>
        <textarea name="edit-notes" rows="2">${escapeHTML(task.notes)}</textarea>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Priority Level</label>
          <select name="edit-priority">
            <option value="Low" ${task.priority === 'Low' ? 'selected' : ''}>Low Priority</option>
            <option value="Medium" ${task.priority === 'Medium' ? 'selected' : ''}>Medium Priority</option>
            <option value="High" ${task.priority === 'High' ? 'selected' : ''}>High Priority</option>
          </select>
        </div>

        <div class="form-group">
          <label>Due Date</label>
          <input type="date" name="edit-due-date" value="${escapeHTML(task.dueDate)}">
        </div>
      </div>

      <div class="edit-actions">
        <button type="button" class="btn btn-secondary" data-action="cancel-edit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
          Cancel
        </button>

        <button type="submit" class="btn btn-primary">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
            <polyline points="17 21 17 13 7 13 7 21"></polyline>
            <polyline points="7 3 7 8 15 8"></polyline>
          </svg>
          Save Changes
        </button>
      </div>
    </form>
  `;
}

// ============================================================================
// 6. Event Listeners
// ============================================================================

// Handle Create Task Form Submission
taskForm.addEventListener('submit', event => {
  event.preventDefault();
  createTask(
    titleInput.value,
    notesInput.value,
    priorityInput.value,
    dueDateInput.value
  );
  taskForm.reset();
  priorityInput.value = 'Medium';
  titleInput.focus();
});

// Handle Task Card Actions (Event Delegation for Toggle, Edit, Cancel, Delete)
taskListEl.addEventListener('click', event => {
  const actionBtn = event.target.closest('[data-action]');
  if (!actionBtn) return;

  const action = actionBtn.dataset.action;
  const taskId = Number(actionBtn.dataset.id);

  if (action === 'toggle') {
    toggleComplete(taskId);
  } else if (action === 'edit') {
    editingTaskId = taskId;
    renderTasks();
  } else if (action === 'cancel-edit') {
    editingTaskId = null;
    renderTasks();
  } else if (action === 'delete') {
    deleteTask(taskId);
  }
});

// Handle Inline Edit Form Submission
taskListEl.addEventListener('submit', event => {
  if (!event.target.matches('.inline-edit-form')) return;
  event.preventDefault();

  const form = event.target;
  const taskId = Number(form.dataset.id);

  const updatedFields = {
    title: form.elements['edit-title'].value,
    notes: form.elements['edit-notes'].value,
    priority: form.elements['edit-priority'].value,
    dueDate: form.elements['edit-due-date'].value
  };

  updateTask(taskId, updatedFields);
});

// Handle Filter Tabs ("All", "Active", "Completed")
filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    renderTasks();
  });
});

// Handle Real-Time Search Filtering
searchInput.addEventListener('input', event => {
  searchQuery = event.target.value;
  renderTasks();
});

// Handle Bulk Clear Completed Tasks
clearCompletedBtn.addEventListener('click', clearCompleted);

// Handle Dark / Light Theme Toggle
themeToggleBtn.addEventListener('click', toggleTheme);

// ============================================================================
// 7. Initialize Application on Page Load
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  loadTasksFromStorage();
  renderTasks();
});