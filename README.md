# Captivate3 - Gamification & Leaderboard System

A web-based gamification platform designed to track team scores, manage points, and visualize leaderboard progress using a persistent PostgreSQL database.

## 🛠 Technology Stack

### Backend
*   **Runtime**: Node.js
*   **Framework**: Express.js (REST API)
*   **Database**: PostgreSQL (via `pg` driver)
*   **Hosting**: Vercel (Serverless Functions)

### Frontend
*   **Core**: Vanilla JavaScript (ES6+), HTML5, CSS3
*   **Charts**: Chart.js (for analytics visualization)
*   **Icons**: FontAwesome

### Libraries & Tools
*   `pg`: PostgreSQL client for Node.js (Connection pooling, async queries).
*   `xlsx`: For Excel file import/export operations.
*   `multer`: Middleware for handling file uploads.
*   `cors`: Cross-Origin Resource Sharing support.
*   `dotenv`: Environment variable management for local development.

---

## 🏗 Architecture & Implementation

The application follows a **Client-Server Architecture**.

### 1. Database Layer (PostgreSQL)
Data is stored in a relational PostgreSQL database hosted on the cloud (e.g., Neon).
*   **Connection Pooling**: Uses `pg.Pool` to efficiently manage database connections, essential for handling concurrent requests and serverless environments.
*   **Schema**:
    *   `users`: Stores authentication credentials (`email`, `password`).
    *   `teams`: Stores team data (`name`, `score`, `icon`) and a `history` JSON field for tracking point changes over time.
    *   `reason_mappings`: Stores predefined reasons for points (`reason`, `points`, `cap_type`).

### 2. Backend (Express.js)
The `server.js` file acts as the main entry point and API controller.
*   **API Routes**: RESTful endpoints (`GET`, `POST`, `PUT`, `DELETE`) handle data operations.
*   **Admin Middleware**: A custom `checkAdmin` middleware verifies the `x-user-email` header or query parameter to restrict sensitive actions (like deleting users or importing data) to authorized admins.
*   **Transactions**: Import operations use SQL transactions (`BEGIN`, `COMMIT`, `ROLLBACK`) to ensure data integrity—either all records are imported, or none are, preventing partial data corruption.

### 3. Frontend (Vanilla JS)
The `script.js` handles all client-side logic.
*   **State Management**: Uses `sessionStorage` to maintain user login sessions.
*   **Dynamic Rendering**: DOM manipulation is used to render the leaderboard, podiums, and charts based on API data.
*   **Data Visualization**: Integration with `Chart.js` provides visual insights into team performance and activity trends.

---

## 🚀 Key Features

### Authentication
*   **Mechanism**: Simple email/password verification against the `users` table.
*   **Security**: Basic session handling via client-side storage (Note: Production apps should upgrade to JWT/Session cookies).

### Leaderboard Logic
*   **Ranking**: Teams are sorted by `score` (descending). Ties are broken by the timestamp of the last activity.
*   **Levels (Caps)**: Scores determine the "Cap" level (Orange, Green, Purple, Black). This logic is shared between the backend (for data) and frontend (for visual badges).

### Import/Export System
*   **Excel Integration**: The `xlsx` library parses uploaded `.xlsx` files into JSON for database insertion and converts database records into `.xlsx` buffers for download.
*   **Logic**:
    *   **Export**: Queries the DB → Generates Worksheet → Sends Buffer.
    *   **Import**: Uploads File → Parses Buffer → Starts Transaction → Upserts Records (Update if exists, Insert if new) → Commits.

---

## ⚙️ Setup & Deployment

### Local Development
1.  **Install Dependencies**: `npm install`
2.  **Environment Setup**: Create a `.env` file with your connection string:
    ```env
    DATABASE_URL=postgres://user:pass@host:5432/db?sslmode=require
    ```
3.  **Run**: `npm start` (Runs on Port 5000)

### Vercel Deployment
1.  **Configuration**: `vercel.json` maps API routes to `server.js` (Serverless Function) and serves static files (`index.html`, etc.).
2.  **Environment Variables**: The `DATABASE_URL` must be added in the Vercel Project Settings.
3.  **Binding**: The server is configured to bind to `0.0.0.0` and port `5000` to ensure compatibility with various hosting environments.
