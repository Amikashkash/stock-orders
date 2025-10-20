import { collection, getDocs, query, where, orderBy } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

function formatDate(date) {
    if (!date) return "לא ידוע";
    if (date.toDate) return date.toDate().toLocaleDateString('he-IL');
    if (date instanceof Date) return date.toLocaleDateString('he-IL');
    return new Date(date).toLocaleDateString('he-IL');
}

export const SalesStatsView = {
    getHTML: function() {
        return `
            <div>
                <div class="flex items-center mb-6">
                    <button data-action="show-view" data-view="dashboard" class="text-indigo-600 hover:text-indigo-800 p-2 rounded-full hover:bg-gray-100" title="חזרה לדשבורד">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l-4-4m0 0l-4 4m4-4v12" /></svg>
                    </button>
                    <h2 class="text-2xl font-semibold text-gray-800 mr-2">סטטיסטיקת מכירות</h2>
                </div>
                <div id="sales-stats-content" class="space-y-4">
                    <div class="text-center text-gray-500">טוען נתונים...</div>
                </div>
            </div>
        `;
    },
    init: async function(db, showView) {
        const content = document.getElementById('sales-stats-content');
        content.innerHTML = `<div class="text-center text-gray-500">טוען נתונים...</div>`;

        try {
            // שאילתה לכל ההזמנות (לא רק שהושלמו)
            const q = query(
                collection(db, "orders"), 
                orderBy("createdAt", "desc")
            );
            const snap = await getDocs(q);

            if (snap.empty) {
                content.innerHTML = `<div class="text-center text-gray-500">אין עדיין הזמנות במערכת.</div>`;
                return;
            }

            let totalOrders = 0;
            let completedOrders = 0;
            let pendingOrders = 0;
            let ordersThisMonth = 0;
            let ordersToday = 0;
            const today = new Date();
            const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

            snap.forEach(doc => {
                const order = doc.data();
                totalOrders++;
                
                if (order.status === "picked") completedOrders++;
                if (order.status === "pending" || order.status === "in-progress") pendingOrders++;
                
                const orderDate = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
                if (orderDate >= thisMonth) ordersThisMonth++;
                if (orderDate.toDateString() === today.toDateString()) ordersToday++;
            });

            let html = `
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div class="bg-blue-100 p-4 rounded shadow">
                        <h3 class="font-bold text-blue-800">סה"כ הזמנות</h3>
                        <p class="text-2xl font-bold text-blue-900">${totalOrders}</p>
                    </div>
                    <div class="bg-green-100 p-4 rounded shadow">
                        <h3 class="font-bold text-green-800">הזמנות שהושלמו</h3>
                        <p class="text-2xl font-bold text-green-900">${completedOrders}</p>
                    </div>
                    <div class="bg-yellow-100 p-4 rounded shadow">
                        <h3 class="font-bold text-yellow-800">הזמנות ממתינות</h3>
                        <p class="text-2xl font-bold text-yellow-900">${pendingOrders}</p>
                    </div>
                    <div class="bg-purple-100 p-4 rounded shadow">
                        <h3 class="font-bold text-purple-800">הזמנות החודש</h3>
                        <p class="text-2xl font-bold text-purple-900">${ordersThisMonth}</p>
                    </div>
                </div>
                <div class="bg-white p-4 rounded shadow">
                    <h3 class="font-bold mb-4">הזמנות אחרונות</h3>
                    <div class="space-y-2">
            `;

            let count = 0;
            snap.forEach(doc => {
                if (count >= 10) return; // הצג רק 10 אחרונות
                const order = doc.data();
                const statusText = getStatusText(order.status);
                const statusColor = getStatusColor(order.status);

                html += `
                    <div class="border-b pb-2">
                        <div class="flex justify-between items-center">
                            <div>
                                <span class="font-semibold">הזמנה #${doc.data().displayId || doc.id.substring(0, 6)}</span>
                                <span class="px-2 py-1 rounded text-xs ${statusColor} ml-2">${statusText}</span>
                            </div>
                            <span class="text-sm text-gray-500">${formatDate(order.createdAt)}</span>
                        </div>
                        <div class="text-sm text-gray-500">
                            חנות: ${order.storeName || "לא ידוע"} | 
                            הוזמן ע"י: ${order.createdByName || "לא ידוע"}
                        </div>
                    </div>
                `;
                count++;
            });

            html += `</div></div>`;
            content.innerHTML = html;

        } catch (error) {
            console.error("Error loading sales stats:", error);
            content.innerHTML = `<div class="text-red-500 text-center">שגיאה בטעינת הנתונים: ${error.message}</div>`;
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