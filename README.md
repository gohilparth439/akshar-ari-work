# AKSHAR ARI WORK - Bill History System

This directory (`history/`) contains the standalone archive viewer and documentation for the client-side Bill History feature of the **AKSHAR ARI WORK** Bill Generator.

---

## 📌 Architecture & Data Storage

- **Storage Key**: `akshar_bills_history` in browser `localStorage`.
- **Zero Backend / Server Requirements**: 100% client-side operation compatible with GitHub Pages, local file execution, and Android Chrome.
- **In-Place Duplicate Prevention**: Bills are indexed and deduplicated by case-insensitive `billNo`. Re-generating or editing an existing bill updates the stored record in place and updates its timestamp.
- **Party-Name-Wise Grouping**: Bills are organized and grouped automatically by `partyName`. If a bill was generated without a party name, it is grouped cleanly under `"General / Cash"`.

---

## 🗂 Data Schema

Each bill record contains:
```json
{
  "id": "bill_1695712345678_abcde",
  "billNo": "001",
  "challanNo": "PC-25",
  "billDate": "2026-09-26",
  "partyName": "Ganesha",
  "items": [
    { "desc": "Saree Embroidery", "qty": "100", "rate": "50", "amount": 5000 },
    ...
  ],
  "subtotal": 5000,
  "grandTotal": 5000,
  "createdAt": "2026-09-26T06:00:00.000Z",
  "updatedAt": "2026-09-26T06:05:00.000Z"
}
```

---

## 🚀 Key Features

1. **Party-Name-Wise History Organization**:
   - Instead of a flat list, bills are automatically grouped by **Party Name**.
   - Each party group header displays:
     - **Party Name** (e.g. `PARTY: Ganesha`, `PARTY: ABC Traders`).
     - **Total number of bills** for that party (e.g. `2 Bills`).
     - **Total cumulative billing amount** for that party (e.g. `Total: ₹ 12,500.00`).
2. **Interactive Expand / Collapse (Accordion)**:
   - Tap any Party header to expand or collapse its bills.
   - Quick action controls: **`[ Expand All ]`** and **`[ Collapse All ]`**.
   - Smooth animated chevron indicator showing the open/closed state.
3. **Sorted Newest First**:
   - Within each party group, bills are sorted with the newest bill date/time at the top.
   - Party groups with recent billing activity appear first.
4. **"Search Party Name" Filtering**:
   - Dynamic search box filtering by Party Name.
   - Also supports matching Bill No. or Challan No.
   - Auto-expands matching party groups so bills are visible immediately.
5. **Card Actions**:
   - **View / Open in App**: Loads the bill into preview mode with full totals and motto.
   - **Edit / Reuse**: Loads bill details into the 10-row editor form to modify or reuse as a template.
   - **Delete**: Safely removes individual bills after prompt confirmation.
6. **Clear All History**: Allows clearing entire history with safety confirmation.
7. **Standalone Archive (`history/index.html`)**: Can be opened independently or navigated to from the main application.
