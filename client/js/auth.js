/**
 * Task Manager Pro - Authentication & User State Service
 */

const auth = {
  getUser() {
    const raw = localStorage.getItem('tm_user');
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  setUser(user) {
    if (user) {
      localStorage.setItem('tm_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('tm_user');
    }
  },

  getToken() {
    return localStorage.getItem('tm_token');
  },

  isAuthenticated() {
    return !!this.getToken();
  },

  async login(email, password) {
    const response = await window.api.post('/auth/login', { email, password });
    if (response.success && response.data) {
      window.api.setToken(response.data.token);
      this.setUser(response.data.user);
    }
    return response;
  },

  async register(name, email, password) {
    const response = await window.api.post('/auth/register', { name, email, password });
    if (response.success && response.data) {
      window.api.setToken(response.data.token);
      this.setUser(response.data.user);
    }
    return response;
  },

  async logout() {
    // Clear auth state synchronously first to prevent race conditions
    window.api.setToken(null);
    this.setUser(null);
    try {
      // Fire-and-forget server-side logout (best effort)
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      // Ignore network failure — client-side state is already cleared
    }
    // Use replace() so the dashboard isn't in browser history
    window.location.replace('/login');
  },

  async fetchCurrentUser() {
    try {
      // skipAuthRedirect: true — this is a soft background refresh.
      // A 401 here (e.g. Supabase cold start on Vercel) must NOT wipe
      // the token or redirect the user back to login.
      const res = await window.api.request('/auth/me', {
        method: 'GET',
        skipAuthRedirect: true
      });
      if (res.success && res.data && res.data.user) {
        this.setUser(res.data.user);
        this.renderUserUI(res.data.user);
        return res.data.user;
      }
    } catch (err) {
      // Silently ignore — the user already has a valid local token.
      // They'll be re-validated on the next real API call.
      console.warn('Background profile refresh failed (non-fatal):', err.message);
    }
    return null;
  },

  async updateProfile(profileData) {
    const response = await window.api.put('/auth/profile', profileData);
    if (response.success && response.data && response.data.user) {
      this.setUser(response.data.user);
      this.renderUserUI(response.data.user);
    }
    return response;
  },

  async changePassword(currentPassword, newPassword) {
    return window.api.put('/auth/change-password', { currentPassword, newPassword });
  },

  renderUserUI(user) {
    const currentUser = user || this.getUser();
    if (!currentUser) return;

    const nameEls = document.querySelectorAll('.js-user-name');
    nameEls.forEach((el) => (el.textContent = currentUser.name));

    const emailEls = document.querySelectorAll('.js-user-email');
    emailEls.forEach((el) => (el.textContent = currentUser.email));

    const avatarEls = document.querySelectorAll('.js-user-avatar');
    avatarEls.forEach((img) => {
      img.src =
        currentUser.avatar ||
        `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
          currentUser.name
        )}&backgroundColor=4f46e5,06b6d4,3b82f6`;
      img.alt = currentUser.name;
    });
  },

  checkAuthGuard(isPublicPage = false) {
    const isAuthed = this.isAuthenticated();

    if (isPublicPage && isAuthed) {
      // Already logged in, redirect to dashboard
      window.location.href = '/dashboard';
      return;
    }

    if (!isPublicPage && !isAuthed) {
      // Unauthorized, redirect to login
      window.location.href = '/login';
      return;
    }

    if (isAuthed) {
      this.renderUserUI();
      // Fetch fresh profile in background
      this.fetchCurrentUser();
    }
  },

  setupSidebarMobile() {
    const toggleBtn = document.getElementById('mobileMenuBtn');
    const sidebar = document.getElementById('appSidebar');
    const backdrop = document.getElementById('sidebarBackdrop');

    if (toggleBtn && sidebar) {
      toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('is-open');
      });
    }

    if (backdrop && sidebar) {
      backdrop.addEventListener('click', () => {
        sidebar.classList.remove('is-open');
      });
    }
  }
};

window.auth = auth;

// Auto-run mobile sidebar initialization when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  auth.setupSidebarMobile();
});
