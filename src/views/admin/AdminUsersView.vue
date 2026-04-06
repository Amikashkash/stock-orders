<template>
  <div>
    <div class="text-h6 font-weight-bold mb-4">ניהול משתמשים</div>

    <div v-if="loading" class="d-flex justify-center py-12">
      <v-progress-circular indeterminate color="primary" />
    </div>

    <template v-else>
      <!-- Duplicate warning -->
      <v-alert
        v-if="duplicateGroups.length"
        type="warning"
        variant="tonal"
        rounded="xl"
        class="mb-4"
      >
        <div class="font-weight-bold mb-2">נמצאו {{ duplicateGroups.length }} כתובות אימייל כפולות</div>
        <div v-for="group in duplicateGroups" :key="group.email" class="d-flex align-center justify-space-between mb-1">
          <span class="text-body-2">{{ group.email }} ({{ group.users.length }} משתמשים)</span>
          <v-btn size="x-small" color="warning" variant="elevated" @click="openMerge(group)">מזג</v-btn>
        </div>
      </v-alert>

      <v-card rounded="xl" elevation="1">
        <v-data-table
          :headers="headers"
          :items="users"
          :items-per-page="50"
          item-value="id"
        >
          <!-- Row highlight for duplicates -->
          <template #item="{ item, props: rowProps }">
            <tr v-bind="rowProps" :class="isDuplicate(item.email) ? 'bg-orange-lighten-5' : ''">
              <td>{{ item.fullName }}</td>
              <td>
                {{ item.email }}
                <v-icon v-if="isDuplicate(item.email)" size="x-small" color="warning" class="ms-1">mdi-alert</v-icon>
              </td>
              <td>{{ item.storeName }}</td>
              <td>
                <v-chip :color="item.role === 'admin' ? 'error' : 'primary'" size="small" variant="tonal">
                  {{ item.role === 'admin' ? 'מנהל' : 'חנות' }}
                </v-chip>
              </td>
              <td class="text-end">
                <div class="d-flex gap-1 justify-end">
                  <v-btn size="x-small" variant="tonal" color="primary" icon="mdi-pencil" @click="openEdit(item)" />
                  <v-btn size="x-small" variant="tonal" color="warning" icon="mdi-lock-reset" title="שלח איפוס סיסמה" @click="sendReset(item)" />
                </div>
              </td>
            </tr>
          </template>
        </v-data-table>
      </v-card>
    </template>

    <!-- Edit dialog -->
    <v-dialog v-model="editDialog" max-width="440">
      <v-card v-if="editUser" rounded="xl" class="pa-2">
        <v-card-title class="pa-4">עריכת משתמש</v-card-title>
        <v-card-text>
          <div class="text-body-2 text-medium-emphasis mb-4">{{ editUser.email }}</div>
          <v-text-field v-model="editUser.fullName" label="שם מלא" variant="outlined" density="compact" class="mb-3" />
          <v-text-field v-model="editUser.storeName" label="שם חנות" variant="outlined" density="compact" class="mb-3" />
          <v-select
            v-model="editUser.role"
            :items="[{ title: 'חנות', value: 'store' }, { title: 'מנהל', value: 'admin' }]"
            label="תפקיד"
            variant="outlined"
            density="compact"
          />
        </v-card-text>
        <v-card-actions class="px-4 pb-4 gap-2">
          <v-btn variant="text" @click="editDialog = false">ביטול</v-btn>
          <v-spacer />
          <v-btn color="primary" :loading="saving" @click="saveUser">שמור</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Merge dialog -->
    <v-dialog v-model="mergeDialog" max-width="520">
      <v-card v-if="mergeGroup" rounded="xl" class="pa-2">
        <v-card-title class="pa-4">מיזוג משתמשים כפולים</v-card-title>
        <v-card-text>
          <p class="text-body-2 mb-4">
            בחר איזה רשומה לשמור. הרשומה שלא תישמר תימחק, וכל ההזמנות שלה יועברו לרשומה הנשמרת.
          </p>
          <v-radio-group v-model="keepUserId">
            <v-card
              v-for="u in mergeGroup.users"
              :key="u.id"
              variant="outlined"
              rounded="lg"
              class="mb-2 pa-2"
              :color="keepUserId === u.id ? 'primary' : undefined"
              style="cursor:pointer"
              @click="keepUserId = u.id"
            >
              <div class="d-flex align-center gap-3">
                <v-radio :value="u.id" hide-details />
                <div>
                  <div class="font-weight-bold">{{ u.fullName }}</div>
                  <div class="text-caption text-medium-emphasis">{{ u.storeName }} · {{ u.role === 'admin' ? 'מנהל' : 'חנות' }}</div>
                  <div class="text-caption text-medium-emphasis">UID: {{ u.id.slice(0, 12) }}...</div>
                </div>
              </div>
            </v-card>
          </v-radio-group>
        </v-card-text>
        <v-card-actions class="px-4 pb-4 gap-2">
          <v-btn variant="text" @click="mergeDialog = false">ביטול</v-btn>
          <v-spacer />
          <v-btn color="error" :loading="merging" :disabled="!keepUserId" @click="confirmMerge">
            מזג ומחק כפיל
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { collection, getDocs, doc, updateDoc, deleteDoc, writeBatch, query, where } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuthStore } from '@/stores/auth'
import { useNotificationStore } from '@/stores/notifications'

const authStore = useAuthStore()
const notify = useNotificationStore()

const loading = ref(true)
const saving = ref(false)
const merging = ref(false)
const users = ref([])
const editDialog = ref(false)
const editUser = ref(null)
const mergeDialog = ref(false)
const mergeGroup = ref(null)
const keepUserId = ref(null)

const headers = [
  { title: 'שם', key: 'fullName', sortable: true },
  { title: 'אימייל', key: 'email', sortable: true },
  { title: 'חנות', key: 'storeName', sortable: true },
  { title: 'תפקיד', key: 'role', sortable: true },
  { title: 'פעולות', key: 'actions', sortable: false, align: 'end' },
]

const duplicateGroups = computed(() => {
  const emailMap = {}
  users.value.forEach((u) => {
    if (!u.email) return
    const key = u.email.toLowerCase()
    if (!emailMap[key]) emailMap[key] = { email: u.email, users: [] }
    emailMap[key].users.push(u)
  })
  return Object.values(emailMap).filter((g) => g.users.length > 1)
})

const duplicateEmails = computed(() => new Set(duplicateGroups.value.map((g) => g.email.toLowerCase())))

function isDuplicate(email) {
  return email && duplicateEmails.value.has(email.toLowerCase())
}

onMounted(async () => {
  const snap = await getDocs(collection(db, 'users'))
  users.value = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  loading.value = false
})

function openEdit(user) {
  editUser.value = { ...user }
  editDialog.value = true
}

async function saveUser() {
  saving.value = true
  try {
    await updateDoc(doc(db, 'users', editUser.value.id), {
      fullName: editUser.value.fullName,
      storeName: editUser.value.storeName,
      role: editUser.value.role,
    })
    const idx = users.value.findIndex((u) => u.id === editUser.value.id)
    if (idx !== -1) users.value[idx] = { ...editUser.value }
    notify.showSuccess('המשתמש עודכן')
    editDialog.value = false
  } catch (err) {
    notify.showError('שגיאה: ' + err.message)
  } finally {
    saving.value = false
  }
}

async function sendReset(user) {
  if (!user.email) { notify.showError('אין אימייל למשתמש זה'); return }
  try {
    await authStore.resetPassword(user.email)
    notify.showSuccess(`קישור איפוס נשלח ל-${user.email}`)
  } catch {
    notify.showError('שגיאה בשליחת איפוס סיסמה')
  }
}

function openMerge(group) {
  mergeGroup.value = group
  // Pre-select the user with admin role, or the first one
  const admin = group.users.find((u) => u.role === 'admin')
  keepUserId.value = admin ? admin.id : group.users[0].id
  mergeDialog.value = true
}

async function confirmMerge() {
  if (!keepUserId.value || !mergeGroup.value) return
  merging.value = true

  const deleteUsers = mergeGroup.value.users.filter((u) => u.id !== keepUserId.value)

  try {
    for (const deleteUser of deleteUsers) {
      // Re-assign orders from deleted user to kept user
      const ordersSnap = await getDocs(
        query(collection(db, 'orders'), where('createdBy', '==', deleteUser.id))
      )
      if (ordersSnap.docs.length > 0) {
        const batch = writeBatch(db)
        ordersSnap.docs.forEach((d) => {
          batch.update(d.ref, { createdBy: keepUserId.value })
        })
        await batch.commit()
      }

      // Delete duplicate user doc
      await deleteDoc(doc(db, 'users', deleteUser.id))
      users.value = users.value.filter((u) => u.id !== deleteUser.id)
    }

    notify.showSuccess('המיזוג הושלם בהצלחה')
    mergeDialog.value = false
  } catch (err) {
    notify.showError('שגיאה במיזוג: ' + err.message)
  } finally {
    merging.value = false
  }
}
</script>
