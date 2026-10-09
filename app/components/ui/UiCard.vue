<template>
  <section class="rounded-ui-card border border-ui-line bg-ui-surface font-ui">
    <header v-if="$slots.title || $slots.actions" class="flex items-center justify-between gap-3 border-b border-ui-line-soft px-5 py-4">
      <h3 class="text-[15px] font-semibold text-ui-ink"><slot name="title" /></h3>
      <div v-if="$slots.actions" class="flex shrink-0 items-center gap-2"><slot name="actions" /></div>
    </header>
    <div class="p-5"><slot /></div>
  </section>
</template>
