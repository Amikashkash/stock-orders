<template>
  <v-app :theme="'warehouse'" style="font-family: Heebo, sans-serif;">
    <v-main class="d-flex align-center justify-center" style="min-height: 100vh; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);">
      <v-card width="400" rounded="xl" elevation="12" class="pa-4">
        <v-card-text class="text-center py-6">
          <v-icon size="64" color="primary" class="mb-3">mdi-warehouse</v-icon>
          <div class="text-h5 font-weight-bold mb-1">ניהול מחסן</div>
          <div class="text-body-2 text-medium-emphasis mb-6">מערכת ניהול הזמנות ומלאי</div>

          <!-- Google sign-in -->
          <v-btn
            size="large"
            block
            rounded="lg"
            variant="outlined"
            class="text-none mb-4"
            :loading="loadingGoogle"
            @click="handleGoogleSignIn"
          >
            <v-icon start>mdi-google</v-icon>
            התחבר עם Google
          </v-btn>

          <v-divider class="mb-4">
            <span class="text-body-2 text-medium-emphasis px-2">או</span>
          </v-divider>

          <!-- Tab: login / register -->
          <v-tabs v-model="tab" grow class="mb-4">
            <v-tab value="login">התחברות</v-tab>
            <v-tab value="register">הרשמה</v-tab>
          </v-tabs>

          <!-- Login form -->
          <v-window v-model="tab">
            <v-window-item value="login">
              <v-form ref="loginFormRef" @submit.prevent="handleEmailSignIn">
                <v-text-field
                  v-model="email"
                  label="אימייל"
                  type="email"
                  :rules="[r => !!r || 'שדה חובה']"
                  variant="outlined"
                  density="compact"
                  class="mb-2"
                />
                <v-text-field
                  v-model="password"
                  label="סיסמה"
                  :type="showPassword ? 'text' : 'password'"
                  :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
                  @click:append-inner="showPassword = !showPassword"
                  :rules="[r => !!r || 'שדה חובה']"
                  variant="outlined"
                  density="compact"
                  class="mb-3"
                />
                <v-btn type="submit" color="primary" block size="large" rounded="lg" :loading="loadingEmail">
                  התחבר
                </v-btn>
                <div class="text-center mt-3">
                  <v-btn variant="text" size="small" color="primary" @click="forgotDialog = true">
                    שכחתי סיסמה
                  </v-btn>
                </div>
              </v-form>
            </v-window-item>

            <!-- Register form -->
            <v-window-item value="register">
              <v-form ref="registerFormRef" @submit.prevent="handleRegister">
                <v-text-field
                  v-model="fullName"
                  label="שם מלא"
                  :rules="[r => !!r || 'שדה חובה']"
                  variant="outlined"
                  density="compact"
                  class="mb-2"
                />
                <v-text-field
                  v-model="email"
                  label="אימייל"
                  type="email"
                  :rules="[r => !!r || 'שדה חובה']"
                  variant="outlined"
                  density="compact"
                  class="mb-2"
                />
                <v-text-field
                  v-model="password"
                  label="סיסמה (לפחות 6 תווים)"
                  :type="showPassword ? 'text' : 'password'"
                  :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
                  @click:append-inner="showPassword = !showPassword"
                  :rules="[r => !!r || 'שדה חובה', r => r.length >= 6 || 'לפחות 6 תווים']"
                  variant="outlined"
                  density="compact"
                  class="mb-3"
                />
                <v-btn type="submit" color="primary" block size="large" rounded="lg" :loading="loadingEmail">
                  הירשם
                </v-btn>
              </v-form>
            </v-window-item>
          </v-window>

          <v-alert v-if="error" type="error" variant="tonal" rounded="lg" class="mt-4 text-body-2">
            {{ error }}
          </v-alert>
        </v-card-text>
      </v-card>
    </v-main>

    <!-- Forgot password dialog -->
    <v-dialog v-model="forgotDialog" max-width="360">
      <v-card rounded="xl" class="pa-2">
        <v-card-title class="text-h6 pa-4">איפוס סיסמה</v-card-title>
        <v-card-text>
          <p class="text-body-2 mb-4">הכנס את כתובת האימייל שלך ונשלח לך קישור לאיפוס סיסמה.</p>
          <v-text-field
            v-model="resetEmail"
            label="אימייל"
            type="email"
            variant="outlined"
            density="compact"
            :disabled="resetSent"
          />
          <v-alert v-if="resetSent" type="success" variant="tonal" rounded="lg" class="mt-2 text-body-2">
            הקישור נשלח! בדוק את תיבת הדואר שלך.
          </v-alert>
        </v-card-text>
        <v-card-actions class="px-4 pb-4 gap-2">
          <v-btn variant="text" @click="forgotDialog = false; resetSent = false">סגור</v-btn>
          <v-spacer />
          <v-btn color="primary" :loading="loadingReset" :disabled="!resetEmail || resetSent" @click="handleForgotPassword">
            שלח קישור
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <AppSnackbar />
  </v-app>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AppSnackbar from '@/components/common/AppSnackbar.vue'

const authStore = useAuthStore()
const router = useRouter()

watch(() => authStore.isAuthenticated, (val) => {
  if (val) router.push('/')
})
const tab = ref('login')
const email = ref('')
const password = ref('')
const fullName = ref('')
const showPassword = ref(false)
const loadingGoogle = ref(false)
const loadingEmail = ref(false)
const error = ref('')
const forgotDialog = ref(false)
const resetEmail = ref('')
const resetSent = ref(false)
const loadingReset = ref(false)
const loginFormRef = ref(null)
const registerFormRef = ref(null)

const firebaseErrors = {
  'auth/user-not-found': 'משתמש לא נמצא',
  'auth/wrong-password': 'סיסמה שגויה',
  'auth/invalid-credential': 'אימייל או סיסמה שגויים',
  'auth/email-already-in-use': 'האימייל כבר רשום במערכת',
  'auth/weak-password': 'הסיסמה חלשה מדי',
  'auth/invalid-email': 'כתובת אימייל לא תקינה',
  'auth/popup-closed-by-user': '',
  'auth/cancelled-popup-request': '',
}

function parseError(e) {
  return firebaseErrors[e.code] ?? 'שגיאה בהתחברות. נסה שוב.'
}

async function handleGoogleSignIn() {
  loadingGoogle.value = true
  error.value = ''
  try {
    await authStore.signInWithGoogle()
  } catch (e) {
    error.value = parseError(e)
    loadingGoogle.value = false
  }
}

async function handleEmailSignIn() {
  const { valid } = await loginFormRef.value.validate()
  if (!valid) return
  loadingEmail.value = true
  error.value = ''
  try {
    await authStore.signInWithEmail(email.value, password.value)
  } catch (e) {
    error.value = parseError(e)
    loadingEmail.value = false
  }
}

async function handleRegister() {
  const { valid } = await registerFormRef.value.validate()
  if (!valid) return
  loadingEmail.value = true
  error.value = ''
  try {
    await authStore.registerWithEmail(email.value, password.value, fullName.value)
  } catch (e) {
    error.value = parseError(e)
    loadingEmail.value = false
  }
}

async function handleForgotPassword() {
  loadingReset.value = true
  try {
    await authStore.resetPassword(resetEmail.value)
    resetSent.value = true
  } catch (e) {
    resetEmail.value = ''
  } finally {
    loadingReset.value = false
  }
}
</script>
