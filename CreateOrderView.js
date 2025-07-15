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
    console.log('🔍 loadProducts: Starting to load products...');
    try {
        if (!db) {
            console.error('❌ loadProducts: Database not provided!');
            return;
        }
        
        console.log('🔍 loadProducts: Getting products collection...');
        const snap = await getDocs(collection(db, "products"));
        console.log(`🔍 loadProducts: Found ${snap.size} products in database`);
        
        products = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log('🔍 loadProducts: Products loaded:', products.length);
        
        if (products.length === 0) {
            console.warn('⚠️ loadProducts: No products found in database!');
        } else {
            console.log('✅ loadProducts: Sample product:', products[0]);
        }
    } catch (error) {
        console.error('❌ loadProducts: Error loading products:', error);
        console.error('❌ loadProducts: Error details:', error.message, error.code);
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
    console.log('🎨 renderProducts: Starting to render products...');
    console.log(`🎨 renderProducts: Total products: ${products.length}`);
    console.log(`🎨 renderProducts: Brand filter: "${brand}"`);
    
    const container = document.getElementById('products-list');
    if (!container) {
        console.error('❌ renderProducts: Could not find products-list container!');
        return;
    }
    
    let filtered = brand ? products.filter(p => p.brand === brand) : products;
    console.log(`🎨 renderProducts: Filtered products: ${filtered.length}`);
    
    container.innerHTML = "";
    
    if (filtered.length === 0) {
        console.warn('⚠️ renderProducts: No products to display after filtering');
        console.log('📊 Debug info:', {
            totalProducts: products.length,
            brandFilter: brand,
            sampleProducts: products.slice(0, 3).map(p => ({ id: p.id, name: p.name, brand: p.brand }))
        });
        
        container.innerHTML = `
            <div style="background: yellow; padding: 15px; text-align: center; border-radius: 8px; margin: 20px;">
                <h3>🔍 DEBUG: No Products Found</h3>
                <p><strong>Total products in database:</strong> ${products.length}</p>
                <p><strong>Brand filter:</strong> "${brand}"</p>
                ${products.length === 0 ? 
                    '<p style="color: red;"><strong>⚠️ No products found in database!</strong></p>' :
                    '<p style="color: blue;">Products exist but filtered out</p>'
                }
                <p style="font-size: 12px; margin-top: 10px;">Check console for more details</p>
                <button onclick="console.log('All products:', window.products = products); alert('Products logged to console')" 
                        style="background: blue; color: white; padding: 5px 10px; border: none; border-radius: 3px; margin-top: 10px;">
                    Log Products to Console
                </button>
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
            <div>
                <div class="mobile-top-nav">
                    <div class="flex items-center mb-4 md:mb-0">
                        <button type="button" data-action="show-view" data-view="dashboard" class="text-indigo-600 hover:text-indigo-800 p-2 rounded-full hover:bg-gray-100 mr-2" title="חזרה לדשבורד">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l-4-4m0 0l-4 4m4-4v12" /></svg>
                        </button>
                        <span class="font-bold text-xl">הוספת הזמנה</span>
                        <span id="cart-indicator" class="ml-2 text-green-700"></span>
                    </div>
                </div>
                
                <div class="mb-4">
                    <label for="brand-filter" class="font-semibold">סנן לפי מותג:</label>
                    <select id="brand-filter" class="input-style ml-2">
                        <option value="">הצג הכל</option>
                    </select>
                </div>
                
                <!-- הסבר על הזמנה לפי מארזים -->
                <div class="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div class="flex items-center text-blue-800">
                        <span class="text-lg mr-2">💡</span>
                        <div>
                            <span class="font-medium">הזמנה גמישה לפי מוצר</span>
                            <div class="text-xs text-blue-600 mt-1">כל מוצר ניתן להזמנה בנפרד לפי מארזים או יחידות בודדות</div>
                        </div>
                    </div>
                </div>
                
                <div id="products-list" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8"></div>
                
                <div class="bg-gray-50 p-4 rounded-lg shadow mt-4">
                    <div class="flex items-center justify-between mb-2">
                        <h3 class="font-bold text-lg">סיכום עגלה</h3>
                        <button id="clear-cart-btn" class="text-xs text-red-600 hover:text-red-800 px-2 py-1 border border-red-300 rounded hover:bg-red-50 transition-colors">
                            רוקן עגלה
                        </button>
                    </div>
                    <div id="cart-summary"></div>
                    
                    <!-- הערות למלקט -->
                    <div class="mt-4">
                        <label for="order-notes" class="block text-sm font-medium text-gray-700 mb-2">הערות למלקט:</label>
                        <textarea id="order-notes" class="input-style resize-none" rows="3" placeholder="הערות מיוחדות, החלפות מותרות, הנחיות לליקוט..."></textarea>
                        <div class="text-xs text-gray-500 mt-1">הערות אלו יופיעו למלקט בעת ביצוע ההזמנה</div>
                    </div>
                    
                    <button id="save-order-btn" class="mobile-primary-btn bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg mt-4 w-full font-semibold" disabled>
                        שמור הזמנה
                    </button>
                    
                    <!-- כפתור חזרה למטה -->
                    <div class="mt-4 text-center">
                        <button type="button" data-action="show-view" data-view="dashboard" class="text-indigo-600 hover:text-indigo-800 px-4 py-2 rounded-lg border border-indigo-300 hover:bg-indigo-50 transition-colors">
                            ← חזרה לדשבורד
                        </button>
                    </div>
                </div>
                
                <!-- כפתור FAB לשמירה מהירה במובייל -->
                <button id="fab-save-btn" class="fab-save" title="שמור הזמנה" disabled>
                    💾
                </button>
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