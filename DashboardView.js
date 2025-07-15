import { collection, query, onSnapshot, where } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

let productsCache = {};
let allProducts = [];
let currentFilters = {
    search: '',
    brand: '',
    stock: ''
};

// --- Private Functions ---

function updateStats() {
    // עדכון סטטיסטיקות
    const totalProducts = allProducts.length;
    const lowStockProducts = allProducts.filter(p => (p.stockQuantity || 0) < 5).length;
    
    document.getElementById('total-products').textContent = totalProducts;
    document.getElementById('low-stock-count').textContent = lowStockProducts;
    
    // יש לעדכן הזמנות ממתינות והזמנות היום בנפרד
    // כרגע נציג 0 כברירת מחדל
    document.getElementById('pending-orders').textContent = '0';
    document.getElementById('today-orders').textContent = '0';
}

function filterProducts() {
    let filtered = [...allProducts];
    
    // סינון לפי חיפוש
    if (currentFilters.search) {
        const searchTerm = currentFilters.search.toLowerCase();
        filtered = filtered.filter(product => 
            (product.name || '').toLowerCase().includes(searchTerm) ||
            (product.brand || '').toLowerCase().includes(searchTerm) ||
            (product.sku || '').toLowerCase().includes(searchTerm)
        );
    }
    
    // סינון לפי מותג
    if (currentFilters.brand) {
        filtered = filtered.filter(product => product.brand === currentFilters.brand);
    }
    
    // סינון לפי מלאי
    if (currentFilters.stock) {
        switch (currentFilters.stock) {
            case 'low':
                filtered = filtered.filter(product => (product.stockQuantity || 0) < 5);
                break;
            case 'medium':
                filtered = filtered.filter(product => {
                    const stock = product.stockQuantity || 0;
                    return stock >= 5 && stock <= 20;
                });
                break;
            case 'high':
                filtered = filtered.filter(product => (product.stockQuantity || 0) > 20);
                break;
        }
    }
    
    renderFilteredProducts(filtered);
}

function renderFilteredProducts(productsToShow) {
    const productListContainer = document.getElementById('product-list-container');
    if (!productListContainer) return;

    if (productsToShow.length === 0) {
        productListContainer.innerHTML = `<p class="text-gray-500 col-span-full text-center">לא נמצאו מוצרים התואמים לחיפוש.</p>`;
        return;
    }

    productListContainer.innerHTML = '';
    
    productsToShow.forEach(product => {
        const placeholderUrl = `https://placehold.co/400x300/e2e8f0/4a5568?text=${encodeURIComponent(product.name)}`;
        const weightText = (product.weight && product.weight.value) ? `${product.weight.value} ${product.weight.unit}` : 'לא צוין';
        
        // צבע מלאי לפי רמת המלאי
        let stockColor = 'text-indigo-600';
        const stock = product.stockQuantity || 0;
        if (stock < 5) stockColor = 'text-red-600';
        else if (stock < 20) stockColor = 'text-yellow-600';
        else stockColor = 'text-green-600';

        const card = document.createElement('div');
        card.className = "product-card bg-white border border-gray-200 rounded-lg shadow-md flex flex-col overflow-hidden";
        card.innerHTML = `
            <div class="w-full h-40 flex items-center justify-center bg-gray-100">
                <img src="${product.imageUrl || placeholderUrl}" alt="תמונה של ${product.name}" class="max-w-full max-h-full object-contain" onerror="this.onerror=null;this.src='${placeholderUrl}';">
            </div>
            <div class="p-4 flex flex-col flex-grow">
                <div class="flex-grow">
                    <h4 class="font-bold text-gray-800 truncate" title="${product.name}">${product.name}</h4>
                    <p class="text-sm text-gray-600">${product.brand}</p>
                    <p class="text-xs text-gray-400 mt-2">מק"ט: ${product.sku}</p>
                </div>
                <div class="mt-4 pt-4 border-t border-gray-200 space-y-2">
                    <p class="text-sm text-gray-700">משקל: <span class="font-semibold text-gray-900">${weightText}</span></p>
                    <p class="text-sm text-gray-700">כמות במלאי: <span class="font-bold text-lg ${stockColor}">${product.stockQuantity || 0}</span></p>
                </div>
                <div class="mt-4 text-center">
                    <button data-action="edit-product" data-sku="${product._id}" class="w-full text-sm bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-md hover:bg-gray-300 transition-colors">ערוך</button>
                </div>
            </div>
        `;
        productListContainer.appendChild(card);
    });
}

function setupFiltersAndSearch() {
    // תפריט ייצוא
    const exportMenuBtn = document.getElementById('export-menu-btn');
    const exportMenu = document.getElementById('export-menu');
    
    if (exportMenuBtn && exportMenu) {
        exportMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            exportMenu.classList.toggle('hidden');
        });
        
        // סגירת התפריט בלחיצה מחוץ לו
        document.addEventListener('click', (e) => {
            if (!exportMenuBtn.contains(e.target) && !exportMenu.contains(e.target)) {
                exportMenu.classList.add('hidden');
            }
        });
    }

    // חיפוש
    const searchInput = document.getElementById('product-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentFilters.search = e.target.value.trim();
            filterProducts();
        });
    }
    
    // סינון מותג
    const brandFilter = document.getElementById('brand-filter');
    if (brandFilter) {
        brandFilter.addEventListener('change', (e) => {
            currentFilters.brand = e.target.value;
            filterProducts();
        });
    }
    
    // סינון מלאי
    const stockFilter = document.getElementById('stock-filter');
    if (stockFilter) {
        stockFilter.addEventListener('change', (e) => {
            currentFilters.stock = e.target.value;
            filterProducts();
        });
    }
}

function updateBrandFilter() {
    const brandFilter = document.getElementById('brand-filter');
    if (!brandFilter) return;
    
    // שמירת הבחירה הנוכחית
    const currentValue = brandFilter.value;
    
    // קבלת רשימת מותגים ייחודיים
    const brands = [...new Set(allProducts.map(p => p.brand).filter(Boolean))].sort();
    
    // עדכון האופציות
    brandFilter.innerHTML = '<option value="">כל המותגים</option>';
    brands.forEach(brand => {
        const option = document.createElement('option');
        option.value = brand;
        option.textContent = brand;
        if (brand === currentValue) option.selected = true;
        brandFilter.appendChild(option);
    });
}

function listenToProducts(db) {
    const productListContainer = document.getElementById('product-list-container');
    if (!productListContainer) return [];

    const q = query(collection(db, "products"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        productsCache = {};
        allProducts = [];

        if (querySnapshot.empty) {
            productListContainer.innerHTML = `<p class="text-gray-500 col-span-full text-center">לא נמצאו מוצרים. לחץ על 'הוסף מוצר' כדי להתחיל.</p>`;
            updateStats();
            return;
        }

        // Gather products into array for sorting
        querySnapshot.forEach((doc) => {
            const product = doc.data();
            productsCache[doc.id] = product;
            product._id = doc.id; // keep id for edit button
            product.sku = doc.id; // ensure sku is available
            allProducts.push(product);
        });

        // Sort by brand, then by name
        allProducts.sort((a, b) => {
            if ((a.brand || "") < (b.brand || "")) return -1;
            if ((a.brand || "") > (b.brand || "")) return 1;
            if ((a.name || "") < (b.name || "")) return -1;
            if ((a.name || "") > (b.name || "")) return 1;
            return 0;
        });

        // עדכון סטטיסטיקות
        updateStats();
        
        // עדכון רשימת מותגים
        updateBrandFilter();
        
        // הצגת מוצרים מסוננים
        filterProducts();
    });

    // Listen to orders for stats
    const ordersUnsubscribe = listenToOrderStats(db);

    return [unsubscribe, ordersUnsubscribe];
}

function listenToOrderStats(db) {
    // האזנה להזמנות ממתינות
    const pendingQuery = query(collection(db, "orders"), where("status", "in", ["pending", "in-progress"]));
    const pendingUnsubscribe = onSnapshot(pendingQuery, (snap) => {
        document.getElementById('pending-orders').textContent = snap.size;
    });

    // האזנה להזמנות היום
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayQuery = query(collection(db, "orders"), where("createdAt", ">=", today));
    const todayUnsubscribe = onSnapshot(todayQuery, (snap) => {
        document.getElementById('today-orders').textContent = snap.size;
    });

    return () => {
        pendingUnsubscribe();
        todayUnsubscribe();
    };
}

// --- Public Interface ---
export const DashboardView = {
    getHTML: function() {
        return `
            <div id="dashboard-view">
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4 flex-wrap">
                    <h2 class="text-2xl font-semibold text-gray-800">לוח בקרה</h2>
                    <div id="main-controls" class="flex flex-col sm:flex-row gap-2 flex-wrap">
                        <button data-action="show-view" data-view="create-order" class="bg-green-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-green-700 transition-colors w-full sm:w-auto">צור הזמנה חדשה</button>
                        <button data-action="show-view" data-view="picking-orders" class="bg-yellow-500 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-yellow-600 transition-colors w-full sm:w-auto">הזמנות לליקוט</button>
                        <button data-action="show-view" data-view="sales-stats" class="bg-indigo-500 text-white font-bold py-2 px-4 rounded-md hover:bg-indigo-700 transition-colors">סטטיסטיקת מכירות</button>
                        <button data-action="show-view" data-view="order-history" class="bg-purple-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-purple-700 transition-colors w-full sm:w-auto">היסטוריית הזמנות</button>
                        <button data-action="show-view" data-view="add-product" class="bg-indigo-800 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-indigo-700 transition-colors w-full sm:w-auto">הוסף מוצר</button>
                    </div>
                </div>
                
                <!-- סטטיסטיקות מהירות -->
                <div id="dashboard-stats" class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div class="stat-card">
                        <div id="total-products" class="stat-number">0</div>
                        <div class="stat-label">סה"כ מוצרים</div>
                    </div>
                    <div class="stat-card">
                        <div id="low-stock-count" class="stat-number">0</div>
                        <div class="stat-label">מלאי נמוך</div>
                    </div>
                    <div class="stat-card">
                        <div id="pending-orders" class="stat-number">0</div>
                        <div class="stat-label">הזמנות ממתינות</div>
                    </div>
                    <div class="stat-card">
                        <div id="today-orders" class="stat-number">0</div>
                        <div class="stat-label">הזמנות היום</div>
                    </div>
                </div>

                <div class="bg-white p-6 rounded-lg shadow-md">
                    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                        <h3 class="text-lg font-semibold text-gray-700">רשימת מוצרים</h3>
                        <div class="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                            <!-- תפריט ייצוא -->
                            <div class="relative">
                                <button id="export-menu-btn" class="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                    </svg>
                                    ייצוא נתונים
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                                    </svg>
                                </button>
                                <div id="export-menu" class="hidden absolute left-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border">
                                    <div class="py-1">
                                        <button onclick="exportProducts()" class="block w-full text-right px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">ייצוא מוצרים (CSV)</button>
                                        <button onclick="exportOrders()" class="block w-full text-right px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">ייצוא הזמנות (CSV)</button>
                                        <button onclick="generateLowStockReport()" class="block w-full text-right px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">דו"ח מלאי נמוך</button>
                                        <button onclick="exportFullBackup()" class="block w-full text-right px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">גיבוי מלא (JSON)</button>
                                    </div>
                                </div>
                            </div>
                            <!-- חיפוש -->
                            <div class="search-box">
                                <input type="text" id="product-search" placeholder="חפש מוצר..." class="input-style pr-10">
                                <svg class="search-icon w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                                </svg>
                            </div>
                            <!-- סינון לפי מותג -->
                            <select id="brand-filter" class="input-style">
                                <option value="">כל המותגים</option>
                            </select>
                            <!-- סינון לפי מלאי -->
                            <select id="stock-filter" class="input-style">
                                <option value="">כל המלאי</option>
                                <option value="low">מלאי נמוך (מתחת ל-5)</option>
                                <option value="medium">מלאי בינוני (5-20)</option>
                                <option value="high">מלאי גבוה (מעל 20)</option>
                            </select>
                        </div>
                    </div>
                    <div id="product-list-container" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        <div class="col-span-full text-center text-gray-500">טוען מוצרים...</div>
                    </div>
                </div>
            </div>
        `;
    },
    init: function(db) {
        // Initialize filters and search
        setupFiltersAndSearch();
        return listenToProducts(db); 
    },
    getProductFromCache: function(sku) {
        return productsCache[sku];
    }
};