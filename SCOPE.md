# SCOPE.md — Business Scope & Requirements

This document outlines the bounds, constraints, and business logic of the Shared Expenses application.

## 📐 Functional Scope

### 1. User Membership and Date Bounds
- Group members can join and leave a group on specific dates.
- An expense's split calculation must exclude members whose participation dates do not overlap with the expense date.
- **Rule**: If `expense.date < member.joinDate` or `expense.date > member.leaveDate`, that member's split is set to 0, and their share is not included in the ledger calculations.

### 2. Conversions
- Primary currency is INR (₹).
- Any expense submitted in USD ($) is automatically converted using the fixed rate:
  $$1 \text{ USD} = 83 \text{ INR}$$

### 3. Dynamic Balance Calculations
- Pairwise debt balances are calculated dynamically from active (non-deleted) expenses and settlements.
- Unresolved import rows flagged `pending_review` are excluded from balance calculations until resolved by an admin.

### 4. CSV Importer Engine
The importer parses local or uploaded CSV datasets and enforces 13 strict rules:
- **Rule 1 (Name Matching)**: Normalizes names and matches existing users using alias strings.
- **Rule 2 (Currency Check)**: Assumes INR if currency is missing. Converts USD to INR at standard 1:83 rate.
- **Rule 3 (Jaccard Similarity)**: Uses a token-based Jaccard similarity index on expense descriptions. If a row is $\ge 0.85$ similar to an existing one in the group with matching amount and date, it flags it as a duplicate.
- **Rule 4 (Settlement Auto-Detect)**: Automatically converts expense rows with description "settlement" or similar payment keywords into standard Settlements.
- **Rule 5 (Date Bounds Check)**: Validates that the expense date falls within the member's group join/leave bounds.
- **Rule 6 (Rounding Deltas)**: Distributes any floating point rounding remainder to the last member in the split list to ensure sums match the converted amount exactly.

---

## 🚫 Out of Scope
- External payment gateway integrations (payments are recorded manually via "Settle Up" logs).
- Multiple active themes or Dark Mode (Visual guidelines lock the app to sharp-cornered Light Mode only).
- Dynamic, real-time exchange rate API integrations (standard fixed rate of 83 INR/USD is enforced).
