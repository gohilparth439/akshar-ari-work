/**
 * AKSHAR ARI WORK - Mobile-First Bill Generator
 * =============================================
 * Client-side JavaScript handling:
 * - 10-item editable card layout (mobile) and table layout (desktop)
 * - Real-time calculation: Amount = Quantity × Rate
 * - Automatic Subtotal & Grand Total (Grand Total = Subtotal, NO discount)
 * - Manual Bill Number entry
 * - Optional Manual Party Challan No. entry
 * - Automatic today's date
 * - Party Name entry (NO mobile number)
 * - Clean tab switching: [1. ENTER BILL] / [2. BILL PREVIEW]
 * - Print and Direct Save-as-PDF handling (jsPDF + html2canvas)
 * - LocalStorage draft persistence for seamless page refreshes
 */

// Configuration Constants
const TOTAL_ROWS = 10;
const STORAGE_KEY_CURRENT_BILL = 'akshar_current_bill_draft';
const STORAGE_KEY_HISTORY = 'akshar_bills_history';

// DOM Element References
const elements = {
  // Inputs
  billNoInput: document.getElementById('input-bill-no'),
  challanNoInput: document.getElementById('input-challan-no'),
  billDateInput: document.getElementById('input-bill-date'),
  partyNameInput: document.getElementById('input-party-name'),

  // Calculation Display in Form
  calcSubtotal: document.getElementById('calc-subtotal'),
  calcGrandTotal: document.getElementById('calc-grandtotal'),

  // Navigation Tabs & Panels
  tabEditor: document.getElementById('tab-editor'),
  tabPreview: document.getElementById('tab-preview'),
  tabHistory: document.getElementById('tab-history'),
  panelEditor: document.getElementById('panel-editor'),
  panelPreview: document.getElementById('panel-preview'),
  panelHistory: document.getElementById('panel-history'),
  historyBadge: document.getElementById('history-badge'),

  // History Controls
  historySearchInput: document.getElementById('history-search-input'),
  btnClearSearch: document.getElementById('btn-clear-search'),
  historyCountText: document.getElementById('history-count-text'),
  historyCardsContainer: document.getElementById('history-cards-container'),
  btnClearHistory: document.getElementById('btn-clear-history'),

  // Action Buttons
  btnNewBill: document.getElementById('btn-new-bill'),
  btnClear: document.getElementById('btn-clear'),
  btnGenerate: document.getElementById('btn-generate'),
  btnPrint: document.getElementById('btn-print'),
  btnPdf: document.getElementById('btn-pdf'),

  // Preview Header Buttons
  btnBackToEdit: document.getElementById('btn-back-to-edit'),
  btnPreviewPrint: document.getElementById('btn-preview-print'),
  btnPreviewPdf: document.getElementById('btn-preview-pdf'),

  // Preview Elements
  viewBillNo: document.getElementById('view-bill-no'),
  viewChallanNo: document.getElementById('view-challan-no'),
  viewChallanItem: document.getElementById('view-challan-item'),
  viewBillDate: document.getElementById('view-bill-date'),
  viewPartyName: document.getElementById('view-party-name'),
  viewSubtotal: document.getElementById('view-subtotal'),
  viewGrandTotal: document.getElementById('view-grandtotal'),

  // Toast
  toast: document.getElementById('toast'),
};

/**
 * Format a number into Indian Rupee Currency display (e.g. ₹ 72,000.00)
 * @param {number} value
 * @returns {string}
 */
function formatCurrency(value) {
  const num = isNaN(value) || value < 0 ? 0 : Number(value);
  return '₹ ' + num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Format date string (YYYY-MM-DD) into readable display format (DD/MM/YYYY)
 * @param {string} dateString 
 * @returns {string}
 */
function formatDateDisplay(dateString) {
  if (!dateString) return '--/--/----';
  const parts = dateString.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateString;
}

/**
 * Get today's date formatted as YYYY-MM-DD for standard HTML date input
 * @returns {string}
 */
function getTodayDateString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Display a temporary toast notification to the user
 * @param {string} message 
 * @param {string} type - 'success' or 'danger'
 */
let toastTimeout;
function showToast(message, type = 'success') {
  if (!elements.toast) return;
  clearTimeout(toastTimeout);
  
  elements.toast.textContent = message;
  elements.toast.className = `toast show ${type === 'danger' ? 'toast-danger' : 'toast-success'}`;
  
  toastTimeout = setTimeout(() => {
    elements.toast.className = 'toast';
  }, 3000);
}

/**
 * Switch between "1. ENTER BILL", "2. BILL PREVIEW", and "3. BILL HISTORY" tabs
 * @param {'editor' | 'preview' | 'history'} target 
 */
function switchTab(target) {
  // Hide all panels safely
  if (elements.panelEditor) elements.panelEditor.style.display = 'none';
  if (elements.panelPreview) elements.panelPreview.style.display = 'none';
  if (elements.panelHistory) elements.panelHistory.style.display = 'none';

  // Deactivate all tab buttons
  if (elements.tabEditor) elements.tabEditor.classList.remove('active');
  if (elements.tabPreview) elements.tabPreview.classList.remove('active');
  if (elements.tabHistory) elements.tabHistory.classList.remove('active');

  if (target === 'preview') {
    if (elements.panelPreview) elements.panelPreview.style.display = 'block';
    if (elements.tabPreview) elements.tabPreview.classList.add('active');
  } else if (target === 'history') {
    if (elements.panelHistory) elements.panelHistory.style.display = 'block';
    if (elements.tabHistory) elements.tabHistory.classList.add('active');
    renderHistoryCards();
  } else {
    // Default to editor
    if (elements.panelEditor) elements.panelEditor.style.display = 'block';
    if (elements.tabEditor) elements.tabEditor.classList.add('active');
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Core Calculation Engine:
 * - Computes row amounts: Amount = Quantity × Rate for all 10 items
 * - Computes Subtotal = Sum of all item amounts
 * - Computes Grand Total = Subtotal (NO discount)
 * - Updates Editor UI and Live A4 Preview UI simultaneously
 * - Automatically saves the draft into localStorage
 */
function calculateAndSync() {
  let subtotal = 0;

  for (let i = 1; i <= TOTAL_ROWS; i++) {
    const descInput = document.getElementById(`item-desc-${i}`);
    const qtyInput = document.getElementById(`item-qty-${i}`);
    const rateInput = document.getElementById(`item-rate-${i}`);
    const rowAmountEl = document.getElementById(`item-amount-${i}`);

    const viewDescCell = document.getElementById(`view-desc-${i}`);
    const viewQtyCell = document.getElementById(`view-qty-${i}`);
    const viewRateCell = document.getElementById(`view-rate-${i}`);
    const viewAmountCell = document.getElementById(`view-amount-${i}`);

    const desc = descInput ? descInput.value.trim() : '';
    const rawQty = qtyInput ? parseFloat(qtyInput.value) : 0;
    const rawRate = rateInput ? parseFloat(rateInput.value) : 0;

    const qty = isNaN(rawQty) || rawQty < 0 ? 0 : rawQty;
    const rate = isNaN(rawRate) || rawRate < 0 ? 0 : rawRate;

    // Formula: Amount = Quantity × Rate
    const rowAmount = qty * rate;
    subtotal += rowAmount;

    // Update row amount in form card
    if (rowAmountEl) {
      rowAmountEl.textContent = formatCurrency(rowAmount);
    }

    // Update Live Preview Row
    if (viewDescCell && viewQtyCell && viewRateCell && viewAmountCell) {
      if (desc !== '' || qty > 0 || rate > 0) {
        viewDescCell.innerHTML = desc ? `<span class="item-filled-desc">${escapeHtml(desc)}</span>` : '<span class="item-empty-desc">—</span>';
        viewQtyCell.textContent = qty > 0 ? qty : '—';
        viewRateCell.textContent = rate > 0 ? rate.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
        viewAmountCell.textContent = rowAmount > 0 ? rowAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';
      } else {
        viewDescCell.innerHTML = '<span class="item-empty-desc">—</span>';
        viewQtyCell.textContent = '—';
        viewRateCell.textContent = '—';
        viewAmountCell.textContent = '—';
      }
    }
  }

  // Grand Total = Subtotal (NO discount)
  const grandTotal = subtotal;

  // Update Calculation Summary in Form
  if (elements.calcSubtotal) elements.calcSubtotal.textContent = formatCurrency(subtotal);
  if (elements.calcGrandTotal) elements.calcGrandTotal.textContent = formatCurrency(grandTotal);

  // Update Calculation Summary in Preview
  if (elements.viewSubtotal) elements.viewSubtotal.textContent = formatCurrency(subtotal);
  if (elements.viewGrandTotal) elements.viewGrandTotal.textContent = formatCurrency(grandTotal);

  // Sync Bill Meta & Party Info to Preview
  syncPartyAndMetaToPreview();

  // Save state to localStorage
  saveCurrentDraftToStorage();
}

/**
 * Sync header metadata, Party Challan No, and Party Name from inputs to the Live A4 Preview
 */
function syncPartyAndMetaToPreview() {
  // Bill No
  if (elements.viewBillNo && elements.billNoInput) {
    const billNoVal = elements.billNoInput.value.trim();
    elements.viewBillNo.textContent = billNoVal !== '' ? billNoVal : '—';
  }

  // Party Challan No (Optional: completely hidden if blank so PDF/Preview is never ugly)
  if (elements.viewChallanItem && elements.viewChallanNo && elements.challanNoInput) {
    const challanVal = elements.challanNoInput.value.trim();
    if (challanVal !== '') {
      elements.viewChallanNo.textContent = challanVal;
      elements.viewChallanItem.classList.remove('is-hidden');
      elements.viewChallanItem.style.setProperty('display', 'flex', 'important');
    } else {
      elements.viewChallanNo.textContent = '';
      elements.viewChallanItem.classList.add('is-hidden');
      elements.viewChallanItem.style.setProperty('display', 'none', 'important');
    }
  }

  // Date
  if (elements.viewBillDate && elements.billDateInput) {
    const dateVal = elements.billDateInput.value;
    elements.viewBillDate.textContent = formatDateDisplay(dateVal);
  }

  // Party Name
  if (elements.viewPartyName && elements.partyNameInput) {
    const pName = elements.partyNameInput.value.trim();
    elements.viewPartyName.textContent = pName !== '' ? pName : '—';
  }
}

/**
 * Attach live change listeners on all 10 item inputs
 */
function attachItemEventListeners() {
  for (let i = 1; i <= TOTAL_ROWS; i++) {
    const descInput = document.getElementById(`item-desc-${i}`);
    const qtyInput = document.getElementById(`item-qty-${i}`);
    const rateInput = document.getElementById(`item-rate-${i}`);

    if (descInput) {
      descInput.addEventListener('input', calculateAndSync);
    }

    if (qtyInput) {
      qtyInput.addEventListener('input', () => {
        if (parseFloat(qtyInput.value) < 0) {
          qtyInput.value = '0';
        }
        calculateAndSync();
      });
    }

    if (rateInput) {
      rateInput.addEventListener('input', () => {
        if (parseFloat(rateInput.value) < 0) {
          rateInput.value = '0';
        }
        calculateAndSync();
      });
    }
  }
}

/**
 * Save current bill draft to localStorage to prevent data loss on page refresh
 */
function saveCurrentDraftToStorage() {
  const items = [];
  for (let i = 1; i <= TOTAL_ROWS; i++) {
    const descInput = document.getElementById(`item-desc-${i}`);
    const qtyInput = document.getElementById(`item-qty-${i}`);
    const rateInput = document.getElementById(`item-rate-${i}`);

    items.push({
      desc: descInput ? descInput.value : '',
      qty: qtyInput ? qtyInput.value : '',
      rate: rateInput ? rateInput.value : ''
    });
  }

  const draftData = {
    billNo: elements.billNoInput ? elements.billNoInput.value : '',
    challanNo: elements.challanNoInput ? elements.challanNoInput.value : '',
    billDate: elements.billDateInput ? elements.billDateInput.value : '',
    partyName: elements.partyNameInput ? elements.partyNameInput.value : '',
    items: items
  };

  try {
    localStorage.setItem(STORAGE_KEY_CURRENT_BILL, JSON.stringify(draftData));
  } catch (e) {
    console.warn('Unable to save draft to localStorage', e);
  }
}

/**
 * Load draft from localStorage on initial page load if present
 */
function loadDraftFromStorage() {
  if (elements.billDateInput) {
    elements.billDateInput.value = getTodayDateString();
  }

  const savedDraft = localStorage.getItem(STORAGE_KEY_CURRENT_BILL);
  if (!savedDraft) {
    calculateAndSync();
    return;
  }

  try {
    const draft = JSON.parse(savedDraft);
    if (draft) {
      if (draft.billNo !== undefined && elements.billNoInput) elements.billNoInput.value = draft.billNo;
      if (draft.challanNo !== undefined && elements.challanNoInput) elements.challanNoInput.value = draft.challanNo;
      if (draft.billDate && elements.billDateInput) elements.billDateInput.value = draft.billDate;
      if (elements.partyNameInput) {
        if (draft.partyName !== undefined) {
          elements.partyNameInput.value = draft.partyName;
        } else if (draft.customerName !== undefined) {
          elements.partyNameInput.value = draft.customerName;
        }
      }

      if (Array.isArray(draft.items)) {
        draft.items.forEach((item, index) => {
          const rowNum = index + 1;
          if (rowNum <= TOTAL_ROWS) {
            const descInput = document.getElementById(`item-desc-${rowNum}`);
            const qtyInput = document.getElementById(`item-qty-${rowNum}`);
            const rateInput = document.getElementById(`item-rate-${rowNum}`);

            if (descInput && item.desc !== undefined) descInput.value = item.desc;
            if (qtyInput && item.qty !== undefined) qtyInput.value = item.qty;
            if (rateInput && item.rate !== undefined) rateInput.value = item.rate;
          }
        });
      }
    }
  } catch (e) {
    console.error('Error parsing saved draft from localStorage:', e);
  }

  calculateAndSync();
}

/**
 * Handle "Generate Bill" action:
 * - Validates Bill No (must not be empty, otherwise shows "Please enter Bill No.")
 * - Party Challan No is OPTIONAL (bill generates smoothly even if blank)
 * - Reads Date and Party Name
 * - Calculates Amount for every row: Amount = Quantity × Rate
 * - Calculates Subtotal and Grand Total (Grand Total = Subtotal)
 * - Updates the Bill Preview DOM
 * - Automatically switches to: 2. BILL PREVIEW
 * - Does NOT reload the page or lose data
 * @returns {boolean} true if generated successfully, false if validation failed
 */
function generateBill() {
  const billNoVal = elements.billNoInput ? elements.billNoInput.value.trim() : '';

  // If there is no Bill No., show: "Please enter Bill No."
  if (!billNoVal) {
    showToast('Please enter Bill No.', 'danger');
    if (elements.billNoInput) {
      if (elements.panelEditor && elements.panelEditor.style.display === 'none') {
        switchTab('editor');
      }
      elements.billNoInput.focus();
      elements.billNoInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      elements.billNoInput.classList.add('input-error');
      setTimeout(() => {
        if (elements.billNoInput) elements.billNoInput.classList.remove('input-error');
      }, 2500);
    }
    return false;
  }

  // Calculate and sync preview with all entered values
  calculateAndSync();

  // Save current bill to history automatically (in-place duplicate prevention)
  saveCurrentBillToHistory();

  // Switch to preview tab
  switchTab('preview');
  showToast('Bill generated & saved to history!', 'success');
  return true;
}

let isPrinting = false;
let isGeneratingPdf = false;

/**
 * Handle "Save as PDF" action:
 * - Directly generates and downloads the PDF file using client-side libraries (jsPDF + html2canvas)
 * - NEVER calls window.print()
 * - Strictly single-page A4 format (210mm x 297mm) with 10mm margins
 * - Filename: AKSHAR_ARI_WORK_BILL_[BILL_NO].pdf (e.g. AKSHAR_ARI_WORK_BILL_1.pdf)
 * - Shows Party Challan No if entered, hides completely if blank
 * - Pure client-side execution, fully compatible with Android mobile Chrome & GitHub Pages
 * - Shows "Generating PDF..." toast during creation
 * - Does NOT reload the page or lose any entered data
 */
async function saveAsPDF() {
  if (isGeneratingPdf) return;

  // Validate Bill No and sync data (shows "Please enter Bill No." if missing)
  const isGenerated = generateBill();
  if (!isGenerated) return;

  const billPreview = document.getElementById('bill-preview');
  if (!billPreview) {
    showToast('Error: Bill preview element not found.', 'danger');
    return;
  }

  isGeneratingPdf = true;
  showToast('Generating PDF... Please wait.', 'success');

  // Disable PDF buttons temporarily during generation
  const pdfButtons = [elements.btnPdf, elements.btnPreviewPdf].filter(Boolean);
  pdfButtons.forEach(btn => {
    btn.disabled = true;
    btn.style.opacity = '0.7';
  });

  // Determine safe filename: AKSHAR_ARI_WORK_BILL_[BILL_NO].pdf
  const billNoRaw = elements.billNoInput ? elements.billNoInput.value.trim() : '1';
  const safeBillNo = billNoRaw.replace(/[^a-zA-Z0-9_-]/g, '_') || '1';
  const fileName = `AKSHAR_ARI_WORK_BILL_${safeBillNo}.pdf`;

  // Create an off-screen clone with .pdf-render-mode to guarantee 794px A4 desktop layout
  // regardless of whether generated on a 320px phone or a desktop monitor
  const clone = billPreview.cloneNode(true);
  clone.id = 'bill-preview-pdf-clone';
  clone.classList.add('pdf-render-mode');
  clone.style.position = 'fixed';
  clone.style.left = '0';
  clone.style.top = '0';
  clone.style.width = '794px';
  clone.style.zIndex = '-9999';
  clone.style.opacity = '1';
  clone.style.visibility = 'visible';
  clone.style.pointerEvents = 'none';
  document.body.appendChild(clone);

  try {
    const hasHtml2Canvas = typeof window.html2canvas === 'function';
    const jsPDFClass = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;

    if (hasHtml2Canvas && jsPDFClass) {
      // High-resolution canvas capture (scale: 2 = 1588px width)
      const canvas = await window.html2canvas(clone, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 1024
      });

      const imgData = canvas.toDataURL('image/png');

      // Create portrait A4 PDF in mm
      const pdf = new jsPDFClass({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      // A4 page: 210mm x 297mm. Available printable area with 10mm margins = 190mm x 277mm
      let pdfWidth = 190;
      let pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      // Mathematically guarantee content NEVER overflows onto a second page
      if (pdfHeight > 277) {
        const scaleFactor = 277 / pdfHeight;
        pdfHeight = 277;
        pdfWidth = pdfWidth * scaleFactor;
      }

      const x = (210 - pdfWidth) / 2;
      const y = 10;

      pdf.addImage(imgData, 'PNG', x, y, pdfWidth, pdfHeight, undefined, 'FAST');
      pdf.save(fileName);

      showToast(`PDF downloaded: ${fileName}`, 'success');
    } else if (typeof window.html2pdf === 'function') {
      // Fallback to html2pdf if global structure differs
      const opt = {
        margin: [10, 10, 10, 10],
        filename: fileName,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, windowWidth: 1024, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };
      await window.html2pdf().set(opt).from(clone).save();
      showToast(`PDF downloaded: ${fileName}`, 'success');
    } else {
      throw new Error('PDF library is not loaded. Please check your internet connection and refresh.');
    }
  } catch (err) {
    console.error('Error generating PDF:', err);
    showToast(`PDF generation error: ${err.message || 'Please try again'}`, 'danger');
  } finally {
    // Clean up off-screen clone from DOM
    if (clone && clone.parentNode) {
      clone.parentNode.removeChild(clone);
    }
    // Re-enable PDF buttons
    pdfButtons.forEach(btn => {
      btn.disabled = false;
      btn.style.opacity = '1';
    });
    isGeneratingPdf = false;
  }
}

/**
 * Handle "Print Bill" action:
 * - Generates the bill and updates preview
 * - Calls native browser window.print() after a 500ms delay
 */
function printBill() {
  if (isPrinting) return;
  const isGenerated = generateBill();
  if (!isGenerated) return;

  isPrinting = true;
  showToast('Opening print dialog...', 'success');
  setTimeout(function() {
    window.print();
    setTimeout(function() { isPrinting = false; }, 1000);
  }, 500);
}

/**
 * Handle "Clear" action:
 * Prompts confirmation before clearing Party Name, Party Challan No, and all 10 items
 */
function handleClear() {
  const confirmed = window.confirm('Are you sure you want to clear all entered party details and item fields?');
  if (!confirmed) return;

  if (elements.partyNameInput) elements.partyNameInput.value = '';
  if (elements.challanNoInput) elements.challanNoInput.value = '';

  for (let i = 1; i <= TOTAL_ROWS; i++) {
    const descInput = document.getElementById(`item-desc-${i}`);
    const qtyInput = document.getElementById(`item-qty-${i}`);
    const rateInput = document.getElementById(`item-rate-${i}`);

    if (descInput) descInput.value = '';
    if (qtyInput) qtyInput.value = '';
    if (rateInput) rateInput.value = '';
  }

  calculateAndSync();
  showToast('Form fields cleared.', 'danger');
}

/**
 * Handle "New Bill" action:
 * - Bill No. field becomes blank for manual entry
 * - Clears Party Challan No
 * - Sets today's date
 * - Clears party name and all 10 items
 * - Resets subtotal & grand total
 * - Switches to Editor tab and focuses Bill No
 */
function handleNewBill() {
  const confirmed = window.confirm('Start a New Bill? This will clear all fields and prepare a fresh blank bill.');
  if (!confirmed) return;

  if (elements.billNoInput) elements.billNoInput.value = '';
  if (elements.challanNoInput) elements.challanNoInput.value = '';
  if (elements.billDateInput) elements.billDateInput.value = getTodayDateString();
  if (elements.partyNameInput) elements.partyNameInput.value = '';

  for (let i = 1; i <= TOTAL_ROWS; i++) {
    const descInput = document.getElementById(`item-desc-${i}`);
    const qtyInput = document.getElementById(`item-qty-${i}`);
    const rateInput = document.getElementById(`item-rate-${i}`);

    if (descInput) descInput.value = '';
    if (qtyInput) qtyInput.value = '';
    if (rateInput) rateInput.value = '';
  }

  calculateAndSync();
  switchTab('editor');

  if (elements.billNoInput) {
    elements.billNoInput.focus();
  }

  showToast('New blank bill prepared. Enter Bill No to begin.', 'success');
}

/**
 * ==========================================================================
 * BILL HISTORY MANAGEMENT SYSTEM
 * ==========================================================================
 * - Persistent client-side storage in localStorage under 'akshar_bills_history'
 * - Auto-saves on every successful "Generate Bill"
 * - In-place duplicate prevention (updates record if matching billNo exists)
 * - Real-time search by Bill No., Challan No., or Party Name
 * - Fast View, Edit / Reuse, and Delete actions
 * - Real-time badge counter on navigation tab
 */

/**
 * Retrieve the saved bills array from localStorage
 * @returns {Array<Object>}
 */
function getHistoryList() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_HISTORY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Error reading bill history from localStorage:', err);
    return [];
  }
}

/**
 * Persist the bills array to localStorage and update badge
 * @param {Array<Object>} list
 */
function saveHistoryList(list) {
  try {
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(list));
  } catch (err) {
    console.error('Error saving bill history to localStorage:', err);
    showToast('Warning: Storage is full or unavailable.', 'danger');
  }
  updateHistoryBadge();
}

/**
 * Update the tab badge count with the total number of saved bills
 */
function updateHistoryBadge() {
  const list = getHistoryList();
  if (elements.historyBadge) {
    elements.historyBadge.textContent = list.length;
  }
}

/**
 * Save current bill draft to history on "Generate Bill":
 * - Collects Bill No, Challan No, Date, Party Name, 10 items, Subtotal, Grand Total
 * - Checks if a bill with matching Bill No already exists
 * - If found: updates record in-place and moves it to top (newest)
 * - If new: unshifts as newest record
 */
function saveCurrentBillToHistory() {
  const billNoVal = elements.billNoInput ? elements.billNoInput.value.trim() : '';
  if (!billNoVal) return;

  const challanNoVal = elements.challanNoInput ? elements.challanNoInput.value.trim() : '';
  const dateVal = elements.billDateInput ? elements.billDateInput.value : getTodayDateString();
  const partyNameVal = elements.partyNameInput ? elements.partyNameInput.value.trim() : '';

  // Extract all 10 item rows
  const items = [];
  let subtotal = 0;
  for (let i = 1; i <= TOTAL_ROWS; i++) {
    const descInput = document.getElementById(`item-desc-${i}`);
    const qtyInput = document.getElementById(`item-qty-${i}`);
    const rateInput = document.getElementById(`item-rate-${i}`);

    const desc = descInput ? descInput.value.trim() : '';
    const rawQty = qtyInput ? parseFloat(qtyInput.value) : 0;
    const rawRate = rateInput ? parseFloat(rateInput.value) : 0;
    const qty = isNaN(rawQty) || rawQty < 0 ? 0 : rawQty;
    const rate = isNaN(rawRate) || rawRate < 0 ? 0 : rawRate;
    const amount = qty * rate;
    subtotal += amount;

    items.push({
      desc: desc,
      qty: qtyInput ? qtyInput.value : '',
      rate: rateInput ? rateInput.value : '',
      amount: amount
    });
  }

  const grandTotal = subtotal;
  const historyList = getHistoryList();
  const nowIso = new Date().toISOString();

  // Check for existing bill with same Bill No (case-insensitive)
  const existingIndex = historyList.findIndex(
    b => b.billNo && b.billNo.trim().toLowerCase() === billNoVal.toLowerCase()
  );

  if (existingIndex !== -1) {
    // In-place update existing record and move to top
    const existingBill = historyList[existingIndex];
    existingBill.billNo = billNoVal;
    existingBill.challanNo = challanNoVal;
    existingBill.billDate = dateVal;
    existingBill.partyName = partyNameVal;
    existingBill.items = items;
    existingBill.subtotal = subtotal;
    existingBill.grandTotal = grandTotal;
    existingBill.updatedAt = nowIso;

    // Move to front (newest)
    historyList.splice(existingIndex, 1);
    historyList.unshift(existingBill);
  } else {
    // Create new bill entry
    const newBill = {
      id: 'bill_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      billNo: billNoVal,
      challanNo: challanNoVal,
      billDate: dateVal,
      partyName: partyNameVal,
      items: items,
      subtotal: subtotal,
      grandTotal: grandTotal,
      createdAt: nowIso,
      updatedAt: nowIso
    };
    historyList.unshift(newBill);
  }

  saveHistoryList(historyList);
}

// State tracking for collapsed party groups
const collapsedPartyKeys = new Set();

/**
 * Group a flat list of bills into party groups
 * @param {Array<Object>} bills
 * @returns {Array<Object>}
 */
function groupBillsByParty(bills) {
  const groupsMap = new Map();

  bills.forEach(bill => {
    const rawParty = (bill.partyName || '').trim();
    const displayParty = rawParty || 'General / Cash';
    const partyKey = rawParty ? rawParty.toLowerCase() : '__general_cash__';

    if (!groupsMap.has(partyKey)) {
      groupsMap.set(partyKey, {
        partyName: displayParty,
        partyKey: partyKey,
        bills: [],
        totalAmount: 0,
        billCount: 0,
        latestTimestamp: 0
      });
    }

    const group = groupsMap.get(partyKey);
    // Keep the best formatted version of party name
    if (group.partyName === 'General / Cash' && rawParty) {
      group.partyName = displayParty;
    }

    group.bills.push(bill);
    const amount = Number(bill.grandTotal) || 0;
    group.totalAmount += amount;
    group.billCount++;

    // Track latest bill timestamp for recency sorting
    const billTimestamp = bill.createdAt ? new Date(bill.createdAt).getTime() : 
                          (bill.billDate ? new Date(bill.billDate).getTime() : 0);
    if (billTimestamp > group.latestTimestamp) {
      group.latestTimestamp = billTimestamp;
    }
  });

  const partyGroups = Array.from(groupsMap.values());

  // Sort bills newest first within each party group
  partyGroups.forEach(group => {
    group.bills.sort((a, b) => {
      // 1. Compare billDate descending (YYYY-MM-DD)
      const dateA = a.billDate || '';
      const dateB = b.billDate || '';
      if (dateA !== dateB) {
        return dateB.localeCompare(dateA);
      }
      // 2. Compare updatedAt or createdAt descending
      const timeA = a.updatedAt || a.createdAt || '';
      const timeB = b.updatedAt || b.createdAt || '';
      if (timeA !== timeB) {
        return timeB.localeCompare(timeA);
      }
      // 3. Fallback to id
      return (b.id || '').localeCompare(a.id || '');
    });
  });

  // Sort party groups by latest bill activity descending
  partyGroups.sort((a, b) => b.latestTimestamp - a.latestTimestamp);

  return partyGroups;
}

/**
 * Toggle collapse/expand state for a specific party group
 * @param {string} partyKey
 */
function togglePartyGroup(partyKey) {
  const safeId = 'party-group-' + encodeURIComponent(partyKey).replace(/%/g, '_');
  const groupEl = document.getElementById(safeId);

  if (collapsedPartyKeys.has(partyKey)) {
    collapsedPartyKeys.delete(partyKey);
    if (groupEl) {
      groupEl.classList.remove('is-collapsed');
      const btn = groupEl.querySelector('.party-group-header');
      if (btn) btn.setAttribute('aria-expanded', 'true');
    }
  } else {
    collapsedPartyKeys.add(partyKey);
    if (groupEl) {
      groupEl.classList.add('is-collapsed');
      const btn = groupEl.querySelector('.party-group-header');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    }
  }
}

/**
 * Expand all party groups
 */
function expandAllPartyGroups() {
  collapsedPartyKeys.clear();
  const allGroups = document.querySelectorAll('.party-group');
  allGroups.forEach(el => {
    el.classList.remove('is-collapsed');
    const btn = el.querySelector('.party-group-header');
    if (btn) btn.setAttribute('aria-expanded', 'true');
  });
}

/**
 * Collapse all party groups
 */
function collapseAllPartyGroups() {
  const allGroups = document.querySelectorAll('.party-group');
  allGroups.forEach(el => {
    const key = el.getAttribute('data-party-key');
    if (key) collapsedPartyKeys.add(key);
    el.classList.add('is-collapsed');
    const btn = el.querySelector('.party-group-header');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  });
}

/**
 * Render Party-Name-Wise grouped history cards based on current search query
 * @param {string} filterQuery
 */
function renderHistoryCards(filterQuery = null) {
  if (!elements.historyCardsContainer) return;

  const allBills = getHistoryList();
  const query = (filterQuery !== null ? filterQuery : (elements.historySearchInput ? elements.historySearchInput.value : '')).trim().toLowerCase();

  // Toggle search clear button
  if (elements.btnClearSearch) {
    elements.btnClearSearch.style.display = query ? 'block' : 'none';
  }

  // Handle empty state (no bills saved at all)
  if (allBills.length === 0) {
    if (elements.historyCountText) {
      elements.historyCountText.textContent = '0 saved bills';
    }
    elements.historyCardsContainer.innerHTML = `
      <div class="history-empty-state">
        <div class="empty-icon">📋</div>
        <h3 class="empty-title">No Saved Bills Yet</h3>
        <p class="empty-desc">Bills generated in "Enter Bill" will automatically be grouped by Party Name here for easy access, reprinting, or editing.</p>
        <button class="btn btn-primary" type="button" onclick="switchTab('editor')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Create First Bill
        </button>
      </div>
    `;
    return;
  }

  // Group all bills by party name
  const allPartyGroups = groupBillsByParty(allBills);

  // If query is present, filter party groups or matching bills
  let displayGroups = allPartyGroups;
  if (query) {
    displayGroups = [];
    allPartyGroups.forEach(group => {
      const matchParty = group.partyName.toLowerCase().includes(query);
      if (matchParty) {
        // Party name matches, show all bills of this party
        displayGroups.push(group);
        // Auto-expand this group so user sees results immediately
        collapsedPartyKeys.delete(group.partyKey);
      } else {
        // Check if any bills inside match billNo or challanNo
        const matchingBills = group.bills.filter(b => 
          (b.billNo || '').toLowerCase().includes(query) ||
          (b.challanNo || '').toLowerCase().includes(query)
        );
        if (matchingBills.length > 0) {
          const matchingTotal = matchingBills.reduce((sum, b) => sum + (Number(b.grandTotal) || 0), 0);
          displayGroups.push({
            ...group,
            bills: matchingBills,
            billCount: matchingBills.length,
            totalAmount: matchingTotal
          });
          collapsedPartyKeys.delete(group.partyKey);
        }
      }
    });
  }

  // Update stats text
  const totalBillsCount = displayGroups.reduce((sum, g) => sum + g.billCount, 0);
  const totalAmountSum = displayGroups.reduce((sum, g) => sum + g.totalAmount, 0);

  if (elements.historyCountText) {
    if (query) {
      elements.historyCountText.textContent = `Showing ${displayGroups.length} Part${displayGroups.length === 1 ? 'y' : 'ies'} (${totalBillsCount} Bill${totalBillsCount === 1 ? '' : 's'})`;
    } else {
      elements.historyCountText.textContent = `${displayGroups.length} Part${displayGroups.length === 1 ? 'y' : 'ies'} • ${totalBillsCount} Bills • Total: ${formatCurrency(totalAmountSum)}`;
    }
  }

  if (displayGroups.length === 0) {
    elements.historyCardsContainer.innerHTML = `
      <div class="history-empty-state">
        <div class="empty-icon">🔍</div>
        <h3 class="empty-title">No Matching Parties</h3>
        <p class="empty-desc">No party name or bills found matching "<strong>${escapeHtml(query)}</strong>".</p>
        <button class="btn btn-secondary" type="button" onclick="clearHistorySearch()">Clear Search</button>
      </div>
    `;
    return;
  }

  // Render Party Groups
  const groupsHtml = displayGroups.map(group => {
    const isCollapsed = collapsedPartyKeys.has(group.partyKey);
    const safeId = 'party-group-' + encodeURIComponent(group.partyKey).replace(/%/g, '_');

    // Render bills inside this party (newest first)
    const billsHtml = group.bills.map(bill => {
      const filledItems = (bill.items || []).filter(it => it.desc || parseFloat(it.qty) > 0 || parseFloat(it.rate) > 0);
      const firstFilledDesc = filledItems.length > 0 && filledItems[0].desc ? filledItems[0].desc : 'No item descriptions';
      const challanBadgeHtml = bill.challanNo 
        ? `<span class="pb-challan-badge">Party Challan No: ${escapeHtml(bill.challanNo)}</span>`
        : '';

      return `
        <div class="party-bill-card" id="h-card-${escapeHtml(bill.id)}">
          <div class="pb-meta-line">
            <div class="pb-badge-group">
              <span class="pb-bill-badge">Bill No: ${escapeHtml(bill.billNo)}</span>
              ${challanBadgeHtml}
            </div>
            <span class="pb-date">Date: ${formatDateDisplay(bill.billDate)}</span>
          </div>

          <div class="pb-data-line">
            <div class="pb-total-group">
              <span class="pb-total-lbl">Grand Total:</span>
              <span class="pb-total-val">${formatCurrency(bill.grandTotal || 0)}</span>
            </div>
            <div class="pb-items-summary" title="${escapeHtml(firstFilledDesc)}">
              <span class="pb-items-pill">${filledItems.length} item${filledItems.length === 1 ? '' : 's'}</span>
              <span class="pb-first-desc">${escapeHtml(firstFilledDesc)}</span>
            </div>
          </div>

          <div class="pb-actions-line">
            <button class="btn btn-secondary" type="button" onclick="viewHistoryBill('${escapeHtml(bill.id)}')">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              View
            </button>
            <button class="btn btn-secondary" type="button" onclick="editHistoryBill('${escapeHtml(bill.id)}')">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Edit
            </button>
            <button class="btn btn-danger-outline" type="button" onclick="deleteHistoryBill('${escapeHtml(bill.id)}')">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              Delete
            </button>
          </div>
        </div>
      `;
    }).join('');

    const escapedPartyKey = escapeHtml(group.partyKey).replace(/'/g, "\\'");

    return `
      <div class="party-group ${isCollapsed ? 'is-collapsed' : ''}" id="${safeId}" data-party-key="${escapeHtml(group.partyKey)}">
        <div class="party-group-header" role="button" tabindex="0" aria-expanded="${!isCollapsed}" onclick="togglePartyGroup('${escapedPartyKey}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();togglePartyGroup('${escapedPartyKey}');}">
          <div class="party-header-info">
            <div class="party-name-row">
              <span class="party-name-label">PARTY:</span>
              <span class="party-name-title">${escapeHtml(group.partyName)}</span>
            </div>
            <div class="party-meta-row">
              <span class="party-bills-badge">${group.billCount} Bill${group.billCount === 1 ? '' : 's'}</span>
              <span class="party-total-badge">Total: ${formatCurrency(group.totalAmount)}</span>
            </div>
          </div>
          <div class="party-chevron-box" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        </div>
        <div class="party-bills-list">
          ${billsHtml}
        </div>
      </div>
    `;
  }).join('');

  elements.historyCardsContainer.innerHTML = groupsHtml;
}

/**
 * Load bill data into application inputs and synchronize state
 * @param {Object} bill
 */
function populateBillData(bill) {
  if (!bill) return;

  if (elements.billNoInput) elements.billNoInput.value = bill.billNo || '';
  if (elements.challanNoInput) elements.challanNoInput.value = bill.challanNo || '';
  if (elements.billDateInput) elements.billDateInput.value = bill.billDate || getTodayDateString();
  if (elements.partyNameInput) elements.partyNameInput.value = bill.partyName || '';

  const items = Array.isArray(bill.items) ? bill.items : [];
  for (let i = 1; i <= TOTAL_ROWS; i++) {
    const descInput = document.getElementById(`item-desc-${i}`);
    const qtyInput = document.getElementById(`item-qty-${i}`);
    const rateInput = document.getElementById(`item-rate-${i}`);

    const item = items[i - 1];
    if (descInput) descInput.value = item && item.desc !== undefined ? item.desc : '';
    if (qtyInput) qtyInput.value = item && item.qty !== undefined ? item.qty : '';
    if (rateInput) rateInput.value = item && item.rate !== undefined ? item.rate : '';
  }

  calculateAndSync();
}

/**
 * View saved bill in Bill Preview tab
 * @param {string} id
 */
function viewHistoryBill(id) {
  const list = getHistoryList();
  const bill = list.find(b => b.id === id);
  if (!bill) {
    showToast('Bill not found in history.', 'danger');
    return;
  }

  populateBillData(bill);
  switchTab('preview');
  showToast(`Loaded Bill #${bill.billNo} for preview.`, 'success');
}

/**
 * Load saved bill into editor form for editing or reuse
 * @param {string} id
 */
function editHistoryBill(id) {
  const list = getHistoryList();
  const bill = list.find(b => b.id === id);
  if (!bill) {
    showToast('Bill not found in history.', 'danger');
    return;
  }

  populateBillData(bill);
  switchTab('editor');

  if (elements.billNoInput) {
    elements.billNoInput.focus();
  }

  showToast(`Loaded Bill #${bill.billNo} for editing.`, 'success');
}

/**
 * Delete a specific bill from history
 * @param {string} id
 */
function deleteHistoryBill(id) {
  const list = getHistoryList();
  const bill = list.find(b => b.id === id);
  if (!bill) return;

  const confirmed = window.confirm(`Are you sure you want to delete Bill #${bill.billNo} from history?`);
  if (!confirmed) return;

  const updatedList = list.filter(b => b.id !== id);
  saveHistoryList(updatedList);
  renderHistoryCards();
  showToast(`Bill #${bill.billNo} deleted.`, 'danger');
}

/**
 * Clear all history after user confirmation
 */
function handleClearAllHistory() {
  const list = getHistoryList();
  if (list.length === 0) {
    showToast('History is already empty.', 'danger');
    return;
  }

  const confirmed = window.confirm('Are you sure you want to delete ALL saved bills history? This cannot be undone.');
  if (!confirmed) return;

  try {
    localStorage.removeItem(STORAGE_KEY_HISTORY);
  } catch (err) {
    console.error('Error clearing history:', err);
  }

  updateHistoryBadge();
  renderHistoryCards();
  showToast('All saved bill history has been cleared.', 'danger');
}

/**
 * Clear the history search input and re-render
 */
function clearHistorySearch() {
  if (elements.historySearchInput) {
    elements.historySearchInput.value = '';
    elements.historySearchInput.focus();
  }
  renderHistoryCards();
}

/**
 * Sanitize HTML entities to prevent XSS in inputs
 * @param {string} str 
 * @returns {string}
 */
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Setup Global Event Listeners
 */
function setupEventListeners() {
  // Navigation Tabs
  if (elements.tabEditor) elements.tabEditor.addEventListener('click', () => switchTab('editor'));
  if (elements.tabPreview) elements.tabPreview.addEventListener('click', () => switchTab('preview'));
  if (elements.tabHistory) elements.tabHistory.addEventListener('click', () => switchTab('history'));

  // History Controls
  if (elements.historySearchInput) {
    elements.historySearchInput.addEventListener('input', (e) => {
      renderHistoryCards(e.target.value);
    });
  }
  if (elements.btnClearSearch) elements.btnClearSearch.addEventListener('click', clearHistorySearch);
  if (elements.btnClearHistory) elements.btnClearHistory.addEventListener('click', handleClearAllHistory);

  // Form Inputs
  if (elements.billNoInput) elements.billNoInput.addEventListener('input', calculateAndSync);
  if (elements.challanNoInput) elements.challanNoInput.addEventListener('input', calculateAndSync);
  if (elements.partyNameInput) elements.partyNameInput.addEventListener('input', calculateAndSync);
  if (elements.billDateInput) elements.billDateInput.addEventListener('change', calculateAndSync);

  // Form Buttons Grid
  if (elements.btnNewBill) elements.btnNewBill.addEventListener('click', handleNewBill);
  if (elements.btnClear) elements.btnClear.addEventListener('click', handleClear);
  if (elements.btnGenerate) elements.btnGenerate.addEventListener('click', generateBill);
  if (elements.btnPrint) elements.btnPrint.addEventListener('click', printBill);
  if (elements.btnPdf) elements.btnPdf.addEventListener('click', saveAsPDF);

  // Preview Header Buttons
  if (elements.btnBackToEdit) elements.btnBackToEdit.addEventListener('click', () => switchTab('editor'));
  if (elements.btnPreviewPrint) elements.btnPreviewPrint.addEventListener('click', printBill);
  if (elements.btnPreviewPdf) elements.btnPreviewPdf.addEventListener('click', saveAsPDF);

  // Attach Item listeners
  attachItemEventListeners();
}

// Expose functions globally for onclick attributes and external callers
window.generateBill = generateBill;
window.saveAsPDF = saveAsPDF;
window.printBill = printBill;
window.switchTab = switchTab;
window.handleNewBill = handleNewBill;
window.handleClear = handleClear;
window.viewHistoryBill = viewHistoryBill;
window.editHistoryBill = editHistoryBill;
window.deleteHistoryBill = deleteHistoryBill;
window.handleClearAllHistory = handleClearAllHistory;
window.clearHistorySearch = clearHistorySearch;
window.togglePartyGroup = togglePartyGroup;
window.expandAllPartyGroups = expandAllPartyGroups;
window.collapseAllPartyGroups = collapseAllPartyGroups;

/**
 * Initialize Application on DOM Ready
 */
document.addEventListener('DOMContentLoaded', () => {
  // 1. Attach all event listeners to static HTML elements
  setupEventListeners();

  // 2. Load draft from localStorage or calculate initial state
  loadDraftFromStorage();

  // 3. Update history count badge
  updateHistoryBadge();

  // 4. Default view: Show requested hash or Form (1. ENTER BILL)
  const initialHash = window.location.hash.replace('#', '');
  if (initialHash === 'preview' || initialHash === 'history') {
    switchTab(initialHash);
  } else {
    switchTab('editor');
  }
});
