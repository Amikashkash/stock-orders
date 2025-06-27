import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

// This is a "component" that encapsulates the HTML and logic for the Auth screen.
export const AuthView = {
    getHTML: function() {
        return `
            <div class="flex items-center justify-center h-screen p-4">
                <div class="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-lg">
                    <h1 class="text-3xl font-bold text-center text-gray-800">מערכת ניהול מחסן</h1>
                    <div class="flex border-b">
                        <button id="login-tab-button" class="flex-1 py-2 text-center font-semibold text-indigo-600 border-b-2 border-indigo-600">התחברות</button>
                        <button id="signup-tab-button" class="flex-1 py-2 text-center font-semibold text-gray-500">הרשמה</button>
                    </div>
                    <div id="auth-message-area" class="text-center p-2 rounded-md text-sm"></div>
                    <div id="login-form-container">
                        <form id="login-form" class="space-y-4">
                            <div><label for="login-email" class="block text-sm font-medium text-gray-700">כתובת מייל</label><input type="email" id="login-email" name="email" required autocomplete="email" class="input-style"></div>
                            <div><label for="login-password" class="block text-sm font-medium text-gray-700">סיסמה</label><input type="password" id="login-password" name="password" required autocomplete="current-password" class="input-style"></div>
                            <button type="submit" class="w-full py-2 px-4 text-white font-semibold bg-indigo-600 rounded-md hover:bg-indigo-700 flex justify-center items-center">התחבר</button>
                        </form>
                        <div class="mt-4 relative"><div class="absolute inset-0 flex items-center"><div class="w-full border-t border-gray-300"></div></div><div class="relative flex justify-center text-sm"><span class="px-2 bg-white text-gray-500">או התחבר באמצעות</span></div></div>
                        <button id="google-login-btn" class="w-full mt-4 py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 flex items-center justify-center gap-2"><svg class="w-5 h-5" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path><path fill="none" d="M0 0h48v48H0z"></path></svg>Google</button>
                    </div>
                    <div id="signup-form-container" class="hidden">
                        <form id="signup-form" class="space-y-4">
                            <div><label for="signup-name" class="block text-sm font-medium text-gray-700">שם מלא</label><input type="text" id="signup-name" name="fullName" required class="input-style"></div>
                            <div><label for="signup-email" class="block text-sm font-medium text-gray-700">כתובת מייל</label><input type="email" id="signup-email" name="email" required autocomplete="email" class="input-style"></div>
                            <div><label for="signup-password" class="block text-sm font-medium text-gray-700">סיסמה</label><input type="password" id="signup-password" name="password" required minlength="6" autocomplete="new-password" class="input-style"></div>
                            <div><label for="signup-store" class="block text-sm font-medium text-gray-700">שם סניף</label><input type="text" id="signup-store" name="storeName" required class="input-style"></div>
                            <button type="submit" class="w-full py-2 px-4 text-white font-semibold bg-indigo-600 rounded-md hover:bg-indigo-700 flex justify-center items-center">הירשם</button>
                        </form>
                    </div>
                </div>
            </div>`;
    },
    attachEventListeners: function(auth, GoogleAuthProvider, signInWithRedirect, db) {
        const loginForm = document.getElementById('login-form');
        const signupForm = document.getElementById('signup-form');
        const googleLoginBtn = document.getElementById('google-login-btn');
        const loginTab = document.getElementById('login-tab-button');
        const signupTab = document.getElementById('signup-tab-button');
        const messageArea = document.getElementById('auth-message-area');

        // Tab switching
        loginTab.addEventListener('click', () => {
            document.getElementById('login-form-container').classList.remove('hidden');
            document.getElementById('signup-form-container').classList.add('hidden');
            loginTab.classList.add('text-indigo-600', 'border-indigo-600');
            signupTab.classList.remove('text-indigo-600', 'border-indigo-600');
        });

        signupTab.addEventListener('click', () => {
            document.getElementById('login-form-container').classList.add('hidden');
            document.getElementById('signup-form-container').classList.remove('hidden');
            loginTab.classList.remove('text-indigo-600', 'border-indigo-600');
            signupTab.classList.add('text-indigo-600', 'border-indigo-600');
        });

        // Form submissions
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                await signInWithEmailAndPassword(auth, loginForm.email.value, loginForm.password.value);
            } catch (error) {
                messageArea.textContent = `שגיאה בהתחברות: ${error.message}`;
                messageArea.classList.add('text-red-500');
            }
        });

        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                const userCredential = await createUserWithEmailAndPassword(auth, signupForm.email.value, signupForm.password.value);
                await updateProfile(userCredential.user, { displayName: signupForm.fullName.value });
                // שמור את שם הסניף במסמך המשתמש
                if (db) {
                    const userRef = doc(db, "users", userCredential.user.uid);
                    await setDoc(userRef, {
                        fullName: signupForm.fullName.value,
                        storeName: signupForm.storeName.value
                    }, { merge: true });
                }
            } catch (error) {
                messageArea.textContent = `שגיאה בהרשמה: ${error.message}`;
                messageArea.classList.add('text-red-500');
            }
        });
        
        // Google login
        googleLoginBtn.addEventListener('click', async () => {
            const provider = new GoogleAuthProvider();
            await signInWithRedirect(auth, provider);
        });
        
            
        }
};