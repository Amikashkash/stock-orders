# Development Guide - Stock Orders App

## Architecture Overview

This is a vanilla JavaScript PWA (Progressive Web App) with Firebase backend.

**Stack:**
- Vanilla JavaScript (ES6 modules)
- Firebase (Firestore + Authentication)
- Tailwind CSS
- Service Worker for offline support

## Project Structure

stock-orders/ ├── app.js # Main app logic, routing ├── index.html # Entry point ├── style.css # Custom styles ├── sw.js # Service worker ├── manifest.json # PWA manifest ├── StateManager.js # Reactive state management ├── utils.js # Common utilities ├── *View.js files # View modules │ ├── DashboardView.js │ ├── CreateOrderView.js │ ├── OrderHistoryView.js │ ├── PickingOrdersView.js │ └── ... └── icons/ # App icons


## View Pattern

Each view is a JavaScript module with this structure:

```javascript
export const MyView = {
    getHTML: function() {
        return `<div>...</div>`;
    },
    
    init: async function(db, auth, showView) {
        // 1. Load data from Firebase
        // 2. Render UI
        // 3. Attach event listeners
    }
};

import { createState } from './StateManager.js';

const [orders, setOrders] = createState([]);

// Subscribe to changes
orders.subscribe((newOrders) => {
    renderOrders(newOrders);
});

// Update state
setOrders([...newOrders]);

users/
  {userId}/
    name: string
    email: string
    role: string

products/
  {productId}/
    name: string
    brand: string
    category: string
    pricePerUnit: number
    unitsPerPackage: number

orders/
  {orderId}/
    customerName: string
    status: string (pending|picking|completed)
    createdBy: userId
    createdAt: timestamp
    notes: string
    
    orderItems/ (subcollection)
      {itemId}/
        productId: string
        quantityOrdered: number
        quantityPicked: number


// Get pending orders
const q = query(
    collection(db, "orders"),
    where("status", "==", "pending"),
    orderBy("createdAt", "desc")
);

// Get orders for current user
const q = query(
    collection(db, "orders"),
    where("createdBy", "==", auth.currentUser.uid)
);

// Get order items (subcollection)
const items = await getDocs(
    collection(db, "orders", orderId, "orderItems")
);

export const NewView = {
    getHTML: function() {
        return `
            <div class="p-4">
                <h2>New View</h2>
                <div id="new-view-content"></div>
            </div>
        `;
    },
    
    init: async function(db, auth, showView) {
        console.log('New view initialized');
    }
};

import { NewView } from './NewView.js';

const views = {
    'new-view': NewView,
    // ...
};

<button data-action="show-view" data-view="new-view">
    New View
</button>

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /newCollection/{docId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth.uid == resource.data.createdBy;
    }
  }
}

Debugging
Check Console:

Open DevTools (F12)
Look for errors in Console tab
Firebase Connection:

console.log('Auth user:', auth.currentUser);
console.log('Firestore:', db);

// Service Worker:

// Application tab > Service Workers
// Click "Update" to get latest version
// Check "Update on reload"
// Clear Cache:

console.log('Auth user:', auth.currentUser);
console.log('Firestore:', db);


Performance Tips
Pagination: Load data in chunks
Indexes: Create Firestore indexes for complex queries
Cache: Use Service Worker to cache static assets
Lazy Load: Only load data when view is shown
Security
Authentication: Always check auth.currentUser
Firestore Rules: Restrict access by user
Validation: Validate data before saving
Sanitization: Don't trust user input
Troubleshooting
"Permission Denied" errors
Check Firestore security rules
Verify user is authenticated
Check if user has correct permissions
Service Worker not updating
Increment cache version in sw.js
Hard refresh (Ctrl+Shift+R)
Clear site data in DevTools
Data not showing
Check console for errors
Verify Firebase connection
Check query filters
Getting Help
Check console errors first
Review Firebase logs
Check QUICK_REFERENCE.md for code snippets
Review similar views for patterns

