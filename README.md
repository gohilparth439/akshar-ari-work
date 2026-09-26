# AKSHAR ARI WORK - Mobile-First Bill Generator

A complete, professional, mobile-first web bill and invoice generator designed specifically for **AKSHAR ARI WORK**.

---

## 🕉️ Devotional Motto: "Jay Swaminarayan"

- Positioned elegantly at the very top of the bill, above **AKSHAR ARI WORK**.
- Styled with devotional typography and Sanskrit danda accents: `॥ Jay Swaminarayan ॥`.
- Rendered in a deep, rich red palette (`#b71c1c`) using traditional serif lettering (`Cinzel` font).
- Perfectly proportioned (clearly visible, yet smaller than the business header).
- Appears on both the **Bill Preview** screen and the generated **A4 PDF / Printouts**.
- Strictly excluded from the data entry form to maintain a clean input experience.

---

## 📋 Comprehensive Bill History Management

The application features a built-in client-side **Bill History System** accessible directly via the **`[ 3. BILL HISTORY ]`** tab and the dedicated `history/` folder:

1. **Automatic Saving on Generation**:
   - Every time **"GENERATE BILL"** is tapped, the complete bill (Bill No., Party Challan No., Date, Party Name, all 10 item rows, Subtotal, and Grand Total) is automatically saved to browser `localStorage` (`akshar_bills_history`).
2. **In-Place Duplicate Prevention**:
   - If a bill with the same `Bill No.` is updated and re-generated, the existing entry is updated in place and moved to the top of the history list instead of creating duplicate records.
3. **Real-Time Search & Filtering**:
   - Fast instant search across `Bill No.`, `Party Challan No.`, and `Party Name`.
4. **Interactive Action Cards (Newest First)**:
   - **View Bill**: Loads the bill into preview mode with full totals and motto.
   - **Edit / Reuse**: Loads bill details into the 10-row editor for rapid template reuse.
   - **Delete**: Safely removes individual bills after prompt confirmation.
5. **Clear All History**:
   - One-click clear with confirmation modal to reset all saved bills.
6. **Real-Time Badge Counter**:
   - Live counter on the navigation tab indicating the exact number of archived bills.
7. **Dedicated History Archive Folder (`history/`)**:
   - Standalone viewer (`history/index.html`) allowing browsing and managing history independently.

---

## 📱 Mobile-First UI & Architecture (Android Chrome & iOS Safari Ready)

The application is engineered with a dedicated **mobile-first interface**:

1. **Clean Screen Separation (Tabs)**:
   - **`[ 1. ENTER BILL ]`**: Focused, card-based form interface for data entry. The long A4 bill is completely separated and does **not** clutter the input screen.
   - **`[ 2. BILL PREVIEW ]`**: Full A4 bill document scaled fluidly to mobile screen width with toolbar options: `[ ← Back to Edit Bill ]`, `[ Print ]`, and `[ Save PDF ]`.
   - **`[ 3. BILL HISTORY ]`**: Complete searchable card-based archive of all previously generated bills with count badge.

2. **Bill Information Section**:
   - **Bill No.**: Manual editable entry (e.g. `1`, `AAW-0001`). Required.
   - **Party Challan No.**: Manual editable entry (e.g. `CH-101`). Optional — the bill generates cleanly whether filled or blank. When blank, it is automatically hidden in both the bill preview and the generated PDF to maintain a neat appearance.
   - **Date**: Automatic current date (`DD/MM/YYYY`), editable.

3. **Mobile Card Item Entry**:
   - On screens `<= 600px`, each of the 10 item rows is displayed as an intuitive **compact card**:
     ```
     ┌────────────────────────────────────────────────┐
     │  ITEM #1                                       │
     ├────────────────────────────────────────────────┤
     │  Item / Work Description                       │
     │  [ Saree                                     ] │
     ├───────────────────────┬────────────────────────┤
     │  Quantity             │  Rate (₹)              │
     │  [ 1500             ] │  [ 48.00             ] │
     ├───────────────────────┴────────────────────────┤
     │  Amount: ₹ 72,000.00                           │
     └────────────────────────────────────────────────┘
     ```
   - On desktop screens (`> 600px`), it seamlessly switches to a traditional 5-column table.

4. **Touch-Optimized Large Mobile Buttons**:
   ```
   [ + New Bill ]    [ Clear ]
   [ Generate Bill (Full width, min-height 46px, 15px font) ]
   [ Print Bill    (Full width, min-height 46px, 15px font) ]
   [ Save as PDF   (Full width, min-height 46px, 15px font) ]
   ```
   - Generous vertical spacing and finger-friendly `min-height: 46px` with `font-size: 15px`.
   - SVG icons have `pointer-events: none` to guarantee every tap triggers the button smoothly.

5. **Direct PDF Download & Print Separation**:
   - **Save as PDF**: Directly creates and downloads the PDF file using client-side `jsPDF` and `html2canvas` CDN libraries.
     - **NEVER calls `window.print()`**.
     - Filename: `AKSHAR_ARI_WORK_BILL_[BILL_NO].pdf` (e.g., `AKSHAR_ARI_WORK_BILL_1.pdf`).
     - Includes **॥ Jay Swaminarayan ॥** and **Party Challan No.** when entered.
     - Renders an off-screen clone with `.pdf-render-mode` (fixed 794px A4 desktop layout), guaranteeing a sharp, single-page A4 PDF output with 10mm margins even when triggered on narrow mobile phone screens.
     - Zero browser URLs, zero file paths, zero timestamps, and zero page numbers.
     - Works seamlessly on Android mobile Chrome and desktop browsers without any backend server.
   - **Print Bill**: Dedicated to native printing. Validates the bill, updates preview, and invokes `window.print()`.
   - **Generate Bill**: Validates Bill No (prompts *"Please enter Bill No."* if missing), calculates all row amounts, subtotal, and grand total, syncs the preview DOM, auto-saves to history, and switches automatically to `2. BILL PREVIEW`.
   - **Data Safety**: Zero page reload, zero data loss upon generating, downloading, or printing. All drafts auto-saved in `localStorage`.

---

## 🌟 Core Features & Business Logic

- **Devotional Motto**: `॥ Jay Swaminarayan ॥` centered at the top of every bill and PDF.
- **Brand Name**: Prominent **AKSHAR ARI WORK** in rich red accent.
- **Manual Bill No Entry**: Type any bill number (e.g. `1`, `AAW-0001`).
- **Party Challan No.**: Optional manual entry. Displayed in preview and PDF as `Party Challan No: [entered number]`. Completely omitted when blank.
- **Date**: Automatic current date (`DD/MM/YYYY`), editable. No time displayed anywhere.
- **Party Details**: **Party Name** only (no mobile number, no address).
- **10 Items**: Exactly 10 rows numbered 1 through 10.
- **Calculations**:
  $$\text{Amount} = \text{Quantity} \times \text{Rate}$$
  $$\text{Subtotal} = \sum \text{Amount}$$
  $$\text{Grand Total} = \text{Subtotal}$$
  *(No discount field or deduction)*
- **Single Page A4 Print (`@media print`)**:
  - `@page { size: A4 portrait; margin: 0; }` suppresses browser headers (Date/Time, Title) and footers (file URL, page number 1/1) in Chrome, Edge, and Android Chrome.
  - Automatically hides all navigation, tabs, inputs, and buttons (`.no-print, .input-section, .controls, .navigation, .mobile-entry, .buttons`).
  - Fluid preview container (`width: 100%; max-width: none; margin: 0;`).
  - Internal bill padding provides crisp $10\text{mm}$ margins with rich red branding.
  - Zero browser URL, time, or document paths inside the printed bill.

---

## 📐 Mobile Screen Compatibility

Tested across all mobile viewport widths:
- **320px**: iPhone SE (1st gen)
- **360px**: Standard Android (Samsung, Redmi, Realme)
- **375px**: iPhone SE / iPhone 11 Pro / 12 mini
- **390px**: iPhone 12 / 13 / 14 / 15
- **412px**: Google Pixel / Samsung Galaxy S series
- **430px**: iPhone 14 / 15 Pro Max

---

## 📁 File Structure

```
akshar-ari-work-bill/
├── index.html         # Main app: Entry form, Preview with Motto, and History panel
├── style.css          # Responsive CSS, Devotional motto styling, History UI & Print/PDF mode
├── script.js           # Core calculations, direct PDF generator, and History storage engine
├── history/
│   ├── index.html     # Dedicated standalone bill history archive viewer
│   └── README.md      # History architecture & data schema documentation
└── README.md          # Comprehensive project documentation
```
