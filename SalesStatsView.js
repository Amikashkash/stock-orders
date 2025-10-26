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
            // Load products first
            const productsSnapshot = await getDocs(collection(db, "products"));
            const productsMap = {};
            productsSnapshot.forEach(doc => {
                productsMap[doc.id] = { id: doc.id, ...doc.data() };
            });

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
            
            // Track product statistics
            const productStats = {}; // productId => { quantity, orders }

            // Process orders
            for (const orderDoc of snap.docs) {
                const order = orderDoc.data();
                totalOrders++;
                
                if (order.status === "picked") completedOrders++;
                if (order.status === "pending" || order.status === "in-progress") pendingOrders++;
                
                const orderDate = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
                if (orderDate >= thisMonth) ordersThisMonth++;
                if (orderDate.toDateString() === today.toDateString()) ordersToday++;
                
                // Collect product stats from order items
                const itemsSnapshot = await getDocs(collection(db, "orders", orderDoc.id, "orderItems"));
                itemsSnapshot.forEach(itemDoc => {
                    const item = itemDoc.data();
                    const productId = item.productId;
                    const quantity = item.quantityOrdered || 0;
                    
                    if (!productStats[productId]) {
                        productStats[productId] = { quantity: 0, orders: 0 };
                    }
                    productStats[productId].quantity += quantity;
                    productStats[productId].orders += 1;
                });
            }
            
            // Sort products by quantity (most ordered first)
            const sortedProducts = Object.entries(productStats)
                .map(([productId, stats]) => ({
                    productId,
                    product: productsMap[productId],
                    ...stats
                }))
                .filter(p => p.product) // Only include products that exist
                .sort((a, b) => b.quantity - a.quantity);
            
            const topProducts = sortedProducts.slice(0, 10); // Top 10
            const totalProductsOrdered = sortedProducts.reduce((sum, p) => sum + p.quantity, 0);

            let html = `
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                    <div class="bg-blue-100 p-4 rounded shadow">
                        <h3 class="font-bold text-blue-800">סה"כ הזמנות</h3>
                        <p class="text-2xl font-bold text-blue-900">${totalOrders}</p>
                    </div>
                    <div class="bg-green-100 p-4 rounded shadow">
                        <h3 class="font-bold text-green-800">הושלמו</h3>
                        <p class="text-2xl font-bold text-green-900">${completedOrders}</p>
                    </div>
                    <div class="bg-yellow-100 p-4 rounded shadow">
                        <h3 class="font-bold text-yellow-800">ממתינות</h3>
                        <p class="text-2xl font-bold text-yellow-900">${pendingOrders}</p>
                    </div>
                    <div class="bg-purple-100 p-4 rounded shadow">
                        <h3 class="font-bold text-purple-800">החודש</h3>
                        <p class="text-2xl font-bold text-purple-900">${ordersThisMonth}</p>
                    </div>
                    <div class="bg-orange-100 p-4 rounded shadow">
                        <h3 class="font-bold text-orange-800">סה"כ פריטים</h3>
                        <p class="text-2xl font-bold text-orange-900">${totalProductsOrdered}</p>
                    </div>
                </div>
                
                <!-- Top Products Section -->
                <div class="bg-white p-6 rounded-lg shadow mb-6">
                    <h3 class="text-xl font-bold mb-4 flex items-center">
                        <svg class="w-6 h-6 ml-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                        </svg>
                        המוצרים המובילים (Top 10)
                    </h3>
                    <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                                    <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">שם מוצר</th>
                                    <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">מותג</th>
                                    <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">כמות כוללת</th>
                                    <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">מס' הזמנות</th>
                                    <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">ממוצע להזמנה</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200">
            `;
            
            topProducts.forEach((item, index) => {
                const avgPerOrder = (item.quantity / item.orders).toFixed(1);
                const isTop3 = index < 3;
                const medalEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
                
                html += `
                    <tr class="${isTop3 ? 'bg-yellow-50' : ''}">
                        <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                            ${medalEmoji} ${index + 1}
                        </td>
                        <td class="px-4 py-3 text-sm text-gray-900 font-semibold">
                            ${item.product.name || 'לא ידוע'}
                        </td>
                        <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            ${item.product.brand || '-'}
                        </td>
                        <td class="px-4 py-3 whitespace-nowrap text-sm font-bold text-green-600">
                            ${item.quantity}
                        </td>
                        <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            ${item.orders}
                        </td>
                        <td class="px-4 py-3 whitespace-nowrap text-sm text-blue-600">
                            ${avgPerOrder}
                        </td>
                    </tr>
                `;
            });
            
            html += `
                            </tbody>
                        </table>
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