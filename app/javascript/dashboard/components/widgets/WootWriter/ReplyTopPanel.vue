<script>
import { ref } from 'vue';
import { useKeyboardEvents } from 'dashboard/composables/useKeyboardEvents';
import { useCaptain } from 'dashboard/composables/useCaptain';
import { useTrack } from 'dashboard/composables';
import { vOnClickOutside } from '@vueuse/components';
import { REPLY_EDITOR_MODES, CHAR_LENGTH_WARNING } from './constants';
import { CAPTAIN_EVENTS } from 'dashboard/helper/AnalyticsHelper/events';
import NextButton from 'dashboard/components-next/button/Button.vue';
import CopilotMenuBar from './CopilotMenuBar.vue';

export default {
  name: 'ReplyTopPanel',
  components: {
    NextButton,
    CopilotMenuBar,
  },
  directives: {
    OnClickOutside: vOnClickOutside,
  },
  props: {
    // Which composer surface is showing: 'instruct' | 'reply' | 'memo'.
    // Owned by ReplyBox; only the Reply tab can send, and only it shows the
    // private-note switch.
    composerTab: {
      type: String,
      default: 'reply',
    },
    mode: {
      type: String,
      default: REPLY_EDITOR_MODES.REPLY,
    },
    isReplyRestricted: {
      type: Boolean,
      default: false,
    },
    disabled: {
      type: Boolean,
      default: false,
    },
    isEditorDisabled: {
      type: Boolean,
      default: false,
    },
    conversationId: {
      type: Number,
      default: null,
    },
    isMessageLengthReachingThreshold: {
      type: Boolean,
      default: () => false,
    },
    charactersRemaining: {
      type: Number,
      default: () => 0,
    },
    editorContent: {
      type: String,
      default: undefined,
    },
    hasContent: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['setReplyMode', 'toggleEditorSize', 'executeCopilotAction'],
  setup(props, { emit }) {
    const setReplyMode = mode => {
      emit('setReplyMode', mode);
    };
    const handleReplyClick = () => {
      if (props.isReplyRestricted) return;
      setReplyMode(REPLY_EDITOR_MODES.REPLY);
    };
    const handleNoteClick = () => {
      setReplyMode(REPLY_EDITOR_MODES.NOTE);
    };

    const { captainTasksEnabled } = useCaptain();
    const showCopilotMenu = ref(false);
    const copilotToggleRef = ref(null);

    const handleCopilotAction = (actionKey, data) => {
      emit('executeCopilotAction', actionKey, data || props.editorContent);
      showCopilotMenu.value = false;
    };

    const toggleCopilotMenu = () => {
      const isOpening = !showCopilotMenu.value;
      if (isOpening) {
        useTrack(CAPTAIN_EVENTS.EDITOR_AI_MENU_OPENED, {
          conversationId: props.conversationId,
          entryPoint: 'top_panel',
        });
      }
      showCopilotMenu.value = isOpening;
    };

    const handleClickOutside = () => {
      showCopilotMenu.value = false;
    };

    // Key hint shown on the private-note switch. `⌥` is how the shortcuts
    // modal writes Alt; Alt+P and Alt+L are registered just below.
    const noteKeyHint = '⌥P';

    // Alt+P and Alt+L flip the reply mode, so they act only in the Reply tab,
    // read at key time: from Instruct or Memo they would change a mode nothing
    // on screen shows, and the supporter would come back to a Reply tab in a
    // mode they did not pick.
    const inReplyTab = () => props.composerTab === 'reply';
    const keyboardEvents = {
      'Alt+KeyP': {
        action: () => {
          if (inReplyTab()) handleNoteClick();
        },
        allowOnFocusedInput: false,
      },
      'Alt+KeyL': {
        action: () => {
          if (inReplyTab()) handleReplyClick();
        },
        allowOnFocusedInput: false,
      },
    };
    useKeyboardEvents(keyboardEvents);

    return {
      handleReplyClick,
      handleNoteClick,
      REPLY_EDITOR_MODES,
      captainTasksEnabled,
      handleCopilotAction,
      showCopilotMenu,
      copilotToggleRef,
      toggleCopilotMenu,
      handleClickOutside,
      noteKeyHint,
    };
  },
  computed: {
    isOnNote() {
      // A restricted reply forces note mode, as the previous toggle component did.
      return this.isReplyRestricted || this.mode === REPLY_EDITOR_MODES.NOTE;
    },
    charLengthClass() {
      return this.charactersRemaining < 0 ? 'text-n-ruby-9' : 'text-n-slate-11';
    },
    characterLengthWarning() {
      return this.charactersRemaining < 0
        ? `${-this.charactersRemaining} ${CHAR_LENGTH_WARNING.NEGATIVE}`
        : `${this.charactersRemaining} ${CHAR_LENGTH_WARNING.UNDER_50}`;
    },
  },
  methods: {
    // On, the switch turns the note back into a reply; off, it makes the
    // reply a note. A restricted channel keeps it on and disabled, and
    // handleReplyClick refuses there too.
    togglePrivateNote() {
      if (this.isOnNote) this.handleReplyClick();
      else this.handleNoteClick();
    },
  },
};
</script>

<template>
  <div
    class="flex justify-between gap-2 h-[3.25rem] items-center ltr:pl-3 ltr:pr-2 rtl:pr-3 rtl:pl-2"
  >
    <button
      v-if="composerTab === 'reply'"
      type="button"
      role="switch"
      class="note-switch"
      :class="{ 'is-on': isOnNote }"
      :aria-checked="isOnNote ? 'true' : 'false'"
      :disabled="disabled || isReplyRestricted"
      data-testid="private-note-toggle"
      @click="togglePrivateNote"
    >
      <span class="note-switch__track" aria-hidden="true">
        <span class="note-switch__thumb" />
      </span>
      {{ $t('CONVERSATION.REPLYBOX.PRIVATE_NOTE') }}
      <kbd class="mode-toggle__key">{{ noteKeyHint }}</kbd>
    </button>
    <div class="flex items-center mx-4 my-0">
      <div v-if="isMessageLengthReachingThreshold" class="text-xs">
        <span :class="charLengthClass">
          {{ characterLengthWarning }}
        </span>
      </div>
    </div>
    <div v-if="captainTasksEnabled" class="flex items-center gap-2">
      <div class="relative">
        <NextButton
          ref="copilotToggleRef"
          ghost
          :disabled="disabled || isEditorDisabled"
          :class="{
            'text-n-violet-9 hover:enabled:!bg-n-violet-3': !showCopilotMenu,
            'text-n-violet-9 bg-n-violet-3': showCopilotMenu,
          }"
          sm
          icon="i-ph-sparkle-fill"
          @click="toggleCopilotMenu"
        />
        <CopilotMenuBar
          v-if="showCopilotMenu"
          v-on-click-outside="[
            handleClickOutside,
            { ignore: [copilotToggleRef] },
          ]"
          :has-selection="false"
          :has-content="hasContent"
          :conversation-id="conversationId"
          class="ltr:right-0 rtl:left-0 bottom-full mb-2"
          @execute-copilot-action="handleCopilotAction"
        />
      </div>
      <NextButton
        ghost
        class="text-n-slate-11"
        sm
        icon="i-lucide-maximize-2"
        @click="$emit('toggleEditorSize')"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
// Private note is a switch inside the Reply tab, not a tab of its own: the
// canvas draws Instruct · Reply · Memo, and supporters still need notes.
.note-switch {
  @apply inline-flex items-center gap-2 ltr:ml-auto rtl:mr-auto text-sm font-medium text-[var(--g-text-muted)] bg-transparent border-0;

  &.is-on {
    @apply text-[var(--g-text)];
  }

  &:disabled {
    @apply opacity-60 cursor-not-allowed;
  }
}

.note-switch__track {
  @apply relative inline-flex items-center w-7 h-4 rounded-full bg-[var(--g-slate-tint-strong)] transition-colors duration-[var(--g-dur-hover)];

  .is-on & {
    @apply bg-[var(--g-agent)];
  }
}

.note-switch__thumb {
  @apply absolute size-3 rounded-full bg-white ltr:left-0.5 rtl:right-0.5 transition-transform duration-[var(--g-dur-hover)];

  .is-on & {
    @apply ltr:translate-x-3 rtl:-translate-x-3;
  }
}

// The design draws `R` and `N` here. Those shortcuts do not exist; the ones
// that do are Alt+L and Alt+P, registered in this component's setup and listed
// in the shortcuts modal as SWITCH_TO_REPLY / SWITCH_TO_PRIVATE_NOTE. The hint
// names the real binding rather than the drawn one.
.mode-toggle__key {
  font: var(--g-text-key);
  @apply px-1 border rounded border-[var(--g-border)] opacity-60;
}
</style>
