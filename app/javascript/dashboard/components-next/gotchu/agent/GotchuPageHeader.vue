<script setup>
defineProps({
  title: { type: String, required: true },
  lede: { type: String, default: '' },
  crumbs: { type: Array, default: () => [] },
  // An editor whose card carries its own heading (boards 6 and 8): only the
  // crumbs and the actions sit up here; the card's h1 names the page.
  compact: { type: Boolean, default: false },
});
</script>

<template>
  <header class="flex flex-wrap items-start gap-6">
    <div class="min-w-0 flex-[999_1_420px]">
      <nav
        v-if="crumbs.length"
        class="flex items-center gap-2 text-[13px] text-[var(--g-text-muted)]"
        :class="compact ? 'mb-0 min-h-8' : 'mb-3'"
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
      <div v-if="!compact" class="flex flex-wrap items-center gap-3">
        <h1
          class="m-0 [font:var(--g-text-display)] tracking-[var(--g-tracking-display)] text-[var(--g-text)]"
        >
          {{ title }}
        </h1>
        <slot name="pill" />
      </div>
      <p
        v-if="lede && !compact"
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
