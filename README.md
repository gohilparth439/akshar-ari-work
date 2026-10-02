# AKSHAR ARI WORK - Cloud Bill History System

This directory (`history/`) contains the standalone archive viewer and documentation for the **Firebase Firestore Cloud Bill History** system of the **AKSHAR ARI WORK** Bill Generator.

---

## 📌 Architecture & Cloud Storage

- **Database**: Google Firebase Firestore (Cloud Database).
- **Authentication**: Firebase Authentication (Email + Password).
- **Primary Source of Truth**: Cloud Firestore (`users/{userId}/bills/{billId}`).
- **Cross-Device Sync**: Shared in real-time across Computer, Mobile (Android Chrome, iOS Safari), and future Android APKs (via Capacitor).
- **Zero Backend / Server Requirements**: 100% client-side operation compatible with GitHub Pages, Capacitor APK, and local execution.
- **In-Place Duplicate Prevention**: Bills are updated in-place by document ID or `billNo` matching so no duplicate records are created.
- **Party-Name-Wise Grouping**: Bills are organized and grouped automatically by `partyName`. If a bill was generated without a party name, it is grouped cleanly under `"General / Cash"`.

---

## 🗂 Firestore Document Schema (`users/{userId}/bills/{billId}`)

Each bill record contains:
```json
{
  "billNo": "001",
  "partyChallanNo": "PC-25",
  "billDate": "2026-10-02",
  "partyName": "Ganesha",
  "subtotal": 5000,
  "grandTotal": 5000,
  "items": [
    {
      "srNo": 1,
      "description": "Saree Embroidery",
      "quantity": 100,
      "rate": 50,
      "amount": 5000
    },
    ...
  ],
  "createdAt": "Firebase Server Timestamp",
  "updatedAt": "Firebase Server Timestamp"
}
```

---

## 🚀 Key Features

1. **Party-Name-Wise History Organization**:
   - Automatically grouped by **Party Name**.
   - Each party group header displays:
     - **Party Name** (e.g. `PARTY: Ganesha`, `PARTY: ABC Traders`).
     - **Total number of bills** for that party (e.g. `3 Bills`).
     - **Total cumulative billing amount** for that party (e.g. `Total: ₹ 18,500.00`).
2. **Interactive Expand / Collapse (Accordion)**:
   - Tap any Party header to expand or collapse its bills.
   - Quick action controls: **`[ Expand All ]`** and **`[ Collapse All ]`**.
   - Animated chevron indicator showing the open/closed state.
3. **Sorted Newest First**:
   - Within each party group, bills are sorted with the newest bill date/time at the top.
   - Party groups with recent billing activity appear first.
4. **"Search Party Name / Bill No. / Party Challan No."**:
   - Dynamic search box filtering in real time across Party Name, Bill No, and Challan No.
   - Auto-expands matching party groups so matching bills are visible immediately.
5. **Card Actions**:
   - **View**: Loads the bill into preview mode with full totals and devotional motto.
   - **Edit**: Loads bill details into the 10-row editor form to update in Firestore without duplicate creation.
   - **Delete**: Prompts with confirmation and safely deletes document from Firestore Cloud.
6. **Local History Migration**:
   - One-click migration of any legacy `localStorage` bills to Firestore Cloud.
