/**
 * Task Manager Pro - Dashboard Logic
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Auth guard check
  auth.checkAuthGuard(false);

  // Initialize Dashboard
  loadDashboardData();
  setupQuickCreateForm();
});

async function loadDashboardData() {
  const loadingEl = document.getElementById('dashboardLoading');
  const contentEl = document.getElementById('dashboardContent');

  try {
    const res = await api.get('/tasks/stats/dashboard');
    if (res.success && res.data && res.data.stats) {
      renderStats(res.data.stats);
      renderTodayTasks(res.data.stats.todayTaskList || []);
      renderRecentTasks(res.data.stats.recentTasks || []);
    }
  } catch (err) {
    utils.showToast(err.message || 'Failed to load dashboard statistics', 'error');
  } finally {
    if (loadingEl) loadingEl.style.display = 'none';
    if (contentEl) contentEl.style.display = 'block';
  }
}

function renderStats(stats) {
  // Metric counts
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val !== undefined ? val : 0;
  };

  setVal('statTotal', stats.total);
  setVal('statCompleted', stats.completed);
  setVal('statInProgress', stats.inProgress);
  setVal('statPending', stats.pending);
  setVal('statOverdue', stats.overdue);
  setVal('statHighPriority', stats.highPriority);
  setVal('statDueToday', stats.dueToday);
  setVal('statDueThisWeek', stats.dueThisWeek);

  // Progress Ring calculation
  const circle = document.getElementById('progressRingCircle');
  const text = document.getElementById('progressRingText');
  if (circle && text) {
    const radius = circle.r.baseVal.value;
    const circumference = 2 * Math.PI * radius;
    circle.style.strokeDasharray = `${circumference} ${circumference}`;
    
    const offset = circumference - (stats.completionRate / 100) * circumference;
    circle.style.strokeDashoffset = offset;
    text.textContent = `${stats.completionRate}%`;
  }
}

function renderTodayTasks(tasks) {
  const container = document.getElementById('todayTasksList');
  if (!container) return;

  if (tasks.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 2rem 1rem;">
        <div class="empty-icon" style="width: 44px; height: 44px;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>
        </div>
        <p style="font-weight: 600; color: var(--text-secondary); margin-bottom: 0.25rem;">No tasks scheduled for today</p>
        <p style="font-size: 0.8rem; color: var(--text-muted);">Enjoy your free time or schedule a new task.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = tasks
    .map(
      (task) => `
    <div class="task-card ${task.status === 'completed' ? 'is-completed' : ''}" style="padding: 0.85rem 1rem;">
      <input 
        type="checkbox" 
        class="task-checkbox" 
        ${task.status === 'completed' ? 'checked' : ''} 
        onchange="toggleTaskStatusFromDashboard('${task._id}', this.checked)"
      />
      <div class="task-content">
        <div class="task-header">
          <span class="task-title" style="font-size: 0.95rem;">${utils.escapeHtml(task.title)}</span>
          <span class="badge badge-${task.priority}">${task.priority}</span>
        </div>
        ${task.description ? `<p class="task-desc" style="font-size: 0.8rem; margin-bottom: 0.35rem;">${utils.escapeHtml(task.description)}</p>` : ''}
      </div>
    </div>
  `
    )
    .join('');
}

function renderRecentTasks(tasks) {
  const container = document.getElementById('recentTasksList');
  if (!container) return;

  if (tasks.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 2rem 1rem;">
        <p style="font-weight: 600; color: var(--text-secondary);">No tasks created yet</p>
      </div>
    `;
    return;
  }

  container.innerHTML = tasks
    .map(
      (task) => `
    <div class="task-card ${task.status === 'completed' ? 'is-completed' : ''}" style="padding: 0.85rem 1rem;">
      <div class="task-content">
        <div class="task-header">
          <a href="/tasks?search=${encodeURIComponent(task.title)}" class="task-title" style="font-size: 0.95rem;">
            ${utils.escapeHtml(task.title)}
          </a>
          <span class="badge badge-status ${task.status}">${task.status}</span>
        </div>
        <div class="task-meta">
          <span class="badge badge-${task.priority}">${task.priority}</span>
          ${task.dueDate ? `<span class="task-due">${utils.formatRelativeDate(task.dueDate)}</span>` : ''}
        </div>
      </div>
    </div>
  `
    )
    .join('');
}

async function toggleTaskStatusFromDashboard(taskId, isChecked) {
  const newStatus = isChecked ? 'completed' : 'todo';
  try {
    await api.patch(`/tasks/${taskId}/status`, { status: newStatus });
    utils.showToast(`Task marked as ${newStatus}`, 'success');
    loadDashboardData();
  } catch (err) {
    utils.showToast(err.message || 'Failed to update task', 'error');
    loadDashboardData();
  }
}

function setupQuickCreateForm() {
  const form = document.getElementById('quickTaskForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const titleInput = document.getElementById('quickTaskTitle');
    const priorityInput = document.getElementById('quickTaskPriority');
    const dueInput = document.getElementById('quickTaskDueDate');

    if (!titleInput.value.trim()) {
      utils.showToast('Please enter a task title', 'error');
      return;
    }

    try {
      await api.post('/tasks', {
        title: titleInput.value.trim(),
        priority: priorityInput ? priorityInput.value : 'medium',
        dueDate: dueInput && dueInput.value ? dueInput.value : null
      });

      utils.showToast('Task created successfully!', 'success');
      form.reset();
      utils.closeModal('createTaskModal');
      loadDashboardData();
    } catch (err) {
      utils.showToast(err.message || 'Failed to create task', 'error');
    }
  });
}

window.toggleTaskStatusFromDashboard = toggleTaskStatusFromDashboard;
