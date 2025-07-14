import { collection, query, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

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
        `;
    },
    init: async function(db, showView) {
        const list = document.getElementById('order-history-list');
        list.innerHTML = `<div class="text-center text-gray-500">טוען הזמנות...</div>`;

        try {
            // שאילתה לכל ההזמנות, ממוינות לפי תאריך יצירה
            const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
            const snap = await getDocs(q);

            if (snap.empty) {
                list.innerHTML = `<div class="text-center text-gray-500">אין הזמנות להציג.</div>`;
                return;
            }

            list.innerHTML = "";
            snap.forEach(docSnap => {
                const order = docSnap.data();
                const storeName = (order.storeName && order.storeName !== "Set Store Name Here") ? order.storeName : "לא ידוע";
                const createdByName = order.createdByName || "לא ידוע";
                const statusText = getStatusText(order.status);
                const statusColor = getStatusColor(order.status);

                list.innerHTML += `
                    <div class="border rounded p-4 bg-white shadow">
                        <div class="flex justify-between items-start mb-2">
                            <div>
                                <div class="font-bold">הזמנה #${docSnap.id.substring(0, 6)}</div>
                                <div class="text-sm text-gray-500">חנות: ${storeName}</div>
<<<<<<< HEAD
                                <div class="text-sm text-gray-500">הוזמן ע"י: ${createdByName}</div>
                                <div class="text-sm text-gray-500">תאריך: ${formatDate(order.createdAt)}</div>
                            </div>
                            <div class="text-left">
                                <span class="px-2 py-1 rounded text-sm ${statusColor}">${statusText}</span>
                                <button data-action="show-pick-order-details" data-order-id="${docSnap.id}" class="block mt-2 text-blue-600 hover:underline text-sm">צפה בפרטים</button>
=======
                                <div class="text-sm text-gray-500">הוזמנה ע"י: ${order.createdByName || "לא ידוע"}</div>
                                <div class="text-sm text-gray-500">הושלמה: ${pickedAtStr}</div>
                                ${order.notes ? `<div class="text-sm text-blue-600 mt-1"><strong>הערות הזמנה:</strong> ${order.notes}</div>` : ''}
                                ${order.pickingNotes ? `<div class="text-sm text-orange-600 mt-1"><strong>הערות ליקוט:</strong> ${order.pickingNotes}</div>` : ''}
>>>>>>> 43770c0a62e482398958ad7fbde272291d9a488c
                            </div>
                        </div>
                        ${order.notes ? `<div class="mt-2 text-yellow-800 bg-yellow-100 p-2 rounded text-sm">${order.notes}</div>` : ""}
                    </div>
                `;
            });

            // מאזין לכפתורי "צפה בפרטים"
            list.addEventListener('click', e => {
                const btn = e.target.closest('button[data-action="show-pick-order-details"]');
                if (btn) {
<<<<<<< HEAD
                    showView('pick-order-details', { orderId: btn.dataset.orderId });
=======
                    showView('pick-order-details', { orderId: btn.dataset.orderId, readOnly: true, fromView: 'order-history' });
>>>>>>> 43770c0a62e482398958ad7fbde272291d9a488c
                }
            });

        } catch (error) {
            console.error("Error loading order history:", error);
            list.innerHTML = `<div class="text-red-500 text-center">שגיאה בטעינת ההזמנות: ${error.message}</div>`;
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
