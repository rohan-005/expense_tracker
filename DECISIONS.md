# DECISIONS.md — Architectural Decisions

This document details the architectural choices and technical decisions made during the design and implementation of the Shared Expenses application.

## 1. Tech Stack Selection
- **MERN Stack**: MongoDB, Express.js, React.js, and Node.js.
  - *Rationale*: Chosen for rapid schema prototyping using Mongoose and robust JSON API support.
- **Tailwind CSS**:
  - *Rationale*: Allows implementing the strict "flat, Tangerine accent, sharp-cornered" styling system directly inside JSX components without complex custom stylesheet structures.

## 2. Session Management & Auth
- JWT tokens are signed by the server and returned to the client upon successful validation.
- The React application stores this token in `localStorage` and supplies it in the `Authorization: Bearer <token>` header.
- A central `AuthContext` provides login/register APIs and stores user state, ensuring a seamless experience.

## 3. Real-Time Chat (WebSockets)
- Implemented Socket.IO.
- When clients visit an expense details page, they join a socket room mapped to the expense's ID (`room: expenseId`).
- Posting a comment via the REST API persists it in MongoDB, then broadcasts a `new_comment` event to the socket room. This ensures that comments are securely saved before being pushed real-time to other clients.

## 4. Rounding Model (Round Half-Up)
- Floating point divisions (e.g. dividing ₹100 by 3) are rounded to 2 decimal places using `Math.round((val + Number.EPSILON) * 100) / 100`.
- To prevent database ledger mismatch, the final member in a split array receives the remainder delta:
  $$\text{last\_owed} = \text{total\_amount} - \sum_{i=1}^{n-1} \text{owed}_i$$

## 5. CSV Importer Review Lifecycle
- CSV rows containing warnings/errors (unmatched users, duplicate detection, etc.) are saved to the `ImportLog` collection with a `pending_review` status.
- While in `pending_review`, these rows are completely excluded from group ledger and balance calculations to prevent inaccurate debt displays.
- Admins can manually click "Resolve" to approve the row's resolution, immediately clearing the block and recalculating active balances.
