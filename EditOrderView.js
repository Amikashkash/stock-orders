import { collection, getDocs, doc, getDoc, updateDoc, deleteDoc, addDoc, query, where } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

let products = [];
let shoppingCart = {}; // productId => quantity
let packageModePerProduct = {}; // productId => boolean (package mode)
let editingOrderId = null;
let originalOrder = null;

function saveCartToStorage() {
    try {
        const cartData = {
            cart: shoppingCart,
            packageMode: packageModePerProduct,
            timestamp: Date.now(),
            brandFilter: document.getElementById('brand-filter')?.value || '',
            editingOrderId
        };
        localStorage.setItem('warehouse_edit_cart', JSON.stringify(cartData));
    } catch (e) {
        console.warn('Failed to save edit cart to localStorage:', e);
    }
}

function loadCartFromStorage() {
    try {
        const saved = localStorage.getItem('warehouse_edit_cart');
        if (saved) {
            const cartData = JSON.parse(saved);
            
            // Check if we're editing the same order
            if (cartData.editingOrderId === editingOrderId && 
                cartData.timestamp && (Date.now() - cartData.timestamp) < 24 * 60 * 60 * 1000) {
                shoppingCart = cartData.cart || {};
                packageModePerProduct = cartData.packageMode || {};
                
                // Restore brand filter
                setTimeout(() => {
                    const brandFilter = document.getElementById('brand-filter');
                    if (brandFilter && cartData.brandFilter) {
                        brandFilter.value = cartData.brandFilter;
                    }
                }, 100);
                
                return true;
            }
        }
    } catch (e) {
        console.warn('Failed to load edit cart from localStorage:', e);
    }
    
    // Clear old data
    localStorage.removeItem('warehouse_edit_cart');
    return false;
}

function clearCartFromStorage() {
    localStorage.removeItem('warehouse_edit_cart');
}

async function loadOrderData(db, auth, orderId) {
    try {
        editingOrderId = orderId;
        
        // Load the order
        const orderRef = doc(db, "orders", orderId);
        const orderSnap = await getDoc(orderRef);
        
        if (!orderSnap.exists()) {
            throw new Error('Order not found');
        }
        
        originalOrder = { id: orderSnap.id, ...orderSnap.data() };
        
        // Check permissions
        if (originalOrder.createdBy !== auth.currentUser?.uid) {
            throw new Error('You can only edit your own orders');
        }
        
        if (originalOrder.status !== 'pending') {
            throw new Error('You can only edit pending orders');
        }
        
        // Load order items
        const itemsCollection = collection(db, "orders", orderId, "orderItems");
        const itemsSnapshot = await getDocs(itemsCollection);
        
        // Clear cart first
        shoppingCart = {};
        packageModePerProduct = {};
        
        // Load items into cart
        itemsSnapshot.forEach(doc => {
            const item = doc.data();
            const productId = item.productId;
            
            if (item.orderType === "package") {
                packageModePerProduct[productId] = true;
                shoppingCart[productId] = item.packagesOrdered || 0;
            } else {
                packageModePerProduct[productId] = false;
                shoppingCart[productId] = item.quantityOrdered || 0;
            }
        });
        
        // Set order notes
        setTimeout(() => {
            const notesField = document.getElementById('order-notes');
            if (notesField && originalOrder.notes) {
                notesField.value = originalOrder.notes;
            }
        }, 100);
        
        return true;
        
    } catch (error) {
        console.error("Error loading order data:", error);
        window.showError(`שגיאה בטעינת ההזמנה: ${error.message}`);
        return false;
    }
}

async function updateOrder(db, auth, showView) {
    console.log('Starting updateOrder...', { editingOrderId, originalOrder, shoppingCart });
    
    const items = Object.entries(shoppingCart).filter(([_, qty]) => qty > 0);
    
    if (items.length === 0) {
        window.showError('אין פריטים בעגלה');
        return;
    }

    try {
        console.log('Updating order with items:', items);
        
        // Update order metadata
        const orderRef = doc(db, "orders", editingOrderId);
        const updatedOrder = {
            ...originalOrder,
            notes: document.getElementById('order-notes')?.value?.trim() || "",
            updatedAt: new Date()
        };
        
        console.log('Updating order metadata...');
        await updateDoc(orderRef, updatedOrder);

        console.log('Deleting existing order items...');
        // Delete all existing order items
        const itemsCollection = collection(db, "orders", editingOrderId, "orderItems");
        const existingItems = await getDocs(itemsCollection);
        
        for (const itemDoc of existingItems.docs) {
            await deleteDoc(doc(db, "orders", editingOrderId, "orderItems", itemDoc.id));
        }

        console.log('Adding new order items...');
        // Add new order items
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
            
            console.log('Adding item:', { productId, qty, orderItemData });
            await addDoc(collection(db, "orders", editingOrderId, "orderItems"), orderItemData);
        }
        
        console.log('Order update completed successfully');
        
        // Clear cart and localStorage
        Object.keys(shoppingCart).forEach(pid => shoppingCart[pid] = 0);
        clearCartFromStorage();
        editingOrderId = null;
        originalOrder = null;
        
        window.showSuccess('ההזמנה עודכנה בהצלחה!');
        
        // Return to order history
        if (showView) {
            showView('order-history');
        }
        
    } catch (error) {
        console.error("Error updating order:", error);
        window.showError(`שגיאה בעדכון ההזמנה: ${error.message}`);
    }
}

function addToCart(productId, quantity = 1) {
    if (!shoppingCart[productId]) shoppingCart[productId] = 0;
    shoppingCart[productId] += quantity;
    if (shoppingCart[productId] < 0) shoppingCart[productId] = 0;
    saveCartToStorage();
    renderCartIndicator();
    renderCartSummary();
    renderProducts(document.getElementById('brand-filter')?.value || '');
}

function removeFromCart(productId, quantity = 1) {
    if (!shoppingCart[productId]) return;
    shoppingCart[productId] -= quantity;
    if (shoppingCart[productId] <= 0) {
        shoppingCart[productId] = 0;
        delete packageModePerProduct[productId];
    }
    saveCartToStorage();
    renderCartIndicator();
    renderCartSummary();
    renderProducts(document.getElementById('brand-filter')?.value || '');
}

function setCartQuantity(productId, quantity) {
    if (quantity <= 0) {
        shoppingCart[productId] = 0;
        delete packageModePerProduct[productId];
    } else {
        shoppingCart[productId] = quantity;
    }
    saveCartToStorage();
    renderCartIndicator();
    renderCartSummary();
    renderProducts(document.getElementById('brand-filter')?.value || '');
}

function togglePackageMode(productId) {
    packageModePerProduct[productId] = !packageModePerProduct[productId];
    saveCartToStorage();
    renderProducts(document.getElementById('brand-filter').value);
    renderCartSummary();
}

function renderCartIndicator() {
    const totalItems = Object.values(shoppingCart).reduce((total, qty) => total + qty, 0);
    const indicator = document.getElementById('cart-indicator');
    if (indicator) {
        indicator.textContent = totalItems > 0 ? totalItems : '';
        indicator.style.display = totalItems > 0 ? 'block' : 'none';
    }
}

function renderCartSummary() {
    const cartSummary = document.getElementById('cart-summary');
    if (!cartSummary) return;

    const cartItems = Object.entries(shoppingCart).filter(([_, qty]) => qty > 0);
    
    if (cartItems.length === 0) {
        cartSummary.innerHTML = '<div class="text-gray-500 text-center py-4">העגלה ריקה</div>';
        return;
    }

    let summaryHTML = '';
    cartItems.forEach(([productId, qty]) => {
        const product = products.find(p => p.id === productId);
        if (!product) return;

        const isPackageMode = packageModePerProduct[productId] || false;
        const packageQty = product.packageQuantity || 1;
        const displayQty = isPackageMode ? `${qty} חבילות (${qty * packageQty} יחידות)` : `${qty} יחידות`;

        summaryHTML += `
            <div class="flex justify-between items-center py-2 border-b">
                <div>
                    <div class="font-medium">${product.name}</div>
                    <div class="text-sm text-gray-500">${displayQty}</div>
                </div>
                <div class="flex items-center space-x-2">
                    <button data-action="remove-from-cart" data-product-id="${productId}" class="w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center text-lg">-</button>
                    <input type="number" 
                           value="${qty}" 
                           min="0" 
                           data-action="set-cart-quantity" data-product-id="${productId}"
                           class="w-16 text-center border rounded px-2 py-1">
                    <button data-action="add-to-cart" data-product-id="${productId}" class="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-lg">+</button>
                </div>
            </div>
        `;
    });

    cartSummary.innerHTML = summaryHTML;
}

function renderProducts(brandFilter = '') {
    const container = document.getElementById('products-container');
    if (!container) return;

    let filteredProducts = products;
    
    // Filter by brand
    if (brandFilter && brandFilter !== '') {
        filteredProducts = products.filter(product => 
            product.brand && product.brand.toLowerCase().includes(brandFilter.toLowerCase())
        );
    }

    let productsHTML = '';
    filteredProducts.forEach(product => {
        const quantity = shoppingCart[product.id] || 0;
        const isPackageMode = packageModePerProduct[product.id] || false;
        const packageQty = product.packageQuantity || 1;
        
        let quantityDisplay = '';
        if (quantity > 0) {
            if (isPackageMode) {
                quantityDisplay = `${quantity} חבילות (${quantity * packageQty} יחידות)`;
            } else {
                quantityDisplay = `${quantity} יחידות`;
            }
        }

        productsHTML += `
            <div class="border rounded p-4 ${quantity > 0 ? 'bg-green-50 border-green-200' : 'bg-white'}">
                <div class="flex justify-between items-start mb-2">
                    <div class="flex-1">
                        <h3 class="font-bold text-lg">${product.name}</h3>
                        <p class="text-gray-600">מותג: ${product.brand || 'לא צוין'}</p>
                        <p class="text-gray-600">קטגוריה: ${product.category || 'לא צוין'}</p>
                        ${product.packageQuantity > 1 ? `<p class="text-blue-600">חבילה של ${product.packageQuantity} יחידות</p>` : ''}
                        ${quantity > 0 ? `<p class="text-green-600 font-bold mt-2">${quantityDisplay}</p>` : ''}
                    </div>
                </div>
                
                <div class="flex items-center justify-between mt-3">
                    <div class="flex items-center space-x-2">
                        <button data-action="remove-from-cart" data-product-id="${product.id}" 
                                class="w-10 h-10 bg-red-500 text-white rounded-full flex items-center justify-center text-xl font-bold">-</button>
                        <span class="mx-3 text-xl font-bold min-w-[3rem] text-center">${quantity}</span>
                        <button data-action="add-to-cart" data-product-id="${product.id}" 
                                class="w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center text-xl font-bold">+</button>
                    </div>
                    
                    ${product.packageQuantity > 1 ? `
                        <button data-action="toggle-package-mode" data-product-id="${product.id}" 
                                class="px-3 py-1 rounded text-sm ${isPackageMode ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'}">
                            ${isPackageMode ? 'חבילות' : 'יחידות'}
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    });

    container.innerHTML = productsHTML;
}

export async function showEditOrderView(db, auth, showView, params = {}) {
    const { orderId, fromView } = params;
    
    if (!orderId) {
        window.showError('מזהה הזמנה לא נמצא');
        return;
    }

    const main = document.querySelector('main');
    main.innerHTML = `
        <div class="min-h-screen bg-gray-50">
            <!-- Sticky Header -->
            <div class="sticky top-0 bg-white shadow-sm border-b z-10">
                <div class="max-w-6xl mx-auto px-4 py-3">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center space-x-3">
                            <button id="back-btn" class="p-2 text-gray-600 hover:bg-gray-100 rounded-full">
                                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
                                </svg>
                            </button>
                            <h1 class="text-xl font-bold">עריכת הזמנה</h1>
                        </div>
                        <div class="flex items-center space-x-3">
                            <div class="relative">
                                <span id="cart-indicator" class="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center font-bold" style="display: none;"></span>
                                <button id="toggle-cart" class="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600">
                                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.5 6h12"></path>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="max-w-6xl mx-auto p-4">
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <!-- Products List -->
                    <div class="lg:col-span-2">
                        <!-- Brand Filter -->
                        <div class="mb-4">
                            <select id="brand-filter" class="w-full p-2 border rounded">
                                <option value="">כל המותגים</option>
                            </select>
                        </div>
                        
                        <div id="products-container" class="space-y-4">
                            <div class="text-center py-8">
                                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                                <p class="mt-2 text-gray-600">טוען מוצרים...</p>
                            </div>
                        </div>
                    </div>

                    <!-- Cart Summary -->
                    <div class="lg:col-span-1">
                        <div class="bg-white rounded-lg shadow p-6 sticky top-24">
                            <h2 class="text-xl font-bold mb-4">סיכום עגלה</h2>
                            
                            <div id="cart-summary" class="mb-6">
                                <div class="text-gray-500 text-center py-4">העגלה ריקה</div>
                            </div>

                            <div class="mb-4">
                                <label for="order-notes" class="block text-sm font-medium text-gray-700 mb-2">הערות להזמנה</label>
                                <textarea id="order-notes" rows="3" class="w-full border rounded-lg px-3 py-2" placeholder="הערות אופציונליות..."></textarea>
                            </div>

                            <button id="update-order-btn" class="w-full bg-green-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-green-600 transition duration-200">
                                עדכן הזמנה
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Floating Action Button (Mobile) -->
            <button id="fab-update-order" class="lg:hidden fixed bottom-6 left-6 bg-green-500 text-white rounded-full shadow-lg hover:bg-green-600 transition-all duration-200 z-50 flex items-center justify-center" style="width: 64px; height: 64px;">
                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
            </button>
        </div>
    `;

    // Load products and order data
    try {
        const productsSnapshot = await getDocs(collection(db, "products"));
        products = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Sort products by brand (מותג) by default
        products.sort((a, b) => {
            const brandA = (a.brand || '').toLowerCase();
            const brandB = (b.brand || '').toLowerCase();
            if (brandA < brandB) return -1;
            if (brandA > brandB) return 1;
            // If brands are the same, sort by name
            const nameA = (a.name || '').toLowerCase();
            const nameB = (b.name || '').toLowerCase();
            return nameA.localeCompare(nameB);
        });
        
        // Load order data
        const orderLoaded = await loadOrderData(db, auth, orderId);
        if (!orderLoaded) {
            showView(fromView || 'order-history');
            return;
        }
        
        // Try to load from storage, fallback to order data if not found
        if (!loadCartFromStorage()) {
            // Cart is already loaded from order data in loadOrderData
        }

        // Populate brand filter
        const brands = [...new Set(products.map(p => p.brand).filter(Boolean))].sort();
        const brandFilter = document.getElementById('brand-filter');
        brands.forEach(brand => {
            const option = document.createElement('option');
            option.value = brand;
            option.textContent = brand;
            brandFilter.appendChild(option);
        });

        // Render initial state
        renderProducts();
        renderCartIndicator();
        renderCartSummary();

        // Event handlers
        document.getElementById('back-btn').addEventListener('click', () => {
            showView(fromView || 'order-history');
        });

        document.getElementById('brand-filter').addEventListener('change', (e) => {
            renderProducts(e.target.value);
            saveCartToStorage();
        });

        document.getElementById('update-order-btn').addEventListener('click', async () => {
            const button = document.getElementById('update-order-btn');
            const originalText = button.textContent;
            
            // Prevent double submission
            if (button.disabled) return;
            
            button.disabled = true;
            button.textContent = 'מעדכן...';
            
            try {
                await updateOrder(db, auth, showView);
            } finally {
                button.disabled = false;
                button.textContent = originalText;
            }
        });

        // Floating Action Button handler (mobile)
        const fabButton = document.getElementById('fab-update-order');
        if (fabButton) {
            fabButton.addEventListener('click', async () => {
                const mainButton = document.getElementById('update-order-btn');
                const originalHTML = fabButton.innerHTML;
                
                // Prevent double submission
                if (fabButton.disabled || mainButton.disabled) return;
                
                fabButton.disabled = true;
                mainButton.disabled = true;
                fabButton.innerHTML = '<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>';
                mainButton.textContent = 'מעדכן...';
                
                try {
                    await updateOrder(db, auth, showView);
                } finally {
                    fabButton.disabled = false;
                    mainButton.disabled = false;
                    fabButton.innerHTML = originalHTML;
                    mainButton.textContent = 'עדכן הזמנה';
                }
            });
        }

        // Cart toggle (for mobile)
        document.getElementById('toggle-cart').addEventListener('click', () => {
            const cartSummary = document.querySelector('.lg\\:col-span-1');
            cartSummary.classList.toggle('hidden');
        });

        // Event delegation for product buttons (scoped to this view)
        const productsContainer = document.getElementById('products-container');
        const cartSummary = document.getElementById('cart-summary');
        
        if (productsContainer) {
            productsContainer.addEventListener('click', (e) => {
                // Try to find the button element if we clicked on something inside it
                let button = e.target;
                if (button.tagName !== 'BUTTON') {
                    button = button.closest('button');
                }
                
                if (!button) return;
                
                const action = button.dataset.action;
                const productId = button.dataset.productId || button.dataset['product-id'];
                
                if (!action || !productId) return;
                
                // Prevent default behavior
                e.preventDefault();
                e.stopPropagation();
                
                switch (action) {
                    case 'add-to-cart':
                        addToCart(productId, 1);
                        break;
                    case 'remove-from-cart':
                        removeFromCart(productId, 1);
                        break;
                    case 'toggle-package-mode':
                        togglePackageMode(productId);
                        break;
                }
            });
        }
        
        if (cartSummary) {
            cartSummary.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                const productId = e.target.dataset.productId || e.target.dataset['product-id'];
                
                if (!action || !productId) return;
                
                switch (action) {
                    case 'add-to-cart':
                        addToCart(productId, 1);
                        break;
                    case 'remove-from-cart':
                        removeFromCart(productId, 1);
                        break;
                }
            });
            
            cartSummary.addEventListener('change', (e) => {
                if (e.target.dataset.action === 'set-cart-quantity') {
                    const productId = e.target.dataset.productId || e.target.dataset['product-id'];
                    const quantity = parseInt(e.target.value) || 0;
                    setCartQuantity(productId, quantity);
                }
            });
        }

    } catch (error) {
        console.error("Error in showEditOrderView:", error);
        main.innerHTML = `
            <div class="text-red-500 text-center p-8">
                <h3 class="text-xl font-bold mb-2">שגיאה בטעינת עמוד העריכה</h3>
                <p class="mb-4">${error.message}</p>
                <button id="error-back-btn" class="bg-blue-500 text-white px-4 py-2 rounded">חזור</button>
            </div>
        `;
        
        // Add event listener for the error back button
        document.getElementById('error-back-btn')?.addEventListener('click', () => {
            showView(fromView || 'order-history');
        });
    }
}

// Make functions available globally
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.setCartQuantity = setCartQuantity;
window.togglePackageMode = togglePackageMode;