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
            // שאילתה לכל ההזמנות
            const ordersQuery = query(
                collection(db, "orders"), 
                orderBy("createdAt", "desc")
            );
            const ordersSnap = await getDocs(ordersQuery);

            // שאילתה לכל המוצרים
            const productsQuery = collection(db, "products");
            const productsSnap = await getDocs(productsQuery);

            if (ordersSnap.empty) {
                content.innerHTML = `<div class="text-center text-gray-500">אין עדיין הזמנות במערכת.</div>`;
                return;
            }

            // יצירת מפה של מוצרים
            const productsMap = {};
            productsSnap.forEach(doc => {
                productsMap[doc.id] = doc.data();
            });

            let totalOrders = 0;
            let completedOrders = 0;
            let pendingOrders = 0;
            let ordersThisMonth = 0;
            let ordersToday = 0;
            const today = new Date();
            const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

            // מפה לאיסוף נתוני מוצרים
            const productStats = {};

            // עיבוד ההזמנות
            for (const orderDoc of ordersSnap.docs) {
                const order = orderDoc.data();
                totalOrders++;
                
                if (order.status === "picked") completedOrders++;
                if (order.status === "pending" || order.status === "in-progress") pendingOrders++;
                
                const orderDate = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
                if (orderDate >= thisMonth) ordersThisMonth++;
                if (orderDate.toDateString() === today.toDateString()) ordersToday++;

                // איסוף נתוני פריטים להזמנה הזאת
                try {
                    const itemsQuery = collection(db, "orders", orderDoc.id, "orderItems");
                    const itemsSnap = await getDocs(itemsQuery);
                    
                    itemsSnap.forEach(itemDoc => {
                        const item = itemDoc.data();
                        const productId = item.productId;
                        const quantity = item.quantityOrdered || 0;
                        
                        if (!productStats[productId]) {
                            productStats[productId] = {
                                totalOrdered: 0,
                                ordersCount: 0,
                                lastOrderDate: null
                            };
                        }
                        
                        productStats[productId].totalOrdered += quantity;
                        productStats[productId].ordersCount++;
                        
                        if (!productStats[productId].lastOrderDate || orderDate > productStats[productId].lastOrderDate) {
                            productStats[productId].lastOrderDate = orderDate;
                        }
                    });
                } catch (error) {
                    console.warn("Error loading items for order:", orderDoc.id, error);
                }
            }

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
                    <h3 class="font-bold mb-4 text-lg">הזמנות לפי מוצר</h3>
                    <div class="overflow-x-auto">
                        <table class="w-full table-auto">
                            <thead>
                                <tr class="bg-gray-50">
                                    <th class="px-4 py-2 text-right font-semibold text-gray-700">מוצר</th>
                                    <th class="px-4 py-2 text-right font-semibold text-gray-700">מותג</th>
                                    <th class="px-4 py-2 text-center font-semibold text-gray-700">כמות כוללת</th>
                                    <th class="px-4 py-2 text-center font-semibold text-gray-700">מספר הזמנות</th>
                                    <th class="px-4 py-2 text-center font-semibold text-gray-700">הזמנה אחרונה</th>
                                </tr>
                            </thead>
                            <tbody>
            `;

            // מיון המוצרים לפי כמות כוללת (מהגבוה לנמוך)
            const sortedProducts = Object.entries(productStats)
                .sort(([,a], [,b]) => b.totalOrdered - a.totalOrdered);

            if (sortedProducts.length === 0) {
                html += `
                    <tr>
                        <td colspan="5" class="px-4 py-8 text-center text-gray-500">
                            אין עדיין נתוני הזמנות למוצרים
                        </td>
                    </tr>
                `;
            } else {
                sortedProducts.forEach(([productId, stats]) => {
                    const product = productsMap[productId];
                    const productName = product?.name || `מוצר ${productId}`;
                    const productBrand = product?.brand || "לא צויין";
                    const lastOrderDateStr = stats.lastOrderDate ? 
                        stats.lastOrderDate.toLocaleDateString('he-IL') : "לא ידוע";
                    
                    // צבע רקע לפי פופולריות
                    let rowClass = "";
                    if (stats.totalOrdered >= 50) {
                        rowClass = "bg-green-50";
                    } else if (stats.totalOrdered >= 20) {
                        rowClass = "bg-yellow-50";
                    } else if (stats.totalOrdered >= 10) {
                        rowClass = "bg-blue-50";
                    }

                    html += `
                        <tr class="${rowClass} border-b hover:bg-gray-50">
                            <td class="px-4 py-3 font-medium">${productName}</td>
                            <td class="px-4 py-3 text-gray-600">${productBrand}</td>
                            <td class="px-4 py-3 text-center font-bold text-lg">${stats.totalOrdered}</td>
                            <td class="px-4 py-3 text-center">${stats.ordersCount}</td>
                            <td class="px-4 py-3 text-center text-sm text-gray-500">${lastOrderDateStr}</td>
                        </tr>
                    `;
                });
            }

            html += `
                        </tbody>
                    </table>
                    </div>
                    
                    <div class="mt-4 text-sm text-gray-500">
                        <div class="flex flex-wrap gap-4">
                            <div class="flex items-center">
                                <div class="w-4 h-4 bg-green-50 border mr-2"></div>
                                <span>מוצרים פופולריים (50+ יח')</span>
                            </div>
                            <div class="flex items-center">
                                <div class="w-4 h-4 bg-yellow-50 border mr-2"></div>
                                <span>מוצרים נמכרים (20-49 יח')</span>
                            </div>
                            <div class="flex items-center">
                                <div class="w-4 h-4 bg-blue-50 border mr-2"></div>
                                <span>מוצרים מזדמנים (10-19 יח')</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            content.innerHTML = html;
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