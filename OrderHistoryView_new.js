import { collection, query, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

function formatDate(date) {
    if (!date) return "לא ידוע";
    if (date.toDate) return date.toDate().toLocaleDateString('he-IL');
    if (date instanceof Date) return date.toLocaleDateString('he-IL');
    return new Date(date).toLocaleDateString('he-IL');
}

export const OrderHistoryView = {
    getBrowserInfo: function() {
        const ua = navigator.userAgent;
        if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
        if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
        if (ua.includes('Firefox')) return 'Firefox';
        if (ua.includes('Edg')) return 'Edge';
        if (ua.includes('Samsung')) return 'Samsung Internet';
        return 'Unknown';
    },
    
    getDeviceInfo: function() {
        const ua = navigator.userAgent;
        if (/iPad|iPhone|iPod/.test(ua)) return 'iOS';
        if (/Android/.test(ua)) return 'Android';
        if (/Windows Phone/.test(ua)) return 'Windows Phone';
        return 'Unknown';
    },
    
    checkWebGL: function() {
        try {
            const canvas = document.createElement('canvas');
            return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
        } catch (e) {
            return false;
        }
    },
    
    checkPrivateBrowsing: function() {
        try {
            localStorage.setItem('test', 'test');
            localStorage.removeItem('test');
            return 'No';
        } catch (e) {
            return 'Possibly';
        }
    },
    
    debugLog: function(message) {
        const now = new Date().toLocaleTimeString();
        const debugMessages = document.getElementById('debug-messages');
        if (debugMessages) {
            debugMessages.innerHTML += `[${now}] ${message}<br>`;
            debugMessages.scrollTop = debugMessages.scrollHeight;
        }
        console.log(message);
    },
    
    getHTML: function() {
        return `
            <div>
                <div class="flex items-center mb-6">
                    <button data-action="show-view" data-view="dashboard" class="text-indigo-600 hover:text-indigo-800 p-2 rounded-full hover:bg-gray-100" title="חזרה לדשבורד">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l-4-4m0 0l-4 4m4-4v12" /></svg>
                    </button>
                    <h2 class="text-2xl font-semibold text-gray-800 mr-2">היסטוריית הזמנות</h2>
                    <button id="refresh-orders-btn" class="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600">רענן</button>
                </div>
                <div style="background: #f0f0f0; padding: 10px; margin-bottom: 10px; font-size: 12px;">
                    Debug: Order History View Loaded - ${new Date().toLocaleTimeString()}<br>
                    User Agent: ${navigator.userAgent.substring(0, 80)}...<br>
                    Screen: ${screen.width}x${screen.height}<br>
                    Viewport: ${window.innerWidth}x${window.innerHeight}<br>
                    Platform: ${navigator.platform}<br>
                    Language: ${navigator.language}<br>
                    Online: ${navigator.onLine}<br>
                    Cookies: ${navigator.cookieEnabled}<br>
                    Local Storage: ${typeof(Storage) !== "undefined"}
                </div>
                <div id="debug-log" style="background: #e8e8e8; padding: 8px; margin-bottom: 10px; font-size: 11px; max-height: 150px; overflow-y: auto; display: none;">
                    <strong>Debug Log:</strong><br>
                    <div id="debug-messages"></div>
                </div>
                <button id="toggle-debug" class="mb-2 bg-gray-500 text-white px-2 py-1 rounded text-xs">הצג Debug</button>
                <div id="order-history-list" class="space-y-4">
                    <div class="text-center text-gray-500">טוען הזמנות...</div>
                </div>
            </div>
        `;
    },
    
    init: async function(db, showView) {
        this.debugLog('OrderHistoryView init started');
        const list = document.getElementById('order-history-list');
        if (!list) {
            this.debugLog('ERROR: Could not find order-history-list element');
            return;
        }
        list.innerHTML = `<div class="text-center text-gray-500">טוען הזמנות...</div>`;
        this.debugLog('Loading message displayed');

        // הוספת מאזין לכפתור debug
        const toggleDebugBtn = document.getElementById('toggle-debug');
        const debugLog = document.getElementById('debug-log');
        if (toggleDebugBtn && debugLog) {
            toggleDebugBtn.onclick = () => {
                const isHidden = debugLog.style.display === 'none';
                debugLog.style.display = isHidden ? 'block' : 'none';
                toggleDebugBtn.textContent = isHidden ? 'הסתר Debug' : 'הצג Debug';
            };
        }

        try {
            this.debugLog('Starting to fetch orders from database');
            this.debugLog(`Database object exists: ${!!db}`);
            this.debugLog(`User authenticated: ${!!window.auth?.currentUser}`);
            this.debugLog(`Location: ${window.location.origin}`);
            this.debugLog(`Is localhost: ${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'}`);
            this.debugLog(`Firebase project: ${db._delegate?._databaseId?.projectId || 'unknown'}`);
            this.debugLog(`Browser: ${this.getBrowserInfo()}`);
            this.debugLog(`Device: ${this.getDeviceInfo()}`);
            this.debugLog(`Network type: ${navigator.connection?.effectiveType || 'unknown'}`);
            this.debugLog(`Service Worker: ${navigator.serviceWorker ? 'supported' : 'not supported'}`);
            
            // בדיקה אם Firebase מוכן
            if (!db) {
                throw new Error('Database not initialized');
            }
            
            // בדיקות נוספות למכשירים בעייתיים
            this.debugLog(`IndexedDB: ${window.indexedDB ? 'supported' : 'not supported'}`);
            this.debugLog(`WebGL: ${this.checkWebGL()}`);
            this.debugLog(`Private browsing: ${this.checkPrivateBrowsing()}`);
            this.debugLog(`Cache API: ${window.caches ? 'supported' : 'not supported'}`);
            
            // בדיקה אם המשתמש מחובר
            if (!window.auth?.currentUser) {
                this.debugLog('WARNING: User not authenticated, this might cause permission issues');
            } else {
                this.debugLog(`User details - UID: ${window.auth.currentUser.uid}`);
                this.debugLog(`User email: ${window.auth.currentUser.email || 'no email'}`);
                this.debugLog(`User display name: ${window.auth.currentUser.displayName || 'no name'}`);
            }
            
            // בדיקת cache וסטטוס המשתמש
            this.debugLog(`Current auth state: ${window.auth?.currentUser ? 'authenticated' : 'not authenticated'}`);
            this.debugLog(`Firebase config projectId: ${window.firebaseConfig?.projectId || 'not found'}`);
            
            // שאילתה לכל ההזמנות, ממוינות לפי תאריך יצירה
            this.debugLog('Creating Firestore query...');
            const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
            this.debugLog('Query created, fetching documents...');
            
            // הוספת timeout לשאילתה למקרה של תקיעה
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Query timeout after 15 seconds')), 15000)
            );
            
            const queryPromise = getDocs(q);
            
            this.debugLog('Starting query with timeout...');
            const snap = await Promise.race([queryPromise, timeoutPromise]);
            
            this.debugLog(`Found ${snap.size} orders in database`);
            if (snap.docs[0]) {
                this.debugLog(`Sample order: ${JSON.stringify(snap.docs[0].data()).substring(0, 100)}...`);
            }

            if (snap.empty) {
                this.debugLog('No orders found, showing empty message');
                list.innerHTML = `
                    <div class="text-center text-gray-500">
                        <p>אין הזמנות להציג.</p>
                        <p style="font-size: 12px; margin-top: 10px;">Debug: Firestore returned empty result</p>
                    </div>`;
                return;
            }

            list.innerHTML = "";
            this.debugLog('Cleared list, starting to render orders');
            
            let orderCount = 0;
            snap.forEach(docSnap => {
                orderCount++;
                this.debugLog(`Rendering order ${orderCount}: ${docSnap.id.substring(0, 8)}`);
                
                const order = docSnap.data();
                const storeName = (order.storeName && order.storeName !== "Set Store Name Here") ? order.storeName : "לא ידוע";
                const createdByName = order.createdByName || "לא ידוע";
                const statusText = getStatusText(order.status);
                const statusColor = getStatusColor(order.status);
                const pickedAtStr = order.pickedAt ? formatDate(order.pickedAt) : "לא הושלמה";

                const orderHTML = `
                    <div class="border rounded p-4 bg-white shadow">
                        <div class="flex justify-between items-start mb-2">
                            <div>
                                <div class="font-bold">הזמנה #${docSnap.id.substring(0, 6)}</div>
                                <div class="text-sm text-gray-500">חנות: ${storeName}</div>
                                <div class="text-sm text-gray-500">הוזמנה ע"י: ${order.createdByName || "לא ידוע"}</div>
                                <div class="text-sm text-gray-500">תאריך: ${formatDate(order.createdAt)}</div>
                                <div class="text-sm text-gray-500">הושלמה: ${pickedAtStr}</div>
                                ${order.notes ? `<div class="text-sm text-blue-600 mt-1"><strong>הערות הזמנה:</strong> ${order.notes}</div>` : ''}
                                ${order.pickingNotes ? `<div class="text-sm text-orange-600 mt-1"><strong>הערות ליקוט:</strong> ${order.pickingNotes}</div>` : ''}
                            </div>
                            <div class="text-left">
                                <span class="px-2 py-1 rounded text-sm ${statusColor}">${statusText}</span>
                                <button data-action="show-pick-order-details" data-order-id="${docSnap.id}" class="block mt-2 text-blue-600 hover:underline text-sm">צפה בפרטים</button>
                            </div>
                        </div>
                        ${order.notes ? `<div class="mt-2 text-yellow-800 bg-yellow-100 p-2 rounded text-sm">${order.notes}</div>` : ""}
                    </div>
                `;
                
                list.innerHTML += orderHTML;
            });
            
            this.debugLog(`SUCCESS: Rendered ${orderCount} orders. HTML length: ${list.innerHTML.length}`);

            // מאזין לכפתורי "צפה בפרטים"
            list.addEventListener('click', e => {
                const btn = e.target.closest('button[data-action="show-pick-order-details"]');
                if (btn) {
                    this.debugLog(`Order details clicked: ${btn.dataset.orderId}`);
                    showView('pick-order-details', { orderId: btn.dataset.orderId, readOnly: true, fromView: 'order-history' });
                }
            });

            // מאזין לכפתור רענון
            const refreshBtn = document.getElementById('refresh-orders-btn');
            if (refreshBtn) {
                refreshBtn.addEventListener('click', () => {
                    this.debugLog('Refresh button clicked - reloading...');
                    this.init(db, showView);
                });
            }

        } catch (error) {
            this.debugLog(`ERROR: ${error.message}`);
            this.debugLog(`Error code: ${error.code || 'unknown'}`);
            this.debugLog(`Network: ${navigator.onLine ? 'Online' : 'Offline'}`);
            this.debugLog(`Error stack: ${error.stack?.substring(0, 200) || 'none'}...`);
            
            console.error("Error loading order history:", error);
            
            let errorMessage = "שגיאה בטעינת ההזמנות";
            if (error.code === 'permission-denied') {
                errorMessage = "אין הרשאה לצפות בהזמנות - בדוק שאתה מחובר לאותו חשבון";
            } else if (error.code === 'unavailable') {
                errorMessage = "שירות Firebase לא זמין - בדוק חיבור לאינטרנט";
            } else if (!navigator.onLine) {
                errorMessage = "אין חיבור לאינטרנט";
            } else if (error.message.includes('timeout')) {
                errorMessage = "הזמן קצוב - רשת איטית או שרת עמוס";
            }
            
            list.innerHTML = `
                <div class="text-red-500 text-center">
                    <p>${errorMessage}</p>
                    <p style="font-size: 12px; margin-top: 10px;">טכני: ${error.message}</p>
                    <p style="font-size: 10px; margin-top: 5px;">Device: ${this.getDeviceInfo()} | Browser: ${this.getBrowserInfo()}</p>
                    <button onclick="location.reload()" class="mt-2 bg-blue-500 text-white px-3 py-1 rounded">נסה שוב</button>
                </div>`;
        }
    }
};

function getStatusText(status) {
    switch (status) {
        case "pending": return "ממתין לליקוט";
        case "in-progress": return "בתהליך ליקוט";
        case "picked": return "הושלם";
        case "draft": return "טיוטה";
        default: return status || "לא ידוע";
    }
}

function getStatusColor(status) {
    switch (status) {
        case "pending": return "bg-yellow-100 text-yellow-800";
        case "in-progress": return "bg-blue-100 text-blue-800";
        case "picked": return "bg-green-100 text-green-800";
        case "draft": return "bg-gray-100 text-gray-800";
        default: return "bg-gray-100 text-gray-800";
    }
}
