const { slateDark } = require('@radix-ui/colors');
import { colors } from './theme/colors';
import { icons } from './theme/icons';
const defaultTheme = require('tailwindcss/defaultTheme');
const {
  iconsPlugin,
  getIconCollections,
} = require('@egoist/tailwindcss-icons');

const defaultSansFonts = [
  '-apple-system',
  'system-ui',
  'BlinkMacSystemFont',
  '"Segoe UI"',
  'Roboto',
  '"Helvetica Neue"',
  'Tahoma',
  'Arial',
  'sans-serif !important',
];

const tailwindConfig = {
  darkMode: 'class',
  content: [
    './enterprise/app/views/**/*.erb',
    './app/javascript/superadmin_pages/**/*.vue',
    './app/javascript/widget/**/*.vue',
    './app/javascript/v3/**/*.vue',
    './app/javascript/dashboard/**/*.vue',
    './app/javascript/portal/**/*.vue',
    './app/javascript/shared/**/*.vue',
    './app/javascript/survey/**/*.vue',
    './app/javascript/dashboard/components-next/**/*.vue',
    './app/javascript/dashboard/helper/**/*.js',
    './app/javascript/dashboard/composables/**/*.js',
    './app/javascript/dashboard/components-next/**/*.js',
    './app/javascript/dashboard/routes/dashboard/**/**/*.js',
    './app/views/**/*.erb',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: defaultSansFonts,
        inter: ['Inter', ...defaultSansFonts],
        interDisplay: ['InterDisplay', ...defaultSansFonts],
      },
      fontWeight: {
        420: '420',
        440: '440',
        460: '460',
        520: '520',
        620: '620',
      },
      typography: {
        bubble: {
          css: {
            color: 'rgb(var(--slate-12))',
            lineHeight: '1.6',
            fontSize: '14px',
            '*': {
              '&:first-child': {
                marginTop: '0',
              },
            },
            overflowWrap: 'anywhere',

            strong: {
              color: 'rgb(var(--slate-12))',
              fontWeight: '700',
            },

            b: {
              color: 'rgb(var(--slate-12))',
              fontWeight: '700',
            },

            h1: {
              color: 'rgb(var(--slate-12))',
              fontWeight: '700',
              fontSize: '1.25rem',
              '&:first-child': {
                marginTop: '0',
              },
            },
            h2: {
              color: 'rgb(var(--slate-12))',
              fontWeight: '700',
              fontSize: '1rem',
              '&:first-child': {
                marginTop: '0',
              },
            },
            h3: {
              color: 'rgb(var(--slate-12))',
              fontWeight: '700',
              fontSize: '1rem',
              '&:first-child': {
                marginTop: '0',
              },
            },
            hr: {
              marginTop: '1.5em',
              marginBottom: '1.5em',
            },
            a: {
              color: 'rgb(var(--slate-12))',
              textDecoration: 'underline',
            },
            ul: {
              paddingInlineStart: '0',
              listStylePosition: 'inside',
            },
            ol: {
              paddingInlineStart: '0',
              listStylePosition: 'inside',
            },
            'ul > li': {
              marginBlockEnd: '0.5em',
              listStyleType: 'disc',
              paddingInlineStart: '1.5em',
              textIndent: '-1.5em',
            },
            'ol > li': {
              marginBlockEnd: '0.5em',
              listStyleType: 'decimal',
              paddingInlineStart: '1.5em',
              textIndent: '-1.5em',
            },
            'li > p:first-child': {
              display: 'inline',
            },
            'li > *': {
              textIndent: '0',
            },
            blockquote: {
              color: 'rgb(var(--slate-11))',
              borderLeft: `4px solid rgb(var(--black-alpha-1))`,
              paddingLeft: '1em',
              '[dir="rtl"] &': {
                borderLeft: 'none',
                paddingLeft: '0',
                borderRight: `4px solid rgb(var(--black-alpha-1))`,
                paddingRight: '1em',
              },
              '[dir="ltr"] &': {
                borderRight: 'none',
                paddingRight: '0',
              },
            },
            code: {
              backgroundColor: 'rgb(var(--alpha-3))',
              color: 'rgb(var(--slate-11))',
              padding: '0.2em 0.4em',
              borderRadius: '4px',
              fontSize: '0.95em',
              '&::before': {
                content: `none`,
              },
              '&::after': {
                content: `none`,
              },
            },
            pre: {
              backgroundColor: 'rgb(var(--alpha-3))',
              padding: '1em',
              borderRadius: '6px',
              overflowX: 'auto',
            },
            table: {
              width: '100%',
              borderCollapse: 'collapse',
            },
            th: {
              padding: '0.75em',
              color: 'rgb(var(--slate-12))',
              border: `none`,
              textAlign: 'start',
              fontWeight: '600',
            },
            tr: {
              border: `none`,
            },
            td: {
              padding: '0.75em',
              border: `none`,
            },
            img: {
              maxWidth: '100%',
              height: 'auto',
              marginTop: 'unset',
              marginBottom: 'unset',
            },
          },
        },
      },
    },
    screens: {
      xs: '480px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
      '3xl': '1900px',
    },
    fontSize: {
      ...defaultTheme.fontSize,
      xxxs: '0.5rem',
      xxs: '0.625rem',
    },
    // Border radius — the Gotchu scale.
    //
    // Source: Claude Design project, tokens/spacing.css §3a ("Radius 8 → 6 on
    // controls, 12 → 10 on cards"), transcribed into
    // dashboard/assets/scss/_gotchu-tokens.scss as `--g-radius-*`. Gotchu has
    // four rungs — 6 / 10 / 16 / 999 — and Tailwind's defaults happen to line up
    // on three of them, so `xl` is the only rung whose rendered value moves.
    //
    // This replaces rather than extends, like `fontSize` above: a top-level
    // theme key wipes the default scale, so the defaults are spread back in and
    // only the Gotchu rungs are overwritten. `rounded-none`, `rounded-sm` (2px)
    // and bare `rounded` (4px) therefore keep Tailwind's values — they have no
    // Gotchu equivalent, and minting one here would add a fifth radius to a
    // four-rung scale.
    //
    // Each override is a `var()` with Tailwind's own default as the fallback,
    // not a hardcoded px. Both halves are load-bearing:
    //
    //  1. _gotchu-tokens.scss stays the single source. Change `--g-radius-card`
    //     there and every `rounded-xl` in the dashboard follows. Hardcode `10px`
    //     here instead and the token file and the utility scale drift apart with
    //     nothing to notice it.
    //  2. One tailwind.config.js feeds FIVE stylesheets — dashboard/_woot.scss,
    //     widget/woot.scss, portal/application.scss, survey/woot.scss and
    //     dashboard/super_admin/index.scss — and only the dashboard and widget
    //     ones import `gotchu-tokens`. Without the fallback, an undefined `--g-radius-card`
    //     makes `border-radius: var(…)` invalid at computed-value time; border
    //     radius does not inherit, so every `rounded-xl` in the portal, survey
    //     and superadmin packs would collapse to 0px. The fallback keeps those
    //     three on exactly today's values and scopes the re-theme to the
    //     dashboard and widget — the same trick, for the same reason, as `--g-brand-rgb` in
    //     theme/colors.js.
    //
    // `lg` (8px) is deliberately NOT remapped, and that is the decision worth
    // reading. 8px is off the Gotchu scale, but it is used 359 times (292 of them
    // in the dashboard) on both sides of the control/card line:
    // `components-next/message` uses it 41 times for chat bubbles (a card →
    // 10px) while `components-next/sidebar` uses it 13 times for nav buttons (a
    // control → 6px). Classifying the 274 plain dashboard sites by their
    // enclosing element split them 95 control / 102 card / 14 media / 63
    // unclear — so either blanket remap moves ~100 call sites the wrong way in
    // one unreviewable jump. It also feeds the
    // size-proportional ladder in components-next/avatar (16→`rounded`, 24→`md`,
    // 32→`lg`, 48→`xl`, 64→`2xl`): pointing `lg` at `--g-radius-card` would tie
    // it with `xl` and collapse two rungs of that ladder into one. So `lg` stays
    // 8px until someone does the per-site pass. It is the known remaining
    // off-scale value, not an oversight.
    borderRadius: {
      ...defaultTheme.borderRadius,
      // --g-radius-control. 6px both ways today; wired anyway so that changing
      // the control radius in the token file actually reaches the 219 call sites
      // that resolve through `md` (`rounded-md`, `rounded-r-md`, `md:rounded-md`
      // …) rather than being coincidentally right.
      md: 'var(--g-radius-control, 0.375rem)',
      // --g-radius-card. The one rung that moves: 12px → 10px. 213 call sites
      // resolve through `xl`; the 196 in the dashboard are the ones that change,
      // the other 17 hold at 12px on the fallback.
      xl: 'var(--g-radius-card, 0.75rem)',
      // --g-radius-modal. 16px both ways today; wired for the same reason as
      // `md`.
      '2xl': 'var(--g-radius-modal, 1rem)',
      // --g-radius-full. 999px against Tailwind's 9999px — indistinguishable on
      // anything narrower than ~2000px, so this is a single-source move and not
      // a visual one.
      full: 'var(--g-radius-full, 9999px)',
    },
    colors: {
      transparent: 'transparent',
      white: '#fff',
      'modal-backdrop-light': 'rgba(0, 0, 0, 0.4)',
      'modal-backdrop-dark': 'rgba(0, 0, 0, 0.6)',
      current: 'currentColor',
      ...colors,
      body: slateDark.slate7,
    },
    keyframes: {
      ...defaultTheme.keyframes,
      wiggle: {
        '0%': { transform: 'translateX(0)' },
        '15%': { transform: 'translateX(0.375rem)' },
        '30%': { transform: 'translateX(-0.375rem)' },
        '45%': { transform: 'translateX(0.375rem)' },
        '60%': { transform: 'translateX(-0.375rem)' },
        '75%': { transform: 'translateX(0.375rem)' },
        '90%': { transform: 'translateX(-0.375rem)' },
        '100%': { transform: 'translateX(0)' },
      },
      'fade-in-up': {
        '0%': { opacity: 0, transform: 'translateY(0.5rem)' },
        '100%': { opacity: 1, transform: 'translateY(0)' },
      },
      'loader-pulse': {
        '0%': { opacity: 0.4 },
        '50%': { opacity: 1 },
        '100%': { opacity: 0.4 },
      },
      'card-select': {
        '0%, 100%': {
          transform: 'translateX(0)',
        },
        '50%': {
          transform: 'translateX(1px)',
        },
      },
      shake: {
        '0%, 100%': { transform: 'translateX(0)' },
        '25%': { transform: 'translateX(0.234375rem)' },
        '50%': { transform: 'translateX(-0.234375rem)' },
        '75%': { transform: 'translateX(0.234375rem)' },
      },
    },
    animation: {
      ...defaultTheme.animation,
      wiggle: 'wiggle 0.5s ease-in-out',
      'fade-in-up': 'fade-in-up 0.3s ease-out',
      'loader-pulse': 'loader-pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      'card-select': 'card-select 0.25s ease-in-out',
      shake: 'shake 0.3s ease-in-out 0s 2',
    },
  },
  plugins: [
    // eslint-disable-next-line
    require('@tailwindcss/typography'),
    iconsPlugin({
      collections: {
        woot: { icons },
        ...getIconCollections([
          'lucide',
          'logos',
          'ri',
          'ph',
          'material-symbols',
          'teenyicons',
          'fluent',
        ]),
      },
    }),
  ],
};

module.exports = tailwindConfig;
