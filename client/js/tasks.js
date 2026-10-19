/**
 * Task Manager Pro - Complete Tasks Controller (List, Kanban, Filter, Search, Sort, CRUD)
 */

let allTasks = [];
let currentView = 'list'; // 'list' | 'kanban'

document.addEventListener('DOMContentLoaded', () => {
  auth.checkAuthGuard(false);
  initTaskPage();
});

function initTaskPage() {
  readQueryParams();
  setupEventListeners();
  loadTasks();
}

function readQueryParams() {
  const params = new URLSearchParams(window.location.search);

  if (params.has('status')) {
    const statusSelect = document.getElementById('filterStatus');
    if (statusSelect) statusSelect.value = params.get('status');
  }

  if (params.has('priority')) {
    const prioritySelect = document.getElementById('filterPriority');
    if (prioritySelect) prioritySelect.value = params.get('priority');
  }

  if (params.has('sort')) {
    const sortSelect = document.getElementById('filterSort');
    if (sortSelect) sortSelect.value = params.get('sort');
  }

  if (params.has('search')) {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = params.get('search');
  }

  if (params.has('view')) {
    currentView = params.get('view') === 'kanban' ? 'kanban' : 'list';
    updateViewButtons();
  }
}

function syncQueryParams() {
  const search = document.getElementById('searchInput')?.value.trim() || '';
  const status = document.getElementById('filterStatus')?.value || 'all';
  const priority = document.getElementById('filterPriority')?.value || 'all';
  const sort = document.getElementById('filterSort')?.value || 'newest';

  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (status !== 'all') params.set('status', status);
  if (priority !== 'all') params.set('priority', priority);
  if (sort !== 'newest') params.set('sort', sort);
  if (currentView !== 'list') params.set('view', currentView);

  const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
  window.history.replaceState({}, '', newUrl);
}

function setupEventListeners() {
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener(
      'input',
      utils.debounce(() => {
        syncQueryParams();
        loadTasks();
      }, 300)
    );
  }

  ['filterStatus', 'filterPriority', 'filterSort'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', () => {
        syncQueryParams();
        loadTasks();
      });
    }
  });

  // Task form submission (Create or Update)
  const taskForm = document.getElementById('taskForm');
  if (taskForm) {
    taskForm.addEventListener('submit', handleTaskFormSubmit);
  }
}

function switchView(view) {
  currentView = view;
  updateViewButtons();
  syncQueryParams();
  renderTasks();
}

function updateViewButtons() {
  const listViewBtn = document.getElementById('listViewBtn');
  const kanbanViewBtn = document.getElementById('kanbanViewBtn');

  if (listViewBtn && kanbanViewBtn) {
    if (currentView === 'list') {
      listViewBtn.classList.add('btn-primary');
      listViewBtn.classList.remove('btn-secondary');
      kanbanViewBtn.classList.remove('btn-primary');
      kanbanViewBtn.classList.add('btn-secondary');
    } else {
      kanbanViewBtn.classList.add('btn-primary');
      kanbanViewBtn.classList.remove('btn-secondary');
      listViewBtn.classList.remove('btn-primary');
      listViewBtn.classList.add('btn-secondary');
    }
  }
}

async function loadTasks() {
  const loadingEl = document.getElementById('tasksLoading');
  const container = document.getElementById('tasksContainer');

  if (loadingEl) loadingEl.style.display = 'block';

  try {
    const search = document.getElementById('searchInput')?.value.trim() || '';
    const status = document.getElementById('filterStatus')?.value || 'all';
    const priority = document.getElementById('filterPriority')?.value || 'all';
    const sort = document.getElementById('filterSort')?.value || 'newest';

    const params = { limit: 100 };
    if (search) params.search = search;
    if (status !== 'all') params.status = status;
    if (priority !== 'all') params.priority = priority;
    if (sort) params.sort = sort;

    const res = await api.get('/tasks', params);
    if (res.success && res.data) {
      allTasks = res.data.tasks || [];
      renderTasks();
      updateHeaderCount(res.meta ? res.meta.total : allTasks.length);
    }
  } catch (err) {
    utils.showToast(err.message || 'Failed to load tasks', 'error');
  } finally {
    if (loadingEl) loadingEl.style.display = 'none';
  }
}

function updateHeaderCount(count) {
  const countEl = document.getElementById('tasksCountBadge');
  if (countEl) countEl.textContent = `${count} ${count === 1 ? 'task' : 'tasks'}`;
}

function renderTasks() {
  const container = document.getElementById('tasksContainer');
  if (!container) return;

  if (allTasks.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
        </div>
        <h3 class="empty-title">No tasks found</h3>
        <p class="empty-desc">No tasks match your current filter or search criteria. Try adjusting your filters or create a new task.</p>
        <button class="btn btn-primary" onclick="openCreateTaskModal()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Create New Task
        </button>
      </div>
    `;
    return;
  }

  if (currentView === 'list') {
    renderListView(container);
  } else {
    renderKanbanView(container);
  }
}

function renderListView(container) {
  container.innerHTML = `
    <div class="task-list">
      ${allTasks.map((task) => renderTaskCard(task)).join('')}
    </div>
  `;
}

function renderKanbanView(container) {
  const todoTasks = allTasks.filter((t) => t.status === 'todo');
  const inProgressTasks = allTasks.filter((t) => t.status === 'in-progress');
  const completedTasks = allTasks.filter((t) => t.status === 'completed');

  container.innerHTML = `
    <div class="kanban-board">
      <div class="kanban-col">
        <div class="kanban-col-header">
          <div class="kanban-col-title">
            <span style="width: 10px; height: 10px; border-radius: 50%; background: #8b5cf6;"></span>
            To Do
          </div>
          <span class="kanban-count">${todoTasks.length}</span>
        </div>
        <div class="kanban-tasks">
          ${todoTasks.length ? todoTasks.map((t) => renderTaskCard(t, true)).join('') : '<p class="text-muted" style="font-size:0.85rem; text-align:center; padding:1.5rem 0;">No tasks</p>'}
        </div>
      </div>

      <div class="kanban-col">
        <div class="kanban-col-header">
          <div class="kanban-col-title">
            <span style="width: 10px; height: 10px; border-radius: 50%; background: #3b82f6;"></span>
            In Progress
          </div>
          <span class="kanban-count">${inProgressTasks.length}</span>
        </div>
        <div class="kanban-tasks">
          ${inProgressTasks.length ? inProgressTasks.map((t) => renderTaskCard(t, true)).join('') : '<p class="text-muted" style="font-size:0.85rem; text-align:center; padding:1.5rem 0;">No tasks</p>'}
        </div>
      </div>

      <div class="kanban-col">
        <div class="kanban-col-header">
          <div class="kanban-col-title">
            <span style="width: 10px; height: 10px; border-radius: 50%; background: #10b981;"></span>
            Completed
          </div>
          <span class="kanban-count">${completedTasks.length}</span>
        </div>
        <div class="kanban-tasks">
          ${completedTasks.length ? completedTasks.map((t) => renderTaskCard(t, true)).join('') : '<p class="text-muted" style="font-size:0.85rem; text-align:center; padding:1.5rem 0;">No tasks</p>'}
        </div>
      </div>
    </div>
  `;
}

function renderTaskCard(task, isKanban = false) {
  const overdue = utils.isOverdue(task.dueDate, task.status);
  const dueToday = utils.isDueToday(task.dueDate);
  const isCompleted = task.status === 'completed';

  let dueClass = '';
  if (overdue) dueClass = 'due-overdue';
  else if (dueToday) dueClass = 'due-today';

  const tagsHtml =
    task.tags && task.tags.length > 0
      ? task.tags.map((tag) => `<span class="badge badge-tag">#${utils.escapeHtml(tag)}</span>`).join('')
      : '';

  return `
    <div class="task-card ${isCompleted ? 'is-completed' : ''} ${overdue ? 'is-overdue' : ''}" id="task-${task._id}">
      <input 
        type="checkbox" 
        class="task-checkbox" 
        ${isCompleted ? 'checked' : ''} 
        onchange="toggleTaskStatus('${task._id}', this.checked)"
        title="Mark task as ${isCompleted ? 'pending' : 'completed'}"
      />
      
      <div class="task-content">
        <div class="task-header">
          <span class="task-title" onclick="openEditTaskModal('${task._id}')">${utils.escapeHtml(task.title)}</span>
          <div style="display:flex; align-items:center; gap:0.5rem;">
            <span class="badge badge-${task.priority}">${task.priority}</span>
            <span class="badge badge-status ${task.status}">${task.status}</span>
          </div>
        </div>

        ${task.description ? `<p class="task-desc">${utils.escapeHtml(task.description)}</p>` : ''}

        <div class="task-meta">
          ${
            task.dueDate
              ? `
            <span class="task-due ${dueClass}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
              ${utils.formatRelativeDate(task.dueDate)}
            </span>
          `
              : ''
          }
          ${tagsHtml}
        </div>
      </div>

      <div class="task-actions">
        <button class="btn btn-ghost btn-icon btn-sm" onclick="openEditTaskModal('${task._id}')" title="Edit Task">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
        </button>
        <button class="btn btn-ghost btn-icon btn-sm" onclick="confirmDeleteTask('${task._id}', '${utils.escapeHtml(task.title).replace(/'/g, "\\'")}')" title="Delete Task">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </div>
    </div>
  `;
}

async function toggleTaskStatus(taskId, isChecked) {
  const newStatus = isChecked ? 'completed' : 'todo';
  try {
    await api.patch(`/tasks/${taskId}/status`, { status: newStatus });
    utils.showToast(`Task updated to ${newStatus}`, 'success');
    
    // Update local task
    const target = allTasks.find((t) => t._id === taskId);
    if (target) {
      target.status = newStatus;
      target.completedAt = isChecked ? new Date().toISOString() : null;
    }
    renderTasks();
  } catch (err) {
    utils.showToast(err.message || 'Failed to update task status', 'error');
    loadTasks();
  }
}

function openCreateTaskModal() {
  document.getElementById('taskModalTitle').textContent = 'Create New Task';
  document.getElementById('taskId').value = '';
  document.getElementById('taskForm').reset();
  utils.openModal('taskModal');
  setTimeout(() => {
    document.getElementById('taskTitle')?.focus();
  }, 80);
}

function closeTaskModal() {
  utils.closeModal('taskModal');
}

function openEditTaskModal(taskId) {
  const task = allTasks.find((t) => t._id === taskId);
  if (!task) return;

  document.getElementById('taskModalTitle').textContent = 'Edit Task';
  document.getElementById('taskId').value = task._id;
  document.getElementById('taskTitle').value = task.title;
  document.getElementById('taskDesc').value = task.description || '';
  document.getElementById('taskStatus').value = task.status || 'todo';
  document.getElementById('taskPriority').value = task.priority || 'medium';
  
  if (task.dueDate) {
    // Format to YYYY-MM-DD for date input
    const d = new Date(task.dueDate);
    const dateFormatted = d.toISOString().split('T')[0];
    document.getElementById('taskDueDate').value = dateFormatted;
  } else {
    document.getElementById('taskDueDate').value = '';
  }

  document.getElementById('taskTags').value = task.tags ? task.tags.join(', ') : '';

  utils.openModal('taskModal');
}

async function handleTaskFormSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const submitBtn = form.querySelector('button[type="submit"]');
  const taskId = document.getElementById('taskId').value;
  const title = document.getElementById('taskTitle').value.trim();
  const description = document.getElementById('taskDesc').value.trim();
  const status = document.getElementById('taskStatus').value;
  const priority = document.getElementById('taskPriority').value;
  const dueDateVal = document.getElementById('taskDueDate').value;
  const tagsVal = document.getElementById('taskTags').value;

  if (!title) {
    utils.showToast('Please enter a task title', 'error');
    return;
  }

  // Parse tags from comma-separated string into a proper array
  const tagsArray = tagsVal
    ? tagsVal.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
    : [];

  const payload = {
    title,
    description,
    status,
    priority,
    dueDate: dueDateVal || null,
    tags: tagsArray
  };

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';
  }

  try {
    if (taskId) {
      await api.put(`/tasks/${taskId}`, payload);
      utils.showToast('Task updated successfully!', 'success');
    } else {
      await api.post('/tasks', payload);
      utils.showToast('Task created successfully!', 'success');
    }

    closeTaskModal();
    loadTasks();
  } catch (err) {
    utils.showToast(err.message || 'Failed to save task', 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Task';
    }
  }
}

function confirmDeleteTask(taskId, taskTitle) {
  utils.showConfirmModal({
    title: 'Delete Task?',
    message: `Are you sure you want to permanently delete "${taskTitle}"? This action cannot be undone.`,
    confirmText: 'Delete Task',
    confirmClass: 'btn-danger',
    onConfirm: async () => {
      try {
        await api.delete(`/tasks/${taskId}`);
        utils.showToast('Task deleted successfully', 'success');
        allTasks = allTasks.filter((t) => t._id !== taskId);
        renderTasks();
        updateHeaderCount(allTasks.length);
      } catch (err) {
        utils.showToast(err.message || 'Failed to delete task', 'error');
      }
    }
  });
}

// Export Tasks as JSON or CSV
function exportTasks(format = 'json') {
  if (allTasks.length === 0) {
    utils.showToast('No tasks to export', 'info');
    return;
  }

  if (format === 'json') {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(allTasks, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `tasks_export_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  } else if (format === 'csv') {
    const headers = ['ID', 'Title', 'Status', 'Priority', 'DueDate', 'Tags', 'CreatedAt'];
    const rows = allTasks.map((t) => [
      `"${t._id}"`,
      `"${(t.title || '').replace(/"/g, '""')}"`,
      `"${t.status}"`,
      `"${t.priority}"`,
      `"${t.dueDate ? new Date(t.dueDate).toISOString() : ''}"`,
      `"${(t.tags || []).join(';')}"`,
      `"${new Date(t.createdAt).toISOString()}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', encodeURI(csvContent));
    downloadAnchor.setAttribute('download', `tasks_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  utils.showToast(`Exported tasks as ${format.toUpperCase()}`, 'success');
}

window.switchView = switchView;
window.toggleTaskStatus = toggleTaskStatus;
window.openCreateTaskModal = openCreateTaskModal;
window.closeTaskModal = closeTaskModal;
window.openEditTaskModal = openEditTaskModal;
window.confirmDeleteTask = confirmDeleteTask;
window.exportTasks = exportTasks;
