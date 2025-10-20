// Utility Functions for Stock Orders App
import { doc, getDoc, setDoc, runTransaction } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

/**
 * Generate the next sequential order number
 * @param {Object} db - Firestore database instance
 * @returns {Promise<{displayId: string, sequentialNumber: number}>}
 */
export async function getNextOrderNumber(db) {
    try {
        const result = await runTransaction(db, async (transaction) => {
            const counterRef = doc(db, "counters", "orderCounter");
            const counterDoc = await transaction.get(counterRef);
            
            let nextNumber = 1;
            if (counterDoc.exists()) {
                nextNumber = (counterDoc.data().value || 0) + 1;
            }
            
            // Update counter atomically
            transaction.set(counterRef, { 
                value: nextNumber,
                lastUpdated: new Date()
            });
            
            return {
                displayId: `ORD-${nextNumber.toString().padStart(4, '0')}`, // ORD-0001
                sequentialNumber: nextNumber
            };
        });
        
        console.log('Generated order number:', result.displayId);
        return result;
    } catch (error) {
        console.error('Error generating order number:', error);
        // Fallback to timestamp-based ID if counter fails
        const timestamp = Date.now().toString().slice(-6);
        return {
            displayId: `ORD-${timestamp}`,
            sequentialNumber: parseInt(timestamp)
        };
    }
}

/**
 * Format date for display
 * @param {Date|Timestamp} date - Date to format
 * @param {string} format - Format type ('short', 'long', 'relative')
 * @returns {string} Formatted date string
 */
export function formatDate(date, format = 'short') {
    if (!date) return '';
    
    const d = date.toDate ? date.toDate() : new Date(date);
    const now = new Date();
    const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
    
    if (format === 'relative') {
        if (diffDays === 0) return 'היום';
        if (diffDays === 1) return 'אתמול';
        if (diffDays < 7) return `לפני ${diffDays} ימים`;
    }
    
    if (format === 'long') {
        return d.toLocaleDateString('he-IL', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    
    // Short format (default)
    return d.toLocaleDateString('he-IL', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Get relative date label for grouping
 * @param {Date|Timestamp} date - Date to check
 * @returns {string} Relative date label
 */
export function getRelativeDate(date) {
    if (!date) return 'תאריך לא ידוע';
    
    const d = date.toDate ? date.toDate() : new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (isSameDay(d, today)) return 'היום';
    if (isSameDay(d, yesterday)) return 'אתמול';
    
    return d.toLocaleDateString('he-IL', { 
        day: 'numeric', 
        month: 'long',
        weekday: 'long'
    });
}

/**
 * Check if two dates are the same day
 * @param {Date} d1 - First date
 * @param {Date} d2 - Second date
 * @returns {boolean} True if same day
 */
export function isSameDay(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
}

/**
 * Show loading indicator
 * @param {string} message - Loading message
 * @returns {string} Loading HTML
 */
export function showLoading(message = 'טוען...') {
    return `
        <div class="flex justify-center items-center p-8">
            <div class="flex items-center gap-3">
                <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                <span class="text-gray-600">${message}</span>
            </div>
        </div>
    `;
}

/**
 * Debounce function calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Group array of items by a key function
 * @param {Array} array - Array to group
 * @param {Function} keyFn - Function that returns grouping key
 * @returns {Object} Grouped object
 */
export function groupBy(array, keyFn) {
    return array.reduce((groups, item) => {
        const key = keyFn(item);
        if (!groups[key]) {
            groups[key] = [];
        }
        groups[key].push(item);
        return groups;
    }, {});
}
