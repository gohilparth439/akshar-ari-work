/**
 * AKSHAR ARI WORK - Mobile-First Bill Generator with Firebase Firestore Cloud Storage
 * ===================================================================================
 * Features:
 * - 10-item editable card layout (mobile) and table layout (desktop)
 * - Real-time calculation: Amount = Quantity × Rate
 * - Automatic Subtotal & Grand Total (Grand Total = Subtotal, NO discount)
 * - Manual Bill Number entry & Optional Manual Party Challan No. entry
 * - Automatic today's date & Party Name entry
 * - Clean tab switching: [1. ENTER BILL] / [2. BILL PREVIEW] / [3. BILL HISTORY]
 * - Devotional Motto: "॥ Jay Swaminarayan ॥" at top of preview & PDF
 * - Direct Save-as-PDF (jsPDF + html2canvas) without print dialog
 * - Native Print Bill (window.print())
 * - Firebase Authentication (Email + Password for business owner)
 * - Firebase Firestore Cloud Database (Primary source of truth for cross-device shared history)
 * - User Data Isolation: users/{userId}/bills/{billId}
 * - Party-name-wise grouped history with count & total billing badges
 * - Instant search across Party Name, Bill No, and Party Challan No
 * - Accordion expand / collapse for party groups
 * - Safe migration of legacy localStorage history to Firestore Cloud
 */

// Configuration Constants
const TOTAL_ROWS = 10;
const STORAGE_KEY_CURRENT_BILL = 'akshar_current_bill_draft';
const STORAGE_KEY_LEGACY_HISTORY = 'akshar_bills_history';

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

  // Cloud Status in Header
  cloudStatusBtn: document.getElementById('cloud-status-btn'),
  cloudStatusText: document.getElementById('cloud-status-text'),

  // Edit Mode Active Banner
  editingModeBanner: document.getElementById('editing-mode-banner'),
  editingBillLabel: document.getElementById('editing-bill-label'),

  // History Controls
  historySearchCard: document.getElementById('history-search-card'),
  historySearchInput: document.getElementById('history-search-input'),
  btnClearSearch: document.getElementById('btn-clear-search'),
  historyCountText: document.getElementById('history-count-text'),
  historyCardsContainer: document.getElementById('history-cards-container'),
  btnClearHistory: document.getElementById('btn-clear-history'),
  btnRefreshHistory: document.getElementById('btn-refresh-history'),
  historyAuthRequired: document.getElementById('history-auth-required'),

  // Migration Elements
  migrationBanner: document.getElementById('migration-banner'),
  localBillsCount: document.getElementById('local-bills-count'),
  migrateModal: document.getElementById('migrate-modal'),
  modalLocalBillsCount: document.getElementById('modal-local-bills-count'),
  migrateStatusBox: document.getElementById('migrate-status-box'),
  btnConfirmMigrate: document.getElementById('btn-confirm-migrate'),

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

  // Modals
  authModal: document.getElementById('auth-modal'),
  authModalTitleText: document.getElementById('auth-modal-title-text'),
  authModalDesc: document.getElementById('auth-modal-desc'),
  authConfigWarning: document.getElementById('auth-config-warning'),
  authForm: document.getElementById('auth-form'),
  authEmail: document.getElementById('auth-email'),
  authPassword: document.getElementById('auth-password'),
  authErrorMsg: document.getElementById('auth-error-msg'),
  btnAuthSubmit: document.getElementById('btn-auth-submit'),
  btnAuthSubmitText: document.getElementById('btn-auth-submit-text'),
  authTogglePrompt: document.getElementById('auth-toggle-prompt'),
  btnAuthModeToggle: document.getElementById('btn-auth-mode-toggle'),

  accountModal: document.getElementById('account-modal'),
  accountUserEmail: document.getElementById('account-user-email'),
  accountCloudStatus: document.getElementById('account-cloud-status'),
  accountBillsCount: document.getElementById('account-bills-count'),

  deleteModal: document.getElementById('delete-modal'),
  deleteBillInfo: document.getElementById('delete-bill-info'),
  btnConfirmDelete: document.getElementById('btn-confirm-delete'),

  // Toast
  toast: document.getElementById('toast'),
};

// Application State Variables
let currentUser = null;
let activeEditingBillId = null;
let firestoreBills = [];
let isCloudSaving = false;
let isCloudDeleting = false;
let isCloudMigrating = false;
let billIdToDelete = null;
let authMode = 'login'; // 'login' | 'register'
let unsubscribeBillsListener = null;
const collapsedPartyKeys = new Set();

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
  }, 3200);
}

/**
 * Switch between "1. ENTER BILL", "2. BILL PREVIEW", and "3. BILL HISTORY" tabs
 * @param {'editor' | 'preview' | 'history'} target 
 */
function switchTab(target) {
  if (elements.panelEditor) elements.panelEditor.style.display = 'none';
  if (elements.panelPreview) elements.panelPreview.style.display = 'none';
  if (elements.panelHistory) elements.panelHistory.style.display = 'none';

  if (elements.tabEditor) elements.tabEditor.classList.remove('active');
  if (elements.tabPreview) elements.tabPreview.classList.remove('active');
  if (elements.tabHistory) elements.tabHistory.classList.remove('active');

  if (target === 'preview') {
    if (elements.panelPreview) elements.panelPreview.style.display = 'block';
    if (elements.tabPreview) elements.tabPreview.classList.add('active');
  } else if (target === 'history') {
    if (elements.panelHistory) elements.panelHistory.style.display = 'block';
    if (elements.tabHistory) elements.tabHistory.classList.add('active');
    
    // Check if user is logged in
    if (!currentUser) {
      if (elements.historyAuthRequired) elements.historyAuthRequired.style.display = 'block';
      if (elements.historySearchCard) elements.historySearchCard.style.display = 'none';
      if (elements.historyCardsContainer) elements.historyCardsContainer.innerHTML = '';
    } else {
      if (elements.historyAuthRequired) elements.historyAuthRequired.style.display = 'none';
      if (elements.historySearchCard) elements.historySearchCard.style.display = 'block';
      renderHistoryCards();
      checkLocalHistoryForMigration();
    }
  } else {
    // Default to editor
    if (elements.panelEditor) elements.panelEditor.style.display = 'block';
    if (elements.tabEditor) elements.tabEditor.classList.add('active');
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Update the Cloud Connection Status indicator badge
 * @param {'connected' | 'problem' | 'disconnected' | 'config' | 'checking'} status
 * @param {string} label
 */
function updateCloudStatus(status, label) {
  if (!elements.cloudStatusBtn || !elements.cloudStatusText) return;
  elements.cloudStatusBtn.className = `cloud-status-badge status-${status}`;
  elements.cloudStatusText.textContent = label;

  if (status === 'connected') {
    elements.cloudStatusBtn.title = `Connected to Firebase Firestore (${currentUser ? currentUser.email : ''}). Tap to view account.`;
  } else if (status === 'config') {
    elements.cloudStatusBtn.title = "Firebase configuration missing. Tap for setup details.";
  } else if (status === 'problem') {
    elements.cloudStatusBtn.title = "Cloud Connection Problem. Check internet and Firebase.";
  } else {
    elements.cloudStatusBtn.title = "Not connected. Tap to log in with your business account.";
  }
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

  // Save current form inputs to localStorage as draft so browser refresh never loses typing
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
    activeEditingBillId: activeEditingBillId,
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

      if (draft.activeEditingBillId) {
        activeEditingBillId = draft.activeEditingBillId;
        if (elements.editingModeBanner) elements.editingModeBanner.style.display = 'flex';
        if (elements.editingBillLabel) elements.editingBillLabel.textContent = `Bill #${draft.billNo || '---'}`;
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

/* ==========================================================================
   FIREBASE AUTHENTICATION & CLOUD FIRESTORE LOGIC
   ========================================================================== */

/**
 * Initialize Firebase Auth and Firestore Cloud Database
 */
function initFirebaseSystem() {
  if (typeof isFirebaseConfigured !== 'function' || !isFirebaseConfigured()) {
    updateCloudStatus('config', '● Cloud Not Configured');
    if (elements.authConfigWarning) elements.authConfigWarning.style.display = 'block';
    return;
  }

  try {
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
      firebaseAuth = firebase.auth();
      firestoreDb = firebase.firestore();

      // Listen to auth state changes across all browser tabs
      firebaseAuth.onAuthStateChanged(handleAuthStateChanged);
    } else {
      updateCloudStatus('problem', '● Cloud Connection Problem');
    }
  } catch (err) {
    console.error("Firebase init error in script:", err);
    updateCloudStatus('problem', '● Cloud Connection Problem');
  }
}

/**
 * Handle Firebase Auth state changes
 * @param {Object|null} user 
 */
function handleAuthStateChanged(user) {
  if (user) {
    currentUser = user;
    updateCloudStatus('connected', '● Cloud Connected');

    if (elements.accountUserEmail) elements.accountUserEmail.textContent = user.email || 'Business Owner';
    if (elements.accountCloudStatus) elements.accountCloudStatus.textContent = '● Cloud Connected';
    if (elements.historyAuthRequired) elements.historyAuthRequired.style.display = 'none';
    if (elements.historySearchCard) elements.historySearchCard.style.display = 'block';

    closeAuthModal();

    // Subscribe to real-time Firestore bills under users/{userId}/bills
    subscribeToFirestoreBills();

    // Check if device has legacy localStorage bills to offer migration
    checkLocalHistoryForMigration();
  } else {
    currentUser = null;
    if (unsubscribeBillsListener) {
      unsubscribeBillsListener();
      unsubscribeBillsListener = null;
    }
    firestoreBills = [];
    updateCloudStatus('disconnected', '● Cloud Not Connected');

    if (elements.historyBadge) elements.historyBadge.textContent = '0';
    if (elements.migrationBanner) elements.migrationBanner.style.display = 'none';

    // If currently on history tab, show login required
    if (elements.panelHistory && elements.panelHistory.style.display !== 'none') {
      if (elements.historyAuthRequired) elements.historyAuthRequired.style.display = 'block';
      if (elements.historySearchCard) elements.historySearchCard.style.display = 'none';
      if (elements.historyCardsContainer) elements.historyCardsContainer.innerHTML = '';
    }
  }
}

/**
 * Subscribe to real-time updates from Firestore for the authenticated user
 */
function subscribeToFirestoreBills() {
  if (!currentUser || !firestoreDb) return;

  if (unsubscribeBillsListener) {
    unsubscribeBillsListener();
  }

  // Show loading indicator on first subscription
  if (elements.historyCardsContainer && firestoreBills.length === 0) {
    elements.historyCardsContainer.innerHTML = `
      <div class="history-loading-state">
        <div class="spinner"></div>
        <h3 class="empty-title">Loading History...</h3>
        <p class="text-muted">Fetching your cloud bills from Firestore...</p>
      </div>
    `;
  }

  try {
    const billsCollection = firestoreDb
      .collection('users')
      .doc(currentUser.uid)
      .collection('bills');

    unsubscribeBillsListener = billsCollection.onSnapshot(
      (snapshot) => {
        const loadedBills = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          loadedBills.push({
            id: doc.id,
            ...data
          });
        });

        firestoreBills = loadedBills;
        if (elements.historyBadge) elements.historyBadge.textContent = firestoreBills.length;
        if (elements.accountBillsCount) elements.accountBillsCount.textContent = firestoreBills.length;

        renderHistoryCards();
        updateCloudStatus('connected', '● Cloud Connected');
      },
      (error) => {
        console.error("Firestore onSnapshot error:", error);
        updateCloudStatus('problem', '● Cloud Connection Problem');
        showToast("Cloud connection error. Please check your internet or Firebase Security Rules.", "danger");
      }
    );
  } catch (err) {
    console.error("Error setting up Firestore listener:", err);
    updateCloudStatus('problem', '● Cloud Connection Problem');
  }
}

/**
 * Save current bill to Firestore Cloud Database
 * - Performs Firestore upsert under users/{userId}/bills/{billId}
 * - Primary source of truth for history
 * - Does not show success unless Firestore confirms the save
 * @returns {Promise<boolean>}
 */
async function saveCurrentBillToFirestore() {
  // If not logged in, prompt login
  if (!currentUser) {
    openAuthModal();
    showToast('Please log in with Firebase to save your bill to Cloud.', 'danger');
    return false;
  }

  if (!firestoreDb) {
    showToast('Cloud database is not initialized. Please verify firebase-config.js.', 'danger');
    return false;
  }

  const billNoVal = elements.billNoInput ? elements.billNoInput.value.trim() : '';
  if (!billNoVal) return false;

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
      srNo: i,
      description: desc,
      quantity: qty,
      rate: rate,
      amount: amount
    });
  }

  const grandTotal = subtotal;
  const isEditing = Boolean(activeEditingBillId);

  // Disable duplicate clicks while saving
  isCloudSaving = true;
  const actionButtons = [elements.btnGenerate, elements.btnPdf, elements.btnPrint].filter(Boolean);
  actionButtons.forEach(btn => { btn.disabled = true; });

  showToast(isEditing ? 'Updating Bill...' : 'Saving Bill...', 'success');

  try {
    const userBillsRef = firestoreDb
      .collection('users')
      .doc(currentUser.uid)
      .collection('bills');

    const billData = {
      billNo: billNoVal,
      partyChallanNo: challanNoVal,
      billDate: dateVal,
      partyName: partyNameVal,
      subtotal: subtotal,
      grandTotal: grandTotal,
      items: items,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (isEditing) {
      // Update existing Firestore document
      await userBillsRef.doc(activeEditingBillId).update(billData);
      showToast('Bill updated successfully.', 'success');
      activeEditingBillId = null;
      if (elements.editingModeBanner) elements.editingModeBanner.style.display = 'none';
    } else {
      // Check if a bill with same Bill No already exists for this user (prevent duplicate)
      const existing = firestoreBills.find(
        b => b.billNo && b.billNo.trim().toLowerCase() === billNoVal.toLowerCase()
      );

      if (existing) {
        // Update the existing document in place
        await userBillsRef.doc(existing.id).update(billData);
        showToast('Bill updated successfully.', 'success');
      } else {
        // Create new document
        billData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        await userBillsRef.add(billData);
        showToast('Bill saved successfully.', 'success');
      }
    }

    updateCloudStatus('connected', '● Cloud Connected');
    return true;
  } catch (err) {
    console.error('Error saving bill to Firestore:', err);
    updateCloudStatus('problem', '● Cloud Connection Problem');
    showToast('Unable to save bill. Please check your internet connection and Firebase configuration.', 'danger');
    return false;
  } finally {
    isCloudSaving = false;
    actionButtons.forEach(btn => { btn.disabled = false; });
  }
}

/**
 * Handle "Generate Bill" action:
 * - Validates Bill No (must not be empty, otherwise shows "Please enter Bill No.")
 * - Calculates all row amounts and totals
 * - Updates Bill Preview DOM
 * - Automatically switches to: 2. BILL PREVIEW
 * - Saves bill to Firestore Cloud database
 * - Does NOT reload the page or lose data
 */
async function generateBill() {
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

  // Switch to preview tab immediately so user sees the generated bill
  switchTab('preview');

  // Save current bill to Firestore Cloud
  await saveCurrentBillToFirestore();

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
 * - Pure client-side execution, fully compatible with Android mobile Chrome & GitHub Pages
 * - Does NOT reload the page or lose any entered data
 */
async function saveAsPDF() {
  if (isGeneratingPdf) return;

  const billNoVal = elements.billNoInput ? elements.billNoInput.value.trim() : '';
  if (!billNoVal) {
    showToast('Please enter Bill No.', 'danger');
    switchTab('editor');
    if (elements.billNoInput) elements.billNoInput.focus();
    return;
  }

  calculateAndSync();
  switchTab('preview');

  const billPreview = document.getElementById('bill-preview');
  if (!billPreview) {
    showToast('Error: Bill preview element not found.', 'danger');
    return;
  }

  isGeneratingPdf = true;
  showToast('Generating PDF... Please wait.', 'success');

  const pdfButtons = [elements.btnPdf, elements.btnPreviewPdf].filter(Boolean);
  pdfButtons.forEach(btn => {
    btn.disabled = true;
    btn.style.opacity = '0.7';
  });

  const billNoRaw = elements.billNoInput ? elements.billNoInput.value.trim() : '1';
  const safeBillNo = billNoRaw.replace(/[^a-zA-Z0-9_-]/g, '_') || '1';
  const fileName = `AKSHAR_ARI_WORK_BILL_${safeBillNo}.pdf`;

  // Create off-screen clone with .pdf-render-mode to guarantee 794px A4 desktop layout
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
      const canvas = await window.html2canvas(clone, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 1024
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDFClass({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      let pdfWidth = 190;
      let pdfHeight = (canvas.height * pdfWidth) / canvas.width;

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
      throw new Error('PDF library is not loaded. Please check your internet connection.');
    }
  } catch (err) {
    console.error('Error generating PDF:', err);
    showToast(`PDF generation error: ${err.message || 'Please try again'}`, 'danger');
  } finally {
    if (clone && clone.parentNode) {
      clone.parentNode.removeChild(clone);
    }
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
  const billNoVal = elements.billNoInput ? elements.billNoInput.value.trim() : '';
  if (!billNoVal) {
    showToast('Please enter Bill No.', 'danger');
    switchTab('editor');
    if (elements.billNoInput) elements.billNoInput.focus();
    return;
  }

  calculateAndSync();
  switchTab('preview');

  isPrinting = true;
  showToast('Opening print dialog...', 'success');
  setTimeout(function() {
    window.print();
    setTimeout(function() { isPrinting = false; }, 1000);
  }, 500);
}

/**
 * Handle "Clear" action:
 * Prompts confirmation before clearing form fields
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

  cancelEditMode(false);
  calculateAndSync();
  showToast('Form fields cleared.', 'danger');
}

/**
 * Handle "+ New Bill" action:
 * Resets form, advances Bill No if desired, and clears active edit mode
 */
function handleNewBill() {
  const confirmed = window.confirm('Start a new bill? Any unsaved changes on the current form will be reset.');
  if (!confirmed) return;

  if (elements.billNoInput) elements.billNoInput.value = '';
  if (elements.challanNoInput) elements.challanNoInput.value = '';
  if (elements.partyNameInput) elements.partyNameInput.value = '';
  if (elements.billDateInput) elements.billDateInput.value = getTodayDateString();

  for (let i = 1; i <= TOTAL_ROWS; i++) {
    const descInput = document.getElementById(`item-desc-${i}`);
    const qtyInput = document.getElementById(`item-qty-${i}`);
    const rateInput = document.getElementById(`item-rate-${i}`);

    if (descInput) descInput.value = '';
    if (qtyInput) qtyInput.value = '';
    if (rateInput) rateInput.value = '';
  }

  cancelEditMode(false);
  calculateAndSync();
  switchTab('editor');
  showToast('New blank bill ready.', 'success');
}

/**
 * Cancel active edit mode and revert to standard creation
 * @param {boolean} notify
 */
function cancelEditMode(notify = true) {
  activeEditingBillId = null;
  if (elements.editingModeBanner) elements.editingModeBanner.style.display = 'none';
  saveCurrentDraftToStorage();
  if (notify) showToast('Edit mode cancelled.', 'success');
}

/* ==========================================================================
   PARTY-NAME-WISE HISTORY DISPLAY & SEARCH
   ========================================================================== */

/**
 * Group bills by Party Name
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
    if (group.partyName === 'General / Cash' && rawParty) {
      group.partyName = displayParty;
    }

    group.bills.push(bill);
    const amount = Number(bill.grandTotal) || 0;
    group.totalAmount += amount;
    group.billCount++;

    // Track latest bill timestamp for sorting
    let billTimestamp = 0;
    if (bill.createdAt) {
      billTimestamp = bill.createdAt.toMillis ? bill.createdAt.toMillis() : new Date(bill.createdAt).getTime();
    } else if (bill.billDate) {
      billTimestamp = new Date(bill.billDate).getTime();
    }
    if (billTimestamp > group.latestTimestamp) {
      group.latestTimestamp = billTimestamp;
    }
  });

  const partyGroups = Array.from(groupsMap.values());

  // Sort bills newest first within each party group
  partyGroups.forEach(group => {
    group.bills.sort((a, b) => {
      const dateA = a.billDate || '';
      const dateB = b.billDate || '';
      if (dateA !== dateB) {
        return dateB.localeCompare(dateA);
      }
      const timeA = a.updatedAt || a.createdAt || '';
      const timeB = b.updatedAt || b.createdAt || '';
      return String(timeB).localeCompare(String(timeA));
    });
  });

  // Sort party groups by latest activity descending
  partyGroups.sort((a, b) => b.latestTimestamp - a.latestTimestamp);

  return partyGroups;
}

/**
 * Toggle collapse/expand for a specific party group
 * @param {string} partyKey
 */
function togglePartyGroup(partyKey) {
  const safeId = 'party-group-' + encodeURIComponent(partyKey).replace(/%/g, '_');
  const groupEl = document.getElementById(safeId);

  if (collapsedPartyKeys.has(partyKey)) {
    collapsedPartyKeys.delete(partyKey);
    if (groupEl) {
      groupEl.classList.remove('is-collapsed');
      const headerBtn = groupEl.querySelector('.party-group-header');
      if (headerBtn) headerBtn.setAttribute('aria-expanded', 'true');
    }
  } else {
    collapsedPartyKeys.add(partyKey);
    if (groupEl) {
      groupEl.classList.add('is-collapsed');
      const headerBtn = groupEl.querySelector('.party-group-header');
      if (headerBtn) headerBtn.setAttribute('aria-expanded', 'false');
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

  if (!currentUser) {
    if (elements.historyAuthRequired) elements.historyAuthRequired.style.display = 'block';
    if (elements.historySearchCard) elements.historySearchCard.style.display = 'none';
    elements.historyCardsContainer.innerHTML = '';
    return;
  }

  const query = (filterQuery !== null ? filterQuery : (elements.historySearchInput ? elements.historySearchInput.value : '')).trim().toLowerCase();

  if (elements.btnClearSearch) {
    elements.btnClearSearch.style.display = query ? 'block' : 'none';
  }

  if (firestoreBills.length === 0) {
    if (elements.historyCountText) elements.historyCountText.textContent = '0 saved bills';
    elements.historyCardsContainer.innerHTML = `
      <div class="history-empty-state">
        <div class="empty-icon">📋</div>
        <h3 class="empty-title">No Saved Bills in Cloud</h3>
        <p class="empty-desc">Bills generated in "1. ENTER BILL" are automatically saved to your Firestore Cloud database and organized by Party Name here.</p>
        <button class="btn btn-primary" type="button" onclick="switchTab('editor')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Create First Bill
        </button>
      </div>
    `;
    return;
  }

  const allPartyGroups = groupBillsByParty(firestoreBills);

  // Filter party groups or matching bills by Party Name, Bill No, or Challan No
  let displayGroups = allPartyGroups;
  if (query) {
    displayGroups = [];
    allPartyGroups.forEach(group => {
      const matchParty = group.partyName.toLowerCase().includes(query);
      if (matchParty) {
        displayGroups.push(group);
        collapsedPartyKeys.delete(group.partyKey);
      } else {
        const matchingBills = group.bills.filter(b => {
          const matchBillNo = (b.billNo || '').toLowerCase().includes(query);
          const matchChallan = (b.partyChallanNo || b.challanNo || '').toLowerCase().includes(query);
          return matchBillNo || matchChallan;
        });
        if (matchingBills.length > 0) {
          displayGroups.push({
            ...group,
            bills: matchingBills
          });
          collapsedPartyKeys.delete(group.partyKey);
        }
      }
    });
  }

  // Update stats text
  if (elements.historyCountText) {
    const totalMatchingBills = displayGroups.reduce((acc, g) => acc + g.bills.length, 0);
    const partyWord = displayGroups.length === 1 ? 'party' : 'parties';
    if (query) {
      elements.historyCountText.textContent = `Showing ${displayGroups.length} ${partyWord} (${totalMatchingBills} of ${firestoreBills.length} bills)`;
    } else {
      elements.historyCountText.textContent = `${displayGroups.length} ${partyWord} • ${firestoreBills.length} total bills`;
    }
  }

  if (displayGroups.length === 0) {
    elements.historyCardsContainer.innerHTML = `
      <div class="history-empty-state">
        <div class="empty-icon">🔍</div>
        <h3 class="empty-title">No Matching Parties or Bills</h3>
        <p class="empty-desc">No party name, bill number, or challan number matching "<strong>${escapeHtml(query)}</strong>".</p>
        <button class="btn btn-secondary" type="button" onclick="clearHistorySearch()">Clear Search</button>
      </div>
    `;
    return;
  }

  // Render Party Groups
  const groupsHtml = displayGroups.map(group => {
    const isCollapsed = collapsedPartyKeys.has(group.partyKey);
    const safeId = 'party-group-' + encodeURIComponent(group.partyKey).replace(/%/g, '_');

    const billsHtml = group.bills.map(bill => {
      const filledItems = (bill.items || []).filter(it => (it.desc || it.description) || parseFloat(it.qty || it.quantity) > 0 || parseFloat(it.rate) > 0);
      const firstFilledDesc = filledItems.length > 0 && (filledItems[0].desc || filledItems[0].description) ? (filledItems[0].desc || filledItems[0].description) : 'No item descriptions';
      const challanNo = bill.partyChallanNo || bill.challanNo;
      const challanBadgeHtml = challanNo 
        ? `<span class="pb-challan-badge">Challan: ${escapeHtml(challanNo)}</span>`
        : '';

      return `
        <div class="party-bill-card" id="h-card-${escapeHtml(bill.id)}">
          <div class="pb-meta-line">
            <div class="pb-badge-group">
              <span class="pb-bill-badge">Bill No: ${escapeHtml(bill.billNo || '---')}</span>
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
 * Load selected Firestore bill into Form and set active editing mode
 * @param {string} id
 */
function editHistoryBill(id) {
  const bill = firestoreBills.find(b => b.id === id);
  if (!bill) {
    showToast('Bill not found.', 'danger');
    return;
  }

  // Load into inputs
  if (elements.billNoInput) elements.billNoInput.value = bill.billNo || '';
  if (elements.challanNoInput) elements.challanNoInput.value = bill.partyChallanNo || bill.challanNo || '';
  if (elements.billDateInput) elements.billDateInput.value = bill.billDate || getTodayDateString();
  if (elements.partyNameInput) elements.partyNameInput.value = bill.partyName || '';

  const items = Array.isArray(bill.items) ? bill.items : [];
  for (let i = 1; i <= TOTAL_ROWS; i++) {
    const descInput = document.getElementById(`item-desc-${i}`);
    const qtyInput = document.getElementById(`item-qty-${i}`);
    const rateInput = document.getElementById(`item-rate-${i}`);

    const item = items[i - 1];
    if (descInput) descInput.value = item && (item.description !== undefined || item.desc !== undefined) ? (item.description || item.desc) : '';
    if (qtyInput) qtyInput.value = item && (item.quantity !== undefined || item.qty !== undefined) ? (item.quantity || item.qty) : '';
    if (rateInput) rateInput.value = item && item.rate !== undefined ? item.rate : '';
  }

  // Enable active edit mode
  activeEditingBillId = bill.id;
  if (elements.editingModeBanner) elements.editingModeBanner.style.display = 'flex';
  if (elements.editingBillLabel) elements.editingBillLabel.textContent = `Bill #${bill.billNo || '---'}`;

  calculateAndSync();
  switchTab('editor');
  showToast(`Loaded Bill #${bill.billNo || ''} for editing.`, 'success');
}

/**
 * Load selected Firestore bill directly into Preview mode
 * @param {string} id
 */
function viewHistoryBill(id) {
  const bill = firestoreBills.find(b => b.id === id);
  if (!bill) {
    showToast('Bill not found.', 'danger');
    return;
  }

  // Populate preview DOM
  if (elements.billNoInput) elements.billNoInput.value = bill.billNo || '';
  if (elements.challanNoInput) elements.challanNoInput.value = bill.partyChallanNo || bill.challanNo || '';
  if (elements.billDateInput) elements.billDateInput.value = bill.billDate || getTodayDateString();
  if (elements.partyNameInput) elements.partyNameInput.value = bill.partyName || '';

  const items = Array.isArray(bill.items) ? bill.items : [];
  for (let i = 1; i <= TOTAL_ROWS; i++) {
    const descInput = document.getElementById(`item-desc-${i}`);
    const qtyInput = document.getElementById(`item-qty-${i}`);
    const rateInput = document.getElementById(`item-rate-${i}`);

    const item = items[i - 1];
    if (descInput) descInput.value = item && (item.description !== undefined || item.desc !== undefined) ? (item.description || item.desc) : '';
    if (qtyInput) qtyInput.value = item && (item.quantity !== undefined || item.qty !== undefined) ? (item.quantity || item.qty) : '';
    if (rateInput) rateInput.value = item && item.rate !== undefined ? item.rate : '';
  }

  calculateAndSync();
  switchTab('preview');
  showToast(`Viewing Bill #${bill.billNo || ''}`, 'success');
}

/**
 * Open delete confirmation modal for a specific bill
 * @param {string} id
 */
function deleteHistoryBill(id) {
  const bill = firestoreBills.find(b => b.id === id);
  if (!bill) return;

  billIdToDelete = id;
  if (elements.deleteBillInfo) {
    const challanInfo = bill.partyChallanNo || bill.challanNo ? ` | Challan: ${bill.partyChallanNo || bill.challanNo}` : '';
    elements.deleteBillInfo.textContent = `Bill No: ${bill.billNo || '---'}${challanInfo} | Party: ${bill.partyName || 'General / Cash'} | Total: ${formatCurrency(bill.grandTotal || 0)}`;
  }

  if (elements.deleteModal) {
    elements.deleteModal.style.display = 'flex';
  }
}

/**
 * Close delete modal
 */
function closeDeleteModal() {
  billIdToDelete = null;
  if (elements.deleteModal) elements.deleteModal.style.display = 'none';
}

/**
 * Confirm and delete bill from Firestore Cloud
 */
async function confirmDeleteBill() {
  if (!billIdToDelete || isCloudDeleting) return;

  if (!currentUser || !firestoreDb) {
    showToast('You must be logged in to delete bills from Firestore.', 'danger');
    closeDeleteModal();
    return;
  }

  isCloudDeleting = true;
  if (elements.btnConfirmDelete) elements.btnConfirmDelete.disabled = true;

  showToast('Deleting Bill...', 'success');

  try {
    await firestoreDb
      .collection('users')
      .doc(currentUser.uid)
      .collection('bills')
      .doc(billIdToDelete)
      .delete();

    if (activeEditingBillId === billIdToDelete) {
      cancelEditMode(false);
    }

    showToast('Bill deleted successfully.', 'danger');
    closeDeleteModal();
  } catch (err) {
    console.error('Error deleting bill from Firestore:', err);
    showToast('Failed to delete bill from cloud. Please try again.', 'danger');
  } finally {
    isCloudDeleting = false;
    if (elements.btnConfirmDelete) elements.btnConfirmDelete.disabled = false;
  }
}

/**
 * Clear all history after user confirmation
 */
async function handleClearAllHistory() {
  if (!currentUser || !firestoreDb) {
    showToast('Please log in with Firebase first.', 'danger');
    return;
  }

  if (firestoreBills.length === 0) {
    showToast('History is already empty.', 'danger');
    return;
  }

  const confirmed = window.confirm('Are you sure you want to delete ALL saved bills from your Firestore cloud database? This cannot be undone.');
  if (!confirmed) return;

  showToast('Deleting all bills from cloud...', 'success');

  try {
    const batch = firestoreDb.batch();
    firestoreBills.forEach(b => {
      const docRef = firestoreDb
        .collection('users')
        .doc(currentUser.uid)
        .collection('bills')
        .doc(b.id);
      batch.delete(docRef);
    });

    await batch.commit();
    cancelEditMode(false);
    showToast('All saved bill history has been cleared.', 'danger');
  } catch (err) {
    console.error('Error clearing cloud history:', err);
    showToast('Failed to clear cloud history. Please try again.', 'danger');
  }
}

/**
 * Manually refresh history from Firestore Cloud
 */
function refreshHistoryFromCloud() {
  if (!currentUser) {
    openAuthModal();
    return;
  }
  showToast('Syncing with Firestore Cloud...', 'success');
  subscribeToFirestoreBills();
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

/* ==========================================================================
   LOCALSTORAGE TO CLOUD MIGRATION FEATURE
   ========================================================================== */

/**
 * Check if device contains legacy localStorage history and prompt user
 */
function checkLocalHistoryForMigration() {
  if (!currentUser) return;

  try {
    const raw = localStorage.getItem(STORAGE_KEY_LEGACY_HISTORY);
    if (!raw) {
      if (elements.migrationBanner) elements.migrationBanner.style.display = 'none';
      return;
    }

    const legacyList = JSON.parse(raw);
    if (Array.isArray(legacyList) && legacyList.length > 0) {
      if (elements.migrationBanner) elements.migrationBanner.style.display = 'block';
      if (elements.localBillsCount) elements.localBillsCount.textContent = legacyList.length;
      if (elements.modalLocalBillsCount) elements.modalLocalBillsCount.textContent = legacyList.length;
    } else {
      if (elements.migrationBanner) elements.migrationBanner.style.display = 'none';
    }
  } catch (e) {
    if (elements.migrationBanner) elements.migrationBanner.style.display = 'none';
  }
}

/**
 * Open migration confirmation modal
 */
function promptMigrateLocalHistory() {
  if (!currentUser) {
    openAuthModal();
    return;
  }
  if (elements.migrateModal) elements.migrateModal.style.display = 'flex';
  if (elements.migrateStatusBox) elements.migrateStatusBox.style.display = 'none';
}

/**
 * Close migration modal
 */
function closeMigrateModal() {
  if (elements.migrateModal) elements.migrateModal.style.display = 'none';
}

/**
 * Upload legacy localStorage bills to Firestore without creating duplicates
 */
async function executeLocalMigration() {
  if (isCloudMigrating || !currentUser || !firestoreDb) return;

  let legacyList = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LEGACY_HISTORY);
    legacyList = raw ? JSON.parse(raw) : [];
  } catch (e) {
    legacyList = [];
  }

  if (legacyList.length === 0) {
    showToast('No local bills found to migrate.', 'danger');
    closeMigrateModal();
    return;
  }

  isCloudMigrating = true;
  if (elements.btnConfirmMigrate) {
    elements.btnConfirmMigrate.disabled = true;
    elements.btnConfirmMigrate.textContent = 'Migrating...';
  }

  if (elements.migrateStatusBox) {
    elements.migrateStatusBox.style.display = 'block';
    elements.migrateStatusBox.className = 'alert-box alert-warning';
    elements.migrateStatusBox.textContent = `Uploading ${legacyList.length} bills to Firestore... Please wait.`;
  }

  let migratedCount = 0;
  let skippedCount = 0;

  try {
    const userBillsRef = firestoreDb
      .collection('users')
      .doc(currentUser.uid)
      .collection('bills');

    for (const b of legacyList) {
      const billNo = (b.billNo || '').trim();
      if (!billNo) continue;

      // Prevent duplicate migration if bill with matching Bill No already exists
      const alreadyExists = firestoreBills.some(
        fb => fb.billNo && fb.billNo.trim().toLowerCase() === billNo.toLowerCase()
      );

      if (alreadyExists) {
        skippedCount++;
        continue;
      }

      const formattedItems = (b.items || []).map((it, idx) => ({
        srNo: idx + 1,
        description: it.desc || it.description || '',
        quantity: Number(it.qty || it.quantity) || 0,
        rate: Number(it.rate) || 0,
        amount: Number(it.amount) || 0
      }));

      await userBillsRef.add({
        billNo: billNo,
        partyChallanNo: b.challanNo || b.partyChallanNo || '',
        billDate: b.billDate || getTodayDateString(),
        partyName: b.partyName || '',
        subtotal: Number(b.subtotal) || 0,
        grandTotal: Number(b.grandTotal) || 0,
        items: formattedItems,
        createdAt: b.createdAt ? new Date(b.createdAt) : firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      migratedCount++;
    }

    if (elements.migrateStatusBox) {
      elements.migrateStatusBox.className = 'alert-box';
      elements.migrateStatusBox.style.backgroundColor = '#ecfdf5';
      elements.migrateStatusBox.style.color = '#065f46';
      elements.migrateStatusBox.textContent = `${migratedCount} bills migrated successfully! ${skippedCount > 0 ? `(${skippedCount} skipped as already present).` : ''}`;
    }

    showToast(`${migratedCount} bills migrated successfully to Cloud.`, 'success');

    // Hide banner
    if (elements.migrationBanner) elements.migrationBanner.style.display = 'none';

    setTimeout(() => {
      closeMigrateModal();
    }, 2200);

  } catch (err) {
    console.error('Migration error:', err);
    if (elements.migrateStatusBox) {
      elements.migrateStatusBox.className = 'alert-box';
      elements.migrateStatusBox.style.backgroundColor = '#fef2f2';
      elements.migrateStatusBox.style.color = '#991b1b';
      elements.migrateStatusBox.textContent = 'Migration failed. Please check your internet connection.';
    }
    showToast('Migration error. Please try again.', 'danger');
  } finally {
    isCloudMigrating = false;
    if (elements.btnConfirmMigrate) {
      elements.btnConfirmMigrate.disabled = false;
      elements.btnConfirmMigrate.textContent = 'Migrate to Cloud';
    }
  }
}

/* ==========================================================================
   AUTHENTICATION MODAL & ACCOUNT MANAGEMENT
   ========================================================================== */

/**
 * Handle clicking on top header cloud status badge
 */
function handleCloudStatusClick() {
  if (currentUser) {
    openAccountModal();
  } else {
    openAuthModal();
  }
}

/**
 * Open authentication modal
 */
function openAuthModal() {
  if (typeof isFirebaseConfigured === 'function' && !isFirebaseConfigured()) {
    if (elements.authConfigWarning) elements.authConfigWarning.style.display = 'block';
  } else {
    if (elements.authConfigWarning) elements.authConfigWarning.style.display = 'none';
  }

  if (elements.authErrorMsg) elements.authErrorMsg.style.display = 'none';
  if (elements.authModal) elements.authModal.style.display = 'flex';
}

/**
 * Close authentication modal
 */
function closeAuthModal() {
  if (elements.authModal) elements.authModal.style.display = 'none';
}

/**
 * Open business account modal
 */
function openAccountModal() {
  if (!currentUser) return;
  if (elements.accountUserEmail) elements.accountUserEmail.textContent = currentUser.email || 'Business Owner';
  if (elements.accountBillsCount) elements.accountBillsCount.textContent = firestoreBills.length;
  if (elements.accountModal) elements.accountModal.style.display = 'flex';
}

/**
 * Close business account modal
 */
function closeAccountModal() {
  if (elements.accountModal) elements.accountModal.style.display = 'none';
}

/**
 * Toggle between Login and Register modes
 */
function toggleAuthMode() {
  if (authMode === 'login') {
    authMode = 'register';
    if (elements.authModalTitleText) elements.authModalTitleText.textContent = 'Create Business Account';
    if (elements.btnAuthSubmitText) elements.btnAuthSubmitText.textContent = 'Register & Connect';
    if (elements.authTogglePrompt) elements.authTogglePrompt.textContent = 'Already have an account?';
    if (elements.btnAuthModeToggle) elements.btnAuthModeToggle.textContent = 'Log In Here';
  } else {
    authMode = 'login';
    if (elements.authModalTitleText) elements.authModalTitleText.textContent = 'Cloud Login';
    if (elements.btnAuthSubmitText) elements.btnAuthSubmitText.textContent = 'Log In';
    if (elements.authTogglePrompt) elements.authTogglePrompt.textContent = "Don't have an account yet?";
    if (elements.btnAuthModeToggle) elements.btnAuthModeToggle.textContent = 'Create Business Account';
  }
  if (elements.authErrorMsg) elements.authErrorMsg.style.display = 'none';
}

/**
 * Toggle password visibility
 */
function togglePasswordVisibility() {
  if (!elements.authPassword) return;
  const isPwd = elements.authPassword.type === 'password';
  elements.authPassword.type = isPwd ? 'text' : 'password';
}

/**
 * Handle Auth Form submission (Login / Register)
 * @param {Event} e
 */
async function handleAuthSubmit(e) {
  e.preventDefault();

  if (!firebaseAuth) {
    if (elements.authErrorMsg) {
      elements.authErrorMsg.textContent = 'Firebase is not initialized. Please configure firebase-config.js.';
      elements.authErrorMsg.style.display = 'block';
    }
    return;
  }

  const email = elements.authEmail ? elements.authEmail.value.trim() : '';
  const password = elements.authPassword ? elements.authPassword.value : '';

  if (!email || !password) {
    if (elements.authErrorMsg) {
      elements.authErrorMsg.textContent = 'Please enter both email and password.';
      elements.authErrorMsg.style.display = 'block';
    }
    return;
  }

  if (elements.btnAuthSubmit) elements.btnAuthSubmit.disabled = true;
  if (elements.authErrorMsg) elements.authErrorMsg.style.display = 'none';

  try {
    if (authMode === 'login') {
      await firebaseAuth.signInWithEmailAndPassword(email, password);
      showToast('Logged in successfully.', 'success');
    } else {
      await firebaseAuth.createUserWithEmailAndPassword(email, password);
      showToast('Account created & logged in.', 'success');
    }
    closeAuthModal();
  } catch (err) {
    console.error('Firebase Auth error:', err);
    let msg = 'Authentication failed. Please check your credentials.';
    if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
      msg = 'Invalid email or password.';
    } else if (err.code === 'auth/email-already-in-use') {
      msg = 'This email is already registered. Please log in.';
    } else if (err.code === 'auth/weak-password') {
      msg = 'Password is too weak. Please use at least 6 characters.';
    } else if (err.code === 'auth/network-request-failed') {
      msg = 'Network error. Please check your internet connection.';
    } else if (err.message) {
      msg = err.message;
    }
    if (elements.authErrorMsg) {
      elements.authErrorMsg.textContent = msg;
      elements.authErrorMsg.style.display = 'block';
    }
  } finally {
    if (elements.btnAuthSubmit) elements.btnAuthSubmit.disabled = false;
  }
}

/**
 * Handle user logout
 */
async function handleLogout() {
  if (!firebaseAuth) return;
  try {
    await firebaseAuth.signOut();
    closeAccountModal();
    showToast('Logged out successfully.', 'success');
  } catch (err) {
    console.error('Logout error:', err);
    showToast('Logout error.', 'danger');
  }
}

/**
 * Sanitize HTML entities to prevent XSS in inputs
 * @param {string} str 
 * @returns {string}
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
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

// Expose functions globally for inline HTML onclick attributes
window.generateBill = generateBill;
window.saveAsPDF = saveAsPDF;
window.printBill = printBill;
window.switchTab = switchTab;
window.handleNewBill = handleNewBill;
window.handleClear = handleClear;
window.viewHistoryBill = viewHistoryBill;
window.editHistoryBill = editHistoryBill;
window.deleteHistoryBill = deleteHistoryBill;
window.closeDeleteModal = closeDeleteModal;
window.confirmDeleteBill = confirmDeleteBill;
window.handleClearAllHistory = handleClearAllHistory;
window.clearHistorySearch = clearHistorySearch;
window.togglePartyGroup = togglePartyGroup;
window.expandAllPartyGroups = expandAllPartyGroups;
window.collapseAllPartyGroups = collapseAllPartyGroups;
window.openAuthModal = openAuthModal;
window.closeAuthModal = closeAuthModal;
window.toggleAuthMode = toggleAuthMode;
window.togglePasswordVisibility = togglePasswordVisibility;
window.handleAuthSubmit = handleAuthSubmit;
window.openAccountModal = openAccountModal;
window.closeAccountModal = closeAccountModal;
window.handleCloudStatusClick = handleCloudStatusClick;
window.handleLogout = handleLogout;
window.cancelEditMode = cancelEditMode;
window.promptMigrateLocalHistory = promptMigrateLocalHistory;
window.closeMigrateModal = closeMigrateModal;
window.executeLocalMigration = executeLocalMigration;
window.refreshHistoryFromCloud = refreshHistoryFromCloud;

/**
 * Initialize Application on DOM Ready
 */
document.addEventListener('DOMContentLoaded', () => {
  // 1. Attach static DOM event listeners
  setupEventListeners();

  // 2. Load draft from localStorage or calculate initial state
  loadDraftFromStorage();

  // 3. Initialize Firebase Auth and Cloud Firestore
  initFirebaseSystem();

  // 4. Default view: Show requested hash or Form (1. ENTER BILL)
  const initialHash = window.location.hash.replace('#', '');
  if (initialHash === 'preview' || initialHash === 'history') {
    switchTab(initialHash);
  } else {
    switchTab('editor');
  }
});
