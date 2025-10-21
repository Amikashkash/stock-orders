import { collection, query, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { getRelativeDate, groupBy, isSameDay } from './utils.js';

function formatDate(date) {
    if (!date) return "לא ידוע";
    if (date.toDate) return date.toDate().toLocaleDateString('he-IL');
    if (date instanceof Date) return date.toLocaleDateString('he-IL');
    return new Date(date).toLocaleDateString('he-IL');
}

export const OrderHistoryView = {
    getHTML: function() {
        return `
            <div>
                <div class="flex items-center mb-6">
                    <button data-action="show-view" data-view="dashboard" class="text-indigo-600 hover:text-indigo-800 p-2 rounded-full hover:bg-gray-100" title="חזרה לדשבורד">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l-4-4m0 0l-4 4m4-4v12" /></svg>
                    </button>
                    <h2 class="text-2xl font-semibold text-gray-800 mr-2">היסטוריית הזמנות</h2>
                </div>
                <div id="order-history-list" class="space-y-4">
                    <div class="text-center text-gray-500">טוען הזמנות...</div>
                </div>
            </div>
            </div>
        `;
    },
    init: async function(db, auth, showView) {
        const list = document.getElementById('order-history-list');
        if (!list) {
            console.error('Could not find order-history-list element');
            return;
        }
        
        try {
            if (!db) {
                list.innerHTML = `<div class="text-red-500 text-center">שגיאה: מסד הנתונים לא זמין</div>`;
                return;
            }
            
            const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
            const snap = await getDocs(q);
            
            if (snap.empty) {
                list.innerHTML = `<div class="text-center text-gray-500">אין הזמנות להציג.</div>`;
                return;
            }

            // Group orders by date
            const orders = [];
            snap.forEach(docSnap => {
                orders.push({
                    id: docSnap.id,
                    ...docSnap.data()
                });
            });

            // Group by date
            const groupedOrders = groupBy(orders, (order) => {
                const date = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
                return date.toDateString(); // Group by day
            });

            // Render grouped orders
            list.innerHTML = "";
            
            // Sort date groups (most recent first)
            const sortedDateKeys = Object.keys(groupedOrders).sort((a, b) => new Date(b) - new Date(a));
            
            sortedDateKeys.forEach(dateKey => {
                const dayOrders = groupedOrders[dateKey];
                const sampleDate = dayOrders[0].createdAt?.toDate ? dayOrders[0].createdAt.toDate() : new Date(dayOrders[0].createdAt);
                const relativeDate = getRelativeDate(sampleDate);
                
                // Date header
                list.innerHTML += `
                    <div class="sticky top-16 bg-blue-50 border-l-4 border-blue-400 p-3 mb-3 rounded-r-lg z-10 shadow-sm">
                        <h3 class="font-bold text-blue-800 text-lg flex items-center gap-2">
                            📅 ${relativeDate}
                            <span class="text-sm font-normal text-blue-600">(${dayOrders.length} הזמנות)</span>
                        </h3>
                    </div>
                `;
                
                // Orders for this date
                dayOrders.forEach(order => {
                    const storeName = (order.storeName && order.storeName !== "Set Store Name Here") ? order.storeName : "לא ידוע";
                    const statusText = getStatusText(order.status);
                    const statusColor = getStatusColor(order.status);
                    const pickedAtStr = order.pickedAt ? formatDate(order.pickedAt) : "לא הושלמה";
                    
                    // Check if order can be edited
                    const canEdit = order.status === 'pending' && 
                                   auth && auth.currentUser && 
                                   order.createdBy === auth.currentUser.uid;

                    list.innerHTML += `
                        <div class="border rounded p-4 bg-white shadow mb-3 mr-4">
                            <div class="flex justify-between items-start mb-2">
                                <div>
                                    <div class="font-bold">הזמנה #${order.displayId || order.id.substring(0, 6)}</div>
                                    <div class="text-sm text-gray-500">חנות: ${storeName}</div>
                                    <div class="text-sm text-gray-500">הוזמנה ע"י: ${order.createdByName || "לא ידוע"}</div>
                                    <div class="text-sm text-gray-500">תאריך: ${formatDate(order.createdAt)}</div>
                                    <div class="text-sm text-gray-500">הושלמה: ${pickedAtStr}</div>
                                </div>
                                <div class="text-left">
                                    <span class="px-2 py-1 rounded text-sm ${statusColor}">${statusText}</span>
                                    <div class="mt-2 space-y-1">
                                        <button data-action="show-pick-order-details" data-order-id="${order.id}" class="block text-blue-600 hover:underline text-sm">צפה בפרטים</button>
                                        ${canEdit ? `
                                            <button data-action="edit-order" data-order-id="${order.id}" class="block text-green-600 hover:underline text-sm font-medium">
                                                ✏️ ערוך הזמנה
                                            </button>
                                        ` : ''}
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                });
            });

            list.addEventListener('click', e => {
                const btn = e.target.closest('button[data-action="show-pick-order-details"]');
                if (btn) {
                    showView('pick-order-details', { orderId: btn.dataset.orderId, readOnly: true, fromView: 'order-history' });
                    return;
                }
                
                const editBtn = e.target.closest('button[data-action="edit-order"]');
                if (editBtn) {
                    showView('edit-order', { orderId: editBtn.dataset.orderId, fromView: 'order-history' });
                }
            });

        } catch (error) {
            console.error("Error loading order history:", error);
            list.innerHTML = `
                <div class="text-red-500 text-center p-4">
                    <h3 class="font-bold">שגיאה בטעינת ההזמנות</h3>
                    <p class="text-sm">${error.message}</p>
                    <button onclick="location.reload()" class="mt-2 bg-blue-500 text-white px-3 py-1 rounded">רענן דף</button>
                </div>`;
        }
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
