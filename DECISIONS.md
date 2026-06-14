# DECISIONS.md — Architectural Decisions

This document details the architectural choices and technical decisions made during the design and implementation of the Shared Expenses application.

## 1. Database Selection (MongoDB vs. Relational SQLite)

- **Migration Decision**: Transitioned the entire backend from MongoDB (Mongoose) to a relational SQLite database (Sequelize ORM).
- **Rationale**:
  - The formal assignment instructions dictate: **"Use relational DBs only."**
  - **SQLite** was chosen because it is serverless, storing the entire database in a single local file (`backend/database.sqlite`), avoiding external dependencies and complex installations.
  - **Sequelize ORM** was chosen to manage the relational schema, foreign keys, cascade deletes, and clean migrations/seeding.
- **Compatibility Layer**:
  - Kept a backwards-compatibility layer in API JSON payloads (mapping the auto-incrementing SQLite integer `id` to `_id`) to ensure the React frontend continued functioning without massive UI state rewrites.

## 2. Session Management & Auth

- JWT tokens are signed by the server and returned to the client upon successful validation.
- The React application stores this token in `localStorage` and supplies it in the `Authorization: Bearer <token>` header.
- A central `AuthContext` provides login/register APIs and stores user state, ensuring a seamless experience.

## 3. Real-Time Chat (WebSockets)

- Implemented Socket.IO.
- When clients visit an expense details page, they join a socket room mapped to the expense's ID (`room: expenseId`).
- Posting a comment via the REST API persists it in SQLite, then broadcasts a `new_comment` event to the socket room. This ensures that comments are securely saved before being pushed real-time to other clients.

## 4. Rounding Model (Round Half-Up & Remainder Allocations)

- Floating point divisions (e.g. dividing ₹100 by 3) are rounded to 2 decimal places using `Math.round((val + Number.EPSILON) * 100) / 100`.
- To prevent database ledger mismatch, the final member in a split array receives the remainder delta:
  $$\text{last\_owed} = \text{total\_amount} - \sum_{i=1}^{n-1} \text{owed}_i$$
- *Example*: Dividing ₹100.00 among Aisha, Rohan, and Priya:
  - Aisha's share: ₹33.33
  - Rohan's share: ₹33.33
  - Priya's share: $100.00 - (33.33 + 33.33) = \text{₹33.34}$
  - Sum is exactly ₹100.00, preserving integrity of balances.

## 5. Temporal Group Memberships

- **Problem**: Aisha, Rohan, Priya, and Meera were members since February. Meera left at the end of March (March 29), and Sam joined in mid-April (April 8). Dev joined for a short weekend trip.
- **Design Option**: GroupMembership model stores `joinDate` and `leaveDate`.
- **Query Logic**:
  - When calculating splits for an expense (whether imported or added manually), the expense's date is checked against each split member's `joinDate` and `leaveDate`.
  - If `expense.date < joinDate` or `expense.date > leaveDate`, the user is automatically excluded from the split.
  - This solves the issue where Meera was incorrectly split on April's Rent (Row 36 of CSV) or Sam is split on expenses before he joined.

## 6. CSV Importer Review Lifecycle

- CSV rows containing warnings/errors (unmatched users, duplicate detection, etc.) are saved to the `ImportLog` collection with a `pending_review` status.
- While in `pending_review`, these rows are completely excluded from group ledger and balance calculations to prevent inaccurate debt displays.
- Admins can manually click "Resolve" to approve the row's resolution, immediately clearing the block and recalculating active balances.
