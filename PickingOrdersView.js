import { collection, query, onSnapshot, where } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

let ordersCache = {};
let unsubscribeFromOrders = null;

// --- Private Functions ---

function listenToOrders(db) {
    const container = document.getElementById('picking-orders-list');
    if (!container) return [];

    const q = query(collection(db, "orders"), where("status", "==", "pending"));
    unsubscribeFromOrders = onSnapshot(q, (querySnapshot) => {
        container.innerHTML = '';
        ordersCache = {};

        if (querySnapshot.empty) {
            container.innerHTML = `<p class="text-gray-500 text-center">אין הזמנות חדשות לליקוט.</p>`;
            return;
        }

        querySnapshot.forEach((doc) => {
            const order = doc.data();
            ordersCache[doc.id] = order;
            const orderCard = document.createElement('div');
            orderCard.className = "bg-white border rounded-lg p-4 flex justify-between items-center shadow-sm hover:shadow-md transition-shadow";
            orderCard.innerHTML = `
                <div>
                    <p class="font-bold text-gray-800">הזמנה #${doc.id.substring(0, 6)}</p>
                    <p class="text-sm text-gray-600">חנות: ${order.storeId}</p>
                    <p class="text-sm text-gray-500">תאריך: ${order.orderDate ? new Date(order.orderDate.seconds * 1000).toLocaleDateString('he-IL') : 'לא ידוע'}</p>
                    ${order.notes ? `<p class="text-sm text-red-600 mt-2"><strong>הערה:</strong> ${order.notes}</p>` : ''}
                </div>
                <button data-action="show-pick-order-details" data-order-id="${doc.id}" class="bg-blue-500 text-white font-semibold py-2 px-4 rounded-md hover:bg-blue-600">התחל ליקוט</button>
            `;
            container.appendChild(orderCard);
        });
    });

    return [unsubscribeFromOrders];
}

// --- Public Interface ---
export const PickingOrdersView = {
    getHTML: function() {
        return `
            <div id="picking-orders-view">
                <div class="flex items-center mb-6">
                    <button data-action="show-view" data-view="dashboard" class="text-indigo-600 hover:text-indigo-800 p-2 rounded-full hover:bg-gray-100">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                    </button>
                    <h2 class="text-2xl font-semibold text-gray-800 mr-2">הזמנות לליקוט</h2>
                </div>
                <div id="picking-orders-list" class="space-y-4">
                     <div class="text-center text-gray-500">טוען הזמנות...</div>
                </div>
            </div>
        `;
    },
    init: function(db, showViewCallback) {
        const listeners = listenToOrders(db); 

        const container = document.getElementById('picking-orders-view');
        if (container) {
            container.addEventListener('click', (e) => {
                const button = e.target.closest('button');
                if (!button || !button.dataset.action) return;

                const { action, orderId, view } = button.dataset;
                
                if (view) {
                    showViewCallback(view);
                } else if (action === 'show-pick-order-details') {
                    showViewCallback('pick-order-details', { orderId: orderId });
                }
            });
        }
        return listeners;
    },
    getOrderFromCache: function(orderId) {
        return ordersCache[orderId];
    }
};
