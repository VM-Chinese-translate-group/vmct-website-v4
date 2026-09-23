import { defineConfig } from 'unocss'
import { presetWind3 } from 'unocss/preset-wind3'

export default defineConfig({
  content: {
    pipeline: {
      include: ['index.html', 'src/**/*.{vue,md}'],
    },
  },
  presets: [presetWind3()],
  shortcuts: {
    'cms-label': 'grid gap-1.5 text-sm font-600 text-[var(--text-2)]',
    'cms-field':
      'box-border min-h-11 w-full rounded-lg border border-solid border-[var(--switcher-border)] bg-[var(--bg-alt)] px-3 py-2 text-[var(--text-1)] outline-none transition-colors placeholder:text-[var(--text-muted)] hover:border-[color-mix(in_srgb,var(--info-1)_55%,var(--switcher-border))] focus-visible:border-[var(--info-1)] focus-visible:ring-3 focus-visible:ring-[color-mix(in_srgb,var(--info-1)_16%,transparent)]',
    'cms-button':
      'inline-flex min-h-10 cursor-pointer items-center justify-center rounded-lg border border-solid border-[var(--switcher-border)] bg-[var(--bg-soft)] px-3 py-2 font-600 text-sm text-[var(--text-1)] transition-colors hover:border-[var(--info-1)] hover:bg-[var(--info-soft)] disabled:pointer-events-none disabled:opacity-50',
    'cms-icon-button':
      'cms-button aspect-square px-0 text-lg text-[var(--text-2)] hover:text-[var(--warning-1)]',
    'cms-danger-button':
      'cms-button border-[color-mix(in_srgb,#dc2626_35%,var(--switcher-border))] text-red-600 dark:text-red-400 hover:border-red-500 hover:bg-red-500/10',
    'cms-primary-button':
      'inline-flex min-h-10 cursor-pointer items-center justify-center rounded-lg border-0 bg-[var(--info-1)] px-4 py-2 font-700 text-sm text-white shadow-sm transition hover:brightness-110 disabled:pointer-events-none disabled:opacity-50',
    'cms-check':
      'flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--switcher-border)] bg-[var(--bg-soft)] px-3 py-2 text-sm font-600 text-[var(--text-2)] [&_input]:accent-[var(--info-1)]',
    'cms-page-row':
      'flex w-full cursor-pointer items-center justify-between gap-2 overflow-hidden rounded-lg border-0 bg-transparent px-2.5 py-2.5 text-left text-sm text-[var(--text-1)] transition-colors hover:bg-[var(--switcher-item-hover)] [&_span]:overflow-hidden [&_span]:text-ellipsis [&_span]:whitespace-nowrap',
    'cms-panel':
      'grid gap-4 rounded-2xl border border-[var(--switcher-border)] bg-[var(--bg-alt)] p-6 shadow-[var(--vp-shadow-1)] max-sm:p-4',
    'cms-library':
      'sticky top-20 flex h-[calc(100vh-6rem)] min-h-0 flex-col overflow-hidden rounded-2xl border border-[var(--switcher-border)] bg-[var(--bg-soft)] shadow-[var(--vp-shadow-1)] max-lg:relative max-lg:top-auto max-lg:h-[28rem]',
    'vm-link-underline':
      "relative inline-block text-[var(--text-medium)] no-underline transition-colors duration-300 after:content-[''] after:absolute after:left-0 after:-bottom-0.5 after:h-0.5 after:w-0 after:[background:var(--footer-underline-gradient)] after:transition-width after:duration-300 hover:text-[var(--footer-link-hover)] hover:after:w-full",
    // Keep input borders explicitly solid: browser UA styles can otherwise fall back to inset.
    // Feedback controls use an outline-only focus state; do not reintroduce bevel shadows here.
    'feedback-flat-control':
      'appearance-none! [box-shadow:none!important] [background-image:none!important]',
    'feedback-select-trigger':
      'appearance-none! h-11! px-3! bg-[var(--bg-white)]! [background-image:none!important] [box-shadow:none!important] border-[color-mix(in_srgb,var(--switcher-border)_86%,transparent)]! rounded-[10px]! hover:border-[var(--info-1)]! focus-visible:border-[var(--info-1)]! focus-visible:outline-2! focus-visible:outline-[var(--info-1)]! focus-visible:outline-offset-2! focus-visible:[box-shadow:none!important]',
    'feedback-field':
      'appearance-none! [-webkit-appearance:none!important] [box-shadow:none!important] [background-image:none!important] box-border w-full min-h-11 px-3 py-2.5 text-[var(--text-dark)] font-inherit bg-[var(--bg-white)]! border border-solid! border-[color-mix(in_srgb,var(--switcher-border)_86%,transparent)]! rounded-[10px]! outline-2 outline-offset-0 [outline-color:transparent] transition-[border-color,background-color,outline-color,outline-offset] duration-[180ms] ease-out placeholder:text-[var(--text-muted)] hover:border-[color-mix(in_srgb,var(--info-1)_55%,var(--switcher-border))]! focus-visible:border-[var(--info-1)]! focus-visible:outline-[var(--info-1)] focus-visible:outline-offset-2 focus-visible:[box-shadow:none!important] invalid:[box-shadow:none!important] invalid:border-[color-mix(in_srgb,var(--switcher-border)_86%,transparent)]!',
    'feedback-note-field': 'min-h-32 resize-none leading-[1.55]',
    'feedback-source-note':
      'border border-[color-mix(in_srgb,var(--info-1)_26%,var(--switcher-border))] bg-[color-mix(in_srgb,var(--info-soft)_72%,var(--bg-white))]',
    'feedback-type-option':
      'transition-[color,border-color,background-color] duration-[160ms] ease-out',
    'feedback-tab-group':
      'inline-flex max-w-full flex-wrap gap-1 rounded-md bg-transparent p-0.5 [box-shadow:none!important] [background-image:none!important] border border-[color-mix(in_srgb,var(--switcher-border)_72%,transparent)]',
    'feedback-tab':
      'feedback-flat-control inline-flex min-h-9 cursor-pointer items-center justify-center rounded-md border-0 px-3 py-2 font-inherit transition-colors lt-sm:w-full lt-sm:px-2',
    'feedback-widget-bubble':
      'absolute right-[0.35rem] bottom-[calc(100%_+_1.2rem)] z-4 block min-h-[3.2rem] w-[min(13.5rem,calc(100vw_-_1rem))] max-w-[calc(100vw_-_1rem)] whitespace-normal break-words px-[0.6rem] pb-[0.82rem] pt-[0.48rem] text-[var(--text-dark)] text-[0.78rem] font-600 leading-[1.4] text-left pointer-events-none overflow-visible origin-bottom-right transition-[opacity,transform,visibility] duration-[180ms] ease-out motion-reduce:transition-none',
    'feedback-widget-bubble-shape':
      'pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible [filter:drop-shadow(1px_2px_0_color-mix(in_srgb,var(--text-dark)_18%,transparent))]',
    'feedback-widget-bubble-text': 'relative z-1 block',
    'feedback-widget-close':
      'appearance-none! [box-shadow:none!important] [background-image:none!important] absolute right-0 top-1 z-5 grid size-5 place-items-center border-0! rounded-sm bg-transparent p-0 text-[0.72rem] leading-none text-[var(--text-muted)] opacity-[0.32] transition-[opacity,color,background-color] duration-[160ms] ease-out hover:bg-[var(--bg-soft)] hover:text-[var(--text-dark)] hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-[var(--info-1)] focus-visible:outline-offset-1 max-[640px]:opacity-[0.58] motion-reduce:transition-none',
    'feedback-widget-restore':
      'appearance-none! [box-shadow:none!important] [background-image:none!important] fixed right-[max(1.15rem,env(safe-area-inset-right))] bottom-[max(1.05rem,env(safe-area-inset-bottom))] z-30 inline-flex min-h-8 items-center gap-1.5 rounded-md border border-[var(--switcher-border)] bg-[var(--bg-soft)] px-2.5 py-1.5 text-xs font-600 text-[var(--text-medium)] opacity-[0.5] transition-[opacity,color,background-color,border-color] duration-[180ms] ease-out hover:border-[var(--info-1)] hover:bg-[var(--info-soft)] hover:text-[var(--info-1)] hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-[var(--info-1)] focus-visible:outline-offset-2 max-[640px]:right-[max(0.7rem,env(safe-area-inset-right))] max-[640px]:bottom-[max(0.75rem,env(safe-area-inset-bottom))] motion-reduce:transition-none',
  },
  rules: [['animate-whirling', { animation: '4s whirling linear infinite alternate' }]],
  preflights: [
    {
      getCSS: () => `
@keyframes whirling {
  from {
    transform: rotate3d(0, 1, 0, -90deg) scale(0.9);
  }
  to {
    transform: rotate3d(0, 1, 0, 90deg) scale(1);
  }
}
`,
    },
  ],
})
