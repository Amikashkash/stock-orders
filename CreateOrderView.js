import { collection, getDocs, addDoc, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

let products = [];
let shoppingCart = {}; // productId => quantity

async function loadProducts(db) {
    const snap = await getDocs(collection(db, "products"));
    products = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

function getBrands(products) {
    return [...new Set(products.map(p => p.brand).filter(Boolean))];
}

function renderCartIndicator() {
    const cartCount = Object.values(shoppingCart).reduce((a, b) => a + b, 0);
    const el = document.getElementById('cart-indicator');
    if (el) el.textContent = cartCount > 0 ? ` (${cartCount})` : '';
}

function renderCartSummary() {
    const cartContainer = document.getElementById('cart-summary');
    const items = Object.entries(shoppingCart).filter(([_, qty]) => qty > 0);
    if (!cartContainer) return;
    if (items.length === 0) {
        cartContainer.innerHTML = `<div class="text-gray-500 text-center">העגלה ריקה</div>`;
        document.getElementById('save-order-btn').disabled = true;
        return;
    }
    cartContainer.innerHTML = `
        <ul class="mb-2">
            ${items.map(([productId, qty]) => {
                const product = products.find(p => p.id === productId);
                return `<li>${product ? product.name : productId} - <b>${qty}</b></li>`;
            }).join('')}
        </ul>
    `;
    document.getElementById('save-order-btn').disabled = false;
}

async function saveOrder(db, auth) {
    const items = Object.entries(shoppingCart).filter(([_, qty]) => qty > 0);
    if (items.length === 0) return;

    // Fetch user info from Firestore
    let storeName = "לא ידוע";
    let createdByName = "לא ידוע";
    if (auth.currentUser) {
        const userRef = doc(db, "users", auth.currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            const userData = userSnap.data();
            storeName = userData.storeName || storeName;
            createdByName = userData.fullName || createdByName;
        }
    }

    const order = {
        createdAt: new Date(),
        createdBy: auth.currentUser ? auth.currentUser.uid : null,
        storeName,
        createdByName,
        status: "pending"
    };
    const orderRef = await addDoc(collection(db, "orders"), order);
    for (const [productId, qty] of items) {
        await addDoc(collection(db, "orders", orderRef.id, "orderItems"), {
            productId,
            quantityOrdered: qty
        });
    }
    // איפוס העגלה
    Object.keys(shoppingCart).forEach(pid => shoppingCart[pid] = 0);
    renderProducts(document.getElementById('brand-filter').value);
    renderCartIndicator();
    renderCartSummary();
    alert("ההזמנה נשמרה בהצלחה!");
}
// start of updated code
function renderProducts(brand = "") {
    const container = document.getElementById('products-list');
    let filtered = brand ? products.filter(p => p.brand === brand) : products;
    container.innerHTML = "";
    filtered.forEach(product => {
        const qty = shoppingCart[product.id] || 0;
        const imageUrl = product.imageUrl || product.image || '';
        let weightStr = "לא צויין";
        if (
            product.weight &&
            typeof product.weight === "object" &&
            product.weight.value !== undefined &&
            product.weight.value !== null &&
            product.weight.unit
        ) {
            weightStr = `${product.weight.value} ${product.weight.unit}`;
        }
        // NEW: stockQuantity
        const stockStr = (product.stockQuantity !== undefined && product.stockQuantity !== null)
            ? `<div class="text-xs text-gray-700 mb-1">מלאי: <b>${product.stockQuantity}</b></div>`
            : `<div class="text-xs text-gray-400 mb-1">מלאי לא ידוע</div>`;

        container.innerHTML += `
            <div class="relative border rounded p-4 flex flex-col items-center mb-4 bg-white shadow">
                ${imageUrl ? `<img src="${imageUrl}" alt="${product.name}" class="w-24 h-24 object-contain mb-2 rounded">` : ''}
                <div class="font-bold">${product.name}</div>
                <div class="text-sm text-gray-500 mb-1">${product.brand || ''}</div>
                <div class="text-xs text-gray-600 mb-2">משקל: ${weightStr}</div>
                ${stockStr}
                <div class="flex items-center gap-2 mb-2">
                    <button class="decrease-qty-btn bg-red-500 text-white px-2 py-1 rounded" data-product-id="${product.id}" title="הפחת">
                        -
                    </button>
                    <span class="font-bold text-lg min-w-[24px] text-center">${qty}</span>
                    <button class="add-to-cart-btn bg-blue-600 text-white px-2 py-1 rounded" data-product-id="${product.id}" title="הוסף">
                        +
                    </button>
                </div>
                ${qty > 0 ? `
                    <span class="absolute top-2 right-2 bg-green-500 text-white rounded-full px-2 py-1 text-xs">
                        ${qty}
                    </span>
                ` : ''}
            </div>
        `;
    });
    renderCartSummary();
}

function listenCartButtons() {
    document.getElementById('products-list').addEventListener('click', e => {
        const addBtn = e.target.closest('.add-to-cart-btn');
        const decBtn = e.target.closest('.decrease-qty-btn');
        let changed = false;
        if (addBtn) {
            const productId = addBtn.dataset.productId;
            shoppingCart[productId] = (shoppingCart[productId] || 0) + 1;
            changed = true;
            showToast(`נוספה יחידה לעגלה!`);
        }
        if (decBtn) {
            const productId = decBtn.dataset.productId;
            shoppingCart[productId] = (shoppingCart[productId] || 0) - 1;
            if (shoppingCart[productId] < 0) shoppingCart[productId] = 0;
            changed = true;
        }
        if (changed) {
            renderProducts(document.getElementById('brand-filter').value);
            renderCartIndicator();
        }
    });
}

function showToast(msg) {
    let toast = document.getElementById('cart-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'cart-toast';
        toast.style.position = 'fixed';
        toast.style.bottom = '30px';
        toast.style.left = '50%';
        toast.style.transform = 'translateX(-50%)';
        toast.style.background = '#38a169';
        toast.style.color = 'white';
        toast.style.padding = '12px 24px';
        toast.style.borderRadius = '8px';
        toast.style.fontWeight = 'bold';
        toast.style.zIndex = 9999;
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 1200);
}

function listenBrandFilter() {
    document.getElementById('brand-filter').addEventListener('change', e => {
        renderProducts(e.target.value);
    });
}

export const CreateOrderView = {
    getHTML: function() {
        return `
            <div>
                <div class="flex items-center mb-4">
                    <button type="button" data-action="show-view" data-view="dashboard" class="text-indigo-600 hover:text-indigo-800 p-2 rounded-full hover:bg-gray-100 mr-2" title="חזרה לדשבורד">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l-4-4m0 0l-4 4m4-4v12" /></svg>
                    </button>
                    <span class="font-bold text-xl">הוספת הזמנה</span>
                    <span id="cart-indicator" class="ml-2 text-green-700"></span>
                </div>
                <div class="mb-4">
                    <label for="brand-filter" class="font-semibold">סנן לפי מותג:</label>
                    <select id="brand-filter" class="input-style ml-2">
                        <option value="">הצג הכל</option>
                    </select>
                </div>
                <div id="products-list" class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8"></div>
                <div class="bg-gray-50 p-4 rounded shadow mt-4">
                    <h3 class="font-bold mb-2">סיכום עגלה</h3>
                    <div id="cart-summary"></div>
                    <button id="save-order-btn" class="bg-green-600 text-white px-4 py-2 rounded mt-2" disabled>שמור הזמנה</button>
                </div>
            </div>
        `;
    },
    init: async function(db, auth, showView) {
        await loadProducts(db);
        const brands = getBrands(products);
        const brandSelect = document.getElementById('brand-filter');
        brands.forEach(brand => {
            const opt = document.createElement('option');
            opt.value = brand;
            opt.textContent = brand;
            brandSelect.appendChild(opt);
        });
        renderProducts();
        renderCartIndicator();
        listenCartButtons();
        listenBrandFilter();

        document.getElementById('save-order-btn').addEventListener('click', async () => {
            await saveOrder(db, auth);
        });

        // No need for direct back button handler, handled globally in app.js
        return [];
    }
};