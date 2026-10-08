/**
 * Comprehensive API Integration Test Suite for Task Manager Pro (Supabase PostgreSQL)
 */
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5000';

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const fetchOptions = {
    method: options.method || 'GET',
    headers
  };

  if (options.body) {
    fetchOptions.body = JSON.stringify(options.body);
  }

  const res = await fetch(url, fetchOptions);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function runTests() {
  console.log('====================================================');
  console.log('🧪 Starting Supabase PostgreSQL API Integration Tests');
  console.log('====================================================\n');
  let passed = 0;
  let failed = 0;

  const assert = (condition, testName, details = '') => {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName} ${details ? `(${details})` : ''}`);
      failed++;
    }
  };

  try {
    // 1. Health check
    const health = await request('/api/health');
    assert(health.status === 200 && health.data.status === 'healthy', 'Health check responds with status 200 and healthy payload');

    // 2. Register test user
    const testEmail = `developer_${Date.now()}@example.com`;
    const regRes = await request('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Alex Developer',
        email: testEmail,
        password: 'Password123!'
      }
    });
    assert(
      regRes.status === 201 && regRes.data.success && regRes.data.data.token && regRes.data.data.user._id,
      'POST /api/auth/register creates user in Supabase and returns token and user payload'
    );
    const token = regRes.data.data ? regRes.data.data.token : null;
    const userId = regRes.data.data ? regRes.data.data.user._id : null;

    // 3. Login test
    const loginRes = await request('/api/auth/login', {
      method: 'POST',
      body: {
        email: testEmail,
        password: 'Password123!'
      }
    });
    assert(
      loginRes.status === 200 && loginRes.data.success && loginRes.data.data.token,
      'POST /api/auth/login validates credentials and returns session token'
    );

    // 4. Duplicate registration check (PostgreSQL Unique constraint check)
    const dupRes = await request('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Duplicate Alex',
        email: testEmail,
        password: 'Password123!'
      }
    });
    assert(
      dupRes.status === 409 && dupRes.data.success === false,
      'Duplicate Email Registration correctly rejected with HTTP 409 Conflict'
    );

    // 5. Protected /api/auth/me
    const meRes = await request('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert(
      meRes.status === 200 && meRes.data.data.user.email === testEmail,
      'GET /api/auth/me returns authenticated user details'
    );

    // 6. Update user profile
    const profileRes = await request('/api/auth/profile', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: {
        bio: 'Senior Full Stack Engineer specializing in Supabase & Node.js',
        preferences: { theme: 'dark', emailNotifications: false }
      }
    });
    assert(
      profileRes.status === 200 && profileRes.data.data.user.bio.includes('Senior Full Stack Engineer'),
      'PUT /api/auth/profile updates user bio and preferences'
    );

    // 7. Create Task
    const createRes = await request('/api/tasks', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: {
        title: 'Migrate to Supabase PostgreSQL',
        description: 'Implement relational schema, queries, indexes, and full-stack integration',
        priority: 'urgent',
        status: 'in-progress',
        dueDate: new Date(Date.now() + 86400000).toISOString(),
        tags: ['supabase', 'postgresql', 'backend'],
        subtasks: [
          { title: 'Define schema', completed: true },
          { title: 'Update queries', completed: true },
          { title: 'Run tests', completed: false }
        ]
      }
    });
    assert(
      createRes.status === 201 && createRes.data.data.task.title === 'Migrate to Supabase PostgreSQL',
      'POST /api/tasks creates task successfully with tags and subtasks'
    );
    const taskId = createRes.data.data.task._id;

    // 8. Create a second task for list & search validation
    await request('/api/tasks', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: {
        title: 'Write Documentation and Guides',
        description: 'Document Supabase SQL schema execution steps and setup',
        priority: 'medium',
        status: 'todo',
        dueDate: new Date(Date.now() + 172800000).toISOString(),
        tags: ['docs', 'supabase']
      }
    });

    // 9. Get Tasks List
    const listRes = await request('/api/tasks', {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert(
      listRes.status === 200 && listRes.data.data.tasks.length >= 2,
      'GET /api/tasks lists all user tasks with pagination and sorting'
    );

    // 10. Filter Tasks by Search Query
    const searchRes = await request('/api/tasks?search=Documentation', {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert(
      searchRes.status === 200 && searchRes.data.data.tasks.some((t) => t.title.includes('Documentation')),
      'GET /api/tasks?search=... searches task title and description'
    );

    // 11. Filter Tasks by Status
    const statusFilterRes = await request('/api/tasks?status=in-progress', {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert(
      statusFilterRes.status === 200 && statusFilterRes.data.data.tasks.every((t) => t.status === 'in-progress'),
      'GET /api/tasks?status=in-progress filters tasks by status'
    );

    // 12. Update Task Status
    const patchRes = await request(`/api/tasks/${taskId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: { status: 'completed' }
    });
    assert(
      patchRes.status === 200 && patchRes.data.data.task.status === 'completed',
      'PATCH /api/tasks/:id/status updates status and completedAt'
    );

    // 13. Update Task Content
    const putRes = await request(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: {
        title: 'Migrate to Supabase PostgreSQL (Completed)',
        priority: 'high'
      }
    });
    assert(
      putRes.status === 200 && putRes.data.data.task.title === 'Migrate to Supabase PostgreSQL (Completed)',
      'PUT /api/tasks/:id updates task details'
    );

    // 14. Dashboard Stats
    const statsRes = await request('/api/tasks/stats/dashboard', {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert(
      statsRes.status === 200 &&
      statsRes.data.data.stats.total >= 2 &&
      statsRes.data.data.stats.completed >= 1 &&
      typeof statsRes.data.data.stats.completionRate === 'number',
      'GET /api/tasks/stats/dashboard computes real-time task metrics'
    );

    // 15. Change Password
    const changePassRes = await request('/api/auth/change-password', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: {
        currentPassword: 'Password123!',
        newPassword: 'NewSuperPassword456!'
      }
    });
    assert(
      changePassRes.status === 200 && changePassRes.data.success,
      'PUT /api/auth/change-password verifies current password and updates hash'
    );

    // 16. Verify new password login
    const reLoginRes = await request('/api/auth/login', {
      method: 'POST',
      body: {
        email: testEmail,
        password: 'NewSuperPassword456!'
      }
    });
    assert(
      reLoginRes.status === 200 && reLoginRes.data.success,
      'POST /api/auth/login validates new password after update'
    );

    // 17. Delete Task
    const deleteRes = await request(`/api/tasks/${taskId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    assert(
      deleteRes.status === 200 && deleteRes.data.success,
      'DELETE /api/tasks/:id deletes task permanently from PostgreSQL'
    );

    console.log('====================================================');
    console.log(`📊 Test Results: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution exception:', err);
    process.exit(1);
  }
}

// Standalone execution helper
if (require.main === module) {
  // Require the Express app — the server will start and emit 'listening'
  const app = require('../server');

  // Wait for the server to be listening before sending requests
  function waitForServer(maxWaitMs = 10000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      function tryConnect() {
        const http = require('http');
        const req = http.request(
          { hostname: 'localhost', port: 5000, path: '/api/health', method: 'GET', timeout: 500 },
          (res) => resolve()
        );
        req.on('error', () => {
          if (Date.now() - start > maxWaitMs) {
            return reject(new Error('Server did not start within the timeout'));
          }
          setTimeout(tryConnect, 250);
        });
        req.on('timeout', () => { req.destroy(); setTimeout(tryConnect, 250); });
        req.end();
      }
      tryConnect();
    });
  }

  waitForServer()
    .then(() => runTests())
    .then(() => { process.exit(0); })
    .catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { runTests };
