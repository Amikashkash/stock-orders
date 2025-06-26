import { collection, query, onSnapshot, writeBatch, doc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

let productsCache = {};
let shoppingCart = {};
let unsubscribeFromProducts = null;

// --- Private Helper Functions ---
function showMessage(area, text, isError = false) {
    if (!area) return;
    area.textContent = text;
    area.className = `text-center p-2 rounded-md text-sm mb-4 ${isError ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`;
    if (!isError) {
        setTimeout(() => { if (area) area.textContent = ''; }, 3000);
    }
}

function renderShoppingCart() {
    const cartContainer = document.getElementById('order-cart-items');
    const submitBtn = document.getElementById('submit-order-btn');
    if (!cartContainer || !submitBtn) return;

    cartContainer.innerHTML = '';
    const skus = Object.keys(shoppingCart);

    if (skus.length === 0) {
        cartContainer.innerHTML = `<p class="text-gray-500 text-center">העגלה ריקה</p>`;
        submitBtn.disabled = true;
        submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
        return;
    }
    
    submitBtn.disabled = false;
    submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');

    skus.forEach(sku => {
        const product = productsCache[sku];
        if (!product) return; // Failsafe if product not in cache yet
        const quantity = shoppingCart[sku];
        const itemHtml = `
            <div class="flex items-center justify-between gap-2 bg-gray-50 p-2 rounded-md">
                <div class="flex-grow">
                    <p class="font-semibold text-sm text-gray-800">${product.name}</p>
                    <p class="text-xs text-gray-500">${product.brand}</p>
                </div>
                <input type="number" value="${quantity}" data-action="update-cart-quantity" data-sku="${sku}" min="1" class="w-16 text-center border-gray-300 rounded-md">
                <button data-action="remove-from-cart" data-sku="${sku}" class="text-red-500 hover:text-red-700 p-1">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="pointer-events: none;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
            </div>
        `;
        cartContainer.innerHTML += itemHtml;
    });
}

function listenToProducts(db) {
    const orderProductListContainer = document.getElementById('order-product-list');
    if (!orderProductListContainer) return null;

    const q = query(collection(db, "products"));
    unsubscribeFromProducts = onSnapshot(q, (querySnapshot) => {
        orderProductListContainer.innerHTML = '';
        productsCache = {};

        if (querySnapshot.empty) {
            orderProductListContainer.innerHTML = `<p class="text-gray-500 col-span-full text-center">לא נמצאו מוצרים להזמנה.</p>`;
            return;
        }

        querySnapshot.forEach((doc) => {
            const product = doc.data();
            productsCache[doc.id] = product;
            const placeholderUrl = `https://placehold.co/400x300/e2e8f0/4a5568?text=${encodeURIComponent(product.name)}`;
            
            const card = document.createElement('div');
            card.className = "border rounded-lg p-3 flex flex-col items-center text-center gap-2";
            card.innerHTML = `
                <img src="${product.imageUrl || placeholderUrl}" class="h-20 w-20 object-contain" onerror="this.onerror=null;this.src='${placeholderUrl}';">
                <p class="font-semibold text-sm h-10 leading-tight">${product.name}</p>
                <button data-action="add-to-cart" data-sku="${doc.id}" class="w-full bg-blue-100 text-blue-800 text-sm font-bold py-2 rounded-md hover:bg-blue-200 transition-colors">הוסף</button>
            `;
            orderProductListContainer.appendChild(card);
        });
    });
    return unsubscribeFromProducts;
}

async function handleCreateOrder(db, auth) {
    const button = document.getElementById('submit-order-btn');
    button.disabled = true;
    button.innerHTML = '<div class="loader"></div>';
    
    const messageArea = document.getElementById('create-order-message-area');
    if (Object.keys(shoppingCart).length === 0) {
        showMessage(messageArea, 'עגלת הקניות ריקה.', true);
        button.disabled = false;
        button.innerHTML = 'שלח הזמנה';
        return;
    }

    try {
        const orderNotes = document.getElementById('order-notes').value;
        const orderRef = await addDoc(collection(db, "orders"), {
            createdByUserId: auth.currentUser.uid,
            storeId: "some-store-id", // Placeholder for now
            status: "pending",
            orderDate: serverTimestamp(),
            itemCount: Object.keys(shoppingCart).length,
            notes: orderNotes || ""
        });

        const batch = writeBatch(db);
        for (const sku in shoppingCart) {
            const product = productsCache[sku];
            const orderItemRef = doc(collection(db, "orders", orderRef.id, "orderItems"));
            batch.set(orderItemRef, { 
                productId: sku, 
                name: product.name, 
                brand: product.brand, 
                quantityOrdered: shoppingCart[sku], 
                quantityPicked: 0, 
                status: "pending" 
            });
        }
        
        await batch.commit();

        showMessage(messageArea, 'ההזמנה נשלחה בהצלחה!', false);
        shoppingCart = {};
        renderShoppingCart();
        document.getElementById('order-notes').value = '';

    } catch (error) {
        console.error("Error creating order: ", error);
        showMessage(messageArea, 'שגיאה ביצירת ההזמנה.', true);
    } finally {
        button.disabled = false;
        button.innerHTML = 'שלח הזמנה';
    }
}


// --- Public Interface ---
export const CreateOrderView = {
    getHTML: function() {
        // --- התיקון כאן: הוספת div עוטף עם ID ---
        return `
            <div id="create-order-view"> 
                <div class="flex items-center mb-6">
                    <button data-action="show-view" data-view="dashboard" class="text-indigo-600 hover:text-indigo-800 p-2 rounded-full hover:bg-gray-100">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                    </button>
                    <h2 class="text-2xl font-semibold text-gray-800 mr-2">יצירת הזמנה חדשה</h2>
                </div>
                <div id="create-order-message-area" class="text-center p-2 rounded-md text-sm mb-4"></div>
                <div class="flex flex-col lg:flex-row gap-6">
                    <div class="lg:w-2/3 bg-white p-6 rounded-lg shadow-md">
                         <h3 class="text-lg font-semibold text-gray-700 mb-4">בחר מוצרים</h3>
                         <div id="order-product-list" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div class="col-span-full text-center text-gray-500">טוען מוצרים...</div>
                         </div>
                    </div>
                    <div class="lg:w-1/3">
                        <div class="bg-white p-6 rounded-lg shadow-md sticky top-24">
                             <h3 class="text-lg font-semibold text-gray-700 mb-4">עגלת קניות</h3>
                             <div id="order-cart-items" class="max-h-60 overflow-y-auto space-y-3 pr-2">
                                 <p class="text-gray-500 text-center" id="empty-cart-message">העגלה ריקה</p>
                             </div>
                             <div class="mt-4">
                                 <label for="order-notes" class="block text-sm font-medium text-gray-700">הערות להזמנה</label>
                                 <textarea id="order-notes" rows="3" class="input-style mt-1" placeholder="לדוגמה: לא להביא ביום שני..."></textarea>
                             </div>
                             <div class="mt-6 border-t pt-4">
                                 <button data-action="create-order" id="submit-order-btn" class="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg shadow-md hover:bg-blue-700 transition-colors flex justify-center items-center opacity-50 cursor-not-allowed" disabled>
                                     שלח הזמנה
                                 </button>
                             </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },
    init: function(db, auth, showViewCallback) {
        shoppingCart = {};

        const productListener = listenToProducts(db);
        renderShoppingCart();
        
        const container = document.getElementById('create-order-view');
        if (container) {
             // --- התיקון כאן: מנגנון ההאזנה לאירועים מחובר כעת לקונטיינר הנכון ---
             container.addEventListener('click', (e) => {
                const button = e.target.closest('button');
                if(!button || !button.dataset.action) return;

                const { action, sku, view } = button.dataset;

                if (view) {
                    showViewCallback(view);
                    return;
                }

                if (action === 'add-to-cart') {
                    if (shoppingCart[sku]) { shoppingCart[sku]++; } else { shoppingCart[sku] = 1; }
                    renderShoppingCart();
                } else if(action === 'remove-from-cart') {
                    delete shoppingCart[sku];
                    renderShoppingCart();
                } else if (action === 'create-order') {
                    handleCreateOrder(db, auth);
                }
            });

            container.addEventListener('change', (e) => {
                 if (e.target.dataset.action === 'update-cart-quantity') {
                    const sku = e.target.dataset.sku;
                    const newQuantity = parseInt(e.target.value, 10);
                    if (newQuantity > 0) {
                        shoppingCart[sku] = newQuantity;
                    } else {
                        delete shoppingCart[sku];
                    }
                    renderShoppingCart();
                 }
            });
        }
        return [productListener];
    }
};
