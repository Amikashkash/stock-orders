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
                
                <!-- Filters Section -->
                <div class="bg-white rounded-lg shadow p-4 mb-6">
                    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">טווח תאריכים</label>
                            <select id="date-range-filter" class="w-full border rounded px-3 py-2">
                                <option value="7">שבוע אחרון</option>
                                <option value="30">חודש אחרון</option>
                                <option value="90" selected>3 חודשים אחרונים</option>
                                <option value="180">6 חודשים אחרונים</option>
                                <option value="365">שנה אחרונה</option>
                                <option value="all">כל התקופה</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">סינון לפי מותג</label>
                            <select id="brand-filter" class="w-full border rounded px-3 py-2">
                                <option value="">כל המותגים</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">חיפוש מוצר</label>
                            <input type="text" id="product-search" placeholder="הקלד שם מוצר..." class="w-full border rounded px-3 py-2">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">מספר מוצרים להצגה</label>
                            <select id="products-limit" class="w-full border rounded px-3 py-2">
                                <option value="10" selected>Top 10</option>
                                <option value="20">Top 20</option>
                                <option value="50">Top 50</option>
                                <option value="100">Top 100</option>
                                <option value="all">כל המוצרים</option>
                            </select>
                        </div>
                    </div>
                    <div class="mt-4 flex gap-2">
                        <button id="apply-filters-btn" class="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600 font-medium">
                            🔍 הצג תוצאות
                        </button>
                        <button id="export-csv-btn" class="bg-green-500 text-white px-6 py-2 rounded hover:bg-green-600 font-medium">
                            📊 ייצא ל-CSV
                        </button>
                        <button id="reset-filters-btn" class="bg-gray-300 text-gray-700 px-6 py-2 rounded hover:bg-gray-400 font-medium">
                            🔄 איפוס
                        </button>
                    </div>
                </div>
                
                <div id="sales-stats-content" class="space-y-4">
                    <div class="text-center text-gray-500">בחר פילטרים ולחץ "הצג תוצאות"</div>
                </div>
            </div>
        `;
    },
    init: async function(db, showView) {
        const content = document.getElementById('sales-stats-content');
        
        // Load products and brands for filters
        const productsSnapshot = await getDocs(collection(db, "products"));
        const productsMap = {};
        const brands = new Set();
        
        productsSnapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            productsMap[doc.id] = product;
            if (product.brand) brands.add(product.brand);
        });
        
        // Populate brand filter
        const brandFilter = document.getElementById('brand-filter');
        Array.from(brands).sort().forEach(brand => {
            const option = document.createElement('option');
            option.value = brand;
            option.textContent = brand;
            brandFilter.appendChild(option);
        });
        
        // Event handlers
        document.getElementById('apply-filters-btn').addEventListener('click', () => {
            loadStats(db, productsMap);
        });
        
        document.getElementById('reset-filters-btn').addEventListener('click', () => {
            document.getElementById('date-range-filter').value = '90';
            document.getElementById('brand-filter').value = '';
            document.getElementById('product-search').value = '';
            document.getElementById('products-limit').value = '10';
            loadStats(db, productsMap);
        });
        
        document.getElementById('export-csv-btn').addEventListener('click', () => {
            exportToCSV(db, productsMap);
        });
        
        // Don't load stats automatically - wait for user to click "Apply Filters"
        // This improves performance and gives users control
        content.innerHTML = `
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
                <svg class="w-16 h-16 mx-auto text-blue-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                </svg>
                <h3 class="text-xl font-bold text-blue-800 mb-2">מוכן להציג דוח</h3>
                <p class="text-blue-600 mb-4">בחר פילטרים לפי צורך ולחץ על "הצג תוצאות" כדי לטעון את הדוח</p>
                <p class="text-sm text-blue-500">ברירת מחדל: 3 חודשים אחרונים</p>
            </div>
        `;
    }
};

async function loadStats(db, productsMap) {
    const content = document.getElementById('sales-stats-content');
    content.innerHTML = `
        <div class="text-center py-8">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p class="mt-4 text-gray-600">טוען נתונים...</p>
        </div>
    `;
    
    try {
        // Get filter values
        const dateRange = document.getElementById('date-range-filter').value;
        const brandFilter = document.getElementById('brand-filter').value;
        const productSearch = document.getElementById('product-search').value.toLowerCase();
        
        // Calculate date threshold
        let dateThreshold = null;
        if (dateRange !== 'all') {
            const days = parseInt(dateRange);
            dateThreshold = new Date();
            dateThreshold.setDate(dateThreshold.getDate() - days);
        }
        
        // Query orders
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
        const today = new Date();
        const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        
        // Track product statistics
        const productStats = {}; // productId => { quantity, orders }

        // Process orders
        for (const orderDoc of snap.docs) {
            const order = orderDoc.data();
            const orderDate = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
            
            // Apply date filter
            if (dateThreshold && orderDate < dateThreshold) continue;
            
            totalOrders++;
            
            if (order.status === "picked") completedOrders++;
            if (order.status === "pending" || order.status === "in-progress") pendingOrders++;
            if (orderDate >= thisMonth) ordersThisMonth++;
            
            // Collect product stats from order items
            const itemsSnapshot = await getDocs(collection(db, "orders", orderDoc.id, "orderItems"));
            itemsSnapshot.forEach(itemDoc => {
                const item = itemDoc.data();
                const productId = item.productId;
                const product = productsMap[productId];
                const quantity = item.quantityOrdered || 0;
                
                // Apply brand filter
                if (brandFilter && product?.brand !== brandFilter) return;
                
                // Apply product search filter
                if (productSearch && !product?.name?.toLowerCase().includes(productSearch)) return;
                
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
        
        // Get products limit from filter
        const productsLimitValue = document.getElementById('products-limit').value;
        const topProducts = productsLimitValue === 'all' 
            ? sortedProducts 
            : sortedProducts.slice(0, parseInt(productsLimitValue));
        
        const totalProductsOrdered = sortedProducts.reduce((sum, p) => sum + p.quantity, 0);
        
        // Get date range text
        const dateRangeText = getDateRangeText(dateRange);
        const filterInfo = [];
        if (dateRange !== 'all') filterInfo.push(dateRangeText);
        if (brandFilter) filterInfo.push(`מותג: ${brandFilter}`);
        if (productSearch) filterInfo.push(`חיפוש: "${productSearch}"`);
        const filterDisplay = filterInfo.length > 0 ? ` (${filterInfo.join(', ')})` : '';

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
                    <h3 class="text-xl font-bold mb-4 flex items-center justify-between">
                        <div class="flex items-center">
                            <svg class="w-6 h-6 ml-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                            </svg>
                            המוצרים המובילים
                        </div>
                        <span class="text-sm font-normal text-gray-600">מציג ${topProducts.length} מוצרים</span>
                    </h3>
                    <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                                    <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">שם מוצר</th>
                                    <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">מותג</th>
                                    <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">גודל/משקל</th>
                                    <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">כמות כוללת</th>
                                    <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">מלאי נוכחי</th>
                                    <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">ימים עד גמר המלאי</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200">
            `;
            
            // Calculate days in the selected period for daily rate calculation
            const daysInPeriod = dateRange === 'all' 
                ? Math.max(1, Math.ceil((today - (snap.docs[snap.docs.length - 1]?.data().createdAt?.toDate() || today)) / (1000 * 60 * 60 * 24)))
                : parseInt(dateRange);
            
            topProducts.forEach((item, index) => {
                const isTop3 = index < 3;
                const medalEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
                
                // Handle size/weight - check if it's an object or string
                let sizeWeight = '-';
                if (item.product.size) {
                    sizeWeight = typeof item.product.size === 'object' 
                        ? `${item.product.size.value || ''} ${item.product.size.unit || ''}`.trim()
                        : item.product.size;
                } else if (item.product.weight) {
                    sizeWeight = typeof item.product.weight === 'object'
                        ? `${item.product.weight.value || ''} ${item.product.weight.unit || ''}`.trim()
                        : item.product.weight;
                }
                
                const currentStock = item.product.stockQuantity || 0;
                
                // Calculate daily consumption rate and days until stockout
                const dailyRate = item.quantity / daysInPeriod;
                let daysUntilStockout = '-';
                let stockoutClass = 'text-gray-500';
                
                if (currentStock > 0 && dailyRate > 0) {
                    const days = Math.floor(currentStock / dailyRate);
                    daysUntilStockout = days;
                    
                    // Color coding based on urgency
                    if (days < 7) {
                        stockoutClass = 'text-red-600 font-bold';
                        daysUntilStockout = `⚠️ ${days}`;
                    } else if (days < 14) {
                        stockoutClass = 'text-orange-600 font-semibold';
                        daysUntilStockout = `⚡ ${days}`;
                    } else if (days < 30) {
                        stockoutClass = 'text-yellow-600';
                        daysUntilStockout = days;
                    } else {
                        stockoutClass = 'text-green-600';
                        daysUntilStockout = days;
                    }
                } else if (currentStock === 0) {
                    daysUntilStockout = '❌ אזל';
                    stockoutClass = 'text-red-700 font-bold';
                } else if (dailyRate === 0) {
                    daysUntilStockout = '∞';
                    stockoutClass = 'text-blue-600';
                }
                
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
                        <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                            ${sizeWeight}
                        </td>
                        <td class="px-4 py-3 whitespace-nowrap text-sm font-bold text-green-600">
                            ${item.quantity}
                        </td>
                        <td class="px-4 py-3 whitespace-nowrap text-sm font-semibold text-blue-600">
                            ${currentStock}
                        </td>
                        <td class="px-4 py-3 whitespace-nowrap text-sm ${stockoutClass}">
                            ${daysUntilStockout}
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

function getDateRangeText(range) {
    switch(range) {
        case '7': return 'שבוע אחרון';
        case '30': return 'חודש אחרון';
        case '90': return '3 חודשים';
        case '180': return '6 חודשים';
        case '365': return 'שנה';
        case 'all': return 'כל התקופה';
        default: return '';
    }
}

async function exportToCSV(db, productsMap) {
    try {
        const dateRange = document.getElementById('date-range-filter').value;
        const brandFilter = document.getElementById('brand-filter').value;
        const productSearch = document.getElementById('product-search').value.toLowerCase();
        
        // Calculate date threshold
        let dateThreshold = null;
        if (dateRange !== 'all') {
            const days = parseInt(dateRange);
            dateThreshold = new Date();
            dateThreshold.setDate(dateThreshold.getDate() - days);
        }
        
        const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        
        const productStats = {};
        
        for (const orderDoc of snap.docs) {
            const order = orderDoc.data();
            const orderDate = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
            
            if (dateThreshold && orderDate < dateThreshold) continue;
            
            const itemsSnapshot = await getDocs(collection(db, "orders", orderDoc.id, "orderItems"));
            itemsSnapshot.forEach(itemDoc => {
                const item = itemDoc.data();
                const productId = item.productId;
                const product = productsMap[productId];
                const quantity = item.quantityOrdered || 0;
                
                if (brandFilter && product?.brand !== brandFilter) return;
                if (productSearch && !product?.name?.toLowerCase().includes(productSearch)) return;
                
                if (!productStats[productId]) {
                    productStats[productId] = { quantity: 0, orders: 0, product };
                }
                productStats[productId].quantity += quantity;
                productStats[productId].orders += 1;
            });
        }
        
        // Create CSV content
        let csv = 'דירוג,שם מוצר,מותג,גודל/משקל,קטגוריה,כמות שהוזמנה בתקופה,מלאי נוכחי,ימים עד אזילה,תאריך חישוב\n';
        
        // Calculate days in period
        const dateRangeValue = document.getElementById('date-range-filter').value;
        const daysInPeriod = dateRangeValue === 'all' 
            ? Math.max(1, Math.ceil((new Date() - (snap.docs[snap.docs.length - 1]?.data().createdAt?.toDate() || new Date())) / (1000 * 60 * 60 * 24)))
            : parseInt(dateRangeValue);
        
        const sortedProducts = Object.entries(productStats)
            .map(([productId, stats]) => ({
                productId,
                product: stats.product,
                quantity: stats.quantity,
                orders: stats.orders
            }))
            .filter(p => p.product)
            .sort((a, b) => b.quantity - a.quantity);
        
        sortedProducts.forEach((item, index) => {
            // Handle size/weight - check if it's an object or string
            let sizeWeight = '-';
            if (item.product.size) {
                sizeWeight = typeof item.product.size === 'object' 
                    ? `${item.product.size.value || ''} ${item.product.size.unit || ''}`.trim()
                    : item.product.size;
            } else if (item.product.weight) {
                sizeWeight = typeof item.product.weight === 'object'
                    ? `${item.product.weight.value || ''} ${item.product.weight.unit || ''}`.trim()
                    : item.product.weight;
            }
            
            const currentStock = item.product.stockQuantity || 0;
            const dailyRate = item.quantity / daysInPeriod;
            
            let daysUntilStockout = '-';
            if (currentStock > 0 && dailyRate > 0) {
                daysUntilStockout = Math.floor(currentStock / dailyRate);
            } else if (currentStock === 0) {
                daysUntilStockout = 'אזל';
            } else if (dailyRate === 0) {
                daysUntilStockout = 'אין צריכה';
            }
            
            csv += `${index + 1},"${item.product.name || 'לא ידוע'}","${item.product.brand || '-'}","${sizeWeight}","${item.product.category || '-'}",${item.quantity},${currentStock},"${daysUntilStockout}","${new Date().toLocaleDateString('he-IL')}"\n`;
        });
        
        // Download CSV
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `product-statistics-${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        alert('הקובץ הורד בהצלחה!');
    } catch (error) {
        console.error('Error exporting CSV:', error);
        alert('שגיאה בייצוא הקובץ: ' + error.message);
    }
}

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