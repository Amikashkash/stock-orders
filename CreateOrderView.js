import { collection, getDocs, addDoc, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

let products = [];
let shoppingCart = {}; // productId => quantity
let packageModePerProduct = {}; // productId => boolean (package mode)
let draftOrderId = null; // Track draft order ID
function saveCartToStorage() {
    try {
        const cartData = {
            cart: shoppingCart,
            packageMode: packageModePerProduct,
            timestamp: Date.now(),
            brandFilter: document.getElementById('brand-filter')?.value || ''
        };
        localStorage.setItem('warehouse_cart', JSON.stringify(cartData));
    } catch (e) {
        console.warn('Failed to save cart to localStorage:', e);
    }
}

function loadCartFromStorage() {
    try {
        const saved = localStorage.getItem('warehouse_cart');
        if (saved) {
            const cartData = JSON.parse(saved);
            
            // בדיקה שהנתונים לא ישנים מדי (יותר מ-24 שעות)
            if (cartData.timestamp && (Date.now() - cartData.timestamp) < 24 * 60 * 60 * 1000) {
                shoppingCart = cartData.cart || {};
                packageModePerProduct = cartData.packageMode || {};
                
                // שחזור סינון מותג
                setTimeout(() => {
                    const brandFilter = document.getElementById('brand-filter');
                    if (brandFilter && cartData.brandFilter) {
                        brandFilter.value = cartData.brandFilter;
                    }
                }, 100);
                
                // הצגת הודעה אם יש פריטים בעגלה
                const itemCount = Object.values(shoppingCart).reduce((a, b) => a + b, 0);
                if (itemCount > 0) {
                    setTimeout(() => {
                        window.showInfo(`השתחזרו ${itemCount} פריטים מהעגלה השמורה`);
                    }, 500);
                }
                
                return true;
            } else {
                // נתונים ישנים - נקה אותם
                clearCartFromStorage();
            }
        }
    } catch (e) {
        console.warn('Failed to load cart from localStorage:', e);
        shoppingCart = {};
    }
    return false;
}

function clearCartFromStorage() {
    try {
        localStorage.removeItem('warehouse_cart');
        shoppingCart = {};
        packageModePerProduct = {};
    } catch (e) {
        console.warn('Failed to clear cart from localStorage:', e);
    }
}

async function loadProducts(db) {
    try {
        if (!db) {
            console.error('Database not provided to loadProducts');
            return;
        }
        
        const snap = await getDocs(collection(db, "products"));
        products = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (products.length === 0) {
            console.warn('No products found in database');
        }
    } catch (error) {
        console.error('Error loading products:', error);
    }
}

// Auto-save function with better mobile support
let autoSaveTimeout;
async function autoSaveCart(db, auth) {
    // Clear previous timeout
    clearTimeout(autoSaveTimeout);
    
    // Save to localStorage immediately for mobile
    saveCartToStorage();
    
    // Debounce database save
    autoSaveTimeout = setTimeout(async () => {
        try {
            await saveDraftOrder(db, auth);
        } catch (e) {
            console.warn('Auto-save failed:', e);
        }
    }, 1000); // Wait 1 second after last change
}

async function saveDraftOrder(db, auth) {
    const items = Object.entries(shoppingCart).filter(([_, qty]) => qty > 0);
    if (items.length === 0) return;

    try {
        if (!auth.currentUser) return;
        
        const orderData = {
            items: items.map(([productId, quantity]) => ({ productId, quantity })),
            status: "draft",
            createdBy: auth.currentUser.uid,
            createdByName: auth.currentUser.displayName || auth.currentUser.email || "לא ידוע",
            updatedAt: new Date()
        };

        if (draftOrderId) {
            // Update existing draft
            await updateDoc(doc(db, "orders", draftOrderId), orderData);
        } else {
            // Create new draft
            orderData.createdAt = new Date();
            const docRef = await addDoc(collection(db, "orders"), orderData);
            draftOrderId = docRef.id;
        }
    } catch (e) {
        console.warn('Could not save draft order:', e);
    }
}

function getBrands(products) {
    return [...new Set(products.map(p => p.brand).filter(Boolean))];
}

function renderCartIndicator() {
    const cartCount = Object.values(shoppingCart).reduce((a, b) => a + b, 0);
    const el = document.getElementById('cart-indicator');
    if (el) el.textContent = cartCount > 0 ? ` (${cartCount})` : '';
    
    // שמירה ב-localStorage
    saveCartToStorage();
}

function renderCartSummary() {
    const cartContainer = document.getElementById('cart-summary');
    const items = Object.entries(shoppingCart).filter(([_, qty]) => qty > 0);
    if (!cartContainer) return;
    
    if (items.length === 0) {
        cartContainer.innerHTML = `
            <div class="text-center py-4">
                <div class="text-4xl mb-2">🛒</div>
                <div class="text-gray-500 font-medium">העגלה ריקה</div>
                <div class="text-xs text-gray-400 mt-1">הוסף מוצרים כדי ליצור הזמנה</div>
            </div>
        `;
        document.getElementById('save-order-btn').disabled = true;
        
        // הסתרת כפתור FAB
        const fabBtn = document.getElementById('fab-save-btn');
        if (fabBtn) {
            fabBtn.disabled = true;
            fabBtn.classList.remove('visible');
        }
        return;
    }
    
    cartContainer.innerHTML = `
        <ul class="mb-4">
            ${items.map(([productId, qty]) => {
                const product = products.find(p => p.id === productId);
                const isPackageMode = packageModePerProduct[productId] || false;
                const packageQty = product?.packageQuantity || 1;
                const totalUnits = isPackageMode ? qty * packageQty : qty;
                const unitText = isPackageMode ? "מארז" : "יח'";
                const weightStr = (product?.weight?.value && product?.weight?.unit) 
                    ? ` (${product.weight.value} ${product.weight.unit})` 
                    : '';
                const typeIndicator = isPackageMode 
                    ? `<span class="order-type-indicator order-type-package">מארז</span>`
                    : `<span class="order-type-indicator order-type-unit">יחידה</span>`;
                const displayText = isPackageMode && packageQty > 1 
                    ? `${product ? product.name : productId}${weightStr} - <b>${qty}</b> ${unitText} (${totalUnits} יח') ${typeIndicator}`
                    : `${product ? product.name : productId}${weightStr} - <b>${qty}</b> ${unitText} ${typeIndicator}`;
                return `<li>${displayText}</li>`;
            }).join('')}
        </ul>
        <div class="border-t pt-2 text-sm text-gray-600">
            <div class="flex justify-between items-center">
                <span>סה"כ פריטים:</span>
                <span class="font-semibold">${items.length}</span>
            </div>
            <div class="flex justify-between items-center">
                <span>סה"כ יחידות:</span>
                <span class="font-semibold">${items.reduce((total, [productId, qty]) => {
                    const isPackageMode = packageModePerProduct[productId] || false;
                    const product = products.find(p => p.id === productId);
                    const packageQty = product?.packageQuantity || 1;
                    return total + (isPackageMode ? qty * packageQty : qty);
                }, 0)}</span>
            </div>
        </div>
    `;
    document.getElementById('save-order-btn').disabled = false;
    
    // עדכון כפתור FAB
    const fabBtn = document.getElementById('fab-save-btn');
    if (fabBtn) {
        fabBtn.disabled = false;
        fabBtn.classList.add('visible');
    }
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
        status: "pending",
        notes: document.getElementById('order-notes')?.value?.trim() || ""
    };
    const orderRef = await addDoc(collection(db, "orders"), order);
    
    let itemCounter = 0;
    for (const [productId, qty] of items) {
        const product = products.find(p => p.id === productId);
        const isPackageMode = packageModePerProduct[productId] || false;
        const packageQty = product?.packageQuantity || 1;
        const actualQuantity = isPackageMode ? qty * packageQty : qty;
        
        const orderItemData = {
            productId,
            quantityOrdered: actualQuantity,
            orderType: isPackageMode ? "package" : "unit",
            packagesOrdered: isPackageMode ? qty : null,
            packageQuantity: isPackageMode ? packageQty : null
        };
        
        const itemRef = await addDoc(collection(db, "orders", orderRef.id, "orderItems"), orderItemData);
    }
    
    // Clear cart and localStorage
    Object.keys(shoppingCart).forEach(pid => shoppingCart[pid] = 0);
    clearCartFromStorage(); // ניקוי מהאחסון המקומי
    draftOrderId = null;
    
    renderProducts(document.getElementById('brand-filter').value);
    renderCartIndicator();
    renderCartSummary();
    
    // עדכון כפתור FAB
    const fabBtn = document.getElementById('fab-save-btn');
    if (fabBtn) {
        fabBtn.disabled = true;
        fabBtn.classList.remove('visible');
    }
    
    // גלילה למעלה אחרי שמירה מוצלחת
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    window.showSuccess("ההזמנה נשמרה בהצלחה!");
}
// start of updated code
function renderProducts(brand = "") {
    const container = document.getElementById('products-list');
    if (!container) {
        console.error('Could not find products-list container');
        return;
    }
    
    let filtered = brand ? products.filter(p => p.brand === brand) : products;
    container.innerHTML = "";
    
    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="text-center text-gray-500 p-8">
                <p>לא נמצאו מוצרים</p>
                ${brand ? `<p class="text-sm">סנן לפי מותג: ${brand}</p>` : ''}
            </div>
        `;
        return;
    }
    
    filtered.forEach(product => {
        const qty = shoppingCart[product.id] || 0;
        const isPackageMode = packageModePerProduct[product.id] || false;
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
        const packageQty = product.packageQuantity || 1;
        const effectiveStock = isPackageMode ? Math.floor((product.stockQuantity || 0) / packageQty) : (product.stockQuantity || 0);
        const unitText = isPackageMode ? `מארז (${packageQty} יח')` : "יח'";
        
        const stockStr = (product?.stockQuantity !== undefined && product?.stockQuantity !== null)
            ? `<div class="text-xs text-gray-700 mb-1">מלאי: <b>${effectiveStock}</b> ${unitText}</div>`
            : `<div class="text-xs text-gray-400 mb-1">מלאי לא ידוע</div>`;

        container.innerHTML += `
            <div class="product-card relative border rounded-lg p-4 bg-white shadow-md hover:shadow-lg transition-all ${qty > 0 ? 'has-quantity' : ''}">
                ${imageUrl ? `
                    <img src="${imageUrl}" 
                         alt="${product.name}" 
                         class="w-24 h-24 object-contain mb-2 rounded mx-auto"
                         onerror="this.onerror=null; this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iOTYiIGhlaWdodD0iOTYiIHZpZXdCb3g9IjAgMCA5NiA5NiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9Ijk2IiBoZWlnaHQ9Ijk2IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0zMiA0MEg2NEw1NiA1Nkg0MEwzMiA0MFoiIGZpbGw9IiNEMUQ1REIiLz4KPGNpcmNsZSBjeD0iNDAiIGN5PSIzMiIgcj0iNCIgZmlsbD0iI0Q5REREQyIvPgo8cGF0aCBkPSJNMjQgNzJINzJWMjRIMjRWNzJaIiBzdHJva2U9IiNEMUQ1REIiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWRhc2hhcnJheT0iNCA0Ii8+Cjx0ZXh0IHg9IjQ4IiB5PSI2MCIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTAiIGZpbGw9IiM5Q0EzQUYiIHRleHQtYW5jaG9yPSJtaWRkbGUiPtio17vbqc+qIHTZgdmPbmjXmdio17k8L3RleHQ+Cjwvc3ZnPgo='; this.style.opacity='0.7'; this.title='תמונה לא זמינה';">
                ` : `
                    <div class="w-24 h-24 mb-2 mx-auto product-image-placeholder rounded">
                        <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                        </svg>
                    </div>
                `}
                <div class="text-center">
                    <div class="font-bold text-lg mb-1">${product.name}</div>
                    <div class="text-sm text-gray-600 mb-1">${product.brand || ''}</div>
                    <div class="text-xs text-gray-500 mb-2">משקל: ${weightStr}</div>
                    ${stockStr}
                    
                    <!-- צ'קבוקס הזמנה לפי מארז -->
                    ${packageQty > 1 ? `
                        <div class="package-info-box rounded-lg p-2 mb-3 border border-blue-200 bg-blue-50">
                            <label class="flex items-center justify-center cursor-pointer text-sm">
                                <input type="checkbox" 
                                       class="package-mode-checkbox ml-2" 
                                       data-product-id="${product.id}"
                                       ${isPackageMode ? 'checked' : ''}>
                                <span class="text-blue-800 font-medium">הזמן לפי מארז (${packageQty} יח')</span>
                            </label>
                        </div>
                    ` : `
                        <div class="text-xs text-gray-500 mb-2 text-center">מוצר ליחידה בלבד</div>
                    `}
                    
                    <div class="flex items-center justify-center gap-3 mb-2">
                        <button class="decrease-qty-btn bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg font-bold transition-colors" 
                                data-product-id="${product.id}" title="הפחת">
                            -
                        </button>
                        <span class="quantity-display font-bold text-xl min-w-[30px] text-center">${qty}</span>
                        <button class="add-to-cart-btn bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg font-bold transition-colors" 
                                data-product-id="${product.id}" title="הוסף">
                            +
                        </button>
                    </div>
                    
                    ${qty > 0 ? `
                        <div class="quantity-badge absolute top-2 right-2 bg-green-500 text-white rounded-full px-2 py-1 text-xs font-bold">
                            ${qty} ${isPackageMode ? 'מארז' : 'יח\''}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    });
    renderCartSummary();
}

function listenCartButtons(db, auth) {
    document.getElementById('products-list').addEventListener('click', e => {
        const addBtn = e.target.closest('.add-to-cart-btn');
        const decBtn = e.target.closest('.decrease-qty-btn');
        let changed = false;
        
        if (addBtn) {
            const productId = addBtn.dataset.productId;
            const product = products.find(p => p.id === productId);
            const currentQty = shoppingCart[productId] || 0;
            const isPackageMode = packageModePerProduct[productId] || false;
            
            // בדיקת מלאי
            if (product && product.stockQuantity !== undefined) {
                const packageQty = product.packageQuantity || 1;
                const effectiveStock = isPackageMode ? Math.floor(product.stockQuantity / packageQty) : product.stockQuantity;
                const currentEffectiveQty = currentQty;
                
                if (currentEffectiveQty >= effectiveStock) {
                    const unitText = isPackageMode ? "מארזים" : "יחידות";
                    window.showError(`לא ניתן להוסיף עוד - מלאי זמין: ${effectiveStock} ${unitText}`);
                    return;
                }
                
                if (currentEffectiveQty + 1 > effectiveStock) {
                    const unitText = isPackageMode ? "מארזים" : "יחידות";
                    window.showWarning(`זהירות: מבקש כמות גדולה מהמלאי הזמין (${effectiveStock} ${unitText})`);
                }
            }
            
            shoppingCart[productId] = (shoppingCart[productId] || 0) + 1;
            changed = true;
            const unitText = isPackageMode ? "מארז" : "יחידה";
            showToast(`נוסף ${unitText} לעגלה!`);
            window.vibrate?.addToCart(); // פידבק הפטי
        }
        
        if (decBtn) {
            const productId = decBtn.dataset.productId;
            shoppingCart[productId] = (shoppingCart[productId] || 0) - 1;
            if (shoppingCart[productId] < 0) shoppingCart[productId] = 0;
            changed = true;
        }
        
        if (changed) {
            saveCartToStorage();
            renderProducts(document.getElementById('brand-filter').value);
            renderCartIndicator();
            // Auto-save after each change
            autoSaveCart(db, auth);
        }
    });
    
    // האזנה לשינויים בצ'קבוקס מארזים
    document.getElementById('products-list').addEventListener('change', e => {
        const packageCheckbox = e.target.closest('.package-mode-checkbox');
        if (packageCheckbox) {
            const productId = packageCheckbox.dataset.productId;
            packageModePerProduct[productId] = packageCheckbox.checked;
            saveCartToStorage();
            renderProducts(document.getElementById('brand-filter').value);
            renderCartIndicator();
            
            const product = products.find(p => p.id === productId);
            const productName = product ? product.name : 'המוצר';
            if (packageCheckbox.checked) {
                window.showInfo(`${productName} יוזמן לפי מארזים`);
            } else {
                window.showInfo(`${productName} יוזמן לפי יחידות`);
            }
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
        saveCartToStorage();
    });
}

export const CreateOrderView = {
    getHTML: function() {
        return `
            <div style="padding-top: 50px; padding-bottom: 140px;">
                <!-- Ultra Compact Sticky Header -->
                <div class="fixed top-0 left-0 right-0 bg-white z-20 border-b border-gray-200 shadow-sm" style="height: 50px;">
                    <div class="max-w-6xl mx-auto h-full px-3 flex items-center justify-between">
                        <div class="flex items-center gap-2">
                            <button type="button" data-action="show-view" data-view="dashboard" class="text-indigo-600 hover:text-indigo-800 p-1" title="חזרה">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                            </button>
                            <span class="font-bold text-base">הוספת הזמנה</span>
                            <span id="cart-indicator" class="text-green-700 font-semibold text-sm"></span>
                        </div>
                        <div class="flex items-center gap-1">
                            <select id="brand-filter" class="text-xs border rounded px-2 py-1" style="max-width: 120px;">
                                <option value="">כל המותגים</option>
                            </select>
                            <button id="header-notes-toggle" class="text-blue-600 hover:bg-blue-50 p-1 rounded" title="הערות">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- Products List with more space -->
                <div class="px-3">
                    <div id="products-list" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"></div>
                </div>
                
                <!-- Compact Sticky Cart at Bottom -->
                <div class="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-200 shadow-lg z-30" style="max-height: 140px;">
                    <div class="max-w-6xl mx-auto px-3 py-2">
                        <!-- Cart Summary - Scrollable if needed -->
                        <div id="cart-summary" class="mb-2 text-sm" style="max-height: 60px; overflow-y: auto;"></div>
                        
                        <!-- Collapsible Notes -->
                        <div id="notes-panel" class="overflow-hidden transition-all duration-300" style="max-height: 0; opacity: 0;">
                            <textarea id="order-notes" class="w-full text-xs border rounded px-2 py-1 mb-1 resize-none" rows="2" placeholder="הערות למלקט..."></textarea>
                        </div>
                        
                        <!-- Action Buttons -->
                        <div class="flex gap-1">
                            <button id="save-order-btn" class="flex-1 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded text-sm font-semibold disabled:opacity-50" disabled>
                                💾 שמור
                            </button>
                            <button id="clear-cart-btn" class="px-3 py-2 text-red-600 border border-red-300 rounded text-xs hover:bg-red-50">
                                רוקן
                            </button>
                            <button type="button" data-action="show-view" data-view="dashboard" class="px-3 py-2 text-indigo-600 border border-indigo-300 rounded text-xs hover:bg-indigo-50">
                                ביטול
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },
                
      
    init: async function(db, auth, showView) {
        // טעינת עגלה שמורה
        loadCartFromStorage();
        
        await loadProducts(db);
        
        // Load cart from localStorage on mobile browsers
        loadCartFromStorage();
        
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
        renderCartSummary();
        listenCartButtons(db, auth);
        listenBrandFilter();

        // Add beforeunload event for mobile browsers
        window.addEventListener('beforeunload', () => {
            saveCartToStorage();
        });

        // Add pagehide event specifically for mobile Safari
        window.addEventListener('pagehide', () => {
            saveCartToStorage();
        });

        // Add visibility change event for mobile browsers
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                saveCartToStorage();
            }
        });

        document.getElementById('save-order-btn').addEventListener('click', async () => {
            await saveOrder(db, auth);
        });

        // חיבור כפתור FAB
        document.getElementById('fab-save-btn').addEventListener('click', async () => {
            await saveOrder(db, auth);
        });

        document.getElementById('clear-cart-btn').addEventListener('click', () => {
            if (Object.values(shoppingCart).some(qty => qty > 0)) {
                if (confirm('האם אתה בטוח שברצונך לרוקן את העגלה? פעולה זו לא ניתנת לביטול.')) {
                    Object.keys(shoppingCart).forEach(pid => shoppingCart[pid] = 0);
                    packageModePerProduct = {};
                    saveCartToStorage();
                    renderProducts(document.getElementById('brand-filter').value);
                    renderCartIndicator();
                    window.showInfo('העגלה רוקנה בהצלחה');
                    
                    // הסתרת כפתור FAB
                    const fabBtn = document.getElementById('fab-save-btn');
                    if (fabBtn) {
                        fabBtn.disabled = true;
                        fabBtn.classList.remove('visible');
                    }
                }
            } else {
                window.showInfo('העגלה כבר ריקה');
            }
        });

        // Auto-save draft order every 30 seconds if there are items
        setInterval(() => {
            const hasItems = Object.values(shoppingCart).some(qty => qty > 0);
            if (hasItems) {
                autoSaveCart(db, auth);
            }
        }, 30000);

        // No need for direct back button handler, handled globally in app.js
        return [];
    }
};