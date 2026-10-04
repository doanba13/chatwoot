// The boards' primary action, drawn in axolotl. `Button`'s colour enum has no
// brand, so this is the fork's established spelling of one, copied from
// ResolveAction.vue and ApprovalCard.vue: a slate solid Button carrying this
// class (`!` because it fights slate/solid's own utilities at equal
// specificity; `!brightness-100` cancels the solid hover filter, since the
// design's hover is a named colour). One per screen, on the action its board
// draws in brand; every other action is a slate (white, outlined) button.
export const BRAND_BUTTON_CLASS =
  '!bg-n-axolotl !text-n-on-axolotl !font-semibold !outline-transparent hover:enabled:!bg-n-axolotl-hover focus-visible:!bg-n-axolotl-hover hover:enabled:!brightness-100 focus-visible:!brightness-100';
