import { collection, query, onSnapshot, doc, updateDoc, writeBatch, getDocs, increment, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

// --- Private Helper Functions ---
function showMessage(area, text, isError = false) {
    if (!area) return;
    area.textContent = text;
    area.className = `text-center p-2 rounded-md text-sm mb-4 ${isError ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`;
    if (!isError) {
        setTimeout(() => { if (area) area.textContent = ''; }, 3000);
    }
}

function listenToOrderItems(db, orderId) {
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
           const itemHtml = `
               <div class="grid grid-cols-4 items-center gap-4 border-b pb-2" id="item-${doc.id}">
                   <div class="col-span-2">
                       <p class="font-semibold text-gray-800">${item.name}</p>
                       <p class="text-sm text-gray-500">הוזמן: ${item.quantityOrdered}</p>
                   </div>
                   <input type="number" id="picked-qty-${doc.id}" class="input-style text-center" value="${isPicked ? item.quantityPicked : item.quantityOrdered}" min="0" ${isPicked ? 'disabled' : ''}>
                   <button data-action="${isPicked ? 'unpick' : 'pick'}" data-order-id="${orderId}" data-item-id="${doc.id}" class="font-semibold py-2 px-4 rounded-md transition-colors ${isPicked ? 'bg-yellow-200 text-yellow-800 hover:bg-yellow-300' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}">${isPicked ? 'שנה' : 'אשר'}</button>
               </div>
           `;
           container.innerHTML += itemHtml;
        });
    });
    return unsubscribe;
}


// --- Public Interface ---
export const PickOrderDetailsView = {
    getHTML: function(orderId, orderCache) {
        const order = orderCache[orderId];
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
            <div class="mt-6 text-left">
                <button data-action="complete-picking" data-order-id="${orderId}" id="complete-picking-btn" class="bg-green-500 text-white font-bold py-3 px-6 rounded-lg shadow-md hover:bg-green-600 transition-colors flex justify-center items-center">השלם ליקוט</button>
            </div>
        `;
    },
    init: function(db, orderId) {
        return [listenToOrderItems(db, orderId)];
    }
};
