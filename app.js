import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithRedirect, getRedirectResult } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { getFirestore, setDoc, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { AuthView } from './AuthView.js';
import { DashboardView } from './DashboardView.js';
import { AddProductView } from './AddProductView.js';
import { EditProductView } from './EditProductView.js';
import { CreateOrderView } from './CreateOrderView.js';
import { PickingOrdersView } from './PickingOrdersView.js';
import { PickOrderDetailsView } from './PickOrderDetailsView.js';
import { OrderHistoryView } from './OrderHistoryView.js';
import { SalesStatsView } from './SalesStatsView.js';

const firebaseConfig = {
    apiKey: "AIzaSyCdAYpf-yICDIHVaqZtRhTk14xV5IfewF4",
    authDomain: "stock-orders-75be0.firebaseapp.com",
    projectId: "stock-orders-75be0",
    storageBucket: "stock-orders-75be0.appspot.com",
    messagingSenderId: "637582925650",
    appId: "1:637582925650:web:23e1626b00db6eca30e48b",
    measurementId: "G-71PT1GXC8R"
};

let auth, db;
const appRoot = document.getElementById('app-root');
const appState = {
    currentUser: null,
    currentView: 'dashboard',
    editingProductId: null,
    pickingOrderId: null,
    listeners: [],
};

function showView(viewName, params = {}) {
    appState.currentView = viewName;
    if (params && params.productId) appState.editingProductId = params.productId;
    if (params && params.orderId) appState.pickingOrderId = params.orderId;
    renderApp(appState.currentUser, params);
}

function renderApp(user, params = {}) {
    if (!appRoot) return;
    if (Array.isArray(appState.listeners)) {
        appState.listeners.forEach(unsub => unsub && unsub());
    }
    appState.listeners = [];

    if (user) {
        appRoot.innerHTML = `
            <header class="bg-white shadow-md sticky top-0 z-10">
                <nav class="container mx-auto px-4 sm:px-6 py-3 flex justify-between items-center">
                    <h1 class="text-xl font-bold text-indigo-600">ניהול מחסן</h1>
                    <div class="flex items-center gap-4">
                        <span id="user-greeting" class="text-gray-700 text-sm hidden sm:block">שלום, ${user.displayName || user.email}</span>
                        <button id="logout-btn" class="px-3 py-1 text-sm text-white bg-red-500 rounded-md hover:bg-red-600">התנתק</button>
                    </div>
                </nav>
            </header>
            <main id="app-content" class="container mx-auto p-4 sm:p-6"></main>
        `;

        const mainContent = document.getElementById('app-content');
        let listeners = [];

        switch (appState.currentView) {
            case 'dashboard':
                mainContent.innerHTML = DashboardView.getHTML();
                listeners = DashboardView.init(db) || [];
                break;
            case 'add-product':
                mainContent.innerHTML = AddProductView.getHTML();
                listeners = AddProductView.init(db, showView) || [];
                break;
            case 'edit-product':
                const productToEdit = DashboardView.getProductFromCache
                    ? DashboardView.getProductFromCache(appState.editingProductId)
                    : null;
                mainContent.innerHTML = EditProductView.getHTML(productToEdit);
                listeners = EditProductView.init(db, showView) || [];
                break;
            case 'create-order':
                mainContent.innerHTML = CreateOrderView.getHTML();
                listeners = awaitOrSync(CreateOrderView.init, db, auth, showView);
                break;
            case 'picking-orders':
                mainContent.innerHTML = PickingOrdersView.getHTML();
                listeners = PickingOrdersView.init(db, showView) || [];
                break;
            case 'order-history':
                mainContent.innerHTML = OrderHistoryView.getHTML();
                listeners = OrderHistoryView.init(db, showView) || [];
                break;
            case 'pick-order-details':
                const orderId = params?.orderId;
                const readOnly = params?.readOnly || false;
                const orderData = params?.orderData || (PickingOrdersView.getOrderFromCache ? PickingOrdersView.getOrderFromCache(orderId) : {}) || {};
                mainContent.innerHTML = PickOrderDetailsView.getHTML(orderId, { [orderId]: orderData }, readOnly);
                listeners = PickOrderDetailsView.init(db, orderId, readOnly) || [];
                break;
            case 'sales-stats':
                mainContent.innerHTML = SalesStatsView.getHTML();
                listeners = SalesStatsView.init(db, showView) || [];
                break;
            default:
                mainContent.innerHTML = `<div>Not found</div>`;
                listeners = [];
        }

        appState.listeners = Array.isArray(listeners) ? listeners : [];

        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                await signOut(auth);
            });
        }

    } else {
        appRoot.innerHTML = AuthView.getHTML();
        AuthView.attachEventListeners(auth, GoogleAuthProvider, signInWithRedirect, db);
    }
}

function awaitOrSync(fn, ...args) {
    const result = fn(...args);
    if (result && typeof result.then === 'function') {
        return result.then(res => res || []);
    }
    return result || [];
}

function main() {
    try {
        const app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);

        document.body.addEventListener('click', (e) => {
            const button = e.target.closest('button');
            if (!button || !button.dataset.action) return;

            const { action, view, sku, orderId } = button.dataset;

            if (action === 'show-view') {
                showView(view);
            } else if (action === 'edit-product') {
                showView('edit-product', { productId: sku });
            } else if (action === 'show-pick-order-details') {
                showView('pick-order-details', { orderId: orderId });
            }
        });

        getRedirectResult(auth).catch(error => {
            console.error("Error with redirect result:", error);
            const messageArea = document.getElementById('auth-message-area');
            if (messageArea) messageArea.textContent = 'שגיאה בהתחברות עם גוגל.';
        });

        onAuthStateChanged(auth, async (user) => {
            appState.currentUser = user;
            if (user && appState.currentView === 'auth') {
                appState.currentView = 'dashboard';
            } else if (!user) {
                appState.currentView = 'auth';
            }
            // ודא שמירת פרטי משתמש (לא מוחק storeName קיים)
            if (user) {
                const userRef = doc(db, "users", user.uid);
                const userDoc = await getDoc(userRef);
                if (!userDoc.exists()) {
                    await setDoc(userRef, {
                        fullName: user.displayName || "No Name",
                        storeName: "Set Store Name Here",
                        email: user.email
                    });
                } else {
                    await setDoc(userRef, {
                        fullName: user.displayName || "No Name",
                        email: user.email
                    }, { merge: true });
                }
            }
            renderApp(user);
        });

    } catch (e) {
        console.error("App initialization error:", e);
        appRoot.innerHTML = `<div class="p-8 text-center text-red-500">שגיאה קריטית באתחול האפליקציה.</div>`;
    }
}

main();