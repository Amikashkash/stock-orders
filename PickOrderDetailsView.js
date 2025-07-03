import { collection, getDocs, doc, updateDoc, serverTimestamp, writeBatch, increment } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

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
    getHTML: function(orderId, orderCache, readOnly = false) {
        return `
            <div>
                <div class="flex items-center mb-6">
                    <button data-action="show-view" data-view="picking-orders" class="text-indigo-600 hover:text-indigo-800 p-2 rounded-full hover:bg-gray-100" title="חזרה להזמנות לליקוט">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l-4-4m0 0l-4 4m4-4v12" /></svg>
                    </button>
                    <h2 class="text-2xl font-semibold text-gray-800 mr-2">פרטי הזמנת ליקוט</h2>
                </div>
                <div id="pick-order-message-area"></div>
                <div id="pick-order-details-list" class="space-y-4"></div>
                <button id="complete-pick-btn" class="bg-green-600 text-white px-4 py-2 rounded mt-4" style="display:none">סיים ליקוט</button>
            </div>
        `;
    },
    init: async function(db, orderId, readOnly = false) {
        const detailsList = document.getElementById('pick-order-details-list');
        const messageArea = document.getElementById('pick-order-message-area');
        const completeBtn = document.getElementById('complete-pick-btn');

        // Load products and order items
        const productsMap = await loadProductsMap(db);
        const itemsSnap = await getDocs(collection(db, "orders", orderId, "orderItems"));

        // Local state for all items, status is taken from DB if exists
        let localItems = [];
        itemsSnap.forEach(itemDoc => {
            const item = itemDoc.data();
            localItems.push({
                docId: itemDoc.id,
                productId: item.productId,
                quantityOrdered: item.quantityOrdered || 0,
                quantityPicked: (item.quantityPicked === undefined || item.quantityPicked === null)
                    ? (item.quantityOrdered || 0)
                    : item.quantityPicked,
                status: item.status === "picked" ? "picked" : "pending"
            });
        });


        // start of updated code 
        function renderItems() {
    if (localItems.length === 0) {
        detailsList.innerHTML = `<div class="text-center text-gray-500">אין פריטים להזמנה זו.</div>`;
        if (completeBtn) completeBtn.style.display = "none";
        return;
    }

    let allPicked = localItems.every(item => item.status === "picked");
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

        html += `
            <div class="border rounded p-4 bg-white shadow flex flex-col gap-2 items-center">
                ${imageUrl ? `<img src="${imageUrl}" alt="${productName}" class="w-24 h-24 object-contain mb-2 rounded">` : ""}
                <div class="font-bold">${productName}${brand} ${weightDisplay}</div>
                ${stockStr}
                <div class="text-sm text-gray-500">כמות מוזמנת: ${item.quantityOrdered}</div>
                <div class="text-sm text-gray-500 flex items-center gap-2">
                    כמות שנלקטה:
                    <input type="number" min="0" max="${item.quantityOrdered}" value="${item.quantityPicked}" data-doc-id="${item.docId}" class="pick-qty border rounded px-2 py-1 w-16 text-center mx-1" ${item.status === "picked" ? "disabled" : ""} />
                    <button type="button" class="pick-btn ${item.status === "picked" ? "bg-yellow-500" : "bg-blue-500"} text-white px-2 py-1 rounded" data-doc-id="${item.docId}">
                        ${item.status === "picked" ? "ערוך" : "אשר"}
                    </button>
                    <span class="ml-2 text-green-700 picked-label" data-doc-id="${item.docId}" style="min-width:40px;">
                        ${item.status === "picked" ? '<span title="נלקט">&#10003; לוקט</span>' : ""}
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
                            showMessage(messageArea, "הפריט סומן כנלקט");
                            renderItems();
                        } else if (btn.textContent.trim() === "ערוך") {
                            input.disabled = false;
                            btn.textContent = "אשר";
                            btn.classList.remove("bg-yellow-500");
                            btn.classList.add("bg-blue-500");
                            pickedLabel.innerHTML = "";
                            item.status = "pending";
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
                    // עדכון סטטוס הזמנה
                    batch.update(doc(db, "orders", orderId), {
                        status: 'picked',
                        pickedAt: serverTimestamp()
                    });
                    await batch.commit();

                    detailsList.querySelectorAll('input, button').forEach(el => el.disabled = true);
                    completeBtn.textContent = "הליקוט הושלם";
                    showMessage(messageArea, "הליקוט הושלם והמלאי עודכן בהצלחה!");
                } catch (e) {
                    completeBtn.disabled = false;
                    showMessage(messageArea, "שגיאה: " + e.message, true);
                    console.error(e);
                }
            });
        }
        return [];
    }
};