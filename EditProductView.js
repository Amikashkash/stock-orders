import { doc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

// --- Private Helper Functions ---
function showMessage(area, text, isError = false) {
    if (!area) return;
    area.textContent = text;
    area.className = `text-center p-2 rounded-md text-sm mb-4 ${isError ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`;
    if (!isError) {
        setTimeout(() => {
            if (area) area.textContent = '';
        }, 3000);
    }
}

async function handleUpdateProduct(db, form, showViewCallback) {
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.innerHTML = '<div class="loader"></div>';
    
    const messageArea = document.getElementById('edit-product-message-area');
    const sku = form.querySelector("#sku").value;

    try {
        const productRef = doc(db, "products", sku);
        await updateDoc(productRef, {
            name: form.querySelector("#name").value,
            brand: form.querySelector("#brand").value,
            weight: { 
                value: Number(form.querySelector("#weight").value) || null, 
                unit: form.querySelector("#unit").value 
            },
            imageUrl: form.querySelector("#image").value,
            cost: Number(form.querySelector("#cost").value) || 0,
            packageQuantity: Number(form.querySelector("#package-qty").value) || 0,
            stockQuantity: Number(form.querySelector("#stock").value) || 0,
            updatedAt: serverTimestamp()
        });
        showMessage(messageArea, 'המוצר עודכן בהצלחה!', false);
        window.showSuccess('המוצר עודכן בהצלחה!');
        setTimeout(() => showViewCallback('dashboard'), 1500); // Go back to dashboard on success
    } catch (error) {
        console.error("Error updating document: ", error);
        showMessage(messageArea, 'שגיאה בעדכון המוצר.', true);
    } finally {
        button.disabled = false;
        button.innerHTML = 'שמור שינויים';
    }
}

// --- Public Interface ---
export const EditProductView = {
    getHTML: function(product) {
        if (!product) {
            return `
                <div class="text-center p-8">
                    <p class="text-red-500">שגיאה: לא ניתן היה לטעון את פרטי המוצר.</p>
                    <div class="text-center mt-4">
                         <button data-action="show-view" data-view="dashboard" class="bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-indigo-700">חזור ללוח הבקרה</button>
                    </div>
                </div>
            `;
        }
        const title = 'עריכת מוצר';
        const buttonText = 'שמור שינויים';
        const weightValue = product.weight ? product.weight.value : '';
        const weightUnit = product.weight ? product.weight.unit : 'ק"ג';

        return `
            <div class="flex items-center mb-6">
                <button data-action="show-view" data-view="dashboard" class="text-indigo-600 hover:text-indigo-800 p-2 rounded-full hover:bg-gray-100">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                </button>
                <h2 class="text-2xl font-semibold text-gray-800 mr-2">${title}</h2>
            </div>
            <div id="edit-product-message-area" class="text-center p-2 rounded-md text-sm mb-4"></div>
            <form id="edit-product-form" class="p-6 sm:p-8 bg-white rounded-lg shadow-md max-w-2xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="md:col-span-2"><label for="name" class="block text-sm font-medium text-gray-700">שם המוצר</label><input type="text" id="name" value="${product.name || ''}" required class="input-style"></div>
                <div><label for="sku" class="block text-sm font-medium text-gray-700">מק"ט / ברקוד</label><input type="text" id="sku" value="${product.sku || ''}" required disabled class="input-style bg-gray-100"></div>
                <div><label for="brand" class="block text-sm font-medium text-gray-700">יצרן / מותג</label><input type="text" id="brand" value="${product.brand || ''}" required class="input-style"></div>
                <div class="flex gap-2">
                    <div class="flex-grow"><label for="weight" class="block text-sm font-medium text-gray-700">משקל / נפח</label><input type="number" step="any" min="0" id="weight" value="${weightValue}" class="input-style"></div>
                    <div><label for="unit" class="block text-sm font-medium text-gray-700">יחידה</label>
                        <select id="unit" class="input-style">
                            <option value="ק\"ג" ${weightUnit === 'ק"ג' ? 'selected' : ''}>ק"ג</option>
                            <option value="גרם" ${weightUnit === 'גרם' ? 'selected' : ''}>גרם</option>
                            <option value="ליטר" ${weightUnit === 'ליטר' ? 'selected' : ''}>ליטר</option>
                            <option value="מ\"ל" ${weightUnit === 'מ"ל' ? 'selected' : ''}>מ"ל</option>
                        </select>
                    </div>
                </div>
                <div><label for="image" class="block text-sm font-medium text-gray-700">כתובת תמונה</label><input type="url" id="image" value="${product.imageUrl || ''}" class="input-style"></div>
                <div><label for="stock" class="block text-sm font-medium text-gray-700">כמות במלאי</label><input type="number" min="0" id="stock" value="${product.stockQuantity !== undefined ? product.stockQuantity : 0}" required class="input-style"></div>
                <div><label for="cost" class="block text-sm font-medium text-gray-700">עלות (אופציונלי)</label><input type="number" step="0.01" min="0" id="cost" value="${product.cost || ''}" class="input-style"></div>
                <div><label for="package-qty" class="block text-sm font-medium text-gray-700">כמות באריזה (אופציונלי)</label><input type="number" min="0" id="package-qty" value="${product.packageQuantity || ''}" class="input-style"></div>
                <div class="md:col-span-2 text-left">
                    <button type="submit" class="w-full md:w-auto bg-green-500 text-white font-semibold py-2 px-6 rounded-lg shadow-md hover:bg-green-600 transition-colors flex justify-center items-center">${buttonText}</button>
                </div>
            </form>
        `;
    },
    init: function(db, showViewCallback) {
        const form = document.getElementById('edit-product-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                handleUpdateProduct(db, form, showViewCallback);
            });
        }
    }
};
