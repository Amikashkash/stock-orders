import { collection, query, onSnapshot, doc, updateDoc, writeBatch, getDocs, increment, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

// --- Helper: הצגת הודעות למשתמש ---
function showMessage(area, text, isError = false) {
    if (!area) return;
    area.textContent = text;
    area.className = `text-center p-2 rounded-md text-sm mb-4 ${isError ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`;
    if (!isError) {
        setTimeout(() => { if (area) area.textContent = ''; }, 3000);
    }
}

// --- Helper: האזנה לפריטי ההזמנה ---
function listenToOrderItems(db, orderId, readOnly = false) {
    const container = document.getElementById('pick-order-items-list');
    if (!container) return null;

    const q = query(collection(db, "orders", orderId, "orderItems"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        container.innerHTML = '';
        if (querySnapshot.empty) {
            container.innerHTML = `<p class="text-gray-500 text-center">לא נמצאו פריטים בהזמנה זו.</p>`;
            return;
        }
        querySnapshot.forEach((doc) => {
            const item = doc.data();
            const isPicked = item.status === 'picked';
            const disabled = readOnly || isPicked ? 'disabled' : '';
            const itemHtml = `
                <div class="grid grid-cols-4 items-center gap-4 border-b pb-2" id="item-${doc.id}">
                    <div class="col-span-2">
                        <p class="font-semibold text-gray-800">${item.name}</p>
                        <p class="text-sm text-gray-500">הוזמן: ${item.quantityOrdered}</p>
                    </div>
                    <input type="number" id="picked-qty-${doc.id}" class="input-style text-center" value="${isPicked ? item.quantityPicked : item.quantityOrdered}" min="0" ${disabled}>
                    ${!readOnly ? `
                        <button data-action="${isPicked ? 'unpick' : 'pick'}" data-order-id="${orderId}" data-item-id="${doc.id}" class="font-semibold py-2 px-4 rounded-md transition-colors ${isPicked ? 'bg-yellow-200 text-yellow-800 hover:bg-yellow-300' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}">${isPicked ? 'שנה' : 'אשר'}</button>
                    ` : ''}
                </div>
            `;
            container.innerHTML += itemHtml;
        });
    });
    return unsubscribe;
}

// --- Public Interface ---
export const PickOrderDetailsView = {
    getHTML: function(orderId, orderCache, readOnly = false) {
        const order = orderCache && orderCache[orderId] ? orderCache[orderId] : null;
        return `
            <div class="flex items-center mb-6">
                <button data-action="show-view" data-view="picking-orders" class="text-indigo-600 hover:text-indigo-800 p-2 rounded-full hover:bg-gray-100">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                </button>
                <h2 class="text-2xl font-semibold text-gray-800 mr-2">ליקוט הזמנה <span id="picking-order-id" class="text-gray-500">#${orderId ? orderId.substring(0, 6) : ''}</span></h2>
            </div>
            ${order && order.notes ? `<div class="bg-yellow-100 text-yellow-800 p-3 rounded-md mb-4 font-semibold"><strong>הערת לקוח:</strong> ${order.notes}</div>` : ''}
            <div id="pick-order-message-area" class="text-center p-2 rounded-md text-sm mb-4"></div>
            <div id="pick-order-items-list" class="bg-white p-6 rounded-lg shadow-md space-y-4">
                <div class="text-center text-gray-500">טוען פריטים...</div>
            </div>
            ${!readOnly ? `
            <div class="mt-6 text-left">
                <button data-action="complete-picking" data-order-id="${orderId}" id="complete-picking-btn" class="bg-green-500 text-white font-bold py-3 px-6 rounded-lg shadow-md hover:bg-green-600 transition-colors flex justify-center items-center">השלם ליקוט</button>
            </div>
            ` : ''}
        `;
    },
    init: function(db, orderId, readOnly = false) {
        const unsub = listenToOrderItems(db, orderId, readOnly);

        if (readOnly) return [unsub];

        // טיפול באירועי ליקוט/שינוי
        const itemsList = document.getElementById('pick-order-items-list');
        if (itemsList) {
            itemsList.addEventListener('click', async (e) => {
                const button = e.target.closest('button[data-action]');
                if (!button) return;
                const action = button.dataset.action;
                const itemId = button.dataset.itemId;
                if (!itemId) return;

                const qtyInput = document.getElementById(`picked-qty-${itemId}`);
                const pickedQty = parseInt(qtyInput.value, 10);

                if (action === 'pick') {
                    const itemRef = doc(db, "orders", orderId, "orderItems", itemId);
                    await updateDoc(itemRef, {
                        status: 'picked',
                        quantityPicked: pickedQty
                    });
                } else if (action === 'unpick') {
                    const itemRef = doc(db, "orders", orderId, "orderItems", itemId);
                    await updateDoc(itemRef, {
                        status: 'pending'
                    });
                }
            });
        }

        // טיפול בלחיצה על "השלם ליקוט"
        const completeBtn = document.getElementById('complete-picking-btn');
        if (completeBtn) {
            completeBtn.addEventListener('click', async () => {
                completeBtn.disabled = true;
                try {
                    const itemsSnap = await getDocs(collection(db, "orders", orderId, "orderItems"));
                    let allPicked = true;
                    itemsSnap.forEach(doc => {
                        if (doc.data().status !== 'picked') allPicked = false;
                    });
                    if (!allPicked) {
                        showMessage(document.getElementById('pick-order-message-area'), "אנא סיים את ליקוט כל הפריטים לפני השלמת הליקוט.", true);
                        completeBtn.disabled = false;
                        return;
                    }
                    await updateDoc(doc(db, "orders", orderId), {
                        status: 'picked',
                        pickedAt: serverTimestamp()
                    });

                    const batch = writeBatch(db);
                    itemsSnap.forEach(itemDoc => {
                        const item = itemDoc.data();
                        if (item.productId && item.quantityPicked) {
                            const productRef = doc(db, "products", item.productId);
                            batch.update(productRef, {
                                stockQuantity: increment(-item.quantityPicked)
                            });
                        }
                    });
                    await batch.commit();

                    if (itemsList) {
                        itemsList.querySelectorAll('input, button').forEach(el => el.disabled = true);
                    }
                    completeBtn.textContent = "הליקוט הושלם";
                    showMessage(document.getElementById('pick-order-message-area'), "הליקוט הושלם והמלאי עודכן בהצלחה!");
                } catch (e) {
                    completeBtn.disabled = false;
                    showMessage(document.getElementById('pick-order-message-area'), "שגיאה: " + e.message, true);
                    console.error(e);
                }
            });
        }

        return [unsub];
    },
};