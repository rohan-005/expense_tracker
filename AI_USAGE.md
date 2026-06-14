# AI_USAGE.md — AI Co-Pilot Attribution

This document attributes the assistance provided by the Antigravity AI coding agent (developed by Google DeepMind) in building the Shared Expenses application.

## 🤖 AI Agent Details
- **Agent Name**: Antigravity
- **Capabilities**: Full-stack application building, test execution, database schema modeling, and layout styling.

## 🛠 Model Context Protocol (MCP) and Tools Utilized
During the project setup, coding, and review sessions, the model interacted with the host system using the following tools:
1. `view_file`: Examined codebase templates, Sequelize schemas, and routes to ensure strict integration.
2. `write_to_file` & `replace_file_content`: Created and updated source codes across backend database routers and frontend React components.
3. `run_command`: Ran local commands to install dependencies, run the database seed script, build frontend production packages, and manage git commits.

## 📝 Contributions
- **Backend Architecture**: Designed the dynamic balance calculation algorithms, Jaccard similarity functions, and soft-delete endpoints.
- **Frontend Assembly**: Built React pages (Dashboard, Details, CSV Importer, Logs, Auth) incorporating a strict Tangerine-accented, sharp-cornered Tailwind CSS configuration.
- **WebSocket Configuration**: Integrated Socket.IO room behaviors to push comments securely across users in real time.

---

## ⚠️ AI Mistakes, Detection, and Resolution Log

Below are three concrete cases where the AI made a mistake during development, how it was caught, and how it was resolved:

### Case 1: Sequelize Attribute-Association Naming Collision
- **Mistake**: The AI initially defined the foreign key column as `paidBy` inside the `Expense` model attributes list while also defining a `belongsTo` association using the alias `as: 'paidBy'`. Sequelize throws a naming collision error when a model column matches the alias name.
- **How it was caught**: Running the development server command (`nodemon server.js`) immediately crashed the application with:
  `Error: Naming collision between attribute 'paidBy' and association 'paidBy' on model Expense. To remedy this, change either foreignKey or as in your association definition`
- **How it was resolved**: Renamed the database column field in the schema definition to `paidById` and configured the association as `Expense.belongsTo(User, { as: 'paidBy', foreignKey: 'paidById' });`. This resolved the collision while successfully preserving the exact `paidBy` object key inside API JSON payloads.

### Case 2: Mongoose Queries Left Unmodified in SQLite Routes
- **Mistake**: When migrating from Mongoose to Sequelize, the AI initially overlooked several Mongoose-specific query patterns in backend routes, such as using `deleteMany({})` for clearing import logs or `find({ group: groupId })` with `.populate()` on models.
- **How it was caught**: Discovered through code quality reviews of the routes folder, where Mongoose methods were identified in `routes/import.js` and `routes/groups.js` which would cause runtime crashes during query execution.
- **How it was resolved**: Replaced all remaining Mongoose query methods with their standard Sequelize equivalents:
  - `deleteMany({})` -> `destroy({ where: {} })`
  - `.find().populate()` -> `findAll({ include: [...] })`
  - `.findById()` -> `findByPk()`
  - Modified key lookups to use `id` instead of `_id`, while appending a backwards-compatible `_id` property onto JSON outputs for the React frontend.

### Case 3: Outdated Column Reference in CSV Importer Queries
- **Mistake**: During the relational model refactoring, the AI forgot to update model insertion operations inside `backend/utils/csvImporter.js` to match the newly renamed database columns, leaving references to `group`, `user`, `fromUser`, and `toUser` intact.
- **How it was caught**: Running the seeding script and reviewing the console stack traces showed model validation errors when attempting database writes.
- **How it was resolved**: Rewrote the insertions in `csvImporter.js` to target the updated Sequelize columns:
  - `group` -> `groupId`
  - `user`/`paidBy` -> `userId`/`paidById`
  - `fromUser`/`toUser` -> `fromUserId`/`toUserId`
  - `expense` -> `expenseId`
