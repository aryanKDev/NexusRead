# 📚 NexusRead

> **Your intelligent reading companion.** A full-stack SaaS book tracker with AI-powered insights, gamification, a built-in PDF reader, and a community marketplace — built on the MERN stack.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-nexusread.vercel.app-6d28d9?style=for-the-badge&logo=vercel)](https://nexusread.vercel.app/)
[![GitHub](https://img.shields.io/badge/GitHub-aryanKDev%2Fnexusread-181717?style=for-the-badge&logo=github)](https://github.com/aryanKDev/nexusread)
[![Status](https://img.shields.io/badge/Status-Active-22c55e?style=for-the-badge)]()
[![Stack](https://img.shields.io/badge/Stack-MERN-61DAFB?style=for-the-badge&logo=react)]()

---

## ✨ Features

### 📖 Reading & Library
- **Personal book library** with status tracking: `wishlist → reading → completed`
- **In-browser PDF Reader** — upload PDFs, read inline, auto-resume from last page
- **Reading progress persistence** — page position saved on tab close via `fetch` + `keepalive`
- **Reading session logging** — tracks time spent per book
- **Highlights & notes** — text highlights stored per page with timestamps

### 🤖 AI Assistant (Gemini-powered)
- **Summarize** — generate concise summaries of selected passages
- **Explain** — plain-language explanations of complex text
- **Define** — in-context word definitions
- **Ask** — Q&A with book context as a grounding prompt
- **Smart Notes** — auto-generate structured notes from your highlights (max 50)

### 📊 Analytics Dashboard
- Reading activity heatmap
- Pages read over time (Recharts charts)
- Reading streaks tracker
- Word cloud from highlights
- Stats panel: books read, pages, average rating, streaks

### 🏆 Gamification
- **Badges system** — 9 badges: First Chapter, Bookworm, Bibliophile, Week Warrior, Monthly Legend, Page Turner, Marathon Reader, Night Owl, Speed Reader
- **Coins** — earned per badge (+25 per badge)
- **Leaderboard** — top readers ranked by completed books (public, opt-in)
- Badge award triggers push notifications

### 🛒 Marketplace
- Browse and purchase books listed by admins
- Shopping cart with order management
- Book detail pages with reviews and ratings
- Preview click tracking

### 🔐 Authentication
- Email/password registration & login
- **Google OAuth 2.0** (one-click sign-in)
- JWT Access Token (15-min lifetime, in-memory only — never `localStorage`)
- Refresh Token rotation with **theft detection** — reuse triggers full session revocation
- HttpOnly cookie storage for refresh tokens
- Silent token refresh via Axios interceptor (queue-deduplication safe)

### 🛡️ Admin Panel
- **Book request approval system** — users submit books, admins approve/reject
- **User management** — list all users, toggle ban/unban with audit trail
- Admin cannot ban themselves or other admins
- Banning a user immediately invalidates all their refresh tokens
- **Audit logs** — last 50 admin actions with populated actor + target
- **Admin stats** — total users, total books, pending requests, approved today
- Admin-specific routes: `/admin/overview`, `/admin/requests`, `/admin/users`, `/admin/books`, `/admin/analytics`

### 🌐 Community & Social
- Public user profiles with reading history
- Social follow/activity feed system
- Review & rating system per book
- Book request submissions from users

### 🔔 Notifications
- In-app notification system (badge earned, admin actions, etc.)
- `NotificationContext` polling on frontend

---

## 🛠️ Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| React 18 + Vite | UI framework & build tool |
| TypeScript | Type safety |
| TailwindCSS | Utility-first styling |
| Framer Motion + GSAP | Page transitions & micro-animations |
| React Router v7 | Client-side routing |
| Axios | HTTP client with request/response interceptors |
| Recharts | Analytics charts |
| react-pdf | In-browser PDF rendering |
| react-hook-form + Zod | Form management & validation |
| @react-oauth/google | Google Sign-In integration |
| lucide-react | Icon system |

### Backend
| Technology | Purpose |
|---|---|
| Node.js + Express | REST API server |
| MongoDB + Mongoose | Database & ODM |
| JSON Web Tokens (JWT) | Stateless access token authentication |
| bcryptjs | Password hashing (salt rounds: 10) |
| cookie-parser | HttpOnly cookie management |
| Helmet | HTTP security headers |
| express-rate-limit | Brute-force protection |
| express-mongo-sanitize | NoSQL injection prevention |
| xss-clean | XSS payload sanitization |
| Multer | File upload handling (PDF) |
| Cloudinary | Cloud PDF storage (optional) |
| google-auth-library | Google OAuth token verification |
| express-validator | Input validation middleware |

### Database Models
`User` · `Book` · `BookRequest` · `RefreshToken` · `ReadingProgress` · `ReadingSession` · `UploadedBook` · `UploadedBookReadingProgress` · `UploadedBookReadingSession` · `Highlight` · `Note` · `Goal` · `Notification` · `Review` · `Order` · `AdminAction` · `PreviewClick`

### Infrastructure & Tools
- **Vercel** — frontend deployment
- **MongoDB Atlas** — managed cloud database
- **Cloudinary** — PDF/media CDN (optional flag: `USE_CLOUDINARY_PDF`)
- **Gemini API** — AI features (summarize, explain, define, ask, smart-notes)
- **Google Books API** — external book search/metadata

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                   FRONTEND (Vercel)                 │
│  React + Vite · TailwindCSS · Framer Motion         │
│                                                     │
│  AuthContext ──► Axios (in-memory token)            │
│       │              │                              │
│       │     Interceptor: auto-refresh on 401        │
│       ▼              ▼                              │
│  ProtectedRoute   API calls (/api/v1/*)             │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS + credentials: true
                       │ (withCredentials for cookies)
┌──────────────────────▼──────────────────────────────┐
│               BACKEND (Express API)                 │
│                                                     │
│  Helmet · CORS allowlist · Body limit 10kb          │
│  mongo-sanitize · xss-clean · rate limiters         │
│                                                     │
│  /api/v1/auth      JWT + Refresh Token rotation     │
│  /api/v1/books     Library CRUD                     │
│  /api/v1/reader    PDF upload + progress sessions   │
│  /api/v1/ai        Gemini-powered AI endpoints      │
│  /api/v1/admin     User mgmt + audit logs           │
│  /api/v1/gamification  Badges + leaderboard         │
│  /api/v1/marketplace   Book sales + orders          │
│  /api/v1/social    Follow + activity feed           │
│  /api/v1/reviews   Book ratings                     │
│  /api/v1/notifications  In-app alerts               │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│         MongoDB Atlas (Multi-collection)            │
│  Users isolated by userId ref on every document     │
└─────────────────────────────────────────────────────┘
```

**Auth Flow:**
1. Login → server signs short-lived **access token** (15m) + creates **refresh token** DB record → refresh token set as `HttpOnly` cookie
2. Frontend stores access token **in memory** (`useRef`) — never `localStorage`
3. Axios request interceptor attaches `Authorization: Bearer <token>` header
4. On 401, response interceptor fires a single `/auth/refresh` call (deduped with promise reference), silently obtains a new access token, retries the original request
5. Refresh token **rotation** on every use — reuse detected = all sessions revoked

---

## 📁 Folder Structure

```
nexusread/
├── backend/                    # Express API (the main production backend)
│   ├── config/
│   │   ├── cloudinary.js       # Cloudinary SDK init
│   │   ├── rateLimit.js        # API & search rate limiters
│   │   └── redis.js            # Redis config (future caching)
│   ├── src/
│   │   ├── app.js              # Express setup (Helmet, CORS, middleware chain)
│   │   ├── controllers/        # 14 controllers
│   │   │   ├── authController.js
│   │   │   ├── adminController.js
│   │   │   ├── bookController.js
│   │   │   ├── reader.controller.js
│   │   │   ├── ai.controller.js
│   │   │   ├── gamification.controller.js
│   │   │   ├── marketplace.controller.js
│   │   │   ├── social.controller.js
│   │   │   ├── review.controller.js
│   │   │   ├── notification.controller.js
│   │   │   ├── order.controller.js
│   │   │   ├── bookRequestController.js
│   │   │   └── readerAnalytics.controller.js
│   │   ├── models/             # 18 Mongoose models
│   │   ├── routes/             # 14 route files + index.js
│   │   ├── middleware/
│   │   │   ├── auth.js         # protect / optionalProtect / restrictTo
│   │   │   ├── security.js     # loginLimiter, registerLimiter, sanitize, xss
│   │   │   └── errorHandler.js
│   │   ├── services/
│   │   │   ├── aiService.js    # Gemini API wrapper
│   │   │   ├── cacheService.js
│   │   │   └── openLibraryService.js
│   │   └── utils/
│   │       ├── AppError.js
│   │       ├── catchAsync.js
│   │       ├── tokenUtils.js   # signAccessToken / verifyAccessToken
│   │       ├── cookieUtils.js  # set/clear/get refresh token cookie
│   │       └── logger.js       # Auth event logger
│   ├── public/pdfs/            # Local PDF storage (when Cloudinary is off)
│   ├── .env.example
│   └── server.js               # Entry point
│
├── src/                        # React frontend (Vite)
│   ├── api/
│   │   └── axios.js            # Axios instance + silent refresh interceptor
│   ├── context/
│   │   ├── AuthContext.jsx     # Auth state, login/logout/Google OAuth
│   │   ├── LibraryContext.jsx  # Personal book library
│   │   ├── CartContext.jsx     # Marketplace cart
│   │   ├── NotificationContext.jsx
│   │   └── ToastContext.jsx
│   ├── components/
│   │   ├── ProtectedRoute.jsx
│   │   ├── AdminProtectedRoute.jsx
│   │   ├── AIAssistant.jsx
│   │   ├── BookTracker.jsx     # Core library view
│   │   ├── ReadingCharts.jsx
│   │   ├── ReadingHeatmap.jsx
│   │   ├── StreakTracker.jsx
│   │   ├── WordCloud.jsx
│   │   ├── StatsPanel.jsx
│   │   └── admin/              # Admin layout + sub-components
│   ├── pages/
│   │   ├── Dashboard.jsx
│   │   ├── Reader.jsx          # PDF reader with AI assistant sidebar
│   │   ├── Analytics.jsx
│   │   ├── Explore.jsx         # Book discovery + OpenLibrary search
│   │   ├── Marketplace.jsx
│   │   ├── BookDetail.jsx
│   │   ├── Leaderboard.jsx
│   │   ├── Profile.jsx
│   │   ├── UploadPage.jsx
│   │   ├── Cart.jsx
│   │   ├── Login.jsx           # Email + Google OAuth
│   │   ├── Register.jsx
│   │   └── admin/
│   │       ├── AdminOverview.jsx
│   │       ├── AdminRequests.jsx
│   │       ├── AdminUsers.jsx
│   │       ├── AdminBooks.jsx
│   │       └── AdminAnalytics.jsx
│   ├── App.jsx                 # Route definitions + provider tree
│   └── index.css               # Global styles + Tailwind base
│
├── vercel.json                 # Vercel SPA rewrite rules
├── vite.config.ts
└── tailwind.config.js
```

---

## 🚀 Installation Guide

### Prerequisites
- Node.js >= 18
- npm >= 9
- MongoDB Atlas account (or local MongoDB)
- Google Cloud Console project (for OAuth + Books API)
- Gemini API key (for AI features)
- Cloudinary account (optional — only needed if `USE_CLOUDINARY_PDF=true`)

---

### 1. Clone the Repository

```bash
git clone https://github.com/aryanKDev/nexusread.git
cd nexusread
```

---

### 2. Backend Setup

```bash
cd backend
npm install
```

Create your `.env` file (see Environment Variables section below):

```bash
cp .env.example .env
# Edit .env with your actual values
```

Start the backend:

```bash
# Development (with hot-reload)
npm run dev

# Production
npm start
```

The API will be available at `http://localhost:5000/api/v1`

> **Health check:** `GET /health` (container probe) or `GET /api/v1/health` (detailed diagnostics)

---

### 3. Frontend Setup

```bash
# From the project root
npm install
```

Create a `.env` file in the root:

```bash
VITE_API_URL=http://localhost:5000/api/v1
VITE_GOOGLE_CLIENT_ID=your_google_client_id_here
```

Start the frontend:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

---

## 🔑 Environment Variables

### Backend (`backend/.env`)

```env
# Server
PORT=5000
NODE_ENV=development

# Database
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/<dbname>?retryWrites=true&w=majority

# JWT — never commit real values
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_ACCESS_EXPIRE=15m
REFRESH_TOKEN_EXPIRE_DAYS=7
REFRESH_TOKEN_COOKIE_NAME=refreshToken

# CORS — must match your frontend origin exactly (for HttpOnly cookie credentials)
FRONTEND_URL=http://localhost:5173
CORS_ORIGIN=http://localhost:5173,http://localhost:5174

# Rate Limiting (auth endpoints, per 15 min window)
AUTH_RATE_LIMIT_MAX=10

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret

# External APIs
GOOGLE_BOOKS_API_KEY=your_google_books_api_key
GEMINI_API_KEY=your_gemini_api_key

# Cloudinary (PDF upload — optional)
USE_CLOUDINARY_PDF=false
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### Frontend (`.env` in project root)

```env
VITE_API_URL=http://localhost:5000/api/v1
VITE_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```

---

## 📡 API Overview

### Auth Routes — `/api/v1/auth`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/register` | Register new user | Public |
| `POST` | `/login` | Login with email/password | Public |
| `POST` | `/google` | Google OAuth sign-in / sign-up | Public |
| `POST` | `/refresh` | Rotate refresh token, get new access token | Cookie |
| `POST` | `/logout` | Revoke all sessions, clear cookie | Public |
| `GET` | `/me` | Get current authenticated user | Protected |

### Book Routes — `/api/v1/books`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/` | Get all books (catalogue) | Optional |
| `POST` | `/` | Add book to personal library | Protected |
| `PUT` | `/:id` | Update book (progress, status, rating) | Protected |
| `DELETE` | `/:id` | Remove book from library | Protected |
| `GET` | `/search` | Search OpenLibrary / Google Books | Public |

### Reader Routes — `/api/v1/reader`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/upload` | Upload PDF (Cloudinary or local) | Protected |
| `GET` | `/:bookId` | Get uploaded book metadata | Protected |
| `GET` | `/progress` | Get reading progress for a book | Protected |
| `PATCH` | `/progress` | Update current page + percentage | Protected |
| `POST` | `/session` | Log a reading session (duration) | Protected |

### AI Routes — `/api/v1/ai`

| Method | Endpoint | Body | Auth |
|--------|----------|------|------|
| `POST` | `/summarize` | `{ text, bookTitle? }` | Protected |
| `POST` | `/explain` | `{ text }` | Protected |
| `POST` | `/define` | `{ word, context? }` | Protected |
| `POST` | `/ask` | `{ question, context? }` | Protected |
| `POST` | `/smart-notes` | `{ highlights[] }` | Protected |

### Admin Routes — `/api/v1/admin`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/users` | List all users |
| `PATCH` | `/users/:id/toggle-ban` | Ban / unban user |
| `GET` | `/audit-logs` | Last 50 admin actions |
| `GET` | `/stats` | Dashboard stats |
| `GET` | `/book-requests` | Pending book requests |
| `PATCH` | `/book-requests/:id/approve` | Approve a book request |
| `PATCH` | `/book-requests/:id/reject` | Reject a book request |

### Other Route Groups

| Group | Prefix | Key Features |
|-------|--------|--------------|
| Gamification | `/api/v1/gamification` | Badges, leaderboard, coin awards |
| Marketplace | `/api/v1/marketplace` | Book listings, pricing |
| Orders | `/api/v1/orders` | Purchase flow |
| Reviews | `/api/v1/reviews` | Star ratings + written reviews |
| Social | `/api/v1/social` | Follows, activity feed |
| Notifications | `/api/v1/notifications` | In-app alerts |
| Book Requests | `/api/v1/book-requests` | User submission queue |

---

## 🔒 Security Features

### JWT + Refresh Token Architecture
- **Access token** — short-lived (15m), signed with `JWT_SECRET`, sent in `Authorization: Bearer` header, stored **only in React `useRef`** (never persisted to disk)
- **Refresh token** — long-lived (7 days), stored in **HttpOnly, Secure, SameSite=Strict** cookie — not accessible to JavaScript
- **Rotation** — every `/auth/refresh` call issues a new refresh token and revokes the old one in MongoDB
- **Theft detection** — if a used (already-rotated) token is presented again, all sessions for that user are immediately revoked

### Brute Force & Abuse Prevention
- Login endpoint: **5 attempts per 15 min** in production
- Register endpoint: same limit as login
- General auth routes: 100 requests per 15 min
- API routes: 1,000 requests per 15 min
- Search endpoints: 60 requests per minute
- All limits relaxed in development (`NODE_ENV !== 'production'`)

### Input Sanitization
- **`express-mongo-sanitize`** — strips `$` and `.` from all request inputs to block NoSQL injection
- **`xss-clean`** — sanitizes HTML tags from all `req.body`, `req.params`, `req.query`
- **Body size limit** — `express.json({ limit: '10kb' })` prevents payload flooding

### HTTP Security Headers (Helmet)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection`
- `Strict-Transport-Security` (HSTS)
- Content Security Policy
- `crossOriginResourcePolicy: cross-origin` (for PDF inline serving)

### CORS Configuration
- Explicit **allow-list** of origins (no wildcard `*`)
- `credentials: true` required for HttpOnly cookie flow
- Unknown origins silently rejected (no CORS headers sent)

### Access Control
- `protect` middleware — verifies JWT signature + checks user still exists + checks `isBanned`
- `restrictTo('admin')` middleware — role-based endpoint gating
- `optionalProtect` — enriches response for logged-in users without blocking unauthenticated access
- Per-resource ownership check — users can only access their own uploaded PDFs and reading progress

### PDF Security
- Uploaded PDFs served via `express.static` **behind `protect` middleware** — unauthenticated requests get 401
- Files named with MongoDB ObjectId to prevent enumeration
- Cloudinary raw upload as alternative (flag-based)

---

## 🖼️ Screenshots

> _Screenshots coming soon — visit the [live demo](https://nexusread.vercel.app/) to experience the app._

| Page | Description |
|------|-------------|
| 🔐 Login / Register | Email + Google One Tap sign-in |
| 📚 Dashboard | Personal library with status filters |
| 📖 PDF Reader | Inline reader with AI sidebar |
| 📊 Analytics | Reading heatmap, charts, streaks |
| 🏆 Leaderboard | Top readers with badge display |
| 🛒 Marketplace | Browse and purchase books |
| 🛡️ Admin Panel | User management + book approval queue |

---

## 🔮 Future Improvements

### AI & Intelligence
- [ ] Personalized book recommendations based on reading history and genre preferences
- [ ] AI-generated reading plans and daily goals
- [ ] Semantic book search using embeddings

### Social & Community
- [ ] Public reading clubs / group reading sessions
- [ ] Friend activity feed and shared highlights
- [ ] Book discussions and threaded comments

### Mobile & Cross-Platform
- [ ] React Native mobile app (iOS + Android)
- [ ] PWA support with offline reading capability
- [ ] Push notifications (Web Push API)

### Performance & Scalability
- [ ] **Redis caching** for leaderboard, book catalogue, and session data (config stub already present)
- [ ] Lazy-load PDF pages for large documents
- [ ] CDN-hosted assets and image optimization
- [ ] Background job queue (BullMQ) for badge checking and notifications

### Developer Experience
- [ ] OpenAPI / Swagger documentation at `/api/v1/docs`
- [ ] Automated test suite (Jest + Supertest for API, Vitest for frontend)
- [ ] Docker Compose for local development
- [ ] GitHub Actions CI/CD pipeline

---

## 👤 Author

**Aryan Kushwaha**

[![GitHub](https://img.shields.io/badge/GitHub-aryanKDev-181717?style=flat-square&logo=github)](https://github.com/aryanKDev)

---

## 📄 License

This project is licensed under the **ISC License**.

---

<div align="center">
  <strong>Built with ❤️ by Aryan Kushwaha</strong><br/>
  <a href="https://nexusread.vercel.app/">nexusread.vercel.app</a>
</div>
