import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

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

async function handleAddProduct(db, form) {
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.innerHTML = '<div class="loader"></div>';
    
    const messageArea = document.getElementById('add-product-message-area');
    const sku = form.querySelector("#sku").value;

    if (!sku) {
        showMessage(messageArea, 'מק"ט הוא שדה חובה.', true);
        button.disabled = false;
        button.innerHTML = 'שמור מוצר';
        return;
    }

    try {
        const productRef = doc(db, "products", sku);
        await setDoc(productRef, {
            name: form.querySelector("#name").value,
            sku: sku,
            brand: form.querySelector("#brand").value,
            weight: { 
                value: Number(form.querySelector("#weight").value) || null, 
                unit: form.querySelector("#unit").value 
            },
            imageUrl: form.querySelector("#image").value,
            cost: Number(form.querySelector("#cost").value) || 0,
            packageQuantity: Number(form.querySelector("#package-qty").value) || 0,
            stockQuantity: 0, 
            createdAt: serverTimestamp()
        });
        showMessage(messageArea, 'המוצר נוסף בהצלחה!', false);
        form.reset();
    } catch (error) {
        console.error("Error adding document: ", error);
        showMessage(messageArea, 'שגיאה בשמירת המוצר.', true);
    } finally {
        button.disabled = false;
        button.innerHTML = 'שמור מוצר';
    }
}

// --- Public Interface ---
export const AddProductView = {
    getHTML: function() {
        return `
            <div class="flex items-center mb-6">
                <button data-action="show-view" data-view="dashboard" class="text-indigo-600 hover:text-indigo-800 p-2 rounded-full hover:bg-gray-100">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                </button>
                <h2 class="text-2xl font-semibold text-gray-800 mr-2">הוספת מוצר חדש</h2>
            </div>
            <div id="add-product-message-area" class="text-center p-2 rounded-md text-sm mb-4"></div>
            <form id="add-product-form" class="p-6 sm:p-8 bg-white rounded-lg shadow-md max-w-2xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="md:col-span-2"><label for="name" class="block text-sm font-medium text-gray-700">שם המוצר</label><input type="text" id="name" required class="input-style"></div>
                <div><label for="sku" class="block text-sm font-medium text-gray-700">מק"ט / ברקוד</label><input type="text" id="sku" required class="input-style"></div>
                <div><label for="brand" class="block text-sm font-medium text-gray-700">יצרן / מותג</label><input type="text" id="brand" required class="input-style"></div>
                <div class="flex gap-2">
                    <div class="flex-grow"><label for="weight" class="block text-sm font-medium text-gray-700">משקל / נפח</label><input type="number" step="any" min="0" id="weight" class="input-style"></div>
                    <div><label for="unit" class="block text-sm font-medium text-gray-700">יחידה</label>
                        <select id="unit" class="input-style">
                            <option value="ק\"ג">ק"ג</option>
                            <option value="גרם">גרם</option>
                            <option value="ליטר">ליטר</option>
                            <option value="מ\"ל">מ"ל</option>
                        </select>
                    </div>
                </div>
                <div><label for="image" class="block text-sm font-medium text-gray-700">כתובת תמונה</label><input type="url" id="image" class="input-style"></div>
                <div><label for="cost" class="block text-sm font-medium text-gray-700">עלות (אופציונלי)</label><input type="number" step="0.01" min="0" id="cost" class="input-style"></div>
                <div><label for="package-qty" class="block text-sm font-medium text-gray-700">כמות באריזה (אופציונלי)</label><input type="number" min="0" id="package-qty" class="input-style"></div>
                <div class="md:col-span-2 text-left">
                    <button type="submit" class="w-full md:w-auto bg-green-500 text-white font-semibold py-2 px-6 rounded-lg shadow-md hover:bg-green-600 transition-colors flex justify-center items-center">שמור מוצר</button>
                </div>
            </form>
        `;
    },
    init: function(db) {
        const form = document.getElementById('add-product-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                handleAddProduct(db, form);
            });
        }
    }
};

