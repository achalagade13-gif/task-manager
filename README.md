# ⚡ TaskFlow Pro — Full-Stack Task & Productivity Suite (Supabase PostgreSQL)

A modern, responsive, production-ready full-stack Task Management application built with **Node.js, Express.js, Supabase PostgreSQL, JWT Authentication, bcrypt**, and a **modern Vanilla JavaScript frontend with rich glassmorphism aesthetics**.

---

## 🌟 Key Features

- **🔐 Robust JWT Authentication**: Secure user registration, login, persistent session management, password hashing with `bcryptjs`, and protected API routes.
- **⚡ Supabase PostgreSQL Relational Engine**: Fully migrated from MongoDB to PostgreSQL with UUID primary keys, foreign key cascading, JSONB preferences/subtasks, array tags, and indexed query performance.
- **📋 Comprehensive Task Management (CRUD)**:
  - Create, view, edit, and delete tasks.
  - Quick inline status toggling (Todo, In-Progress, Completed) with automatic completion timestamps.
  - Priority management (**Low** 🟢, **Medium** 🔵, **High** 🟠, **Urgent** 🔴).
  - Due dates with relative time calculations and overdue warning badges.
  - Description and multi-tag system.
- **📊 Interactive Dashboard**:
  - Live metric counters for Total, In-Progress, Completed, Overdue, and High-Priority tasks.
  - Circular SVG productivity progress ring.
  - "Today's Schedule" checklist with interactive completion checkboxes.
  - Recent activity feed.
- **🔍 Advanced Search, Filtering & Sorting**:
  - Full-text debounced search across titles, descriptions, and `#tags`.
  - Multi-status and priority filter dropdowns.
  - Sorting by Newest, Oldest, Due Date, Priority, and Alphabetical (A-Z).
  - URL query parameter synchronization (bookmarkable and shareable views).
- **🗂️ Dual View Modes**: Seamlessly switch between structured **List View** and visual **3-Column Kanban Board**.
- **💾 Export**: One-click export of tasks to **JSON** or **CSV** formats.
- **👤 User Profile & Security**: Update user information, bio, and change password securely.
- **📱 Fully Responsive Design**: Mobile navigation drawer, touch-friendly tap targets, and fluid grid layouts for mobile, tablet, and desktop screens.

---

## 🏗️ Architecture & Project Structure

```
Task Manager/
├── client/                     # Frontend Application (Vanilla JS & Modern CSS)
│   ├── index.html              # Landing & Feature Overview
│   ├── login.html              # Sign-In Page
│   ├── register.html           # Sign-Up Page
│   ├── dashboard.html          # Productivity Dashboard
│   ├── tasks.html              # Task Management (List & Kanban)
│   ├── profile.html            # Profile & Password Management
│   ├── css/
│   │   ├── style.css           # Modern Glassmorphic Design System
│   │   └── responsive.css      # Mobile Drawer & Breakpoint Rules
│   └── js/
│       ├── api.js              # Central API client & JWT Interceptor
│       ├── auth.js             # Authentication State & Navigation Hydration
│       ├── utils.js            # Toasts, Modals, Dates, and Debounce Helpers
│       ├── dashboard.js        # Dashboard Metrics & Widget Logic
│       └── tasks.js            # Task CRUD, Kanban, Filters & Sort Logic
│
├── server/                     # Backend Node/Express API
│   ├── config/
│   │   ├── supabase.js         # Supabase PostgreSQL Client & Fallback Engine
│   │   └── db.js               # Database Connection & Health Verification
│   ├── controllers/
│   │   ├── authController.js   # Auth & Profile Endpoints
│   │   └── taskController.js   # Task CRUD, Filtering, & Aggregations
│   ├── middleware/
│   │   ├── authMiddleware.js   # JWT Protection Middleware
│   │   ├── validationMiddleware.js # Input Validation & UUID Sanity
│   │   └── errorMiddleware.js  # Centralized PostgreSQL / HTTP Error Handlers
│   ├── models/
│   │   ├── User.js             # Supabase PostgreSQL User Model & Methods
│   │   └── Task.js             # Supabase PostgreSQL Task Model & Queries
│   ├── routes/
│   │   ├── authRoutes.js       # /api/auth Routing & Rate Limiting
│   │   └── taskRoutes.js       # /api/tasks Routing
│   ├── utils/
│   │   ├── response.js         # Standard JSON Response Wrapper
│   │   └── token.js            # JWT Sign & Verify Utilities
│   ├── tests/
│   │   └── api.test.js         # Integration Test Suite
│   └── server.js               # Express Server & Middleware Initialization
│
├── supabase/
│   └── schema.sql              # Supabase PostgreSQL DDL (Tables, Indexes, Triggers, RLS)
├── .env.example                # Example Environment Variables
├── .env                        # Local Environment Configuration
├── .gitignore                  # Git Ignore Rules
├── package.json                # Project Dependencies & Scripts
└── README.md                   # Full Documentation
```

---

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | HTML5, Modern CSS3 (Variables, Glassmorphism, Flex/Grid), Vanilla JavaScript (ES6+ Modular) |
| **Backend** | Node.js, Express.js |
| **Database** | Supabase PostgreSQL (`@supabase/supabase-js`) |
| **Authentication** | JSON Web Tokens (`jsonwebtoken`), `bcryptjs` for salted hashing |
| **Security** | `helmet` (CSP headers), `express-rate-limit` (brute-force defense), `cors`, UUID & Input validation |
| **Icons & Typography** | Google Fonts (*Plus Jakarta Sans*), SVG Icon System |

---

## 🗄️ Supabase PostgreSQL Database Schema

The database schema is defined in [`supabase/schema.sql`](supabase/schema.sql).

### 1. `users` Table

| Column | Type | Constraints / Default | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PRIMARY KEY DEFAULT `gen_random_uuid()` | Unique user identifier |
| `name` | VARCHAR(60) | NOT NULL | User full name |
| `email` | VARCHAR(255) | UNIQUE NOT NULL | User email address |
| `password` | VARCHAR(255) | NOT NULL | Bcrypt salted hash |
| `avatar` | TEXT | DEFAULT `''` | User profile avatar URL |
| `bio` | VARCHAR(250) | DEFAULT `''` | User bio summary |
| `preferences` | JSONB | DEFAULT `'{"theme": "dark", "emailNotifications": true}'` | Custom user settings |
| `created_at` | TIMESTAMPTZ | DEFAULT `NOW()` | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | DEFAULT `NOW()` | Auto-updated via trigger |

### 2. `tasks` Table

| Column | Type | Constraints / Default | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PRIMARY KEY DEFAULT `gen_random_uuid()` | Unique task identifier |
| `user_id` | UUID | NOT NULL REFERENCES `users(id)` ON DELETE CASCADE | Foreign key to task owner |
| `title` | VARCHAR(120) | NOT NULL | Task title |
| `description`| VARCHAR(2000)| DEFAULT `''` | Detailed description / notes |
| `status` | VARCHAR(20) | NOT NULL DEFAULT `'todo'` CHECK (`status` IN ('todo', 'in-progress', 'completed')) | Task status |
| `priority` | VARCHAR(20) | NOT NULL DEFAULT `'medium'` CHECK (`priority` IN ('low', 'medium', 'high', 'urgent')) | Priority level |
| `due_date` | TIMESTAMPTZ | DEFAULT NULL | Target completion date |
| `tags` | TEXT[] | DEFAULT `'{}'` | Categorization tags array |
| `completed_at`| TIMESTAMPTZ | DEFAULT NULL | Timestamp when completed |
| `subtasks` | JSONB | DEFAULT `'[]'` | Subtasks checklist array |
| `created_at` | TIMESTAMPTZ | DEFAULT `NOW()` | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | DEFAULT `NOW()` | Auto-updated via trigger |

### PostgreSQL Indexes & Triggers
- `idx_tasks_user_id` on `tasks(user_id)`
- `idx_tasks_user_status` on `tasks(user_id, status)`
- `idx_tasks_user_priority` on `tasks(user_id, priority)`
- `idx_tasks_user_due_date` on `tasks(user_id, due_date)`
- `idx_tasks_user_created_at` on `tasks(user_id, created_at DESC)`
- `idx_tasks_tags` GIN index on `tasks USING gin(tags)`
- Trigger `update_timestamp_column()` on `users` & `tasks` for automated `updated_at` maintenance.

---

## 📡 REST API Documentation

All API responses follow a consistent JSON structure:

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { ... },
  "meta": { ... }
}
```

### Authentication Endpoints (`/api/auth`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Public | Register new user account |
| `POST` | `/api/auth/login` | Public | Authenticate user & obtain JWT |
| `POST` | `/api/auth/logout` | Public | Client token clear acknowledgment |
| `GET` | `/api/auth/me` | Private | Get authenticated user profile |
| `PUT` | `/api/auth/profile` | Private | Update name, avatar, bio, preferences |
| `PUT` | `/api/auth/change-password` | Private | Update user password |

### Task Endpoints (`/api/tasks`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/tasks` | Private | List tasks with search, filter, and sorting |
| `GET` | `/api/tasks/stats/dashboard` | Private | Aggregated metrics for dashboard |
| `GET` | `/api/tasks/:id` | Private | Get single task by ID |
| `POST` | `/api/tasks` | Private | Create new task |
| `PUT` | `/api/tasks/:id` | Private | Update existing task |
| `PATCH`| `/api/tasks/:id/status` | Private | Quick status toggle (`todo`, `in-progress`, `completed`) |
| `DELETE`| `/api/tasks/:id` | Private | Delete task permanently |

#### Query Parameters for `GET /api/tasks`:
- `search`: Filter by search term (searches title, description, and tags).
- `status`: `all`, `todo`, `in-progress`, `completed`, `pending`, `overdue`.
- `priority`: `all`, `low`, `medium`, `high`, `urgent`.
- `sort`: `newest`, `oldest`, `dueDate`, `priority`, `title`.
- `timeframe`: `today`, `this-week`, `overdue`.
- `page` & `limit`: Pagination parameters.

---

## 🚀 Supabase PostgreSQL Setup Guide

### 1. Create a Supabase Project
1. Log in to [Supabase](https://supabase.com) and create a new project.
2. Note your **Project URL** and **API Keys** (`anon` public key & `service_role` secret key) under **Project Settings -> API**.

### 2. Run the SQL Schema in Supabase
1. Go to the **SQL Editor** in your Supabase dashboard.
2. Open [`supabase/schema.sql`](supabase/schema.sql) from this project.
3. Paste the contents into the SQL Editor and click **Run**.
4. This will create the `users` and `tasks` tables, indexes, triggers, and Row Level Security policies.

### 3. Configure `.env`
Update your `.env` file with your Supabase credentials:

```env
PORT=5000
NODE_ENV=development

SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

JWT_SECRET=super_secret_jwt_key_task_manager_2026_change_in_production
JWT_EXPIRES_IN=7d

RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=300
AUTH_RATE_LIMIT_MAX=20
```

---

## 💻 Local Development & Testing

### 1. Install Dependencies
```bash
npm install
```

### 2. Run API Integration Tests
```bash
npm test
```

### 3. Start the Server
```bash
# Production start
npm start

# Development watch mode
npm run dev
```

Visit **`http://localhost:5000`** in your browser to interact with the full web app.

---

## 🔒 Security & Best Practices Implemented

1. **Password Hashing**: Passwords are cryptographically hashed using `bcryptjs` with salt work factor 10.
2. **JWT Route Protection**: Stateless token validation on private endpoints; invalid or expired tokens are rejected.
3. **HTTP Header Hardening**: Configured `helmet` with Content Security Policy (CSP).
4. **Rate Limiting**: `express-rate-limit` prevents brute-force login attempts (20 attempts / 15 min on auth routes).
5. **PostgreSQL Relational Integrity**: Foreign key constraints with `ON DELETE CASCADE` ensure tasks are automatically cleaned up when a user is deleted.
6. **Data Isolation**: All queries enforce `user_id` filtering, ensuring total multi-tenant tenant isolation.
