import { collection, getDocs, doc, getDoc, updateDoc, serverTimestamp, writeBatch, increment } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { pickingProgressManager } from './PickingProgressManager.js';

function showMessage(area, text, isError = false) {
    if (!area) return;
    area.textContent = text;
    area.className = isError
        ? "text-red-600 font-bold my-2"
        : "text-green-700 font-bold my-2";
    setTimeout(() => { area.textContent = ""; }, 3000);
}

async function loadProductsMap(db) {
    const snap = await getDocs(collection(db, "products"));
    const map = {};
    snap.forEach(doc => map[doc.id] = doc.data());
    return map;
}

export const PickOrderDetailsView = {
    getHTML: function(orderId, orderCache, readOnly = false, fromView = 'picking-orders') {
        console.log('DEBUG: PickOrderDetailsView.getHTML called with fromView:', fromView);
        const backView = fromView === 'order-history' ? 'order-history' : 'picking-orders';
        const backTitle = fromView === 'order-history' ? 'חזרה להיסטוריית הזמנות' : 'חזרה להזמנות לליקוט';
        console.log('DEBUG: backView set to:', backView);
        
        return `
            <div>
                <div class="flex items-center mb-6">
                    <button data-action="show-view" data-view="${backView}" class="text-indigo-600 hover:text-indigo-800 p-2 rounded-full hover:bg-gray-100" title="${backTitle}">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l-4-4m0 0l-4 4m4-4v12" /></svg>
                    </button>
                    <h2 class="text-2xl font-semibold text-gray-800 mr-2">פרטי הזמנת ליקוט</h2>
                    ${!readOnly ? `<div class="mr-auto text-sm text-blue-600 bg-blue-50 px-3 py-1 rounded-full">התקדמות נשמרת אוטומטית</div>` : ''}
                </div>
                
                <!-- אינדיקטור התקדמות -->
                ${!readOnly ? `
                <div id="mobile-progress-indicator" class="mb-4 bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-sm font-medium text-indigo-800">התקדמות ליקוט</span>
                        <span id="progress-text" class="text-sm text-indigo-600">0/0</span>
                    </div>
                    <div class="w-full bg-indigo-200 rounded-full h-2">
                        <div id="progress-bar" class="bg-indigo-600 h-2 rounded-full transition-all duration-300" style="width: 0%"></div>
                    </div>
                </div>
                ` : ''}
                
                <div id="pick-order-message-area"></div>
                
                <!-- מקום להערות ההזמנה המקוריות -->
                <div id="original-order-notes"></div>
                
                <!-- שדה הערות לליקוט -->
                ${!readOnly ? `
                <div class="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <label for="picking-notes" class="block text-sm font-medium text-gray-700 mb-2">הערות לליקוט:</label>
                    <textarea id="picking-notes" class="input-style resize-none" rows="2" placeholder="הערות, החלפות, או בעיות שנתגלו בליקוט..."></textarea>
                    <div class="text-xs text-gray-500 mt-1">הערות אלו יישמרו עם ההזמנה</div>
                </div>
                ` : ''}
                
                <div id="pick-order-details-list" class="space-y-4"></div>
                <button id="complete-pick-btn" class="bg-green-600 text-white px-4 py-2 rounded mt-4" style="display:none">סיים ליקוט</button>
            </div>
        `;
    },
    init: async function(db, orderId, readOnly = false) {
        const detailsList = document.getElementById('pick-order-details-list');
        const messageArea = document.getElementById('pick-order-message-area');
        const completeBtn = document.getElementById('complete-pick-btn');
        
        // משתנה להתקדמות שמורה
        let savedProgress = null;
        let localItems = []; // הגדרת localItems מחוץ לבלוק try

        // Load products and order items
        const productsMap = await loadProductsMap(db);
        
        // טעינת נתוני ההזמנה למקרה שיש הערות
        let orderData = null;
        try {
            const orderSnap = await getDoc(doc(db, "orders", orderId));
            if (orderSnap.exists()) {
                orderData = orderSnap.data();
            }
        } catch (e) {
            console.warn('Failed to load order data:', e);
        }
        
        try {
            const itemsSnap = await getDocs(collection(db, "orders", orderId, "orderItems"));
            
            // Local state for all items, status is taken from DB if exists
            itemsSnap.forEach(itemDoc => {
                const item = itemDoc.data();
                localItems.push({
                    docId: itemDoc.id,
                    productId: item.productId,
                    quantityOrdered: item.quantityOrdered || 0,
                    quantityPicked: (item.quantityPicked === undefined || item.quantityPicked === null)
                        ? (item.quantityOrdered || 0)
                        : item.quantityPicked,
                    status: item.status === "picked" ? "picked" : "pending",
                    orderType: item.orderType || "unit",
                    packagesOrdered: item.packagesOrdered || null,
                    packageQuantity: item.packageQuantity || null
                });
            });

            if (localItems.length === 0) {
                const emptyMessage = `
                    <div class="text-center p-8 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div class="text-4xl mb-4">⚠️</div>
                        <div class="font-medium text-yellow-800 mb-2">אין פריטים בהזמנה זו</div>
                        <div class="text-sm text-yellow-600 mb-4">
                            ייתכן שההזמנה לא נוצרה כראוי או שהיא ריקה.<br>
                            נסה ליצור הזמנה חדשה או בדוק עם המנהל.
                        </div>
                        <button onclick="history.back()" class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                            חזור להזמנות
                        </button>
                    </div>
                `;
                detailsList.innerHTML = emptyMessage;
                showMessage(messageArea, "לא נמצאו פריטים בהזמנה זו", true);
                return [];
            }
            
        } catch (error) {
            console.error("Error loading order items:", error);
            showMessage(messageArea, "שגיאה בטעינת פריטי ההזמנה: " + error.message, true);
            return [];
        }

        // טעינת התקדמות שמורה (אם קיימת)
        if (!readOnly) {
            savedProgress = pickingProgressManager.loadProgress(orderId);
            if (savedProgress && savedProgress.items) {
                let hasProgress = false;
                
                localItems.forEach(item => {
                    const savedItem = savedProgress.items[item.docId];
                    if (savedItem && savedItem.status === 'picked') {
                        item.quantityPicked = savedItem.quantityPicked;
                        item.status = savedItem.status;
                        hasProgress = true;
                    }
                });
                
                if (hasProgress) {
                    setTimeout(() => {
                        window.showInfo('התקדמות ליקוט קודמת שוחזרה בהצלחה');
                    }, 500);
                }
            }
        }

        // פונקציה לשמירת התקדמות
        function saveProgress() {
            if (!readOnly) {
                const progressItems = {};
                localItems.forEach(item => {
                    progressItems[item.docId] = {
                        productId: item.productId,
                        quantityPicked: item.quantityPicked,
                        status: item.status
                    };
                });
                
                const notesTextarea = document.getElementById('picking-notes');
                const notes = notesTextarea ? notesTextarea.value : '';
                
                pickingProgressManager.saveProgress(orderId, progressItems, notes);
            }
        }

        // הצגת הערות ההזמנה המקוריות אם קיימות
        const originalNotesDiv = document.getElementById('original-order-notes');
        if (originalNotesDiv && orderData && orderData.notes) {
            originalNotesDiv.innerHTML = `
                <div class="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 class="text-sm font-medium text-blue-800 mb-2">הערות ההזמנה:</h4>
                    <div class="text-sm text-blue-700">${orderData.notes}</div>
                </div>
            `;
        }

        // שחזור הערות מהתקדמות שמורה
        if (!readOnly && savedProgress && savedProgress.notes) {
            const notesTextarea = document.getElementById('picking-notes');
            if (notesTextarea) {
                notesTextarea.value = savedProgress.notes;
            }
        }

        // האזנה לשינויים בהערות
        if (!readOnly) {
            const notesTextarea = document.getElementById('picking-notes');
            if (notesTextarea) {
                notesTextarea.addEventListener('input', () => {
                    saveProgress();
                });
            }
        }


        // start of updated code 
        function renderItems() {
            if (localItems.length === 0) {
                detailsList.innerHTML = `<div class="text-center text-gray-500 p-8">
                    <div class="text-4xl mb-4">📦</div>
                    <div class="font-medium">אין פריטים להזמנה זו</div>
                    <div class="text-sm mt-2">ייתכן שההזמנה לא נטענה כראוי או שאין בה פריטים</div>
                </div>`;
                if (completeBtn) completeBtn.style.display = "none";
                return;
            }

    let allPicked = localItems.every(item => item.status === "picked");
    let pickedCount = localItems.filter(item => item.status === "picked").length;
    
    // עדכון אינדיקטור התקדמות למובייל
    if (!readOnly) {
        const progressText = document.getElementById('progress-text');
        const progressBar = document.getElementById('progress-bar');
        
        if (progressText) {
            progressText.textContent = `${pickedCount}/${localItems.length}`;
        }
        
        if (progressBar) {
            const percentage = (pickedCount / localItems.length) * 100;
            progressBar.style.width = `${percentage}%`;
        }
    }
    
    let html = "";
    localItems.forEach(item => {
        const product = productsMap[item.productId];
        const productName = product?.name || "מוצר לא ידוע";
        const brand = product?.brand ? ` (${product.brand})` : "";
        const imageUrl = product?.imageUrl || product?.image || "";

        // Show weight/size: expects product.weight = { value: 2, unit: "ק\"ג" }
        let weightDisplay = "";
        if (product?.weight && product.weight.value && product.weight.unit) {
            weightDisplay = `<span class="text-xs text-gray-500 ml-2">(${product.weight.value} ${product.weight.unit})</span>`;
        }

        // NEW: stockQuantity
        const stockStr = (product?.stockQuantity !== undefined && product?.stockQuantity !== null)
            ? `<div class="text-xs text-gray-700">מלאי: <b>${product.stockQuantity}</b></div>`
            : `<div class="text-xs text-gray-400">מלאי לא ידוע</div>`;

        // הצגת פרטי הזמנה (יחידות או מארזים)
        let orderDetailsStr = `<div class="text-sm text-gray-500">כמות מוזמנת: ${item.quantityOrdered}`;
        if (item.orderType === "package" && item.packagesOrdered && item.packageQuantity) {
            orderDetailsStr += ` יח' (${item.packagesOrdered} מארז × ${item.packageQuantity} יח')`;
        } else {
            orderDetailsStr += ` יח'`;
        }
        orderDetailsStr += `</div>`;

        html += `
            <div class="border rounded p-4 bg-white shadow flex flex-col gap-2 items-center">
                ${imageUrl ? `
                    <img src="${imageUrl}" 
                         alt="${productName}" 
                         class="w-24 h-24 object-contain mb-2 rounded"
                         onerror="this.onerror=null; this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iOTYiIGhlaWdodD0iOTYiIHZpZXdCb3g9IjAgMCA5NiA5NiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9Ijk2IiBoZWlnaHQ9Ijk2IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0zMiA0MEg2NEw1NiA1Nkg0MEwzMiA0MFoiIGZpbGw9IiNEMUQ1REIiLz4KPGNpcmNsZSBjeD0iNDAiIGN5PSIzMiIgcj0iNCIgZmlsbD0iI0Q5REREQyIvPgo8cGF0aCBkPSJNMjQgNzJINzJWMjRIMjRWNzJaIiBzdHJva2U9IiNEMUQ1REIiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWRhc2hhcnJheT0iNCA0Ii8+Cjx0ZXh0IHg9IjQ4IiB5PSI2MCIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTAiIGZpbGw9IiM5Q0EzQUYiIHRleHQtYW5jaG9yPSJtaWRkbGUiPtio17vbqc+qIHTZgdmPbmjXmdio17k8L3RleHQ+Cjwvc3ZnPgo='; this.style.opacity='0.7'; this.title='תמונה לא זמינה';">
                ` : `
                    <div class="w-24 h-24 mb-2 product-image-placeholder rounded">
                        <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                        </svg>
                    </div>
                `}
                <div class="font-bold">${productName}${brand} ${weightDisplay}</div>
                ${stockStr}
                ${orderDetailsStr}
                <div class="text-sm text-gray-500 flex items-center gap-2 flex-wrap justify-center">
                    כמות שנלקטה:
                    <input type="number" min="0" max="${item.quantityOrdered}" value="${item.quantityPicked}" data-doc-id="${item.docId}" class="pick-qty border rounded px-2 py-1 w-16 text-center mx-1" ${item.status === "picked" ? "disabled" : ""} />
                    <button type="button" class="pick-btn ${item.status === "picked" ? "bg-yellow-500" : "bg-blue-500"} text-white px-3 py-2 rounded min-w-[80px]" data-doc-id="${item.docId}">
                        ${item.status === "picked" ? "ערוך" : "אשר"}
                    </button>
                    <span class="picked-label text-green-700 font-bold" data-doc-id="${item.docId}" style="min-width:60px;">
                        ${item.status === "picked" ? '<span title="נלקט">✓ לוקט</span>' : ""}
                    </span>
                </div>
            </div>
        `;
    });
    detailsList.innerHTML = html;

            // כפתור סיים ליקוט
            if (!readOnly && completeBtn) {
                completeBtn.style.display = "block";
                completeBtn.disabled = !allPicked;
            } else if (completeBtn) {
                completeBtn.style.display = "none";
            }

            // מאזינים לכפתורי אשר/ערוך
            if (!readOnly) {
                detailsList.querySelectorAll('.pick-btn').forEach(btn => {
                    btn.onclick = null;
                    btn.addEventListener('click', () => {
                        const docId = btn.getAttribute('data-doc-id');
                        const input = detailsList.querySelector(`.pick-qty[data-doc-id="${docId}"]`);
                        const pickedLabel = detailsList.querySelector(`.picked-label[data-doc-id="${docId}"]`);
                        const item = localItems.find(i => i.docId === docId);
                        if (!item) return;

                        if (btn.textContent.trim() === "אשר") {
                            const qty = parseInt(input.value, 10) || 0;
                            if (qty < 0) {
                                showMessage(messageArea, "כמות לא יכולה להיות שלילית", true);
                                return;
                            }
                            item.quantityPicked = qty;
                            item.status = "picked";
                            saveProgress(); // שמירת התקדמות
                            showMessage(messageArea, "הפריט סומן כנלקט");
                            window.vibrate.itemPicked(); // פידבק הפטי
                            renderItems();
                        } else if (btn.textContent.trim() === "ערוך") {
                            input.disabled = false;
                            btn.textContent = "אשר";
                            btn.classList.remove("bg-yellow-500");
                            btn.classList.add("bg-blue-500");
                            pickedLabel.innerHTML = "";
                            item.status = "pending";
                            saveProgress(); // שמירת התקדמות
                        }
                    });
                });
            }
        }

        // רנדר ראשוני
        renderItems();

        // מאזין לכפתור סיים ליקוט
        if (completeBtn && !readOnly) {
            completeBtn.onclick = null;
            completeBtn.addEventListener('click', async () => {
                completeBtn.disabled = true;
                try {
                    // עדכון כל הפריטים ב-Firestore
                    const batch = writeBatch(db);
                    for (const item of localItems) {
                        batch.update(doc(db, "orders", orderId, "orderItems", item.docId), {
                            quantityPicked: item.quantityPicked,
                            status: "picked"
                        });
                        // עדכון מלאי
                        if (item.productId && item.quantityPicked) {
                            const productRef = doc(db, "products", item.productId);
                            batch.update(productRef, {
                                stockQuantity: increment(-item.quantityPicked)
                            });
                        }
                    }
                    
                    // שמירת הערות ליקוט
                    const notesTextarea = document.getElementById('picking-notes');
                    const pickingNotes = notesTextarea ? notesTextarea.value.trim() : '';
                    
                    // עדכון סטטוס הזמנה
                    const orderUpdate = {
                        status: 'picked',
                        pickedAt: serverTimestamp()
                    };
                    
                    // הוספת הערות ליקוט אם קיימות
                    if (pickingNotes) {
                        orderUpdate.pickingNotes = pickingNotes;
                    }
                    
                    batch.update(doc(db, "orders", orderId), orderUpdate);
                    await batch.commit();

                    // מחיקת התקדמות שמורה לאחר השלמה מוצלחת
                    pickingProgressManager.clearProgress(orderId);

                    detailsList.querySelectorAll('input, button').forEach(el => el.disabled = true);
                    completeBtn.textContent = "הליקוט הושלם";
                    showMessage(messageArea, "הליקוט הושלם והמלאי עודכן בהצלחה!");
                    window.vibrate.orderComplete(); // פידבק הפטי לסיום
                } catch (e) {
                    completeBtn.disabled = false;
                    showMessage(messageArea, "שגיאה: " + e.message, true);
                    console.error(e);
                }
            });
        }

        // קריאה לפונקציית renderItems כדי להציג את הפריטים
        renderItems();
        
        return [];
    }
};