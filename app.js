import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithRedirect, getRedirectResult, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { AuthView } from './AuthView.js';
import { DashboardView } from './DashboardView.js';
import { AddProductView } from './AddProductView.js';
import { EditProductView } from './EditProductView.js';
import { CreateOrderView } from './CreateOrderView.js';
import { PickingOrdersView } from './PickingOrdersView.js';
import { PickOrderDetailsView } from './PickOrderDetailsView.js';

// ===================================
// Firebase Configuration
// ===================================
const firebaseConfig = {
    apiKey: "AIzaSyCdAYpf-yICDIHVaqZtRhTk14xV5IfewF4",
    authDomain: "stock-orders-75be0.firebaseapp.com",
    projectId: "stock-orders-75be0",
    storageBucket: "stock-orders-75be0.appspot.com",
    messagingSenderId: "637582925650",
    appId: "1:637582925650:web:23e1626b00db6eca30e48b",
    measurementId: "G-71PT1GXC8R"
};

// ===================================
// Globals & State
// ===================================
let auth, db;
const appRoot = document.getElementById('app-root');
const appState = {
    currentUser: null,
    currentView: 'dashboard', 
    editingProductId: null,
    pickingOrderId: null,
    listeners: [],
};

// ===================================
// Application Router & Renderer
// ===================================

function showView(viewName, params = {}) {
    appState.currentView = viewName;
    if (params && params.productId) appState.editingProductId = params.productId;
    if (params && params.orderId) appState.pickingOrderId = params.orderId;
    renderApp(appState.currentUser);
}

function renderApp(user) {
    if (!appRoot) return;
    appState.listeners.forEach(unsub => unsub());
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
        
        switch (appState.currentView) {
            case 'dashboard':
            default:
                mainContent.innerHTML = DashboardView.getHTML();
                appState.listeners = DashboardView.init(db);
                break;
            case 'add-product':
                 mainContent.innerHTML = AddProductView.getHTML();
                 AddProductView.init(db, showView);
                 break;
            case 'edit-product':
                const productToEdit = DashboardView.getProductFromCache(appState.editingProductId);
                mainContent.innerHTML = EditProductView.getHTML(productToEdit);
                EditProductView.init(db, showView);
                break;
             case 'create-order':
                mainContent.innerHTML = CreateOrderView.getHTML();
                appState.listeners = CreateOrderView.init(db, auth, showView);
                break;
             case 'picking-orders':
                mainContent.innerHTML = PickingOrdersView.getHTML();
                appState.listeners = PickingOrdersView.init(db);
                break;
             case 'pick-order-details':
                const orderData = PickingOrdersView.getOrderFromCache(appState.pickingOrderId);
                mainContent.innerHTML = PickOrderDetailsView.getHTML(appState.pickingOrderId, orderData);
                appState.listeners = PickOrderDetailsView.init(db,  appState.pickingOrderId );
                break;
        }

        document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
        
    } else {
        appRoot.innerHTML = AuthView.getHTML();
        AuthView.attachEventListeners(auth, GoogleAuthProvider, signInWithRedirect);
    }
}


// ===================================
// Initialization
// ===================================
function main() {
    try {
        const app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);

        // --- התיקון כאן: מנהל אירועים מרכזי אחד לכל האפליקציה ---
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
            if(messageArea) messageArea.textContent = 'שגיאה בהתחברות עם גוגל.';
        });

        onAuthStateChanged(auth, (user) => {
            appState.currentUser = user;
            if (user && appState.currentView === 'auth') {
                appState.currentView = 'dashboard';
            } else if (!user) {
                appState.currentView = 'auth';
            }
            renderApp(user);
        });

    } catch (e) {
        console.error("Initialization Failed:", e);
        appRoot.innerHTML = `<div class="p-8 text-center text-red-500">שגיאה קריטית באתחול האפליקציה.</div>`;
    }
}

main();
