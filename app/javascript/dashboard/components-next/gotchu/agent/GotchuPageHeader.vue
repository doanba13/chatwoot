<script setup>
defineProps({
  title: { type: String, required: true },
  lede: { type: String, default: '' },
  crumbs: { type: Array, default: () => [] },
});
</script>

<template>
  <header class="flex flex-wrap items-start gap-6">
    <div class="min-w-0 flex-[999_1_420px]">
      <nav
        v-if="crumbs.length"
        class="flex items-center gap-2 mb-3 text-[13px] text-[var(--g-text-muted)]"
        :aria-label="title"
      >
        <template v-for="(crumb, i) in crumbs" :key="crumb.label">
          <router-link
            v-if="crumb.to"
            :to="crumb.to"
            class="no-underline text-inherit"
          >
            {{ crumb.label }}
          </router-link>
          <span v-else>{{ crumb.label }}</span>
          <span v-if="i < crumbs.length - 1" aria-hidden="true">/</span>
        </template>
      </nav>
      <div class="flex flex-wrap items-center gap-3">
        <h1
          class="m-0 [font:var(--g-text-display)] tracking-[var(--g-tracking-display)] text-[var(--g-text)]"
        >
          {{ title }}
        </h1>
        <slot name="pill" />
      </div>
      <p
        v-if="lede"
        class="mt-2 mb-0 max-w-[620px] [font:var(--g-text-body-lg)] text-[var(--g-text-muted)]"
      >
        {{ lede }}
      </p>
    </div>
    <div class="flex flex-wrap items-center flex-none gap-2">
      <slot name="actions" />
    </div>
  </header>
</template>
