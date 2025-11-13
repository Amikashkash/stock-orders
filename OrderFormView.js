/**
 * OrderFormView - Unified component for creating and editing orders
 * Handles both create and edit modes
 */

import { collection, getDocs, addDoc, doc, getDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { getNextOrderNumber } from './utils.js';
import { ShoppingCart } from './ShoppingCart.js';

/**
 * OrderFormView component
 */
export class OrderFormView {
    constructor(mode = 'create') {
        this.mode = mode; // 'create' or 'edit'
        this.products = [];
        this.cart = new ShoppingCart(mode === 'edit' ? 'warehouse_edit_cart' : 'warehouse_cart');
        this.db = null;
        this.auth = null;
        this.showView = null;
        this.draftOrderId = null;
        this.originalOrder = null;
        this.orderId = null;
    }

    /**
     * Initialize the view
     * @param {Object} db - Firestore database instance
     * @param {Object} auth - Firebase auth instance
     * @param {Function} showView - Function to navigate between views
     * @param {Object} params - Additional parameters (orderId for edit mode)
     * @returns {Array} Array of cleanup functions
     */
    async init(db, auth, showView, params = {}) {
        this.db = db;
        this.auth = auth;
        this.showView = showView;

        if (this.mode === 'edit') {
            this.orderId = params.orderId;
            if (!this.orderId) {
                window.showError('מזהה הזמנה לא נמצא');
                showView('order-history');
                return [];
            }
            this.cart.initialize(this.orderId);
        } else {
            this.cart.initialize();
        }

        try {
            // Load products
            await this.loadProducts();

            // For edit mode, load order data
            if (this.mode === 'edit') {
                const success = await this.loadOrderData();
                if (!success) {
                    showView(params.fromView || 'order-history');
                    return [];
                }
            }

            // Render the view
            this.render();
            this.setupEventListeners();

            // Load cart from storage or show restored message
            if (this.cart.loadFromStorage()) {
                const itemCount = this.cart.getTotalQuantity();
                if (itemCount > 0 && this.mode === 'create') {
                    setTimeout(() => {
                        window.showInfo(`השתחזרו ${itemCount} פריטים מהעגלה השמורה`);
                    }, 500);
                }
            }

            // Setup periodic auto-save for create mode
            if (this.mode === 'create') {
                setInterval(() => {
                    if (this.cart.getTotalItems() > 0) {
                        this.cart.setupAutoSave(() => this.saveDraftOrder());
                    }
                }, 30000);
            }

            return this.getCleanupFunctions();
        } catch (error) {
            console.error('Error initializing OrderFormView:', error);
            window.showError('שגיאה באתחול הטופס');
            return [];
        }
    }

    /**
     * Load all products from database
     */
    async loadProducts() {
        try {
            if (!this.db) {
                throw new Error('Database not provided');
            }

            const snap = await getDocs(collection(this.db, "products"));
            this.products = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            if (this.products.length === 0) {
                console.warn('No products found in database');
            }
        } catch (error) {
            console.error('Error loading products:', error);
            throw error;
        }
    }

    /**
     * Load order data for edit mode
     */
    async loadOrderData() {
        try {
            const orderRef = doc(this.db, "orders", this.orderId);
            const orderSnap = await getDoc(orderRef);

            if (!orderSnap.exists()) {
                throw new Error('ההזמנה לא נמצאה');
            }

            this.originalOrder = { id: orderSnap.id, ...orderSnap.data() };

            // Check permissions
            if (this.originalOrder.createdBy !== this.auth.currentUser?.uid) {
                throw new Error('ניתן לערוך רק הזמנות שלך');
            }

            if (this.originalOrder.status !== 'pending') {
                throw new Error('ניתן לערוך רק הזמנות ממתינות');
            }

            // Load order items
            const itemsSnapshot = await getDocs(collection(this.db, "orders", this.orderId, "orderItems"));
            const orderItems = itemsSnapshot.docs.map(doc => doc.data());

            // Load items into cart
            this.cart.loadFromOrderItems(orderItems);

            return true;
        } catch (error) {
            console.error("Error loading order data:", error);
            window.showError(`שגיאה בטעינת ההזמנה: ${error.message}`);
            return false;
        }
    }

    /**
     * Get HTML for the view
     */
    getHTML() {
        const title = this.mode === 'edit' ? 'עריכת הזמנה' : 'הוספת הזמנה';
        const saveButtonText = this.mode === 'edit' ? 'עדכן הזמנה' : 'שמור הזמנה';

        return `
            <div>
                <div class="mobile-top-nav">
                    <div class="flex items-center mb-4 md:mb-0">
                        <button type="button" data-action="show-view" data-view="dashboard" class="text-indigo-600 hover:text-indigo-800 p-2 rounded-full hover:bg-gray-100 mr-2" title="חזרה לדשבורד">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l-4-4m0 0l-4 4m4-4v12" /></svg>
                        </button>
                        <span class="font-bold text-xl">${title}</span>
                        <span id="cart-indicator" class="ml-2 text-green-700"></span>
                    </div>
                </div>

                <div class="mb-4">
                    <label for="brand-filter" class="font-semibold">סנן לפי מותג:</label>
                    <select id="brand-filter" class="input-style ml-2">
                        <option value="">הצג הכל</option>
                    </select>
                </div>

                ${this.mode === 'create' ? `
                <div class="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div class="flex items-center text-blue-800">
                        <span class="text-lg mr-2">💡</span>
                        <div>
                            <span class="font-medium">הזמנה גמישה לפי מוצר</span>
                            <div class="text-xs text-blue-600 mt-1">כל מוצר ניתן להזמנה בנפרד לפי מארזים או יחידות בודדות</div>
                        </div>
                    </div>
                </div>
                ` : ''}

                <div id="products-list" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8"></div>

                <div class="bg-gray-50 p-4 rounded-lg shadow mt-4">
                    <div class="flex items-center justify-between mb-2">
                        <h3 class="font-bold text-lg">סיכום עגלה</h3>
                        <button id="clear-cart-btn" class="text-xs text-red-600 hover:text-red-800 px-2 py-1 border border-red-300 rounded hover:bg-red-50 transition-colors">
                            רוקן עגלה
                        </button>
                    </div>
                    <div id="cart-summary"></div>

                    <div class="mt-4">
                        <label for="order-notes" class="block text-sm font-medium text-gray-700 mb-2">הערות למלקט:</label>
                        <textarea id="order-notes" class="input-style resize-none" rows="3" placeholder="הערות מיוחדות, החלפות מותרות, הנחיות לליקוט..."></textarea>
                        <div class="text-xs text-gray-500 mt-1">הערות אלו יופיעו למלקט בעת ביצוע ההזמנה</div>
                    </div>

                    <button id="save-order-btn" class="mobile-primary-btn bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg mt-4 w-full font-semibold" disabled>
                        ${saveButtonText}
                    </button>

                    <div class="mt-4 text-center">
                        <button type="button" data-action="show-view" data-view="dashboard" class="text-indigo-600 hover:text-indigo-800 px-4 py-2 rounded-lg border border-indigo-300 hover:bg-indigo-50 transition-colors">
                            ← חזרה לדשבורד
                        </button>
                    </div>
                </div>

                <button id="fab-save-btn" class="fab-save" title="${saveButtonText}" disabled>
                    💾
                </button>
            </div>
        `;
    }

    /**
     * Render the view
     */
    render() {
        // Populate brand filter
        const brands = this.getBrands();
        const brandSelect = document.getElementById('brand-filter');
        if (brandSelect) {
            brands.forEach(brand => {
                const opt = document.createElement('option');
                opt.value = brand;
                opt.textContent = brand;
                brandSelect.appendChild(opt);
            });
        }

        // Set notes if editing
        if (this.mode === 'edit' && this.originalOrder?.notes) {
            const notesField = document.getElementById('order-notes');
            if (notesField) {
                notesField.value = this.originalOrder.notes;
            }
        }

        this.renderProducts();
        this.renderCartIndicator();
        this.renderCartSummary();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Brand filter
        const brandFilter = document.getElementById('brand-filter');
        if (brandFilter) {
            brandFilter.addEventListener('change', (e) => {
                this.renderProducts(e.target.value);
                this.cart.saveToStorage();
            });
        }

        // Product list clicks
        const productsList = document.getElementById('products-list');
        if (productsList) {
            productsList.addEventListener('click', (e) => this.handleProductClick(e));
            productsList.addEventListener('change', (e) => this.handleProductChange(e));
        }

        // Save button
        const saveBtn = document.getElementById('save-order-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.handleSave());
        }

        // FAB button
        const fabBtn = document.getElementById('fab-save-btn');
        if (fabBtn) {
            fabBtn.addEventListener('click', () => this.handleSave());
        }

        // Clear cart button
        const clearBtn = document.getElementById('clear-cart-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.handleClearCart());
        }

        // Save cart on page visibility change (for mobile)
        this.addMobileEventListeners();
    }

    /**
     * Add mobile-specific event listeners
     */
    addMobileEventListeners() {
        const saveCart = () => this.cart.saveToStorage();

        window.addEventListener('beforeunload', saveCart);
        window.addEventListener('pagehide', saveCart);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                saveCart();
            }
        });
    }

    /**
     * Handle product click events
     */
    handleProductClick(e) {
        const addBtn = e.target.closest('.add-to-cart-btn');
        const decBtn = e.target.closest('.decrease-qty-btn');

        if (addBtn) {
            const productId = addBtn.dataset.productId;
            this.handleAddToCart(productId);
        } else if (decBtn) {
            const productId = decBtn.dataset.productId;
            this.cart.removeFromCart(productId, 1);
            this.updateUI();
        }
    }

    /**
     * Handle product change events (checkboxes)
     */
    handleProductChange(e) {
        const packageCheckbox = e.target.closest('.package-mode-checkbox');
        if (packageCheckbox) {
            const productId = packageCheckbox.dataset.productId;
            this.cart.togglePackageMode(productId);

            const product = this.products.find(p => p.id === productId);
            const productName = product ? product.name : 'המוצר';

            if (packageCheckbox.checked) {
                window.showInfo(`${productName} יוזמן לפי מארזים`);
            } else {
                window.showInfo(`${productName} יוזמן לפי יחידות`);
            }

            this.updateUI();
        }
    }

    /**
     * Handle add to cart with stock validation
     */
    handleAddToCart(productId) {
        const product = this.products.find(p => p.id === productId);
        const currentQty = this.cart.getQuantity(productId);
        const isPackageMode = this.cart.isPackageMode(productId);

        // Stock validation
        if (product && product.stockQuantity !== undefined) {
            const packageQty = product.packageQuantity || 1;
            const effectiveStock = isPackageMode ? Math.floor(product.stockQuantity / packageQty) : product.stockQuantity;

            if (currentQty >= effectiveStock) {
                const unitText = isPackageMode ? "מארזים" : "יחידות";
                window.showError(`לא ניתן להוסיף עוד - מלאי זמין: ${effectiveStock} ${unitText}`);
                return;
            }

            if (currentQty + 1 > effectiveStock) {
                const unitText = isPackageMode ? "מארזים" : "יחידות";
                window.showWarning(`זהירות: מבקש כמות גדולה מהמלאי הזמין (${effectiveStock} ${unitText})`);
            }
        }

        this.cart.addToCart(productId, 1);
        const unitText = isPackageMode ? "מארז" : "יחידה";
        this.showToast(`נוסף ${unitText} לעגלה!`);
        window.vibrate?.addToCart?.(); // Haptic feedback

        this.updateUI();

        // Auto-save for create mode
        if (this.mode === 'create') {
            this.cart.setupAutoSave(() => this.saveDraftOrder());
        }
    }

    /**
     * Handle clear cart
     */
    handleClearCart() {
        if (this.cart.getTotalQuantity() > 0) {
            if (confirm('האם אתה בטוח שברצונך לרוקן את העגלה? פעולה זו לא ניתנת לביטול.')) {
                this.cart.clear();
                this.updateUI();
                window.showInfo('העגלה רוקנה בהצלחה');
            }
        } else {
            window.showInfo('העגלה כבר ריקה');
        }
    }

    /**
     * Handle save (create or update order)
     */
    async handleSave() {
        if (this.mode === 'create') {
            await this.saveOrder();
        } else {
            await this.updateOrder();
        }
    }

    /**
     * Save new order
     */
    async saveOrder() {
        const items = this.cart.getItems();
        if (items.length === 0) {
            window.showError('העגלה ריקה');
            return;
        }

        try {
            // Generate sequential order number
            const { displayId, sequentialNumber } = await getNextOrderNumber(this.db);

            // Fetch user info
            let storeName = "לא ידוע";
            let createdByName = "לא ידוע";
            if (this.auth.currentUser) {
                const userRef = doc(this.db, "users", this.auth.currentUser.uid);
                const userSnap = await getDoc(userRef);
                if (userSnap.exists()) {
                    const userData = userSnap.data();
                    storeName = userData.storeName || storeName;
                    createdByName = userData.fullName || createdByName;
                }
            }

            // Create order
            const order = {
                displayId,
                sequentialNumber,
                createdAt: new Date(),
                createdBy: this.auth.currentUser ? this.auth.currentUser.uid : null,
                storeName,
                createdByName,
                status: "pending",
                notes: document.getElementById('order-notes')?.value?.trim() || ""
            };

            const orderRef = await addDoc(collection(this.db, "orders"), order);

            // Add order items
            const orderItems = this.cart.exportForOrder(this.products);
            for (const itemData of orderItems) {
                await addDoc(collection(this.db, "orders", orderRef.id, "orderItems"), itemData);
            }

            // Delete draft order if exists
            if (this.draftOrderId) {
                try {
                    await deleteDoc(doc(this.db, "orders", this.draftOrderId));
                } catch (e) {
                    console.warn('Could not delete draft order:', e);
                }
            }

            // Clear cart
            this.cart.clear();
            this.draftOrderId = null;

            // Update UI
            this.updateUI();

            // Scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });

            window.showSuccess(`ההזמנה ${order.displayId} נשמרה בהצלחה!`);
        } catch (error) {
            console.error('Error saving order:', error);
            window.showError('שגיאה בשמירת ההזמנה: ' + error.message);
        }
    }

    /**
     * Update existing order
     */
    async updateOrder() {
        const items = this.cart.getItems();
        if (items.length === 0) {
            window.showError('אין פריטים בעגלה');
            return;
        }

        try {
            // Update order metadata
            const orderRef = doc(this.db, "orders", this.orderId);
            await updateDoc(orderRef, {
                notes: document.getElementById('order-notes')?.value?.trim() || "",
                updatedAt: new Date()
            });

            // Delete existing order items
            const itemsSnapshot = await getDocs(collection(this.db, "orders", this.orderId, "orderItems"));
            for (const itemDoc of itemsSnapshot.docs) {
                await deleteDoc(doc(this.db, "orders", this.orderId, "orderItems", itemDoc.id));
            }

            // Add new order items
            const orderItems = this.cart.exportForOrder(this.products);
            for (const itemData of orderItems) {
                await addDoc(collection(this.db, "orders", this.orderId, "orderItems"), itemData);
            }

            // Clear cart
            this.cart.clear();
            this.orderId = null;
            this.originalOrder = null;

            window.showSuccess('ההזמנה עודכנה בהצלחה!');

            // Return to order history
            if (this.showView) {
                this.showView('order-history');
            }
        } catch (error) {
            console.error("Error updating order:", error);
            window.showError(`שגיאה בעדכון ההזמנה: ${error.message}`);
        }
    }

    /**
     * Save draft order (create mode only)
     */
    async saveDraftOrder() {
        if (this.mode !== 'create') return;

        const items = this.cart.getItems();
        if (items.length === 0) return;

        try {
            if (!this.auth.currentUser) return;

            const orderData = {
                items: items.map(([productId, quantity]) => ({ productId, quantity })),
                status: "draft",
                createdBy: this.auth.currentUser.uid,
                createdByName: this.auth.currentUser.displayName || this.auth.currentUser.email || "לא ידוע",
                updatedAt: new Date()
            };

            if (this.draftOrderId) {
                await updateDoc(doc(this.db, "orders", this.draftOrderId), orderData);
            } else {
                orderData.createdAt = new Date();
                const docRef = await addDoc(collection(this.db, "orders"), orderData);
                this.draftOrderId = docRef.id;
            }
        } catch (e) {
            console.warn('Could not save draft order:', e);
        }
    }

    /**
     * Render products list
     */
    renderProducts(brandFilter = "") {
        const container = document.getElementById('products-list');
        if (!container) return;

        let filtered = brandFilter ? this.products.filter(p => p.brand === brandFilter) : this.products;
        container.innerHTML = "";

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="text-center text-gray-500 p-8">
                    <p>לא נמצאו מוצרים</p>
                    ${brandFilter ? `<p class="text-sm">סנן לפי מותג: ${brandFilter}</p>` : ''}
                </div>
            `;
            return;
        }

        filtered.forEach(product => {
            container.appendChild(this.createProductCard(product));
        });
    }

    /**
     * Create product card element
     */
    createProductCard(product) {
        const qty = this.cart.getQuantity(product.id);
        const isPackageMode = this.cart.isPackageMode(product.id);
        const imageUrl = product.imageUrl || product.image || '';
        const packageQty = product.packageQuantity || 1;
        const effectiveStock = isPackageMode ? Math.floor((product.stockQuantity || 0) / packageQty) : (product.stockQuantity || 0);
        const unitText = isPackageMode ? `מארז (${packageQty} יח')` : "יח'";

        let weightStr = "לא צויין";
        if (product.weight?.value && product.weight?.unit) {
            weightStr = `${product.weight.value} ${product.weight.unit}`;
        }

        const stockStr = (product.stockQuantity !== undefined && product.stockQuantity !== null)
            ? `<div class="text-xs text-gray-700 mb-1">מלאי: <b>${effectiveStock}</b> ${unitText}</div>`
            : `<div class="text-xs text-gray-400 mb-1">מלאי לא ידוע</div>`;

        const card = document.createElement('div');
        card.className = `product-card relative border rounded-lg p-4 bg-white shadow-md hover:shadow-lg transition-all ${qty > 0 ? 'has-quantity' : ''}`;

        card.innerHTML = `
            ${imageUrl ? `
                <img src="${imageUrl}"
                     alt="${product.name}"
                     class="w-24 h-24 object-contain mb-2 rounded mx-auto"
                     onerror="this.style.opacity='0.5'">
            ` : `
                <div class="w-24 h-24 mb-2 mx-auto product-image-placeholder rounded flex items-center justify-center bg-gray-100">
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
        `;

        return card;
    }

    /**
     * Render cart indicator
     */
    renderCartIndicator() {
        const cartCount = this.cart.getTotalQuantity();
        const el = document.getElementById('cart-indicator');
        if (el) {
            el.textContent = cartCount > 0 ? ` (${cartCount})` : '';
        }
    }

    /**
     * Render cart summary
     */
    renderCartSummary() {
        const cartContainer = document.getElementById('cart-summary');
        const items = this.cart.getItems();
        if (!cartContainer) return;

        if (items.length === 0) {
            cartContainer.innerHTML = `
                <div class="text-center py-4">
                    <div class="text-4xl mb-2">🛒</div>
                    <div class="text-gray-500 font-medium">העגלה ריקה</div>
                    <div class="text-xs text-gray-400 mt-1">הוסף מוצרים כדי ליצור הזמנה</div>
                </div>
            `;
            this.updateButtonState(true);
            return;
        }

        cartContainer.innerHTML = `
            <ul class="mb-4">
                ${items.map(([productId, qty]) => {
                    const product = this.products.find(p => p.id === productId);
                    const isPackageMode = this.cart.isPackageMode(productId);
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
                    return `<li class="mb-1">${displayText}</li>`;
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
                        const isPackageMode = this.cart.isPackageMode(productId);
                        const product = this.products.find(p => p.id === productId);
                        const packageQty = product?.packageQuantity || 1;
                        return total + (isPackageMode ? qty * packageQty : qty);
                    }, 0)}</span>
                </div>
            </div>
        `;

        this.updateButtonState(false);
    }

    /**
     * Update save button state
     */
    updateButtonState(disabled) {
        const saveBtn = document.getElementById('save-order-btn');
        const fabBtn = document.getElementById('fab-save-btn');

        if (saveBtn) {
            saveBtn.disabled = disabled;
        }

        if (fabBtn) {
            fabBtn.disabled = disabled;
            if (disabled) {
                fabBtn.classList.remove('visible');
            } else {
                fabBtn.classList.add('visible');
            }
        }
    }

    /**
     * Update all UI components
     */
    updateUI() {
        const brandFilter = document.getElementById('brand-filter');
        this.renderProducts(brandFilter ? brandFilter.value : '');
        this.renderCartIndicator();
        this.renderCartSummary();
    }

    /**
     * Get unique brands from products
     */
    getBrands() {
        return [...new Set(this.products.map(p => p.brand).filter(Boolean))].sort();
    }

    /**
     * Show toast notification
     */
    showToast(msg) {
        let toast = document.getElementById('cart-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'cart-toast';
            toast.style.cssText = `
                position: fixed;
                bottom: 30px;
                left: 50%;
                transform: translateX(-50%);
                background: #38a169;
                color: white;
                padding: 12px 24px;
                border-radius: 8px;
                font-weight: bold;
                z-index: 9999;
                display: none;
            `;
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.style.display = 'block';
        setTimeout(() => { toast.style.display = 'none'; }, 1200);
    }

    /**
     * Get cleanup functions for event listeners
     */
    getCleanupFunctions() {
        return [];
    }
}

// Export convenience functions for backward compatibility
export const CreateOrderView = {
    getHTML: () => new OrderFormView('create').getHTML(),
    init: async (db, auth, showView) => {
        const view = new OrderFormView('create');
        return await view.init(db, auth, showView);
    }
};

export async function showEditOrderView(db, auth, showView, params = {}) {
    const main = document.querySelector('main') || document.getElementById('app-content');
    if (!main) {
        console.error('Could not find main content area');
        return;
    }

    const view = new OrderFormView('edit');
    main.innerHTML = view.getHTML();
    await view.init(db, auth, showView, params);
}
