// מערכת התראות מתקדמת
export class NotificationSystem {
    constructor() {
        this.notifications = [];
        this.container = null;
        this.init();
    }

    init() {
        // יצירת מכולה להתראות
        this.container = document.createElement('div');
        this.container.id = 'notification-container';
        this.container.className = 'fixed top-4 left-4 z-50 space-y-2';
        document.body.appendChild(this.container);
    }

    // הצגת התראה
    show(message, type = 'info', duration = 5000) {
        const notification = this.createNotification(message, type);
        this.container.appendChild(notification);
        
        // הוספה לרשימה
        this.notifications.push(notification);
        
        // הסרה אוטומטית
        if (duration > 0) {
            setTimeout(() => {
                this.remove(notification);
            }, duration);
        }
        
        return notification;
    }

    createNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification-item transform transition-all duration-300 ease-in-out translate-x-full opacity-0`;
        
        const colors = {
            success: 'bg-green-500 border-green-600',
            error: 'bg-red-500 border-red-600',
            warning: 'bg-yellow-500 border-yellow-600',
            info: 'bg-blue-500 border-blue-600'
        };
        
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };
        
        notification.innerHTML = `
            <div class="${colors[type] || colors.info} text-white px-4 py-3 rounded-lg shadow-lg border-r-4 max-w-sm">
                <div class="flex items-start">
                    <span class="text-xl mr-3 mt-0.5">${icons[type] || icons.info}</span>
                    <div class="flex-1">
                        <p class="text-sm font-medium">${message}</p>
                    </div>
                    <button class="mr-2 text-white hover:text-gray-200 focus:outline-none" onclick="this.closest('.notification-item').remove()">
                        <span class="text-lg">&times;</span>
                    </button>
                </div>
            </div>
        `;
        
        // אנימציית כניסה
        setTimeout(() => {
            notification.classList.remove('translate-x-full', 'opacity-0');
        }, 10);
        
        return notification;
    }

    remove(notification) {
        if (notification && notification.parentNode) {
            // אנימציית יציאה
            notification.classList.add('translate-x-full', 'opacity-0');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
            
            // הסרה מהרשימה
            const index = this.notifications.indexOf(notification);
            if (index > -1) {
                this.notifications.splice(index, 1);
            }
        }
    }

    // הצגת התראה למלאי נמוך
    showLowStockAlert(productName, currentStock, minStock = 5) {
        const message = `מלאי נמוך: ${productName} - נותרו ${currentStock} יחידות`;
        return this.show(message, 'warning', 8000);
    }

    // הצגת התראת הצלחה
    showSuccess(message) {
        return this.show(message, 'success');
    }

    // הצגת התראת שגיאה
    showError(message) {
        return this.show(message, 'error', 8000);
    }

    // הצגת התראת מידע
    showInfo(message) {
        return this.show(message, 'info');
    }

    // ניקוי כל ההתראות
    clearAll() {
        this.notifications.forEach(notification => {
            this.remove(notification);
        });
    }
}

// יצירת מופע גלובלי
export const notificationSystem = new NotificationSystem();

// פונקציות עזר גלובליות
window.showNotification = (message, type, duration) => {
    return notificationSystem.show(message, type, duration);
};

window.showSuccess = (message) => notificationSystem.showSuccess(message);
window.showError = (message) => notificationSystem.showError(message);
window.showInfo = (message) => notificationSystem.showInfo(message);
window.showLowStock = (productName, stock) => notificationSystem.showLowStockAlert(productName, stock);
