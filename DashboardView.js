import { collection, query, onSnapshot } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

let productsCache = {};

// --- Private Functions ---

function listenToProducts(db) {
    const productListContainer = document.getElementById('product-list-container');
    if (!productListContainer) return [];

    const q = query(collection(db, "products"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        productListContainer.innerHTML = '';
        productsCache = {};

        if (querySnapshot.empty) {
            productListContainer.innerHTML = `<p class="text-gray-500 col-span-full text-center">לא נמצאו מוצרים. לחץ על 'הוסף מוצר' כדי להתחיל.</p>`;
            return;
        }

        querySnapshot.forEach((doc) => {
            const product = doc.data();
            productsCache[doc.id] = product;
            const placeholderUrl = `https://placehold.co/400x300/e2e8f0/4a5568?text=${encodeURIComponent(product.name)}`;
            const weightText = (product.weight && product.weight.value) ? `${product.weight.value} ${product.weight.unit}` : 'לא צוין';
            
            const card = document.createElement('div');
            card.className = "bg-white border border-gray-200 rounded-lg shadow-md flex flex-col overflow-hidden";
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
                        <p class="text-sm text-gray-700">כמות במלאי: <span class="font-bold text-lg text-indigo-600">${product.stockQuantity}</span></p>
                    </div>
                    <div class="mt-4 text-center">
                        <button data-action="edit-product" data-sku="${doc.id}" class="w-full text-sm bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-md hover:bg-gray-300 transition-colors">ערוך</button>
                    </div>
                </div>
            `;
            productListContainer.appendChild(card);
        });
    });

    return [unsubscribe];
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
                <div class="bg-white p-6 rounded-lg shadow-md">
                    <h3 class="text-lg font-semibold text-gray-700 mb-4">רשימת מוצרים</h3>
                    <div id="product-list-container" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        <div class="col-span-full text-center text-gray-500">טוען מוצרים...</div>
                    </div>
                </div>
            </div>
        `;
    },
    init: function(db) {
        return listenToProducts(db); 
    },
    getProductFromCache: function(sku) {
        return productsCache[sku];
    }
};
