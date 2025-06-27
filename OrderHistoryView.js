import { collection, query, where, getDocs, doc, getDoc, Timestamp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

export const OrderHistoryView = {
    getHTML: function() {
        return `
            <div>
                <div class="flex items-center mb-6">
                    <button data-action="show-view" data-view="dashboard" class="text-indigo-600 hover:text-indigo-800 p-2 rounded-full hover:bg-gray-100" title="Back to Dashboard">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l-4-4m0 0l-4 4m4-4v12" /></svg>
                    </button>
                    <h2 class="text-2xl font-semibold text-gray-800 mr-2">היסטוריית הזמנות</h2>
                </div>
                <div id="order-history-list" class="space-y-4">
                    <div class="text-center text-gray-500">טוען הזמנות...</div>
                </div>
            </div>
        `;
    },
    init: async function(db, showView) {
        const list = document.getElementById('order-history-list');
        list.innerHTML = `<div class="text-center text-gray-500">טוען הזמנות...</div>`;
        try {
            // הצג את כל ההזמנות שנאספו ב-48 שעות האחרונות (או שנה לדרישתך)
            const now = new Date();
            const dayAgo = new Date(now.getTime() - 1000 * 60 * 60 * 48);
            const q = query(
                collection(db, "orders"),
                where("status", "==", "picked"),
                where("pickedAt", ">=", Timestamp.fromDate(dayAgo))
            );
            const snap = await getDocs(q);
            if (snap.empty) {
                list.innerHTML = `<div class="text-center text-gray-500">לא נמצאו הזמנות שהושלמו.</div>`;
                return;
            }
            list.innerHTML = "";
            for (const docSnap of snap.docs) {
                const order = docSnap.data();
                let storeName = (order.storeName && order.storeName !== "Set Store Name Here")
                    ? order.storeName
                    : null;

                if (!storeName) {
                    const userId = order.createdBy || order.createdByUserId;
                    if (userId) {
                        try {
                            const userDoc = await getDoc(doc(db, "users", userId));
                            if (userDoc.exists()) {
                                const userData = userDoc.data();
                                storeName = userData.storeName || "Set the store name here";
                            } else {
                                storeName = "Set the store name here";
                            }
                        } catch {
                            storeName = "Set the store name here";
                        }
                    } else {
                        storeName = "Set the store name here";
                    }
                }

                // תצוגת תאריך בפורמט DD/MM/YYYY HH:MM
                let pickedAtStr = '';
                if (order.pickedAt && order.pickedAt.toDate) {
                    const d = order.pickedAt.toDate();
                    pickedAtStr = d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
                        ' ' + d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
                }

                list.innerHTML += `
                    <div class="border rounded p-4 bg-white shadow">
                        <div class="flex justify-between items-center">
                            <div>
                                <div class="font-bold">הזמנה #${docSnap.id.substring(0, 6)}</div>
                                <div class="text-sm text-gray-500">חנות: ${storeName}</div>
                                <div class="text-sm text-gray-500">הוזמנה ע"י: ${order.createdByName || "לא ידוע"}</div>
                                <div class="text-sm text-gray-500">הושלמה: ${pickedAtStr}</div>
                            </div>
                            <button data-action="show-order-details" data-order-id="${docSnap.id}" class="text-blue-600 hover:underline">צפה בפרטים</button>
                        </div>
                        ${order.notes ? `<div class="mt-2 text-yellow-800 bg-yellow-100 p-2 rounded">${order.notes}</div>` : ""}
                    </div>
                `;
            }

            list.addEventListener('click', e => {
                const btn = e.target.closest('button[data-action="show-order-details"]');
                if (btn) {
                    showView('pick-order-details', { orderId: btn.dataset.orderId, readOnly: true });
                }
            });
        } catch (e) {
            list.innerHTML = `<div class="text-red-600">שגיאה בטעינת ההזמנות: ${e.message}</div>`;
        }
    }
};