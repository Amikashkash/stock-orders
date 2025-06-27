import { collection, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

export const PickingOrdersView = {
    getHTML: function() {
        return `
            <div>
                <div class="flex items-center mb-6">
                    <button data-action="show-view" data-view="dashboard" class="text-indigo-600 hover:text-indigo-800 p-2 rounded-full hover:bg-gray-100" title="חזרה לדשבורד">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l-4-4m0 0l-4 4m4-4v12" /></svg>
                    </button>
                    <h2 class="text-2xl font-semibold text-gray-800 mr-2">הזמנות לליקוט</h2>
                </div>
                <div id="picking-orders-list" class="space-y-4">
                    <div class="text-center text-gray-500">טוען הזמנות...</div>
                </div>
            </div>
        `;
    },
    init: function(db, showView) {
        const list = document.getElementById('picking-orders-list');
        list.innerHTML = `<div class="text-center text-gray-500">טוען הזמנות...</div>`;

        // Query only orders that are not picked yet
        const q = query(collection(db, "orders"), where("status", "in", ["pending", "in-progress"]));
        const unsubscribe = onSnapshot(q, (snap) => {
            if (snap.empty) {
                list.innerHTML = `<div class="text-center text-gray-500">אין הזמנות לליקוט כרגע.</div>`;
                return;
            }
            list.innerHTML = "";
            snap.forEach(docSnap => {
                const order = docSnap.data();
                const storeName = (order.storeName && order.storeName !== "Set Store Name Here") ? order.storeName : "לא ידוע";
                const createdByName = order.createdByName || "לא ידוע";
                list.innerHTML += `
                    <div class="border rounded p-4 bg-white shadow flex flex-col gap-2">
                        <div class="flex justify-between items-center">
                            <div>
                                <div class="font-bold">הזמנה #${docSnap.id.substring(0, 6)}</div>
                                <div class="text-sm text-gray-500">חנות: ${storeName}</div>
                                <div class="text-sm text-gray-500">הוזמן ע"י: ${createdByName}</div>
                            </div>
                            <button data-action="show-pick-order-details" data-order-id="${docSnap.id}" class="text-blue-600 hover:underline">פרטי ליקוט</button>
                        </div>
                        ${order.notes ? `<div class="mt-2 text-yellow-800 bg-yellow-100 p-2 rounded">${order.notes}</div>` : ""}
                    </div>
                `;
            });
        });

        // Delegate click for details button
        list.addEventListener('click', e => {
            const btn = e.target.closest('button[data-action="show-pick-order-details"]');
            if (btn) {
                showView('pick-order-details', { orderId: btn.dataset.orderId });
            }
        });

        // Optional: cache orders for quick access in details view
        this._orderCache = {};
        onSnapshot(q, (snap) => {
            snap.forEach(docSnap => {
                this._orderCache[docSnap.id] = docSnap.data();
            });
        });

        return [unsubscribe];
    },
    getOrderFromCache: function(orderId) {
        return this._orderCache ? { [orderId]: this._orderCache[orderId] } : {};
    }
};