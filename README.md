# Spreetail Split — Shared Expenses Application

A production-ready Splitwise-style full-stack application built with Node.js/Express backend, SQLite database using Sequelize ORM, React frontend, Tailwind CSS, featuring real-time chat comments (via Socket.IO), dynamic balance calculation engines, and a robust, rule-based CSV importer with manual review logs.

## 🎨 Theme & Visual Design System
Built strictly according to the design specifications:
- **Style**: Light Mode only.
- **Palette**: White (`#FFFFFF`) backgrounds, light-gray (`#F4F4F4` / `#E8E8E8`) surfaces, and dark charcoal (`#1F1F1F`) text.
- **Accent**: Tangerine (`#FF7A1A`) for all primary actions, "you are owed" amounts, and active nav states.
- **Aesthetic**: Sharp corners everywhere (`rounded-none`), flat 1px borders, zero box-shadows, and zero gradients.

---

## 🛠 Features
1. **User Authentication**: JWT-based login and registration with custom avatar generation. Preloaded with Quick Demo Logins for Aisha, Rohan, Priya, Dev, Sam, and Meera.
2. **Group Ledgers**: Create groups, select categories (Home, Trip, Couple, Other), and manage memberships with active date boundaries (`joinDate` and `leaveDate`).
3. **Ledger Balance Engine**: Dynamic pairwise and overall balance calculations using the spec formula:
   $$\text{net} = (\text{splits where A paid for B}) - (\text{splits where B paid for A}) - (\text{settlements } A \rightarrow B) + (\text{settlements } B \rightarrow A)$$
4. **Interactive Expense Entry**: Add expenses in INR or USD (auto-converted to INR at a fixed rate of 1 USD = 83 INR) with equal, unequal, percentage, and share splits.
5. **CSV Importer Engine**: Processes CSV files (such as `Expenses Export.csv`) applying 13 strict parsing rules (aliases, Jaccard description comparisons, settlement conversion, membership date bounds, rounding deltas, etc.).
6. **Import Review Logs**: View anomalies (e.g., duplicate warnings, departed members, missing currencies) and resolve them to automatically update calculations.
7. **Real-time Expense Chat**: Socket.IO room-based comments for active discussion on individual expenses.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- SQLite3 (installed automatically via npm package `sqlite3`)

### Installation & Run (Local Script)
We provide a unified startup script `start.sh` that installs all dependencies, seeds the local database, builds production assets, and starts the development servers.

```bash
chmod +x start.sh
./start.sh
```

### Manual Run

#### 1. Backend Setup
```bash
cd backend
npm install
npm run seed     # Seeds the local SQLite database at backend/database.sqlite
npm run dev      # Starts the backend on http://localhost:5000
```

#### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev      # Starts the frontend on http://localhost:5173
```

---

## 🐳 Docker Deployment
Run the complete application inside Docker:

```bash
docker-compose up --build
```
This serves the application on `http://localhost:5000` (where the production-built React app is statically served by the Express backend).

---

## 📖 System Design Documents
For more details, please review our separate design documentation:
- [SCOPE.md](./SCOPE.md): Boundaries, constraints, and business logic specs.
- [DECISIONS.md](./DECISIONS.md): Architectural decisions and data models.
- [AI_USAGE.md](./AI_USAGE.md): Attribution of AI tools utilized during development.
- [BUILD_PLAN.md](./BUILD_PLAN.md): Completed build phase checklist.
