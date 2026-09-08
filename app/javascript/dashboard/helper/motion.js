/**
 * Motion presets for the Gotchu design system.
 *
 * Where animation lives, and why it is split:
 *
 *   CSS owns state transitions — hover tints, focus rings, the switch knob, the
 *   spinner, the streaming pulse. They are driven by a class or a pseudo-class
 *   the browser already tracks, they are interruptible for free, and routing
 *   them through JS would cost a frame loop to reproduce something a
 *   `transition` property does natively. Those durations and the keyframes live
 *   in assets/scss/_gotchu-tokens.scss.
 *
 *   motion-v owns enter and exit — dialogs, dropdown menus, banners, toasts.
 *   That is the case `<Transition>` handles awkwardly: an exit animation has to
 *   hold the element in the DOM until it finishes, and once a component can be
 *   dismissed mid-animation you want the interruption handled rather than
 *   re-declared. `AnimatePresence` is that.
 *
 * The durations below are the same numbers as the CSS custom properties, in the
 * seconds motion-v expects. They are duplicated rather than read back from
 * `getComputedStyle` on purpose: a token read at call time is a layout read in
 * an animation path, and these two lists are short enough that drift is visible
 * in review. Keep them in step with _gotchu-tokens.scss.
 *
 * Accessibility is not handled here. `<MotionConfig reduced-motion="user">` in
 * App.vue covers every motion-v animation at once; the CSS half is the
 * prefers-reduced-motion block in the token sheet.
 */

/** cubic-bezier(0.2, 0, 0, 1) — the system's only easing curve. */
export const EASE_OUT = [0.2, 0, 0, 1];

/** Durations in seconds, named for the moment rather than the number. */
export const DURATION = {
  /** Hover and press tints. */
  hover: 0.12,
  /** Inline reveal: trace expand, chips, popovers. */
  reveal: 0.16,
  /** Something arriving: draft dock, approval card, rail cards. */
  arrive: 0.2,
  /** The handled moment — the only place an overshoot is allowed. */
  pop: 0.24,
};

const ease = duration => ({ duration, ease: EASE_OUT });

/**
 * Inline reveal — the `g-in` keyframe as a motion-v variant. Popovers, dropdown
 * menus, anything that appears next to the thing that opened it.
 */
export const REVEAL = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 4 },
  transition: ease(DURATION.reveal),
};

/**
 * Arrival — banners, toasts, the draft dock. Same shape as REVEAL but slower and
 * from further away, because these appear away from the pointer and need to be
 * noticed rather than merely followed.
 */
export const ARRIVE = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 8 },
  transition: ease(DURATION.arrive),
};

/** A modal panel. Scale is small on purpose — the scrim carries the transition. */
export const MODAL = {
  initial: { opacity: 0, scale: 0.98, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.98, y: 8 },
  transition: ease(DURATION.arrive),
};

/** The scrim behind a modal. Flat opacity — the design does not blur it. */
export const SCRIM = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: ease(DURATION.hover),
};

/**
 * The handled moment: a task closed, a reply sent, a code minted. The one
 * overshoot in the system — do not reach for it for ordinary state changes, or
 * it stops meaning anything.
 */
export const POP = {
  initial: { opacity: 0, scale: 0.6 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.6 },
  transition: {
    duration: DURATION.pop,
    ease: [0.34, 1.56, 0.64, 1],
  },
};
