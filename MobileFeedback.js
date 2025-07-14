// מערכת פידבק והפטי למובייל
export class MobileFeedback {
    constructor() {
        this.isSupported = {
            vibration: 'vibrate' in navigator,
            haptic: 'vibrate' in navigator,
            notifications: 'Notification' in window
        };
    }

    // ויברציה קלה להצלחה
    success() {
        if (this.isSupported.vibration) {
            navigator.vibrate([50]);
        }
    }

    // ויברציה לשגיאה
    error() {
        if (this.isSupported.vibration) {
            navigator.vibrate([100, 50, 100]);
        }
    }

    // ויברציה לאזהרה
    warning() {
        if (this.isSupported.vibration) {
            navigator.vibrate([200]);
        }
    }

    // ויברציה להוספה לעגלה
    addToCart() {
        if (this.isSupported.vibration) {
            navigator.vibrate([30]);
        }
    }

    // ויברציה לליקוט פריט
    itemPicked() {
        if (this.isSupported.vibration) {
            navigator.vibrate([50, 30, 50]);
        }
    }

    // ויברציה לסיום ליקוט
    orderComplete() {
        if (this.isSupported.vibration) {
            navigator.vibrate([100, 50, 100, 50, 200]);
        }
    }

    // נגינת צליל (אם נתמך)
    playSound(type = 'success') {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            const frequencies = {
                success: 800,
                error: 300,
                warning: 600,
                info: 500
            };

            oscillator.frequency.value = frequencies[type] || frequencies.success;
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.1);
        } catch (error) {
            // דפדפן לא תומך או אודיו חסום
            console.log('Audio feedback not available');
        }
    }

    // בקשת הרשאות התראות
    async requestNotificationPermission() {
        if (!this.isSupported.notifications) return false;

        if (Notification.permission === 'granted') return true;
        
        if (Notification.permission !== 'denied') {
            const permission = await Notification.requestPermission();
            return permission === 'granted';
        }
        
        return false;
    }

    // שליחת התראה
    showNotification(title, options = {}) {
        if (!this.isSupported.notifications || Notification.permission !== 'granted') {
            return null;
        }

        const notification = new Notification(title, {
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            vibrate: [200, 100, 200],
            tag: 'warehouse-notification',
            ...options
        });

        // סגירה אוטומטית אחרי 5 שניות
        setTimeout(() => {
            notification.close();
        }, 5000);

        return notification;
    }

    // התראה למלאי נמוך
    notifyLowStock(productName, stock) {
        this.warning();
        this.showNotification('מלאי נמוך!', {
            body: `${productName} - נותרו ${stock} יחידות`,
            icon: '⚠️'
        });
    }

    // התראה לסיום הזמנה
    notifyOrderComplete(orderId) {
        this.orderComplete();
        this.showNotification('הזמנה הושלמה!', {
            body: `הזמנה ${orderId} נלקטה בהצלחה`,
            icon: '✅'
        });
    }
}

// יצירת מופע גלובלי
export const mobileFeedback = new MobileFeedback();

// פונקציות עזר גלובליות
window.vibrate = {
    success: () => mobileFeedback.success(),
    error: () => mobileFeedback.error(),
    warning: () => mobileFeedback.warning(),
    addToCart: () => mobileFeedback.addToCart(),
    itemPicked: () => mobileFeedback.itemPicked(),
    orderComplete: () => mobileFeedback.orderComplete()
};

// בקשת הרשאות בטעינת הדף
document.addEventListener('DOMContentLoaded', () => {
    // בקשת הרשאות רק בעת פעולה ראשונה של המשתמש
    let userInteracted = false;
    
    const requestPermissions = async () => {
        if (!userInteracted) {
            userInteracted = true;
            await mobileFeedback.requestNotificationPermission();
        }
    };
    
    document.addEventListener('click', requestPermissions, { once: true });
    document.addEventListener('touchstart', requestPermissions, { once: true });
});
