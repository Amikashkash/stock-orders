import { collection, getDocs, query, where, Timestamp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

function formatDate(date) {
    if (!date) return '';
    const d = typeof date === 'object' && date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export const SalesStatsView = {
    getHTML: function() {
        const today = new Date();
        const weekAgo = new Date();
        weekAgo.setDate(today.getDate() - 7);
        return `
            <div>
                <div class="flex items-center mb-6">
                    <button data-action="show-view" data-view="dashboard" class="text-indigo-600 hover:text-indigo-800 p-2 rounded-full hover:bg-gray-100" title="חזרה לדשבורד">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l-4-4m0 0l-4 4m4-4v12" /></svg>
                    </button>
                    <h2 class="text-2xl font-semibold text-gray-800 mr-2">סטטיסטיקת מכירות</h2>
                </div>
                <form id="sales-stats-filter" class="flex gap-4 mb-6 flex-wrap">
                    <label>מתאריך: <input type="date" id="from-date" value="${weekAgo.toISOString().slice(0,10)}" class="input-style"></label>
                    <label>עד תאריך: <input type="date" id="to-date" value="${today.toISOString().slice(0,10)}" class="input-style"></label>
                    <button type="submit" class="bg-blue-600 text-white px-4 py-2 rounded-md">הצג</button>
                </form>
                <div id="sales-stats-list" class="space-y-4">
                    <div class="text-center text-gray-500">טוען נתונים...</div>
                </div>
            </div>
        `;
    },
    init: async function(db, showView) {
        const list = document.getElementById('sales-stats-list');
        const filterForm = document.getElementById('sales-stats-filter');

        async function loadStats(fromDate, toDate) {
            list.innerHTML = `<div class="text-center text-gray-500">טוען נתונים...</div>`;
            try {
                // שלוף את כל הלוגים בטווח תאריכים
                const fromTS = Timestamp.fromDate(new Date(fromDate));
                const toTS = Timestamp.fromDate(new Date(toDate + "T23:59:59"));
                const logsQ = query(
                    collection(db, "productSalesLogs"),
                    where("soldAt", ">=", fromTS),
                    where("soldAt", "<=", toTS)
                );
                const logsSnap = await getDocs(logsQ);

                // סכם לפי productId
                const stats = {};
                logsSnap.forEach(docSnap => {
                    const log = docSnap.data();
                    if (!stats[log.productId]) stats[log.productId] = { total: 0, last: null, weight: log.weight || null };
                    stats[log.productId].total += log.quantity;
                    if (!stats[log.productId].last || (log.soldAt && log.soldAt.toDate() > stats[log.productId].last)) {
                        stats[log.productId].last = log.soldAt ? log.soldAt.toDate() : null;
                    }
                    if (log.weight) stats[log.productId].weight = log.weight;
                });

                // שלוף שמות מוצרים
                const productsSnap = await getDocs(collection(db, "products"));
                const products = {};
                productsSnap.forEach(doc => products[doc.id] = doc.data());

                let any = false;
                list.innerHTML = "";
                Object.keys(stats).forEach(productId => {
                    any = true;
                    const product = products[productId];
                    // הצגת משקל ליחידה בצורה תקינה
                    let weightStr = "-";
                    if (product && product.weight && typeof product.weight === "object" && product.weight.value && product.weight.unit) {
                        weightStr = `${product.weight.value} ${product.weight.unit}`;
                    } else if (stats[productId].weight && typeof stats[productId].weight === "object" && stats[productId].weight.value && stats[productId].weight.unit) {
                        weightStr = `${stats[productId].weight.value} ${stats[productId].weight.unit}`;
                    } else if (typeof stats[productId].weight === "number") {
                        weightStr = stats[productId].weight + " ק\"ג";
                    }
                    list.innerHTML += `
                        <div class="border rounded p-4 bg-white shadow flex flex-col gap-2">
                            <div class="font-bold">${product ? product.name : productId}</div>
                            <div class="text-sm text-gray-500">סה"כ יחידות שנמכרו: ${stats[productId].total}</div>
                            <div class="text-sm text-gray-500">משקל ליחידה: ${weightStr}</div>
                            <div class="text-sm text-gray-500">נמכר לאחרונה: ${stats[productId].last ? formatDate(stats[productId].last) : '-'}</div>
                        </div>
                    `;
                });
                if (!any) {
                    list.innerHTML = `<div class="text-center text-gray-500">אין נתונים בטווח התאריכים שנבחר.</div>`;
                }
            } catch (e) {
                list.innerHTML = `<div class="text-red-600">שגיאה בטעינת נתוני המכירות: ${e.message}</div>`;
            }
        }

        // טען ברירת מחדל
        const today = new Date();
        const weekAgo = new Date();
        weekAgo.setDate(today.getDate() - 7);
        await loadStats(weekAgo.toISOString().slice(0,10), today.toISOString().slice(0,10));

        filterForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fromDate = document.getElementById('from-date').value;
            const toDate = document.getElementById('to-date').value;
            await loadStats(fromDate, toDate);
        });
    }
};