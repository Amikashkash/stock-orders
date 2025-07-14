// מערכת שמירת התקדמות ליקוט
export class PickingProgressManager {
    constructor() {
        this.storageKey = 'picking_progress';
    }

    // שמירת התקדמות ליקוט
    saveProgress(orderId, itemsProgress, notes = '') {
        try {
            const progressData = {
                orderId,
                items: itemsProgress,
                notes,
                timestamp: Date.now(),
                lastModified: new Date().toISOString()
            };
            
            const allProgress = this.getAllProgress();
            allProgress[orderId] = progressData;
            
            localStorage.setItem(this.storageKey, JSON.stringify(allProgress));
            return true;
        } catch (error) {
            console.warn('Failed to save picking progress:', error);
            return false;
        }
    }

    // טעינת התקדמות ליקוט
    loadProgress(orderId) {
        try {
            const allProgress = this.getAllProgress();
            const progress = allProgress[orderId];
            
            if (progress) {
                // בדיקה שההתקדמות לא ישנה מדי (יותר מ-7 ימים)
                const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 ימים
                if (Date.now() - progress.timestamp < maxAge) {
                    return progress;
                } else {
                    // מחיקת התקדמות ישנה
                    this.clearProgress(orderId);
                }
            }
        } catch (error) {
            console.warn('Failed to load picking progress:', error);
        }
        return null;
    }

    // קבלת כל ההתקדמויות
    getAllProgress() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            return saved ? JSON.parse(saved) : {};
        } catch (error) {
            console.warn('Failed to get all progress:', error);
            return {};
        }
    }

    // מחיקת התקדמות ספציפית
    clearProgress(orderId) {
        try {
            const allProgress = this.getAllProgress();
            delete allProgress[orderId];
            localStorage.setItem(this.storageKey, JSON.stringify(allProgress));
            return true;
        } catch (error) {
            console.warn('Failed to clear progress:', error);
            return false;
        }
    }

    // מחיקת כל ההתקדמויות
    clearAllProgress() {
        try {
            localStorage.removeItem(this.storageKey);
            return true;
        } catch (error) {
            console.warn('Failed to clear all progress:', error);
            return false;
        }
    }

    // קבלת רשימת הזמנות עם התקדמות שמורה
    getOrdersWithProgress() {
        const allProgress = this.getAllProgress();
        return Object.keys(allProgress).map(orderId => ({
            orderId,
            lastModified: allProgress[orderId].lastModified,
            timestamp: allProgress[orderId].timestamp,
            itemsCount: Object.keys(allProgress[orderId].items || {}).length
        }));
    }

    // ניקוי התקדמויות ישנות
    cleanOldProgress() {
        try {
            const allProgress = this.getAllProgress();
            const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 ימים
            const now = Date.now();
            let cleaned = 0;

            Object.keys(allProgress).forEach(orderId => {
                if (now - allProgress[orderId].timestamp > maxAge) {
                    delete allProgress[orderId];
                    cleaned++;
                }
            });

            if (cleaned > 0) {
                localStorage.setItem(this.storageKey, JSON.stringify(allProgress));
                console.log(`Cleaned ${cleaned} old picking progress entries`);
            }

            return cleaned;
        } catch (error) {
            console.warn('Failed to clean old progress:', error);
            return 0;
        }
    }
}

// יצירת מופע גלובלי
export const pickingProgressManager = new PickingProgressManager();

// ניקוי אוטומטי של נתונים ישנים בטעינת הדף
pickingProgressManager.cleanOldProgress();
