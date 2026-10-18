<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { OnClickOutside } from '@vueuse/components';
import {
  TRANSLATE_TARGETS,
  useTranslateSetting,
} from 'dashboard/composables/useTranslateSetting';
import Button from 'dashboard/components-next/button/Button.vue';
import DropdownMenu from 'dashboard/components-next/dropdown-menu/DropdownMenu.vue';

const { t } = useI18n();
const { enabled, target, setEnabled, setTarget } = useTranslateSetting();
const isOpen = ref(false);

const languageName = lang =>
  ({
    en: t('GOTCHU.TRANSLATE.LANGUAGES.en'),
    vi: t('GOTCHU.TRANSLATE.LANGUAGES.vi'),
    de: t('GOTCHU.TRANSLATE.LANGUAGES.de'),
    fr: t('GOTCHU.TRANSLATE.LANGUAGES.fr'),
  })[lang];

const items = computed(() =>
  TRANSLATE_TARGETS.map(lang => ({
    label: languageName(lang),
    value: lang,
    action: 'pick',
    isSelected: lang === target.value,
  }))
);

const pick = ({ value }) => {
  isOpen.value = false;
  setTarget(value);
};
</script>

<template>
  <div class="flex items-center flex-shrink-0 gap-1">
    <Button
      v-tooltip.bottom="t('GOTCHU.TRANSLATE.SWITCH_TOOLTIP')"
      :label="t('GOTCHU.TRANSLATE.SWITCH_LABEL')"
      :variant="enabled ? 'faded' : 'ghost'"
      slate
      sm
      :aria-pressed="enabled"
      @click="setEnabled(!enabled)"
    />
    <OnClickOutside class="relative" @trigger="isOpen = false">
      <Button
        ghost
        slate
        sm
        :label="languageName(target)"
        :aria-label="t('GOTCHU.TRANSLATE.LANGUAGE_LABEL')"
        icon="i-lucide-chevron-down"
        trailing-icon
        @click="isOpen = !isOpen"
      />
      <DropdownMenu
        v-if="isOpen"
        :menu-items="items"
        class="mt-1 end-0 top-full w-40"
        @action="pick"
      />
    </OnClickOutside>
  </div>
</template>
