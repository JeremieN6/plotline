<template>
  <div class="grid gap-5">
    <section class="rounded-[20px] border border-[#E5E3DF] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      <p class="text-xs font-semibold uppercase tracking-[0.22em] text-[#E8873A]">Compte</p>
      <h1 class="mt-2 text-3xl font-bold text-[#111111]">Usage</h1>
      <p class="mt-3 text-sm text-[#666666]">
        Nombre de générations du mois, pour voir ce que ça représente. Aucune limite n'est appliquée.
      </p>

      <div class="mt-5 flex flex-wrap items-end gap-4">
        <div>
          <label class="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#AAAAAA]" for="usage-month">Mois</label>
          <select
            id="usage-month"
            v-model="month"
            class="mt-1.5 block rounded-[10px] border border-[#E5E3DF] bg-white px-3 py-2.5 text-sm text-[#111111] outline-none focus:border-[#E8873A]"
          >
            <option v-for="item in monthOptions" :key="item" :value="item">{{ item }}</option>
          </select>
        </div>

        <div v-if="isAdmin">
          <label class="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#AAAAAA]" for="usage-scope">Périmètre</label>
          <select
            id="usage-scope"
            v-model="scope"
            class="mt-1.5 block rounded-[10px] border border-[#E5E3DF] bg-white px-3 py-2.5 text-sm text-[#111111] outline-none focus:border-[#E8873A]"
          >
            <option value="account">Mon compte</option>
            <option value="all">Tous les comptes</option>
          </select>
        </div>
      </div>
    </section>

    <p v-if="error" class="rounded-[14px] border border-[#F1CEC7] bg-[#FFF7F5] p-4 text-sm text-[#C65244]">
      Impossible de charger l'usage.
    </p>

    <template v-else-if="usage">
      <section class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div v-for="tile in tiles" :key="tile.label" class="rounded-xl border border-[#E8E3DC] bg-[#FFFCF8] p-4">
          <p class="text-[11px] uppercase tracking-[0.16em] text-[#A18972]">{{ tile.label }}</p>
          <p class="mt-1 text-3xl font-bold text-[#111111]">{{ tile.value }}</p>
        </div>
      </section>

      <section class="rounded-[20px] border border-[#E5E3DF] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <h2 class="text-xl font-bold text-[#111111]">Par modèle</h2>
        <p v-if="!modelRows.length" class="mt-3 text-sm text-[#666666]">Aucune génération ce mois-ci.</p>
        <table v-else class="mt-3 w-full text-left text-sm">
          <thead>
            <tr class="text-[11px] uppercase tracking-[0.14em] text-[#AAAAAA]">
              <th class="py-2 pr-4 font-semibold">Modèle</th>
              <th class="py-2 text-right font-semibold">Générations</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in modelRows" :key="row.model" class="border-t border-[#EFEBE5]">
              <td class="py-2 pr-4 text-[#111111]">{{ row.model }}</td>
              <td class="py-2 text-right font-semibold text-[#111111]">{{ row.count }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="rounded-[20px] border border-[#E5E3DF] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <h2 class="text-xl font-bold text-[#111111]">{{ scope === 'all' ? 'Par compte' : 'Par profil' }}</h2>
        <p v-if="!usage.breakdown.length" class="mt-3 text-sm text-[#666666]">Aucune activité ce mois-ci.</p>
        <div v-else class="mt-3 overflow-x-auto">
          <table class="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr class="text-[11px] uppercase tracking-[0.14em] text-[#AAAAAA]">
                <th class="py-2 pr-4 font-semibold">{{ scope === 'all' ? 'Compte' : 'Profil' }}</th>
                <th class="py-2 text-right font-semibold">Générations</th>
                <th class="py-2 text-right font-semibold">Vidéos</th>
                <th class="py-2 text-right font-semibold">Images</th>
                <th class="py-2 text-right font-semibold">Régénérations</th>
                <th class="py-2 text-right font-semibold">Échecs</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in usage.breakdown" :key="row.id" class="border-t border-[#EFEBE5]">
                <td class="py-2 pr-4 break-all text-[#111111]">{{ row.name }}</td>
                <td class="py-2 text-right font-semibold text-[#111111]">{{ row.generations }}</td>
                <td class="py-2 text-right text-[#111111]">{{ row.videos }}</td>
                <td class="py-2 text-right text-[#111111]">{{ row.images }}</td>
                <td class="py-2 text-right text-[#111111]">{{ row.regenerations }}</td>
                <td class="py-2 text-right text-[#111111]">{{ row.failed }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <p class="text-xs text-[#888888]">
        {{ usage.limits }}
        <span v-if="usage.truncated" class="font-semibold text-[#C65244]"> Résultat tronqué : trop de lignes pour ce mois.</span>
      </p>
    </template>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

useHead({ title: 'Usage' })

const { user: authUser, refreshAuth } = useAuthSession()
await refreshAuth()
const isAdmin = computed(() => Boolean(authUser.value?.isAdmin))

function formatMonth(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

// 6 derniers mois, du plus recent au plus ancien.
const monthOptions = Array.from({ length: 6 }, (_, offset) => {
  const date = new Date()
  date.setDate(1)
  date.setMonth(date.getMonth() - offset)
  return formatMonth(date)
})

const month = ref(monthOptions[0])
const scope = ref('account')

const { data: usage, error } = await useFetch('/api/usage', {
  query: computed(() => ({ month: month.value, ...(isAdmin.value && scope.value === 'all' ? { scope: 'all' } : {}) })),
})

const tiles = computed(() => {
  const total = usage.value?.total
  if (!total) return []
  return [
    { label: 'Générations', value: total.generations },
    { label: 'Vidéos', value: total.videos },
    { label: 'Images', value: total.images },
    { label: 'Régénérations', value: total.regenerations },
    { label: 'Échecs', value: total.failed },
  ]
})

const modelRows = computed(() => Object.entries(usage.value?.total?.byModel || {})
  .map(([model, count]) => ({ model, count }))
  .sort((a, b) => b.count - a.count))
</script>
