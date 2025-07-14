// מערכת גיבוי וייצוא נתונים
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

export class DataExportSystem {
    constructor(db) {
        this.db = db;
    }

    // ייצוא מוצרים ל-CSV
    async exportProductsToCSV() {
        try {
            const productsSnap = await getDocs(collection(this.db, "products"));
            const products = [];
            
            productsSnap.forEach(doc => {
                const data = doc.data();
                products.push({
                    'מק"ט': doc.id,
                    'שם המוצר': data.name || '',
                    'מותג': data.brand || '',
                    'משקל': data.weight ? `${data.weight.value} ${data.weight.unit}` : '',
                    'מלאי': data.stockQuantity || 0,
                    'עלות': data.cost || '',
                    'כמות באריזה': data.packageQuantity || '',
                    'תאריך יצירה': data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleDateString('he-IL') : ''
                });
            });

            this.downloadCSV(products, 'products');
            window.showSuccess('רשימת המוצרים יוצאה בהצלחה!');
        } catch (error) {
            console.error('Error exporting products:', error);
            window.showError('שגיאה בייצוא רשימת המוצרים: ' + error.message);
        }
    }

    // ייצוא הזמנות ל-CSV
    async exportOrdersToCSV(fromDate = null, toDate = null) {
        try {
            let ordersQuery = collection(this.db, "orders");
            const ordersSnap = await getDocs(ordersQuery);
            const orders = [];
            
            for (const orderDoc of ordersSnap.docs) {
                const orderData = orderDoc.data();
                
                // סינון תאריכים אם נדרש
                if (fromDate || toDate) {
                    const orderDate = orderData.createdAt ? new Date(orderData.createdAt.seconds * 1000) : null;
                    if (fromDate && orderDate < fromDate) continue;
                    if (toDate && orderDate > toDate) continue;
                }
                
                // קבלת פרטי ההזמנה
                const orderItemsSnap = await getDocs(collection(this.db, "orders", orderDoc.id, "orderItems"));
                const itemsCount = orderItemsSnap.size;
                
                let totalQuantity = 0;
                orderItemsSnap.forEach(itemDoc => {
                    const item = itemDoc.data();
                    totalQuantity += item.quantityOrdered || 0;
                });

                orders.push({
                    'מזהה הזמנה': orderDoc.id,
                    'סטטוס': this.translateStatus(orderData.status),
                    'חנות': orderData.storeName || 'לא ידוע',
                    'הוזמן ע"י': orderData.createdByName || 'לא ידוע',
                    'תאריך הזמנה': orderData.createdAt ? new Date(orderData.createdAt.seconds * 1000).toLocaleDateString('he-IL') : '',
                    'תאריך השלמה': orderData.pickedAt ? new Date(orderData.pickedAt.seconds * 1000).toLocaleDateString('he-IL') : '',
                    'מספר פריטים': itemsCount,
                    'סה"כ כמות': totalQuantity,
                    'הערות': orderData.notes || ''
                });
            }

            this.downloadCSV(orders, 'orders');
            window.showSuccess('רשימת ההזמנות יוצאה בהצלחה!');
        } catch (error) {
            console.error('Error exporting orders:', error);
            window.showError('שגיאה בייצוא רשימת ההזמנות: ' + error.message);
        }
    }

    // ייצוא גיבוי מלא ל-JSON
    async exportFullBackup() {
        try {
            const backup = {
                exportDate: new Date().toISOString(),
                products: {},
                orders: {},
                users: {}
            };

            // ייצוא מוצרים
            const productsSnap = await getDocs(collection(this.db, "products"));
            productsSnap.forEach(doc => {
                backup.products[doc.id] = doc.data();
            });

            // ייצוא הזמנות
            const ordersSnap = await getDocs(collection(this.db, "orders"));
            for (const orderDoc of ordersSnap.docs) {
                backup.orders[orderDoc.id] = {
                    ...orderDoc.data(),
                    items: {}
                };
                
                // ייצוא פריטי ההזמנה
                const itemsSnap = await getDocs(collection(this.db, "orders", orderDoc.id, "orderItems"));
                itemsSnap.forEach(itemDoc => {
                    backup.orders[orderDoc.id].items[itemDoc.id] = itemDoc.data();
                });
            }

            // ייצוא משתמשים (ללא נתונים רגישים)
            const usersSnap = await getDocs(collection(this.db, "users"));
            usersSnap.forEach(doc => {
                const userData = doc.data();
                backup.users[doc.id] = {
                    fullName: userData.fullName || '',
                    storeName: userData.storeName || ''
                };
            });

            this.downloadJSON(backup, 'full-backup');
            window.showSuccess('גיבוי מלא הושלם בהצלחה!');
        } catch (error) {
            console.error('Error creating backup:', error);
            window.showError('שגיאה ביצירת גיבוי: ' + error.message);
        }
    }

    // המרת CSV לקובץ להורדה
    downloadCSV(data, filename) {
        if (data.length === 0) {
            window.showError('אין נתונים לייצוא');
            return;
        }

        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(','),
            ...data.map(row => headers.map(header => {
                const value = row[header] || '';
                // Escape quotes and wrap in quotes if contains comma
                return typeof value === 'string' && (value.includes(',') || value.includes('"')) 
                    ? `"${value.replace(/"/g, '""')}"` 
                    : value;
            }).join(','))
        ].join('\n');

        // Add BOM for proper Hebrew display in Excel
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // המרת JSON לקובץ להורדה
    downloadJSON(data, filename) {
        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.json`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // תרגום סטטוס הזמנה
    translateStatus(status) {
        const statusMap = {
            'pending': 'ממתינה',
            'in-progress': 'בתהליך',
            'picked': 'הושלמה',
            'cancelled': 'בוטלה'
        };
        return statusMap[status] || status;
    }

    // יצירת דו"ח מלאי נמוך
    async generateLowStockReport() {
        try {
            const productsSnap = await getDocs(collection(this.db, "products"));
            const lowStockProducts = [];
            
            productsSnap.forEach(doc => {
                const data = doc.data();
                const stock = data.stockQuantity || 0;
                if (stock < 5) {
                    lowStockProducts.push({
                        'מק"ט': doc.id,
                        'שם המוצר': data.name || '',
                        'מותג': data.brand || '',
                        'כמות במלאי': stock,
                        'דרגת דחיפות': stock === 0 ? 'אזל' : stock < 2 ? 'קריטי' : 'נמוך'
                    });
                }
            });

            if (lowStockProducts.length === 0) {
                window.showInfo('אין מוצרים עם מלאי נמוך כרגע');
                return;
            }

            // מיון לפי כמות במלאי (מהקטן לגדול)
            lowStockProducts.sort((a, b) => a['כמות במלאי'] - b['כמות במלאי']);

            this.downloadCSV(lowStockProducts, 'low-stock-report');
            window.showSuccess(`דו"ח מלאי נמוך נוצר - ${lowStockProducts.length} מוצרים`);
        } catch (error) {
            console.error('Error generating low stock report:', error);
            window.showError('שגיאה ביצירת דו"ח מלאי נמוך: ' + error.message);
        }
    }
}

// פונקציות עזר גלובליות
export function setupExportSystem(db) {
    const exportSystem = new DataExportSystem(db);
    
    // הוספת פונקציות לחלון הגלובלי
    window.exportProducts = () => exportSystem.exportProductsToCSV();
    window.exportOrders = () => exportSystem.exportOrdersToCSV();
    window.exportFullBackup = () => exportSystem.exportFullBackup();
    window.generateLowStockReport = () => exportSystem.generateLowStockReport();
    
    return exportSystem;
}
