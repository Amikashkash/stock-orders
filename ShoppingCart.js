/**
 * Shopping Cart Module
 * Manages shopping cart state and operations for both create and edit order views
 */

export class ShoppingCart {
    constructor(storageKey = 'warehouse_cart') {
        this.storageKey = storageKey;
        this.cart = {}; // productId => quantity
        this.packageMode = {}; // productId => boolean
        this.orderId = null; // For edit mode
        this.autoSaveTimeout = null;
    }

    /**
     * Initialize cart with optional order ID (for edit mode)
     * @param {string} orderId - Optional order ID for edit mode
     */
    initialize(orderId = null) {
        this.orderId = orderId;
        this.loadFromStorage();
    }

    /**
     * Add quantity to cart
     * @param {string} productId - Product ID
     * @param {number} quantity - Quantity to add
     */
    addToCart(productId, quantity = 1) {
        if (!this.cart[productId]) {
            this.cart[productId] = 0;
        }
        this.cart[productId] += quantity;
        if (this.cart[productId] < 0) {
            this.cart[productId] = 0;
        }
        this.saveToStorage();
    }

    /**
     * Remove quantity from cart
     * @param {string} productId - Product ID
     * @param {number} quantity - Quantity to remove
     */
    removeFromCart(productId, quantity = 1) {
        if (!this.cart[productId]) return;

        this.cart[productId] -= quantity;
        if (this.cart[productId] <= 0) {
            this.cart[productId] = 0;
            delete this.packageMode[productId];
        }
        this.saveToStorage();
    }

    /**
     * Set exact quantity for a product
     * @param {string} productId - Product ID
     * @param {number} quantity - Exact quantity
     */
    setQuantity(productId, quantity) {
        if (quantity <= 0) {
            this.cart[productId] = 0;
            delete this.packageMode[productId];
        } else {
            this.cart[productId] = quantity;
        }
        this.saveToStorage();
    }

    /**
     * Toggle package mode for a product
     * @param {string} productId - Product ID
     */
    togglePackageMode(productId) {
        this.packageMode[productId] = !this.packageMode[productId];
        this.saveToStorage();
    }

    /**
     * Get quantity for a product
     * @param {string} productId - Product ID
     * @returns {number} Quantity
     */
    getQuantity(productId) {
        return this.cart[productId] || 0;
    }

    /**
     * Check if product is in package mode
     * @param {string} productId - Product ID
     * @returns {boolean} Is in package mode
     */
    isPackageMode(productId) {
        return this.packageMode[productId] || false;
    }

    /**
     * Get all cart items (non-zero quantities)
     * @returns {Array} Array of [productId, quantity] pairs
     */
    getItems() {
        return Object.entries(this.cart).filter(([_, qty]) => qty > 0);
    }

    /**
     * Get total number of unique items in cart
     * @returns {number} Total items
     */
    getTotalItems() {
        return this.getItems().length;
    }

    /**
     * Get total quantity (sum of all quantities)
     * @returns {number} Total quantity
     */
    getTotalQuantity() {
        return Object.values(this.cart).reduce((sum, qty) => sum + qty, 0);
    }

    /**
     * Clear the entire cart
     */
    clear() {
        this.cart = {};
        this.packageMode = {};
        this.clearStorage();
    }

    /**
     * Load cart from order data (for edit mode)
     * @param {Array} orderItems - Array of order items from Firestore
     */
    loadFromOrderItems(orderItems) {
        this.cart = {};
        this.packageMode = {};

        orderItems.forEach(item => {
            const productId = item.productId;

            if (item.orderType === "package") {
                this.packageMode[productId] = true;
                this.cart[productId] = item.packagesOrdered || 0;
            } else {
                this.packageMode[productId] = false;
                this.cart[productId] = item.quantityOrdered || 0;
            }
        });

        this.saveToStorage();
    }

    /**
     * Save cart to localStorage
     */
    saveToStorage() {
        try {
            const data = {
                cart: this.cart,
                packageMode: this.packageMode,
                timestamp: Date.now(),
                orderId: this.orderId
            };
            localStorage.setItem(this.storageKey, JSON.stringify(data));
        } catch (e) {
            console.warn('Failed to save cart to localStorage:', e);
        }
    }

    /**
     * Load cart from localStorage
     * @returns {boolean} True if cart was loaded successfully
     */
    loadFromStorage() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (!saved) return false;

            const data = JSON.parse(saved);

            // Validate data structure
            if (!data || typeof data !== 'object') {
                this.clearStorage();
                return false;
            }

            // Check if data is too old (24 hours)
            const maxAge = 24 * 60 * 60 * 1000;
            if (data.timestamp && (Date.now() - data.timestamp) > maxAge) {
                this.clearStorage();
                return false;
            }

            // For edit mode, verify we're editing the same order
            if (this.orderId && data.orderId !== this.orderId) {
                return false;
            }

            // Load data with validation
            this.cart = data.cart || {};
            this.packageMode = data.packageMode || {};

            // Validate cart data
            Object.keys(this.cart).forEach(key => {
                if (typeof this.cart[key] !== 'number' || this.cart[key] < 0) {
                    delete this.cart[key];
                }
            });

            return true;
        } catch (e) {
            console.warn('Failed to load cart from localStorage:', e);
            this.clearStorage();
            return false;
        }
    }

    /**
     * Clear cart from localStorage
     */
    clearStorage() {
        try {
            localStorage.removeItem(this.storageKey);
        } catch (e) {
            console.warn('Failed to clear cart from localStorage:', e);
        }
    }

    /**
     * Setup auto-save with debounce
     * @param {Function} saveCallback - Callback function to save cart
     * @param {number} delay - Debounce delay in milliseconds
     */
    setupAutoSave(saveCallback, delay = 1000) {
        clearTimeout(this.autoSaveTimeout);

        // Save to localStorage immediately
        this.saveToStorage();

        // Debounce database save
        this.autoSaveTimeout = setTimeout(async () => {
            try {
                await saveCallback();
            } catch (e) {
                console.warn('Auto-save failed:', e);
            }
        }, delay);
    }

    /**
     * Export cart data for creating/updating orders
     * @param {Array} products - Array of all products
     * @returns {Array} Array of order items with full data
     */
    exportForOrder(products) {
        return this.getItems().map(([productId, qty]) => {
            const product = products.find(p => p.id === productId);
            const isPackageMode = this.isPackageMode(productId);
            const packageQty = product?.packageQuantity || 1;
            const actualQuantity = isPackageMode ? qty * packageQty : qty;

            return {
                productId,
                quantityOrdered: actualQuantity,
                orderType: isPackageMode ? "package" : "unit",
                packagesOrdered: isPackageMode ? qty : null,
                packageQuantity: isPackageMode ? packageQty : null
            };
        });
    }
}
