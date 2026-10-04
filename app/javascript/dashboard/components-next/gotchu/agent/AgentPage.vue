<template>
  <!-- w-full: the page ground runs to the right edge however narrow the
    content is (a short form left a white band beside it). -->
  <div class="w-full h-full min-w-0 overflow-y-auto bg-[var(--g-bg)]">
    <!-- max-md:pb-24: on a phone the menu button floats over the bottom-left
      corner, so the end of the page scrolls clear of it. -->
    <div
      class="box-border flex flex-col gap-8 px-12 py-10 max-md:px-4 max-md:pt-6 max-md:pb-24"
    >
      <slot name="header" />
      <div class="flex flex-wrap items-start gap-8">
        <section class="min-w-0 flex flex-col gap-4 flex-[999_1_560px]">
          <slot />
        </section>
        <aside
          v-if="$slots.side"
          class="min-w-0 flex flex-col gap-3 flex-[1_1_300px]"
        >
          <slot name="side" />
        </aside>
      </div>
    </div>
  </div>
</template>
