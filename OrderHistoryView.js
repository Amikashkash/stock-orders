import { collection, query, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

function formatDate(date) {
    if (!date) return "לא ידוע";
    if (date.toDate) return date.toDate().toLocaleDateString('he-IL');
    if (date instanceof Date) return date.toLocaleDateString('he-IL');
    return new Date(date).toLocaleDateString('he-IL');
}

export const OrderHistoryView = {
    getHTML: function() {
        console.log('OrderHistoryView.getHTML called');
        return `
            <div>
                <div class="flex items-center mb-6">
                    <button data-action="show-view" data-view="dashboard" class="text-indigo-600 hover:text-indigo-800 p-2 rounded-full hover:bg-gray-100" title="חזרה לדשבורד">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l-4-4m0 0l-4 4m4-4v12" /></svg>
                    </button>
                    <h2 class="text-2xl font-semibold text-gray-800 mr-2">היסטוריית הזמנות</h2>
                </div>
                <div style="background: yellow; padding: 10px; margin: 10px 0; font-size: 12px;">
                    <strong>DEBUG INFO:</strong><br>
                    Time: ${new Date().toLocaleTimeString()}<br>
                    User Agent: ${navigator.userAgent}<br>
                    Screen: ${screen.width}x${screen.height}<br>
                    Viewport: ${window.innerWidth}x${window.innerHeight}<br>
                    Connection: ${navigator.connection ? navigator.connection.effectiveType : 'unknown'}
                </div>
                <div id="order-history-list" class="space-y-4">
                    <div class="text-center text-gray-500">טוען הזמנות...</div>
                </div>
            </div>
        `;
    },
    init: async function(db, showView) {
        console.log('OrderHistoryView.init called with:', db, showView);
        const list = document.getElementById('order-history-list');
        if (!list) {
            console.error('Could not find order-history-list element');
            return;
        }
        
        list.innerHTML = `
            <div class="text-center text-blue-500">DEBUG: init function started...</div>
            <div style="background: lightblue; padding: 5px; margin: 5px 0; font-size: 12px;">
                Auth check: ${window.currentUser ? 'User logged in: ' + window.currentUser.email : 'No user logged in'}<br>
                DB check: ${db ? 'Database connected' : 'Database NOT connected'}
            </div>
        `;
        
        // Add a delay to see if it's a timing issue
        setTimeout(async () => {
            try {
                console.log('Starting database query...');
                list.innerHTML = `<div class="text-center text-blue-500">DEBUG: Creating query...</div>`;
                
                if (!db) {
                    list.innerHTML = `<div class="text-red-500">ERROR: Database not initialized</div>`;
                    return;
                }
                
                const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
                console.log('Query created, fetching...');
                list.innerHTML = `<div class="text-center text-blue-500">DEBUG: Fetching data...</div>`;
                
                const snap = await getDocs(q);
                console.log('Data fetched, processing...', snap.size, 'orders');
                
                if (snap.empty) {
                    list.innerHTML = `<div class="text-center text-gray-500">אין הזמנות להציג.</div>`;
                    return;
                }

                list.innerHTML = `<div class="text-center text-green-500">SUCCESS: Found ${snap.size} orders, rendering...</div>`;
                
                setTimeout(() => {
                    list.innerHTML = "";
                    snap.forEach(docSnap => {
                        const order = docSnap.data();
                        const storeName = (order.storeName && order.storeName !== "Set Store Name Here") ? order.storeName : "לא ידוע";
                        const statusText = getStatusText(order.status);
                        const statusColor = getStatusColor(order.status);
                        const pickedAtStr = order.pickedAt ? formatDate(order.pickedAt) : "לא הושלמה";

                        list.innerHTML += `
                            <div class="border rounded p-4 bg-white shadow">
                                <div class="flex justify-between items-start mb-2">
                                    <div>
                                        <div class="font-bold">הזמנה #${docSnap.id.substring(0, 6)}</div>
                                        <div class="text-sm text-gray-500">חנות: ${storeName}</div>
                                        <div class="text-sm text-gray-500">הוזמנה ע"י: ${order.createdByName || "לא ידוע"}</div>
                                        <div class="text-sm text-gray-500">תאריך: ${formatDate(order.createdAt)}</div>
                                        <div class="text-sm text-gray-500">הושלמה: ${pickedAtStr}</div>
                                    </div>
                                    <div class="text-left">
                                        <span class="px-2 py-1 rounded text-sm ${statusColor}">${statusText}</span>
                                        <button data-action="show-pick-order-details" data-order-id="${docSnap.id}" class="block mt-2 text-blue-600 hover:underline text-sm">צפה בפרטים</button>
                                    </div>
                                </div>
                            </div>
                        `;
                    });

                    list.addEventListener('click', e => {
                        const btn = e.target.closest('button[data-action="show-pick-order-details"]');
                        if (btn) {
                            console.log('Order details clicked:', btn.dataset.orderId);
                            showView('pick-order-details', { orderId: btn.dataset.orderId, readOnly: true, fromView: 'order-history' });
                        }
                    });
                    
                    console.log('Orders rendered successfully');
                }, 500);

            } catch (error) {
                console.error("Error loading order history:", error);
                list.innerHTML = `
                    <div class="text-red-500 text-center p-4">
                        <h3 class="font-bold">שגיאה בטעינת ההזמנות</h3>
                        <p class="text-sm">${error.message}</p>
                        <p class="text-xs">קוד שגיאה: ${error.code || 'לא ידוע'}</p>
                        <button onclick="location.reload()" class="mt-2 bg-blue-500 text-white px-3 py-1 rounded">רענן דף</button>
                    </div>`;
            }
        }, 1000);
    }
};

function getStatusText(status) {
    switch (status) {
        case "pending": return "ממתין לליקוט";
        case "in-progress": return "בתהליך ליקוט";
        case "picked": return "הושלם";
        case "draft": return "טיוטה";
        default: return status || "לא ידוע";
    }
}

function getStatusColor(status) {
    switch (status) {
        case "pending": return "bg-yellow-100 text-yellow-800";
        case "in-progress": return "bg-blue-100 text-blue-800";
        case "picked": return "bg-green-100 text-green-800";
        case "draft": return "bg-gray-100 text-gray-800";
        default: return "bg-gray-100 text-gray-800";
    }
}
