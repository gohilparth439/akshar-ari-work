/* ============================================================
   AKSHAR ARI WORK — Firebase Configuration & Firestore Sync
   Supports saving bills and pending reports party-wise to Firestore.
   Falls back gracefully to local storage if offline or unconfigured.
   ============================================================ */

// Replace the placeholder values with your Firebase project configuration
const firebaseConfig = (typeof window !== 'undefined' && window.FIREBASE_CONFIG) ? window.FIREBASE_CONFIG : {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

const CloudDB = (() => {
    let db = null;
    let isInitialized = false;

    function initFirebase(config) {
        const conf = config || firebaseConfig;
        try {
            if (typeof firebase !== 'undefined' && firebase.initializeApp) {
                if (conf && conf.apiKey && conf.apiKey !== "YOUR_API_KEY") {
                    if (!firebase.apps.length) {
                        firebase.initializeApp(conf);
                    }
                    db = firebase.firestore();
                    // Enable multi-tab offline persistence
                    try {
                        if (typeof db.enablePersistence === 'function') {
                            db.enablePersistence({ synchronizeTabs: true }).catch(err => {
                                console.warn('Firestore offline persistence notice:', err.code);
                            });
                        }
                    } catch (pErr) {
                        console.warn('Firestore persistence warning:', pErr);
                    }
                    isInitialized = true;
                    console.log('Firebase Firestore initialized successfully.');
                    return true;
                } else {
                    console.log('Firebase config is using placeholders. Running in local storage mode.');
                }
            }
        } catch (e) {
            console.warn('Firebase initialization skipped:', e.message);
        }
        return false;
    }

    // Auto-init on load
    initFirebase();

    return {
        init: (config) => initFirebase(config),
        isConfigured: () => isInitialized && db !== null,

        // Save or update bill document in Firestore
        saveBill: async (billData) => {
            if (!isInitialized || !db) return false;
            try {
                const docId = billData.id || ('bill_' + (billData.billNumber ? billData.billNumber.replace(/[^a-zA-Z0-9_-]/g, '_') : Date.now()));
                const docRef = db.collection('bills').doc(docId);
                await docRef.set({
                    id: docId,
                    billNumber: String(billData.billNumber || '').trim(),
                    partyName: String(billData.partyName || '').trim(),
                    challanNumber: String(billData.challanNumber || '').trim(),
                    date: billData.date || new Date().toISOString().split('T')[0],
                    items: Array.isArray(billData.items) ? billData.items : [],
                    subtotal: Number(billData.subtotal) || 0,
                    discountType: 'percent',
                    discountPercent: Number(billData.discountPercent) || 0,
                    discountAmount: Number(billData.discountAmount) || 0,
                    discount: Number(billData.discountAmount) || 0,
                    grandTotal: Number(billData.grandTotal) || 0,
                    paymentReceived: !!billData.paymentReceived,
                    amountReceived: Number(billData.amountReceived) || 0,
                    pendingAmount: Number(billData.pendingAmount) || 0,
                    paymentStatus: billData.paymentStatus || 'pending',
                    paymentDate: billData.paymentDate || '',
                    payments: Array.isArray(billData.payments) ? billData.payments : [],
                    partyDetails: String(billData.partyDetails || '').trim(),
                    updatedAt: new Date().toISOString(),
                    createdAt: billData.createdAt || new Date().toISOString()
                }, { merge: true });
                console.log('Bill synced to Firestore:', billData.billNumber);
                return true;
            } catch (err) {
                console.error('Error saving bill to Firestore:', err);
                return false;
            }
        },

        // Fetch all bills from Firestore
        getBills: async () => {
            if (!isInitialized || !db) return null;
            try {
                const snapshot = await db.collection('bills').get();
                const bills = [];
                snapshot.forEach(doc => {
                    bills.push(doc.data());
                });
                return bills;
            } catch (err) {
                console.error('Error fetching bills from Firestore:', err);
                return null;
            }
        },

        // Delete bill document from Firestore
        deleteBill: async (id) => {
            if (!isInitialized || !db) return false;
            try {
                await db.collection('bills').doc(id).delete();
                console.log('Bill deleted from Firestore:', id);
                return true;
            } catch (err) {
                console.error('Error deleting bill from Firestore:', err);
                return false;
            }
        },

        // Save a snapshot of the party-wise Pending Payment Report
        savePendingReport: async (reportData) => {
            if (!isInitialized || !db) return false;
            try {
                const docId = reportData.id || ('report_' + Date.now());
                await db.collection('pending_reports').doc(docId).set({
                    id: docId,
                    reportTitle: "PENDING PAYMENT REPORT",
                    businessName: "AKSHAR ARI WORK",
                    generatedDate: reportData.generatedDate,
                    overallTotalPending: Number(reportData.overallTotalPending) || 0,
                    parties: reportData.parties || [],
                    createdAt: new Date().toISOString()
                });
                console.log('Pending Payment Report saved to Firestore:', docId);
                return true;
            } catch (err) {
                console.error('Error saving pending report to Firestore:', err);
                return false;
            }
        },

        // Save a snapshot for a specific selected party
        savePartyPendingReport: async (reportData) => {
            if (!isInitialized || !db) return false;
            try {
                const docId = reportData.id || ('party_report_' + Date.now());
                await db.collection('party_pending_reports').doc(docId).set({
                    id: docId,
                    reportTitle: "PENDING PAYMENT REPORT",
                    businessName: "AKSHAR ARI WORK",
                    partyName: reportData.partyName,
                    generatedDate: reportData.generatedDate,
                    totalPendingAmount: Number(reportData.totalPendingAmount) || 0,
                    bills: reportData.bills || [],
                    createdAt: new Date().toISOString()
                });
                console.log('Party Pending Report saved to Firestore:', docId);
                return true;
            } catch (err) {
                console.error('Error saving party pending report to Firestore:', err);
                return false;
            }
        },

        // Real-time listener for bills collection
        onBillsChanged: (callback) => {
            if (!isInitialized || !db) return null;
            try {
                return db.collection('bills').onSnapshot(snapshot => {
                    const bills = [];
                    snapshot.forEach(doc => bills.push(doc.data()));
                    callback(bills);
                }, err => {
                    console.error('Firestore bills listener error:', err);
                });
            } catch (err) {
                console.error('Error setting Firestore listener:', err);
                return null;
            }
        }
    };
})();

// Export globally
if (typeof window !== 'undefined') {
    window.CloudDB = CloudDB;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CloudDB, firebaseConfig };
}
