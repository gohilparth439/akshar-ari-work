/* ============================================================
   AKSHAR ARI WORK — Bill Generator V2  —  Master Script
   ============================================================ */
let appInitialized = false;
function initApp() {
    if (appInitialized) return;
    appInitialized = true;

    // ========== DOM REFERENCES ==========
    const $ = id => document.getElementById(id);

    // Inputs
    const inpBillNo       = $('inp-billNo');
    const inpChallan      = $('inp-challan');
    const inpDate         = $('inp-date');
    const inpPartyName    = $('inp-partyName');
    const inpPartyDetails = $('inp-partyDetails');
    const inpSubtotal     = $('inp-subtotal');
    const inpDiscount     = $('inp-discount');
    const inpDiscountAmount = $('inp-discountAmount');
    const inpGrandTotal   = $('inp-grandTotal');
    const chkPayment      = $('chk-payment');
    const paymentFields   = $('paymentFields');
    const inpAmtReceived  = $('inp-amountReceived');
    const inpPayDate      = $('inp-paymentDate');

    // Tables
    const editTableBody   = $('editTableBody');
    const prevTableBody   = $('prevTableBody');

    // Preview spans
    const prevBillNo      = $('prev-billNo');
    const prevChallan     = $('prev-challan');
    const prevDate        = $('prev-date');
    const prevPartyName   = $('prev-partyName');
    const prevPartyDetails= $('prev-partyDetails');
    const prevPartyDetailsRow = $('prev-partyDetailsRow');
    const prevSubtotal    = $('prev-subtotal');
    const prevDiscount    = $('prev-discount');
    const prevDiscountRow = $('prev-discountRow');
    const prevDiscountLabel = $('prev-discountLabel');
    const prevGrandTotal  = $('prev-grandTotal');

    // Buttons
    const btnAddRow    = $('btn-addRow');
    const btnDeleteRow = $('btn-deleteRow');
    const btnSave      = $('btn-save');
    const btnPrint     = $('btn-print');
    const btnPdf       = $('btn-pdf');
    const btnReset     = $('btn-reset');
    const statusMsg    = $('statusMsg');

    // Storage
    const STORAGE_KEY = 'akshar_ari_bills_v2';
    let editingBillId = null; // tracks if we are editing an existing bill

    // ========== NAVIGATION ==========
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            const page = link.dataset.page;
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            $('page-' + page).classList.add('active');
            link.classList.add('active');
            // Refresh data on page switch
            if (page === 'history') {
                renderHistory();
                refreshBillsFromCloud();
            }
            if (page === 'pending') renderPending();
            if (page === 'dashboard') renderDashboard();
        });
    });

    // ========== EDIT TABLE — ROW MANAGEMENT ==========
    function wireRow(tr) {
        const inDesc = tr.children[1] ? (tr.children[1].querySelector('input') || tr.children[1].firstChild) : null;
        const inQty  = tr.children[2] ? (tr.children[2].querySelector('input') || tr.children[2].firstChild) : null;
        const inRate = tr.children[3] ? (tr.children[3].querySelector('input') || tr.children[3].firstChild) : null;
        const inAmt  = tr.children[4] ? (tr.children[4].querySelector('input') || tr.children[4].firstChild) : null;
        const btnDel = tr.children[5] ? (tr.children[5].querySelector('button') || tr.children[5].firstChild) : null;

        function calcRow() {
            const q = parseFloat(inQty ? inQty.value : 0) || 0;
            const r = parseFloat(inRate ? inRate.value : 0) || 0;
            if (inAmt) {
                inAmt.value = (q * r) > 0 ? (q * r).toFixed(2) : '';
            }
            recalcAll();
        }

        if (inQty && !inQty._calcBound) {
            inQty._calcBound = true;
            ['input', 'change', 'keyup', 'blur'].forEach(evt => inQty.addEventListener(evt, calcRow));
        }
        if (inRate && !inRate._calcBound) {
            inRate._calcBound = true;
            ['input', 'change', 'keyup', 'blur'].forEach(evt => inRate.addEventListener(evt, calcRow));
        }
        if (inDesc && !inDesc._prevBound) {
            inDesc._prevBound = true;
            ['input', 'change', 'keyup', 'blur'].forEach(evt => inDesc.addEventListener(evt, updatePreview));
        }
        if (btnDel && !btnDel._delBound) {
            btnDel._delBound = true;
            btnDel.addEventListener('click', () => {
                tr.remove();
                renumberRows();
                recalcAll();
                updatePreview();
            });
        }
    }

    function createEditRow(data) {
        data = data || {};
        const tr = document.createElement('tr');

        // Sr. No.
        const tdSr = document.createElement('td');
        tdSr.className = 'td-sr-num';
        tdSr.textContent = editTableBody.children.length + 1;
        tdSr.style.textAlign = 'center';
        tdSr.style.fontWeight = '600';
        tdSr.style.color = '#555';
        tr.appendChild(tdSr);

        // Description
        const tdDesc = document.createElement('td');
        const inDesc = document.createElement('input');
        inDesc.type = 'text';
        inDesc.className = 'inp-item-desc';
        inDesc.value = data.desc || '';
        inDesc.placeholder = 'Enter item or work description';
        inDesc.style.textAlign = 'left';
        tdDesc.appendChild(inDesc);
        tr.appendChild(tdDesc);

        // Quantity
        const tdQty = document.createElement('td');
        const inQty = document.createElement('input');
        inQty.type = 'number';
        inQty.inputMode = 'numeric';
        inQty.className = 'inp-item-qty';
        inQty.min = '0';
        inQty.value = data.qty !== undefined && data.qty !== 0 ? data.qty : '';
        inQty.placeholder = '0';
        tdQty.appendChild(inQty);
        tr.appendChild(tdQty);

        // Rate
        const tdRate = document.createElement('td');
        const inRate = document.createElement('input');
        inRate.type = 'number';
        inRate.inputMode = 'decimal';
        inRate.className = 'inp-item-rate';
        inRate.min = '0';
        inRate.step = '0.01';
        inRate.value = data.rate !== undefined && data.rate !== 0 ? data.rate : '';
        inRate.placeholder = '0.00';
        tdRate.appendChild(inRate);
        tr.appendChild(tdRate);

        // Amount (readonly)
        const tdAmt = document.createElement('td');
        const inAmt = document.createElement('input');
        inAmt.type = 'text';
        inAmt.readOnly = true;
        inAmt.className = 'inp-item-amt';
        inAmt.placeholder = '0.00';
        inAmt.style.fontWeight = '600';
        tdAmt.appendChild(inAmt);
        tr.appendChild(tdAmt);

        // Delete button (hidden in print)
        const tdDel = document.createElement('td');
        tdDel.className = 'no-print td-del-cell';
        const btnDel = document.createElement('button');
        btnDel.type = 'button';
        btnDel.textContent = '✕';
        btnDel.className = 'btn-del-row';
        btnDel.title = 'Delete this row';
        if (btnDel.setAttribute) btnDel.setAttribute('aria-label', 'Delete row');
        tdDel.appendChild(btnDel);
        tr.appendChild(tdDel);

        wireRow(tr);

        // Calc if pre-populated
        if (data.qty && data.rate) {
            const q = parseFloat(data.qty) || 0;
            const r = parseFloat(data.rate) || 0;
            inAmt.value = (q * r) > 0 ? (q * r).toFixed(2) : '';
        }

        return tr;
    }

    function renumberRows() {
        Array.from(editTableBody.children).forEach((tr, i) => {
            tr.children[0].textContent = i + 1;
        });
    }

    function recalcAll() {
        let subtotal = 0;
        editTableBody.querySelectorAll('tr').forEach(tr => {
            const inQty  = tr.children[2] ? (tr.children[2].querySelector('input') || tr.children[2].firstChild) : null;
            const inRate = tr.children[3] ? (tr.children[3].querySelector('input') || tr.children[3].firstChild) : null;
            const inAmt  = tr.children[4] ? (tr.children[4].querySelector('input') || tr.children[4].firstChild) : null;

            const q = parseFloat(inQty ? inQty.value : 0) || 0;
            const r = parseFloat(inRate ? inRate.value : 0) || 0;
            const rowAmt = q * r;

            if (inAmt) {
                inAmt.value = rowAmt > 0 ? rowAmt.toFixed(2) : '';
            }
            subtotal += rowAmt;
        });
        inpSubtotal.value = subtotal.toFixed(2);

        let discountPercent = parseFloat(inpDiscount.value) || 0;
        if (discountPercent < 0) {
            discountPercent = 0;
            inpDiscount.value = 0;
        } else if (discountPercent > 100) {
            discountPercent = 100;
            inpDiscount.value = 100;
        }

        const discountAmount = (subtotal * discountPercent) / 100;
        if (inpDiscountAmount) {
            inpDiscountAmount.value = discountAmount.toFixed(2);
        }

        const grand = Math.max(0, subtotal - discountAmount);
        inpGrandTotal.value = grand.toFixed(2);

        // Update preview in real-time
        updatePreview();
    }

    // Event delegation on table body: catch ANY input, change, keyup, or blur
    function handleItemInput(e) {
        const target = e.target;
        if (!target || target.tagName !== 'INPUT') return;
        const tr = target.closest ? target.closest('tr') : (target.parentElement ? target.parentElement.parentElement : null);
        if (!tr) return;

        const inQty  = tr.children[2] ? (tr.children[2].querySelector('input') || tr.children[2].firstChild) : null;
        const inRate = tr.children[3] ? (tr.children[3].querySelector('input') || tr.children[3].firstChild) : null;
        const inAmt  = tr.children[4] ? (tr.children[4].querySelector('input') || tr.children[4].firstChild) : null;

        const q = parseFloat(inQty ? inQty.value : 0) || 0;
        const r = parseFloat(inRate ? inRate.value : 0) || 0;
        if (inAmt) {
            inAmt.value = (q * r) > 0 ? (q * r).toFixed(2) : '';
        }

        recalcAll();
    }

    if (editTableBody && editTableBody.addEventListener) {
        ['input', 'change', 'keyup', 'blur'].forEach(evt => {
            editTableBody.addEventListener(evt, handleItemInput);
        });

        editTableBody.addEventListener('click', (e) => {
            const btn = (e.target && e.target.closest) ? e.target.closest('.btn-del-row') : null;
            if (btn) {
                const tr = btn.closest('tr');
                if (tr) {
                    tr.remove();
                    renumberRows();
                    recalcAll();
                }
            }
        });
    }

    // Initialize 10 blank rows
    function initRows(count) {
        const target = count || 10;
        // If editTableBody already has rows (e.g. from static HTML)
        if (editTableBody.children.length === target) {
            Array.from(editTableBody.children).forEach(tr => {
                wireRow(tr);
            });
            renumberRows();
            recalcAll();
            updatePreview();
            return;
        }
        editTableBody.innerHTML = '';
        for (let i = 0; i < target; i++) {
            editTableBody.appendChild(createEditRow());
        }
        renumberRows();
        recalcAll();
        updatePreview();
    }
    initRows(10);

    // Set today's date
    inpDate.value = new Date().toISOString().split('T')[0];

    btnAddRow.addEventListener('click', () => {
        editTableBody.appendChild(createEditRow());
        renumberRows();
        updatePreview();
    });

    btnDeleteRow.addEventListener('click', () => {
        if (editTableBody.children.length > 1) {
            editTableBody.lastElementChild.remove();
            renumberRows();
            recalcAll();
            updatePreview();
        }
    });

    ['input', 'change', 'keyup', 'blur'].forEach(evt => {
        inpDiscount.addEventListener(evt, recalcAll);
    });

    // Payment checkbox
    chkPayment.addEventListener('change', () => {
        paymentFields.classList.toggle('hidden', !chkPayment.checked);
        if (chkPayment.checked && !inpPayDate.value) {
            inpPayDate.value = new Date().toISOString().split('T')[0];
        }
        updatePreview();
    });

    // Real-time preview update on form field changes
    [inpBillNo, inpChallan, inpDate, inpPartyName, inpPartyDetails].forEach(el => {
        if (!el) return;
        ['input', 'change', 'keyup', 'blur'].forEach(evt => {
            el.addEventListener(evt, updatePreview);
        });
    });

    // Delegation on page-bill for instant updates
    const pageBillEl = $('page-bill');
    if (pageBillEl && pageBillEl.addEventListener) {
        ['input', 'change', 'keyup'].forEach(evt => {
            pageBillEl.addEventListener(evt, () => {
                updatePreview();
            });
        });
    }

    // ========== BILL PREVIEW ==========
    function updatePreview() {
        prevBillNo.textContent = inpBillNo.value || '';
        prevChallan.textContent = inpChallan.value || '';
        prevDate.textContent = formatDateDisplay(inpDate.value);
        prevPartyName.textContent = inpPartyName.value || '';

        const details = inpPartyDetails.value.trim();
        if (details) {
            prevPartyDetails.textContent = details;
            prevPartyDetailsRow.style.display = '';
        } else {
            prevPartyDetailsRow.style.display = 'none';
        }

        // Rebuild preview table
        prevTableBody.innerHTML = '';
        const rows = editTableBody.querySelectorAll('tr');
        // We always show at least 10 rows in preview
        const rowCount = Math.max(rows.length, 10);
        for (let i = 0; i < rowCount; i++) {
            const tr = document.createElement('tr');
            if (i < rows.length) {
                const editRow = rows[i];
                const inDesc = editRow.children[1] ? (editRow.children[1].querySelector('input') || editRow.children[1].firstChild) : null;
                const inQty  = editRow.children[2] ? (editRow.children[2].querySelector('input') || editRow.children[2].firstChild) : null;
                const inRate = editRow.children[3] ? (editRow.children[3].querySelector('input') || editRow.children[3].firstChild) : null;
                const inAmt  = editRow.children[4] ? (editRow.children[4].querySelector('input') || editRow.children[4].firstChild) : null;
                const desc = inDesc ? (inDesc.value || '') : '';
                const qty  = inQty ? (inQty.value || '') : '';
                const rate = inRate ? (inRate.value || '') : '';
                const amt  = inAmt ? (inAmt.value || '') : '';
                tr.innerHTML = `<td>${i+1}</td><td>${desc}</td><td>${qty}</td><td>${rate}</td><td>${amt}</td>`;
            } else {
                tr.innerHTML = `<td>${i+1}</td><td></td><td></td><td></td><td></td>`;
            }
            prevTableBody.appendChild(tr);
        }

        // Totals
        const sub = parseFloat(inpSubtotal.value) || 0;
        const discountPct = parseFloat(inpDiscount.value) || 0;
        const discountAmount = parseFloat(inpDiscountAmount ? inpDiscountAmount.value : 0) || 0;
        const grand = parseFloat(inpGrandTotal.value) || 0;

        prevSubtotal.textContent = '₹' + formatIndianNumber(sub);

        if (discountPct > 0 && discountAmount > 0) {
            const pStr = Number.isInteger(discountPct) ? discountPct : discountPct.toFixed(2);
            if (prevDiscountLabel) {
                prevDiscountLabel.textContent = `Discount (${pStr}%):`;
            }
            prevDiscount.textContent = '₹' + formatIndianNumber(discountAmount);
            prevDiscountRow.style.display = '';
        } else {
            prevDiscountRow.style.display = 'none';
        }

        prevGrandTotal.textContent = '₹' + formatIndianNumber(grand);
    }

    function formatDateDisplay(dateStr) {
        if (!dateStr) return '--/--/----';
        const str = String(dateStr).trim();
        const parts = str.split(/[-/]/);
        if (parts.length === 3) {
            if (parts[0].length === 4) {
                // YYYY-MM-DD
                return parts[2].padStart(2, '0') + '/' + parts[1].padStart(2, '0') + '/' + parts[0];
            } else if (parts[2].length === 4) {
                // DD-MM-YYYY or MM-DD-YYYY
                return parts[0].padStart(2, '0') + '/' + parts[1].padStart(2, '0') + '/' + parts[2];
            }
        }
        const d = new Date(str);
        if (isNaN(d.getTime())) return str;
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return dd + '/' + mm + '/' + yyyy;
    }

    function formatIndianNumber(num) {
        if (num === 0) return '0.00';
        const parts = num.toFixed(2).split('.');
        let intPart = parts[0];
        const decPart = parts[1];
        // Indian number system: last 3 digits, then groups of 2
        if (intPart.length > 3) {
            const last3 = intPart.slice(-3);
            let rest = intPart.slice(0, -3);
            // Add comma every 2 digits from right in the remaining part
            rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
            intPart = rest + ',' + last3;
        }
        return intPart + '.' + decPart;
    }

    // Initial preview
    updatePreview();

    // ========== PERSISTENCE (localStorage) ==========
    function loadBills() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed.filter(b => b && typeof b === 'object') : [];
        } catch (e) {
            return [];
        }
    }

    function saveBillsToStorage(bills) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(bills));
    }

    function showStatus(msg, type) {
        statusMsg.textContent = msg;
        statusMsg.className = 'status-msg ' + type;
        setTimeout(() => { statusMsg.className = 'status-msg'; }, 4000);
    }

    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
    }

    function collectFormData() {
        const items = [];
        editTableBody.querySelectorAll('tr').forEach(tr => {
            const inDesc = tr.children[1] ? (tr.children[1].querySelector('input') || tr.children[1].firstChild) : null;
            const inQty  = tr.children[2] ? (tr.children[2].querySelector('input') || tr.children[2].firstChild) : null;
            const inRate = tr.children[3] ? (tr.children[3].querySelector('input') || tr.children[3].firstChild) : null;
            const inAmt  = tr.children[4] ? (tr.children[4].querySelector('input') || tr.children[4].firstChild) : null;
            const desc = inDesc ? inDesc.value.trim() : '';
            const qty  = parseFloat(inQty ? inQty.value : 0) || 0;
            const rate = parseFloat(inRate ? inRate.value : 0) || 0;
            const amt  = parseFloat(inAmt ? inAmt.value : 0) || 0;
            items.push({ desc, qty, rate, amount: amt });
        });

        const subtotal = parseFloat(inpSubtotal.value) || 0;
        let discountPercent = parseFloat(inpDiscount.value) || 0;
        if (discountPercent < 0) discountPercent = 0;
        if (discountPercent > 100) discountPercent = 100;
        const discountAmount = (subtotal * discountPercent) / 100;

        const grandTotal = Math.max(0, subtotal - discountAmount);
        const amtReceived = parseFloat(inpAmtReceived.value) || 0;
        const pendingAmount = Math.max(0, grandTotal - amtReceived);

        let paymentStatus = 'pending';
        if (amtReceived >= grandTotal && grandTotal > 0) paymentStatus = 'paid';
        else if (amtReceived > 0) paymentStatus = 'partial';

        return {
            id: editingBillId || generateId(),
            billNumber: inpBillNo.value.trim(),
            challanNumber: inpChallan.value.trim(),
            date: inpDate.value,
            partyName: inpPartyName.value.trim(),
            partyDetails: inpPartyDetails.value.trim(),
            items,
            subtotal,
            discountPercent,
            discountAmount,
            discount: discountAmount,
            grandTotal,
            paymentReceived: chkPayment.checked,
            amountReceived: amtReceived,
            paymentDate: inpPayDate.value,
            pendingAmount,
            paymentStatus,
            payments: [],  // payment history array
            createdAt: new Date().toISOString()
        };
    }

    // ========== SAVE ==========
    btnSave.addEventListener('click', async () => {
        // Validate
        const partyName = inpPartyName.value.trim();
        const billNo = inpBillNo.value.trim();
        const challan = inpChallan.value.trim();
        const date = inpDate.value;

        if (!billNo || !date || !partyName || !challan) {
            showStatus('Please fill Bill No, Date, Party Name, and Challan No.', 'error');
            return;
        }

        // Prevent accidental duplicate clicks
        if (btnSave.disabled) return;
        btnSave.disabled = true;
        const originalText = btnSave.innerHTML;
        btnSave.innerHTML = '⏳ Saving Bill...';

        try {
            const bills = loadBills();
            const billData = collectFormData();
            billData.partyName = partyName; // explicitly trimmed party name

            if (editingBillId) {
                // Update existing bill document
                const idx = bills.findIndex(b => b.id === editingBillId);
                if (idx !== -1) {
                    billData.id = editingBillId;
                    billData.payments = bills[idx].payments || [];
                    billData.createdAt = bills[idx].createdAt || billData.createdAt;
                    bills[idx] = billData;
                } else {
                    bills.push(billData);
                }
                editingBillId = null;
            } else {
                // Check for duplicate bill number
                const existing = bills.find(b => b.billNumber === billData.billNumber);
                if (existing) {
                    if (!confirm('Bill number "' + billData.billNumber + '" already exists. Do you want to overwrite it?')) {
                        btnSave.disabled = false;
                        btnSave.innerHTML = originalText;
                        return;
                    }
                    const idx = bills.findIndex(b => b.id === existing.id);
                    billData.id = existing.id; // preserve document ID
                    billData.payments = existing.payments || [];
                    billData.createdAt = existing.createdAt || billData.createdAt;
                    bills[idx] = billData;
                } else {
                    bills.push(billData);
                }
            }

            // Save to local cache first
            saveBillsToStorage(bills);
            renderPending();
            renderHistory();
            if (typeof renderDashboard === 'function') renderDashboard();

            // Sync with Firestore Cloud DB
            let cloudSaved = false;
            if (typeof window !== 'undefined' && window.CloudDB && window.CloudDB.isConfigured()) {
                updateSyncStatus('syncing', 'Syncing...');
                cloudSaved = await window.CloudDB.saveBill(billData);
                updateSyncStatus('cloud', '☁️ Cloud Synced');
            }

            if (cloudSaved) {
                showStatus(`Bill ${billData.billNumber} (${billData.partyName}) saved to Cloud & History successfully!`, 'success');
            } else {
                showStatus(`Bill ${billData.billNumber} saved successfully! (Local storage cache)`, 'success');
            }
        } catch (err) {
            console.error('Error saving bill:', err);
            showStatus('Error saving bill: ' + (err.message || 'Unknown error'), 'error');
        } finally {
            btnSave.disabled = false;
            btnSave.innerHTML = originalText;
        }
    });

    // ========== RESET ==========
    btnReset.addEventListener('click', () => {
        if (confirm('Reset the form? Unsaved changes will be lost.')) {
            editingBillId = null;
            inpBillNo.value = '';
            inpChallan.value = '';
            inpDate.value = new Date().toISOString().split('T')[0];
            inpPartyName.value = '';
            inpPartyDetails.value = '';
            inpDiscount.value = 0;
            if (inpDiscountAmount) inpDiscountAmount.value = '0.00';
            chkPayment.checked = false;
            paymentFields.classList.add('hidden');
            inpAmtReceived.value = 0;
            inpPayDate.value = '';
            Array.from(editTableBody.children).forEach(tr => {
                const inDesc = tr.children[1] ? (tr.children[1].querySelector('input') || tr.children[1].firstChild) : null;
                const inQty  = tr.children[2] ? (tr.children[2].querySelector('input') || tr.children[2].firstChild) : null;
                const inRate = tr.children[3] ? (tr.children[3].querySelector('input') || tr.children[3].firstChild) : null;
                const inAmt  = tr.children[4] ? (tr.children[4].querySelector('input') || tr.children[4].firstChild) : null;
                if (inDesc) inDesc.value = '';
                if (inQty)  inQty.value = '';
                if (inRate) inRate.value = '';
                if (inAmt)  inAmt.value = '';
            });
            initRows(10);
            recalcAll();
            updatePreview();
        }
    });

    // ========== PRINT ==========
    btnPrint.addEventListener('click', () => {
        updatePreview();
        setTimeout(() => window.print(), 200);
    });

    // ========== PDF DOWNLOAD ==========
    btnPdf.addEventListener('click', () => {
        updatePreview();
        const billEl = document.getElementById('billPreview');
        if (typeof html2canvas === 'undefined' || typeof window === 'undefined' || !window.jspdf) {
            showStatus('PDF library offline or loading. Please click Print Bill and select "Save as PDF".', 'error');
            return;
        }
        showStatus('Generating PDF...', 'success');

        html2canvas(billEl, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            width: 794,
            windowWidth: 794
        }).then(canvas => {
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = 210;
            const pageHeight = 297;
            const imgWidth = pageWidth - 10; // 5mm margin each side
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            const imgData = canvas.toDataURL('image/png');

            if (imgHeight <= pageHeight - 10) {
                pdf.addImage(imgData, 'PNG', 5, 5, imgWidth, imgHeight);
            } else {
                // Multi-page
                let yOffset = 0;
                const pageContentHeight = pageHeight - 10;
                while (yOffset < imgHeight) {
                    if (yOffset > 0) pdf.addPage();
                    pdf.addImage(imgData, 'PNG', 5, 5 - yOffset, imgWidth, imgHeight);
                    yOffset += pageContentHeight;
                }
            }

            const filename = 'Bill_' + (inpBillNo.value || 'Untitled') + '.pdf';
            pdf.save(filename);
            showStatus('PDF downloaded: ' + filename, 'success');
        }).catch(err => {
            showStatus('PDF generation failed: ' + err.message, 'error');
        });
    });

    // ========== BILL HISTORY ==========
    function renderHistory() {
        const bills = loadBills();
        const container = $('historyList');
        const search = ($('historySearch').value || '').toLowerCase();
        const filterVal = document.querySelector('.filter-btns .btn-sm.active')?.dataset.filter || 'all';

        // Group by party
        const groups = {};
        bills.forEach(bill => {
            if (!bill) return;
            // Search filter
            const pName = bill.partyName || '';
            const bNum = bill.billNumber || '';
            const cNum = bill.challanNumber || '';
            const searchStr = (pName + ' ' + bNum + ' ' + cNum).toLowerCase();
            if (search && !searchStr.includes(search)) return;

            // Status filter
            const status = getBillStatus(bill);
            if (filterVal !== 'all' && status !== filterVal) return;

            const party = pName || 'Unknown';
            if (!groups[party]) groups[party] = [];
            groups[party].push(bill);
        });

        container.innerHTML = '';
        const sortedParties = Object.keys(groups).sort();

        if (sortedParties.length === 0) {
            container.innerHTML = '<p style="color:#999;text-align:center;padding:20px;">No bills found.</p>';
            return;
        }

        sortedParties.forEach(party => {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'history-party-group';

            const nameDiv = document.createElement('div');
            nameDiv.className = 'history-party-name';
            nameDiv.textContent = party;
            groupDiv.appendChild(nameDiv);

            // Sort bills by date descending
            groups[party].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

            groups[party].forEach(bill => {
                const status = getBillStatus(bill);
                const isPaid = (status === 'paid');
                const isPartial = (status === 'partial');
                const remaining = Math.max(0, (bill.grandTotal || 0) - (bill.amountReceived || 0));

                const card = document.createElement('div');
                card.className = 'history-bill-card';
                card.innerHTML = `
                    <div class="bill-field"><strong>Bill:</strong> ${esc(bill.billNumber)}</div>
                    <div class="bill-field"><strong>Party:</strong> ${esc(bill.partyName)}</div>
                    <div class="bill-field"><strong>Challan:</strong> ${esc(bill.challanNumber)}</div>
                    <div class="bill-field"><strong>Date:</strong> ${formatDateDisplay(bill.date)}</div>
                    <div class="bill-field"><strong>Grand Total:</strong> ₹${formatIndianNumber(bill.grandTotal || 0)}</div>
                    <div class="bill-field"><strong>Received:</strong> ₹${formatIndianNumber(bill.amountReceived || 0)}</div>
                    <div class="bill-field"><strong>Pending:</strong> ₹${formatIndianNumber(remaining)}</div>
                    <div class="bill-field">
                        <span class="status-badge status-${status}">${isPartial ? 'Partially Paid' : (isPaid ? 'Paid' : 'Pending')}</span>
                    </div>
                    <div class="bill-field">
                        <label class="bill-status-check is-${status}" title="Toggle payment status">
                            <input type="checkbox" class="chk-bill-status" data-id="${bill.id}" ${isPaid ? 'checked' : ''} />
                            <span>${isPaid ? '☑ Paid' : (isPartial ? '☐ Partially Paid' : '☐ Pending')}</span>
                        </label>
                    </div>
                    <div class="bill-actions">
                        <button class="btn btn-sm" data-action="view" data-id="${bill.id}">View</button>
                        <button class="btn btn-sm" data-action="edit" data-id="${bill.id}">Edit</button>
                        <button class="btn btn-sm" data-action="print" data-id="${bill.id}">Print</button>
                        <button class="btn btn-sm" data-action="pay" data-id="${bill.id}">Payment</button>
                        <button class="btn btn-sm" data-action="delete" data-id="${bill.id}" style="color:#c00">Delete</button>
                    </div>
                `;
                groupDiv.appendChild(card);
            });

            container.appendChild(groupDiv);
        });

        // Attach action handlers
        container.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                const id = btn.dataset.id;
                if (action === 'view') viewBill(id);
                if (action === 'edit') editBill(id);
                if (action === 'print') printOldBill(id);
                if (action === 'delete') deleteBill(id);
                if (action === 'pay') recordPayment(id);
            });
        });

        // Attach checkbox payment toggle handlers
        container.querySelectorAll('.chk-bill-status').forEach(chk => {
            chk.addEventListener('change', async (e) => {
                const id = chk.dataset.id;
                const bills = loadBills();
                const idx = bills.findIndex(b => b.id === id);
                if (idx === -1) return;
                const bill = bills[idx];
                const prevStatus = getBillStatus(bill);
                const willBeChecked = chk.checked;

                // Disable during confirmation to prevent duplicate triggers
                chk.disabled = true;

                if (willBeChecked) {
                    // Marking as Paid
                    const grand = parseFloat(bill.grandTotal) || 0;
                    const received = parseFloat(bill.amountReceived) || 0;
                    const remaining = Math.max(0, grand - received);

                    if (prevStatus === 'partial') {
                        const ok = confirm(`Bill ${bill.billNumber} (${bill.partyName}) has a partial payment.\nPaid: ₹${formatIndianNumber(received)}\nRemaining Pending: ₹${formatIndianNumber(remaining)}\n\nMark remaining balance of ₹${formatIndianNumber(remaining)} as fully PAID?`);
                        if (!ok) {
                            chk.checked = false;
                            chk.disabled = false;
                            return;
                        }
                    } else {
                        const ok = confirm(`Mark Bill ${bill.billNumber} (${bill.partyName}) for ₹${formatIndianNumber(grand)} as fully PAID?`);
                        if (!ok) {
                            chk.checked = false;
                            chk.disabled = false;
                            return;
                        }
                    }

                    bill.amountReceived = grand;
                    bill.pendingAmount = 0;
                    bill.paymentStatus = 'paid';
                    bill.paymentReceived = true;
                    bill.paymentDate = new Date().toISOString().split('T')[0];
                } else {
                    // Marking as Pending
                    const grand = parseFloat(bill.grandTotal) || 0;
                    const ok = confirm(`Change Bill ${bill.billNumber} (${bill.partyName}) status from Paid to PENDING?\n\nThis will restore the outstanding balance of ₹${formatIndianNumber(grand)}.`);
                    if (!ok) {
                        chk.checked = true;
                        chk.disabled = false;
                        return;
                    }

                    bill.amountReceived = 0;
                    bill.pendingAmount = grand;
                    bill.paymentStatus = 'pending';
                    bill.paymentReceived = false;
                    bill.paymentDate = '';
                }

                bills[idx] = bill;
                saveBillsToStorage(bills);

                if (typeof window !== 'undefined' && window.CloudDB && window.CloudDB.isConfigured()) {
                    try {
                        await window.CloudDB.saveBill(bill);
                    } catch (err) {
                        console.error('Firebase sync error on status change:', err);
                    }
                }

                renderHistory();
                renderPending();
                if (typeof renderDashboard === 'function') renderDashboard();
            });
        });
    }

    // Search handler for history
    $('historySearch').addEventListener('input', renderHistory);

    // Filter buttons
    document.querySelectorAll('.filter-btns .btn-sm').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btns .btn-sm').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderHistory();
        });
    });

    function getBillStatus(bill) {
        const grand = bill.grandTotal || 0;
        const received = bill.amountReceived || 0;
        if (grand <= 0) return 'paid';
        if (received >= grand) return 'paid';
        if (received > 0) return 'partial';
        return 'pending';
    }

    function esc(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // ========== VIEW BILL ==========
    function viewBill(id) {
        const bills = loadBills();
        const bill = bills.find(b => b.id === id);
        if (!bill) return alert('Bill not found.');
        populateForm(bill);
        // Switch to bill page
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        $('page-bill').classList.add('active');
        document.querySelector('[data-page="bill"]').classList.add('active');
        window.scrollTo(0, 0);
    }

    // ========== EDIT BILL ==========
    function editBill(id) {
        const bills = loadBills();
        const bill = bills.find(b => b.id === id);
        if (!bill) return alert('Bill not found.');
        editingBillId = id;
        populateForm(bill);
        // Switch to bill page
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        $('page-bill').classList.add('active');
        document.querySelector('[data-page="bill"]').classList.add('active');
        showStatus('Editing bill ' + bill.billNumber + '. Click Save to update.', 'success');
        window.scrollTo(0, 0);
    }

    // ========== PRINT OLD BILL ==========
    function printOldBill(id) {
        const bills = loadBills();
        const bill = bills.find(b => b.id === id);
        if (!bill) return alert('Bill not found.');
        populateForm(bill);
        updatePreview();
        setTimeout(() => window.print(), 250);
    }

    // ========== DELETE BILL ==========
    function deleteBill(id) {
        if (!confirm('Are you sure you want to delete this bill? This cannot be undone.')) return;
        let bills = loadBills();
        bills = bills.filter(b => b.id !== id);
        saveBillsToStorage(bills);
        renderHistory();
        renderPending();
        if (typeof window !== 'undefined' && window.CloudDB && window.CloudDB.isConfigured()) {
            window.CloudDB.deleteBill(id);
        }
    }

    // ========== RECORD PAYMENT ==========
    function recordPayment(id) {
        const bills = loadBills();
        const bill = bills.find(b => b.id === id);
        if (!bill) return alert('Bill not found.');

        const pending = (bill.grandTotal || 0) - (bill.amountReceived || 0);
        if (pending <= 0) return alert('This bill is already fully paid.');

        const amtStr = prompt('Pending: ₹' + formatIndianNumber(pending) + '\n\nEnter payment amount (₹):');
        if (amtStr === null) return;
        const amt = parseFloat(amtStr);
        if (isNaN(amt) || amt <= 0) return alert('Please enter a valid amount.');
        if (amt > pending) return alert('Payment cannot exceed pending amount ₹' + formatIndianNumber(pending));

        const payDate = prompt('Enter payment date (YYYY-MM-DD):', new Date().toISOString().split('T')[0]);
        if (!payDate) return;

        // Record payment
        bill.amountReceived = (bill.amountReceived || 0) + amt;
        bill.pendingAmount = Math.max(0, bill.grandTotal - bill.amountReceived);
        bill.paymentReceived = bill.amountReceived > 0;
        bill.paymentStatus = getBillStatus(bill);
        bill.paymentDate = payDate;

        // Add to payment history
        if (!bill.payments) bill.payments = [];
        bill.payments.push({ amount: amt, date: payDate, recordedAt: new Date().toISOString() });

        const idx = bills.findIndex(b => b.id === id);
        bills[idx] = bill;
        saveBillsToStorage(bills);
        renderHistory();
        renderPending(); // update pending payment report automatically!
        if (typeof window !== 'undefined' && window.CloudDB && window.CloudDB.isConfigured()) {
            window.CloudDB.saveBill(bill);
        }
        alert('Payment of ₹' + formatIndianNumber(amt) + ' recorded successfully.');
    }

    // ========== POPULATE FORM ==========
    function populateForm(bill) {
        inpBillNo.value = bill.billNumber || '';
        inpChallan.value = bill.challanNumber || '';
        inpDate.value = bill.date || '';
        inpPartyName.value = bill.partyName || '';
        inpPartyDetails.value = bill.partyDetails || '';

        // Items
        editTableBody.innerHTML = '';
        const items = bill.items || [];
        const rowCount = Math.max(items.length, 10);
        for (let i = 0; i < rowCount; i++) {
            const data = i < items.length ? items[i] : {};
            editTableBody.appendChild(createEditRow(data));
        }
        renumberRows();

        const pct = bill.discountPercent !== undefined ? bill.discountPercent : ((bill.subtotal > 0 && bill.discount) ? Number(((bill.discount / bill.subtotal) * 100).toFixed(2)) : 0);
        inpDiscount.value = pct;

        chkPayment.checked = bill.paymentReceived || false;
        paymentFields.classList.toggle('hidden', !chkPayment.checked);
        inpAmtReceived.value = bill.amountReceived || 0;
        inpPayDate.value = bill.paymentDate || '';

        recalcAll();
    }

    // ========== PENDING PAYMENTS ==========
    const selectParty = $('selectParty');
    const pendingReportPartyName = $('pendingReportPartyName');
    const pendingReportContent = $('pendingReportContent');
    const overallPendingBanner = $('overallPendingBanner');
    const pendingBannerLabel = $('pendingBannerLabel');
    const overallPendingAmount = $('overallPendingAmount');
    const btnGeneratePartyReport = $('btn-generatePartyReport');
    const btnSavePartyReport = $('btn-savePartyReport');
    const btnPartyPdf = $('btn-partyPdf');
    const btnPartyPrint = $('btn-partyPrint');

    function populatePartyDropdown() {
        if (!selectParty) return;
        const bills = loadBills();
        const currentVal = selectParty.value;
        const parties = new Set();
        bills.forEach(b => {
            const p = (b.partyName || '').trim();
            if (p) parties.add(p);
        });
        const sortedParties = Array.from(parties).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

        selectParty.innerHTML = '<option value="">-- SELECT PARTY NAME --</option>';
        sortedParties.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p;
            opt.textContent = p;
            if (p === currentVal) opt.selected = true;
            selectParty.appendChild(opt);
        });

        if (sortedParties.length > 0) {
            const allOpt = document.createElement('option');
            allOpt.value = '__ALL__';
            allOpt.textContent = '-- ALL PARTIES (Summary) --';
            if (currentVal === '__ALL__') allOpt.selected = true;
            selectParty.appendChild(allOpt);
        }
    }

    function renderPending() {
        populatePartyDropdown();
        const bills = loadBills();
        const selectedParty = (selectParty ? selectParty.value : '').trim();
        const challanFilter = ($('pendingSearch') ? $('pendingSearch').value : '').trim().toLowerCase();

        const todayStr = new Date().toISOString().split('T')[0];
        if ($('pendingReportDate')) {
            $('pendingReportDate').textContent = 'Generated on: ' + formatDateDisplay(todayStr);
        }

        const container = $('pendingReportContent');
        if (!container) return;
        container.innerHTML = '';

        // If no party selected yet
        if (!selectedParty) {
            if (pendingReportPartyName) {
                pendingReportPartyName.textContent = 'Party Name: [Please Select a Party]';
                pendingReportPartyName.style.display = 'block';
            }
            container.innerHTML = `<div style="text-align:center;padding:40px 20px;color:#888;font-size:15px;font-weight:600;">
                Please select a Party Name from the dropdown above to generate the pending payment report.
            </div>`;
            if (overallPendingBanner) overallPendingBanner.style.display = 'none';
            return;
        }

        // Case 1: Specific Selected Party (e.g. Hanuman or Shree Ram)
        if (selectedParty !== '__ALL__') {
            if (pendingReportPartyName) {
                pendingReportPartyName.textContent = 'Party Name: ' + selectedParty;
                pendingReportPartyName.style.display = 'block';
            }

            const partyBills = bills.filter(b => {
                const p = (b.partyName || '').trim();
                return p.toLowerCase() === selectedParty.toLowerCase();
            });

            // Filter pending bills (> 0.001)
            const seenDocIds = new Set();
            const pendingItems = [];
            let partyTotal = 0;

            partyBills.forEach(bill => {
                const grand = parseFloat(bill.grandTotal) || 0;
                const received = parseFloat(bill.amountReceived) || 0;
                // Important calculation: Pending Amount = Final Bill Grand Total − Amount Received.
                // The grand total already includes the discount. Never subtract the discount again.
                const pendingAmt = Math.max(0, grand - received);

                if (pendingAmt <= 0.001) return; // exclude fully paid bills

                const challanStr = (bill.challanNumber || '').trim();
                if (challanFilter && !challanStr.toLowerCase().includes(challanFilter)) return;

                const docId = bill.id || (bill.billNumber ? 'bill_' + bill.billNumber : 'doc_' + Math.random());
                if (seenDocIds.has(docId)) return;
                seenDocIds.add(docId);

                let statusText = 'Pending';
                if (received > 0 && received < grand) statusText = 'Partially Paid';

                pendingItems.push({
                    challanNumber: challanStr || '--',
                    billNumber: bill.billNumber || '',
                    date: bill.date || '',
                    pendingAmount: pendingAmt,
                    status: statusText
                });

                partyTotal += pendingAmt;
            });

            if (pendingItems.length === 0) {
                container.innerHTML = `<div style="text-align:center;padding:40px 20px;color:#155724;background:#d4edda;border-radius:4px;font-size:15px;font-weight:700;margin:15px 0;">
                    No pending payments for "${esc(selectedParty)}". All bills are fully paid!
                </div>`;
                if (overallPendingBanner) overallPendingBanner.style.display = 'none';
                return;
            }

            // Sort newest date first
            pendingItems.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

            // Build 3-column Table:
            // 1. Party Challan No. | 2. Total Pending (₹) | 3. Status
            const table = document.createElement('table');
            table.className = 'pending-table';
            let html = `<thead>
                <tr>
                    <th style="width:40%;text-align:left;">Party Challan No.</th>
                    <th style="width:35%;text-align:right;">Total Pending (₹)</th>
                    <th style="width:25%;text-align:center;">Status</th>
                </tr>
            </thead>
            <tbody>`;

            pendingItems.forEach(item => {
                const statusClass = item.status === 'Partially Paid' ? 'partial' : 'pending';
                html += `<tr>
                    <td style="font-weight:600;text-align:left;">${esc(item.challanNumber)}</td>
                    <td style="text-align:right;font-weight:700;color:#8b0000;">₹${formatIndianNumber(item.pendingAmount)}</td>
                    <td style="text-align:center;"><span class="status-badge status-${statusClass}">${item.status}</span></td>
                </tr>`;
            });

            html += `<tr class="party-total-row">
                <td style="font-weight:800;letter-spacing:0.5px;text-align:left;">Party Total</td>
                <td style="text-align:right;font-weight:800;color:#8b0000;font-size:14px;">₹${formatIndianNumber(partyTotal)}</td>
                <td></td>
            </tr>
            </tbody>`;

            table.innerHTML = html;
            container.appendChild(table);

            if (overallPendingBanner) {
                if (pendingBannerLabel) pendingBannerLabel.textContent = 'PARTY TOTAL PENDING:';
                if (overallPendingAmount) overallPendingAmount.textContent = '₹' + formatIndianNumber(partyTotal);
                overallPendingBanner.style.display = 'flex';
            }
            return;
        }

        // Case 2: ALL PARTIES Summary
        if (selectedParty === '__ALL__') {
            if (pendingReportPartyName) {
                pendingReportPartyName.textContent = 'Party Name: All Parties (Combined Summary)';
                pendingReportPartyName.style.display = 'block';
            }

            const groups = {};
            let overallTotal = 0;
            const seenDocIds = new Set();

            bills.forEach(bill => {
                const grand = parseFloat(bill.grandTotal) || 0;
                const received = parseFloat(bill.amountReceived) || 0;
                const pendingAmt = Math.max(0, grand - received);

                if (pendingAmt <= 0.001) return;

                const partyStr = (bill.partyName || '').trim() || '[MISSING PARTY NAME]';
                const challanStr = (bill.challanNumber || '').trim();
                if (challanFilter && !challanStr.toLowerCase().includes(challanFilter)) return;

                const docId = bill.id || (bill.billNumber ? 'bill_' + bill.billNumber : 'doc_' + Math.random());
                if (seenDocIds.has(docId)) return;
                seenDocIds.add(docId);

                if (!groups[partyStr]) {
                    groups[partyStr] = {
                        partyName: partyStr,
                        bills: [],
                        partyTotal: 0
                    };
                }

                let statusText = 'Pending';
                if (received > 0 && received < grand) statusText = 'Partially Paid';

                groups[partyStr].bills.push({
                    challanNumber: challanStr || '--',
                    billNumber: bill.billNumber || '',
                    date: bill.date || '',
                    pendingAmount: pendingAmt,
                    status: statusText
                });

                groups[partyStr].partyTotal += pendingAmt;
                overallTotal += pendingAmt;
            });

            const sortedParties = Object.keys(groups).sort();
            if (sortedParties.length === 0) {
                container.innerHTML = `<div style="text-align:center;padding:40px 20px;color:#888;font-size:15px;font-weight:600;">
                    No pending payments found across all parties. All bills are fully paid!
                </div>`;
                if (overallPendingBanner) overallPendingBanner.style.display = 'none';
                return;
            }

            sortedParties.forEach(pKey => {
                const grp = groups[pKey];
                const groupDiv = document.createElement('div');
                groupDiv.className = 'pending-party-group';

                const nameDiv = document.createElement('div');
                nameDiv.className = 'pending-party-header';
                nameDiv.textContent = 'Party Name: ' + grp.partyName;
                groupDiv.appendChild(nameDiv);

                const table = document.createElement('table');
                table.className = 'pending-table';
                let html = `<thead>
                    <tr>
                        <th style="width:40%;text-align:left;">Party Challan No.</th>
                        <th style="width:35%;text-align:right;">Total Pending (₹)</th>
                        <th style="width:25%;text-align:center;">Status</th>
                    </tr>
                </thead>
                <tbody>`;

                grp.bills.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
                grp.bills.forEach(item => {
                    const statusClass = item.status === 'Partially Paid' ? 'partial' : 'pending';
                    html += `<tr>
                        <td style="font-weight:600;text-align:left;">${esc(item.challanNumber)}</td>
                        <td style="text-align:right;font-weight:700;color:#8b0000;">₹${formatIndianNumber(item.pendingAmount)}</td>
                        <td style="text-align:center;"><span class="status-badge status-${statusClass}">${item.status}</span></td>
                    </tr>`;
                });

                html += `<tr class="party-total-row">
                    <td style="font-weight:800;letter-spacing:0.5px;text-align:left;">Party Total</td>
                    <td style="text-align:right;font-weight:800;color:#8b0000;font-size:14px;">₹${formatIndianNumber(grp.partyTotal)}</td>
                    <td></td>
                </tr>
                </tbody>`;

                table.innerHTML = html;
                groupDiv.appendChild(table);
                container.appendChild(groupDiv);
            });

            if (overallPendingBanner) {
                if (pendingBannerLabel) pendingBannerLabel.textContent = 'OVERALL TOTAL PENDING:';
                if (overallPendingAmount) overallPendingAmount.textContent = '₹' + formatIndianNumber(overallTotal);
                overallPendingBanner.style.display = 'flex';
            }
        }
    }

    if (selectParty) selectParty.addEventListener('change', renderPending);
    if ($('pendingSearch')) $('pendingSearch').addEventListener('input', renderPending);
    if (btnGeneratePartyReport) btnGeneratePartyReport.addEventListener('click', renderPending);

    // ========== SAVE PARTY PENDING REPORT ==========
    if (btnSavePartyReport) {
        btnSavePartyReport.addEventListener('click', async () => {
            const selectedParty = (selectParty ? selectParty.value : '').trim();
            if (!selectedParty) {
                showPendingStatus('Please select a Party Name first.', 'error');
                return;
            }

            const bills = loadBills();
            const todayStr = new Date().toISOString().split('T')[0];

            if (selectedParty !== '__ALL__') {
                const partyBills = bills.filter(b => ((b.partyName || '').trim().toLowerCase() === selectedParty.toLowerCase()));
                const seenDocIds = new Set();
                const pendingItems = [];
                let partyTotal = 0;

                partyBills.forEach(bill => {
                    const grand = parseFloat(bill.grandTotal) || 0;
                    const received = parseFloat(bill.amountReceived) || 0;
                    const pendingAmt = Math.max(0, grand - received);

                    if (pendingAmt <= 0.001) return;

                    const docId = bill.id || (bill.billNumber ? 'bill_' + bill.billNumber : 'doc_' + Math.random());
                    if (seenDocIds.has(docId)) return;
                    seenDocIds.add(docId);

                    let statusText = 'Pending';
                    if (received > 0 && received < grand) statusText = 'Partially Paid';

                    pendingItems.push({
                        challanNumber: bill.challanNumber || '--',
                        billNumber: bill.billNumber || '',
                        date: bill.date || '',
                        pendingAmount: pendingAmt,
                        status: statusText
                    });

                    partyTotal += pendingAmt;
                });

                if (pendingItems.length === 0) {
                    showPendingStatus('No pending balance to save for "' + selectedParty + '".', 'error');
                    return;
                }

                const reportSnapshot = {
                    id: 'party_report_' + Date.now(),
                    reportTitle: 'PENDING PAYMENT REPORT',
                    businessName: 'AKSHAR ARI WORK',
                    partyName: selectedParty,
                    generatedDate: todayStr,
                    totalPendingAmount: partyTotal,
                    bills: pendingItems,
                    savedAt: new Date().toISOString()
                };

                // Save snapshot locally
                try {
                    const existingRaw = localStorage.getItem('akshar_ari_party_pending_reports_v2');
                    const reports = existingRaw ? JSON.parse(existingRaw) : [];
                    reports.push(reportSnapshot);
                    localStorage.setItem('akshar_ari_party_pending_reports_v2', JSON.stringify(reports));
                } catch (e) {
                    console.error('Error saving local party report snapshot:', e);
                }

                // Sync to Firestore if configured
                if (typeof window !== 'undefined' && window.CloudDB && window.CloudDB.isConfigured()) {
                    await window.CloudDB.savePartyPendingReport(reportSnapshot);
                }

                showPendingStatus('Party Pending Report for "' + selectedParty + '" saved successfully! (Total Pending: ₹' + formatIndianNumber(partyTotal) + ')', 'success');
            } else {
                showPendingStatus('Please select a specific Party Name to save an individual party report.', 'error');
            }
        });
    }

    // ========== DOWNLOAD PARTY PENDING PDF ==========
    if (btnPartyPdf) {
        btnPartyPdf.addEventListener('click', () => {
            const selectedParty = (selectParty ? selectParty.value : '').trim();
            if (!selectedParty) {
                showPendingStatus('Please select a Party Name first.', 'error');
                return;
            }

            const reportEl = document.getElementById('pendingReportPreview');
            if (!reportEl) return;
            if (typeof html2canvas === 'undefined' || typeof window === 'undefined' || !window.jspdf) {
                showPendingStatus('PDF library offline or loading. Please click Print Report and select "Save as PDF".', 'error');
                return;
            }
            showPendingStatus('Generating Party Pending Report PDF...', 'success');

            html2canvas(reportEl, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                width: 794,
                windowWidth: 794
            }).then(canvas => {
                const { jsPDF } = window.jspdf;
                const pdf = new jsPDF('p', 'mm', 'a4');
                const pageWidth = 210;
                const pageHeight = 297;
                const margin = 5;
                const imgWidth = pageWidth - (margin * 2);
                const imgHeight = (canvas.height * imgWidth) / canvas.width;
                const imgData = canvas.toDataURL('image/png');

                if (imgHeight <= pageHeight - (margin * 2)) {
                    pdf.addImage(imgData, 'PNG', margin, margin, imgWidth, imgHeight);
                } else {
                    let yOffset = 0;
                    const pageContentHeight = pageHeight - (margin * 2);
                    while (yOffset < imgHeight) {
                        if (yOffset > 0) pdf.addPage();
                        pdf.addImage(imgData, 'PNG', margin, margin - yOffset, imgWidth, imgHeight);
                        yOffset += pageContentHeight;
                    }
                }

                const dateStr = new Date().toISOString().split('T')[0];
                const cleanParty = selectedParty.replace(/[^a-zA-Z0-9_-]/g, '_');
                const filename = 'Pending_Report_' + cleanParty + '_' + dateStr + '.pdf';
                pdf.save(filename);
                showPendingStatus('Party Pending Report PDF downloaded: ' + filename, 'success');
            }).catch(err => {
                showPendingStatus('PDF generation failed: ' + err.message, 'error');
            });
        });
    }

    // ========== PRINT PARTY PENDING REPORT ==========
    if (btnPartyPrint) {
        btnPartyPrint.addEventListener('click', () => {
            const selectedParty = (selectParty ? selectParty.value : '').trim();
            if (!selectedParty) {
                showPendingStatus('Please select a Party Name first before printing.', 'error');
                return;
            }
            window.print();
        });
    }

    function showPendingStatus(msg, type) {
        const el = $('pendingStatusMsg');
        if (!el) return;
        el.textContent = msg;
        el.className = 'status-msg ' + type;
        setTimeout(() => { el.className = 'status-msg'; }, 4000);
    }

    // ========== DASHBOARD ==========
    function renderDashboard() {
        const bills = loadBills();

        let totalBills = bills.length;
        let totalBilling = 0;
        let totalReceived = 0;
        let totalPending = 0;
        let pendingCount = 0;
        let paidCount = 0;

        const partyMap = {};

        bills.forEach(bill => {
            if (!bill) return;
            const grand = bill.grandTotal || 0;
            const received = bill.amountReceived || 0;
            const pending = Math.max(0, grand - received);

            totalBilling += grand;
            totalReceived += received;
            totalPending += pending;

            const status = getBillStatus(bill);
            if (status === 'paid') paidCount++;
            else pendingCount++;

            const party = bill.partyName || 'Unknown';
            if (!partyMap[party]) partyMap[party] = { billing: 0, received: 0, pending: 0 };
            partyMap[party].billing += grand;
            partyMap[party].received += received;
            partyMap[party].pending += pending;
        });

        $('dashboardCards').innerHTML = `
            <div class="dash-card"><span class="dash-value">${totalBills}</span><span class="dash-label">Total Bills</span></div>
            <div class="dash-card"><span class="dash-value">₹${formatIndianNumber(totalBilling)}</span><span class="dash-label">Total Billing</span></div>
            <div class="dash-card"><span class="dash-value">₹${formatIndianNumber(totalReceived)}</span><span class="dash-label">Total Received</span></div>
            <div class="dash-card"><span class="dash-value">₹${formatIndianNumber(totalPending)}</span><span class="dash-label">Total Pending</span></div>
            <div class="dash-card"><span class="dash-value">${pendingCount}</span><span class="dash-label">Pending Bills</span></div>
            <div class="dash-card"><span class="dash-value">${paidCount}</span><span class="dash-label">Fully Paid Bills</span></div>
        `;

        const sortedParties = Object.keys(partyMap).sort();
        let tableHtml = `<table class="party-summary-table">
            <thead><tr><th>Party Name</th><th>Total Billing (₹)</th><th>Total Received (₹)</th><th>Total Pending (₹)</th></tr></thead>
            <tbody>`;
        sortedParties.forEach(party => {
            const p = partyMap[party];
            tableHtml += `<tr>
                <td>${esc(party)}</td>
                <td>₹${formatIndianNumber(p.billing)}</td>
                <td>₹${formatIndianNumber(p.received)}</td>
                <td>₹${formatIndianNumber(p.pending)}</td>
            </tr>`;
        });
        tableHtml += '</tbody></table>';
        $('partySummary').innerHTML = sortedParties.length ? tableHtml : '<p style="color:#999;text-align:center;">No data yet.</p>';
    }

    // ========== CLOUD SYNC & STATUS ==========
    function updateSyncStatus(state, label) {
        const badge = $('navSyncBadge');
        const txt = $('syncText');
        if (!badge || !txt) return;
        badge.className = 'nav-sync-indicator ' + (state || '');
        txt.textContent = label || '';
    }

    async function refreshBillsFromCloud() {
        if (typeof window !== 'undefined' && window.CloudDB && window.CloudDB.isConfigured()) {
            updateSyncStatus('syncing', 'Syncing Cloud...');
            try {
                const cloudBills = await window.CloudDB.getBills();
                if (cloudBills && Array.isArray(cloudBills)) {
                    const localBills = loadBills();
                    const mergedMap = new Map();
                    localBills.forEach(b => {
                        const k = b.id || (b.billNumber ? 'bill_' + b.billNumber : null);
                        if (k) mergedMap.set(k, b);
                    });
                    cloudBills.forEach(b => {
                        const k = b.id || (b.billNumber ? 'bill_' + b.billNumber : null);
                        if (k) mergedMap.set(k, b);
                    });
                    const finalBills = Array.from(mergedMap.values());
                    saveBillsToStorage(finalBills);
                    updateSyncStatus('cloud', '☁️ Cloud Synced');
                    renderHistory();
                    renderPending();
                    if (typeof renderDashboard === 'function') renderDashboard();
                    return finalBills;
                }
            } catch (err) {
                console.warn('Error fetching cloud bills:', err);
                updateSyncStatus('offline', '💾 Local Mode (Offline)');
            }
        } else {
            updateSyncStatus('offline', '💾 Local Mode');
        }
        return loadBills();
    }

    // Refresh Cloud History button
    const btnRefreshHistory = $('btn-refreshCloudHistory');
    if (btnRefreshHistory) {
        btnRefreshHistory.addEventListener('click', async () => {
            btnRefreshHistory.disabled = true;
            const originalHtml = btnRefreshHistory.innerHTML;
            btnRefreshHistory.innerHTML = '⏳ Refreshing...';
            try {
                await refreshBillsFromCloud();
                showStatus('Cloud history refreshed successfully!', 'success');
            } catch (err) {
                console.error(err);
                showStatus('Cloud refresh failed: ' + (err.message || 'Offline'), 'error');
            } finally {
                btnRefreshHistory.disabled = false;
                btnRefreshHistory.innerHTML = originalHtml;
            }
        });
    }

    // ========== INITIAL LOAD & CLOUD SYNC ==========
    updatePreview();
    renderPending();
    renderHistory();

    function initCloudSync() {
        if (typeof window !== 'undefined' && window.CloudDB && window.CloudDB.isConfigured()) {
            updateSyncStatus('cloud', '☁️ Cloud Synced');
            
            // Listen for multi-device real-time updates
            window.CloudDB.onBillsChanged(cloudBills => {
                if (cloudBills && Array.isArray(cloudBills)) {
                    saveBillsToStorage(cloudBills);
                    updateSyncStatus('cloud', '☁️ Cloud Synced');
                    renderPending();
                    renderHistory();
                    if ($('page-dashboard') && $('page-dashboard').classList.contains('active')) {
                        renderDashboard();
                    }
                }
            });

            // Refresh from cloud on boot
            refreshBillsFromCloud();
        } else {
            updateSyncStatus('offline', '💾 Local Mode');
        }
    }

    initCloudSync();
}

// ========== INITIALIZATION ==========
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initApp);
    } else {
        initApp();
    }
    // Also attach to DOMContentLoaded for test harnesses / delayed triggers
    document.addEventListener('DOMContentLoaded', initApp);
}
