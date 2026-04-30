
import type { DefineComponent, SlotsType } from 'vue'
type IslandComponent<T> = DefineComponent<{}, {refresh: () => Promise<void>}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, SlotsType<{ fallback: { error: unknown } }>> & T

type HydrationStrategies = {
  hydrateOnVisible?: IntersectionObserverInit | true
  hydrateOnIdle?: number | true
  hydrateOnInteraction?: keyof HTMLElementEventMap | Array<keyof HTMLElementEventMap> | true
  hydrateOnMediaQuery?: string
  hydrateAfter?: number
  hydrateWhen?: boolean
  hydrateNever?: true
}
type LazyComponent<T> = DefineComponent<HydrationStrategies, {}, {}, {}, {}, {}, {}, { hydrated: () => void }> & T


export const Scene: typeof import("../components/canvas/Scene.vue")['default']
export const SlotMachine: typeof import("../components/canvas/SlotMachine.vue")['default']
export const SymbolCell: typeof import("../components/canvas/SymbolCell.vue")['default']
export const Reel: typeof import("../components/slot/Reel.vue")['default']
export const BalanceDisplay: typeof import("../components/ui/BalanceDisplay.vue")['default']
export const BetDisplay: typeof import("../components/ui/BetDisplay.vue")['default']
export const ChangeBetButton: typeof import("../components/ui/ChangeBetButton.vue")['default']
export const SpinButton: typeof import("../components/ui/SpinButton.vue")['default']
export const SpinHistory: typeof import("../components/ui/SpinHistory.vue")['default']
export const NuxtWelcome: typeof import("../../../node_modules/.pnpm/nuxt@3.21.4_@parcel+watcher@2.5.6_@types+node@20.19.39_@vue+compiler-sfc@3.5.33_cac@6.7_772185285ef9222927cfcb560a0ac75f/node_modules/nuxt/dist/app/components/welcome.vue")['default']
export const NuxtLayout: typeof import("../../../node_modules/.pnpm/nuxt@3.21.4_@parcel+watcher@2.5.6_@types+node@20.19.39_@vue+compiler-sfc@3.5.33_cac@6.7_772185285ef9222927cfcb560a0ac75f/node_modules/nuxt/dist/app/components/nuxt-layout")['default']
export const NuxtErrorBoundary: typeof import("../../../node_modules/.pnpm/nuxt@3.21.4_@parcel+watcher@2.5.6_@types+node@20.19.39_@vue+compiler-sfc@3.5.33_cac@6.7_772185285ef9222927cfcb560a0ac75f/node_modules/nuxt/dist/app/components/nuxt-error-boundary.vue")['default']
export const ClientOnly: typeof import("../../../node_modules/.pnpm/nuxt@3.21.4_@parcel+watcher@2.5.6_@types+node@20.19.39_@vue+compiler-sfc@3.5.33_cac@6.7_772185285ef9222927cfcb560a0ac75f/node_modules/nuxt/dist/app/components/client-only")['default']
export const DevOnly: typeof import("../../../node_modules/.pnpm/nuxt@3.21.4_@parcel+watcher@2.5.6_@types+node@20.19.39_@vue+compiler-sfc@3.5.33_cac@6.7_772185285ef9222927cfcb560a0ac75f/node_modules/nuxt/dist/app/components/dev-only")['default']
export const ServerPlaceholder: typeof import("../../../node_modules/.pnpm/nuxt@3.21.4_@parcel+watcher@2.5.6_@types+node@20.19.39_@vue+compiler-sfc@3.5.33_cac@6.7_772185285ef9222927cfcb560a0ac75f/node_modules/nuxt/dist/app/components/server-placeholder")['default']
export const NuxtLink: typeof import("../../../node_modules/.pnpm/nuxt@3.21.4_@parcel+watcher@2.5.6_@types+node@20.19.39_@vue+compiler-sfc@3.5.33_cac@6.7_772185285ef9222927cfcb560a0ac75f/node_modules/nuxt/dist/app/components/nuxt-link")['default']
export const NuxtLoadingIndicator: typeof import("../../../node_modules/.pnpm/nuxt@3.21.4_@parcel+watcher@2.5.6_@types+node@20.19.39_@vue+compiler-sfc@3.5.33_cac@6.7_772185285ef9222927cfcb560a0ac75f/node_modules/nuxt/dist/app/components/nuxt-loading-indicator")['default']
export const NuxtTime: typeof import("../../../node_modules/.pnpm/nuxt@3.21.4_@parcel+watcher@2.5.6_@types+node@20.19.39_@vue+compiler-sfc@3.5.33_cac@6.7_772185285ef9222927cfcb560a0ac75f/node_modules/nuxt/dist/app/components/nuxt-time.vue")['default']
export const NuxtRouteAnnouncer: typeof import("../../../node_modules/.pnpm/nuxt@3.21.4_@parcel+watcher@2.5.6_@types+node@20.19.39_@vue+compiler-sfc@3.5.33_cac@6.7_772185285ef9222927cfcb560a0ac75f/node_modules/nuxt/dist/app/components/nuxt-route-announcer")['default']
export const NuxtImg: typeof import("../../../node_modules/.pnpm/nuxt@3.21.4_@parcel+watcher@2.5.6_@types+node@20.19.39_@vue+compiler-sfc@3.5.33_cac@6.7_772185285ef9222927cfcb560a0ac75f/node_modules/nuxt/dist/app/components/nuxt-stubs")['NuxtImg']
export const NuxtPicture: typeof import("../../../node_modules/.pnpm/nuxt@3.21.4_@parcel+watcher@2.5.6_@types+node@20.19.39_@vue+compiler-sfc@3.5.33_cac@6.7_772185285ef9222927cfcb560a0ac75f/node_modules/nuxt/dist/app/components/nuxt-stubs")['NuxtPicture']
export const NuxtPage: typeof import("../../../node_modules/.pnpm/nuxt@3.21.4_@parcel+watcher@2.5.6_@types+node@20.19.39_@vue+compiler-sfc@3.5.33_cac@6.7_772185285ef9222927cfcb560a0ac75f/node_modules/nuxt/dist/pages/runtime/page")['default']
export const NoScript: typeof import("../../../node_modules/.pnpm/nuxt@3.21.4_@parcel+watcher@2.5.6_@types+node@20.19.39_@vue+compiler-sfc@3.5.33_cac@6.7_772185285ef9222927cfcb560a0ac75f/node_modules/nuxt/dist/head/runtime/components")['NoScript']
export const Link: typeof import("../../../node_modules/.pnpm/nuxt@3.21.4_@parcel+watcher@2.5.6_@types+node@20.19.39_@vue+compiler-sfc@3.5.33_cac@6.7_772185285ef9222927cfcb560a0ac75f/node_modules/nuxt/dist/head/runtime/components")['Link']
export const Base: typeof import("../../../node_modules/.pnpm/nuxt@3.21.4_@parcel+watcher@2.5.6_@types+node@20.19.39_@vue+compiler-sfc@3.5.33_cac@6.7_772185285ef9222927cfcb560a0ac75f/node_modules/nuxt/dist/head/runtime/components")['Base']
export const Title: typeof import("../../../node_modules/.pnpm/nuxt@3.21.4_@parcel+watcher@2.5.6_@types+node@20.19.39_@vue+compiler-sfc@3.5.33_cac@6.7_772185285ef9222927cfcb560a0ac75f/node_modules/nuxt/dist/head/runtime/components")['Title']
export const Meta: typeof import("../../../node_modules/.pnpm/nuxt@3.21.4_@parcel+watcher@2.5.6_@types+node@20.19.39_@vue+compiler-sfc@3.5.33_cac@6.7_772185285ef9222927cfcb560a0ac75f/node_modules/nuxt/dist/head/runtime/components")['Meta']
export const Style: typeof import("../../../node_modules/.pnpm/nuxt@3.21.4_@parcel+watcher@2.5.6_@types+node@20.19.39_@vue+compiler-sfc@3.5.33_cac@6.7_772185285ef9222927cfcb560a0ac75f/node_modules/nuxt/dist/head/runtime/components")['Style']
export const Head: typeof import("../../../node_modules/.pnpm/nuxt@3.21.4_@parcel+watcher@2.5.6_@types+node@20.19.39_@vue+compiler-sfc@3.5.33_cac@6.7_772185285ef9222927cfcb560a0ac75f/node_modules/nuxt/dist/head/runtime/components")['Head']
export const Html: typeof import("../../../node_modules/.pnpm/nuxt@3.21.4_@parcel+watcher@2.5.6_@types+node@20.19.39_@vue+compiler-sfc@3.5.33_cac@6.7_772185285ef9222927cfcb560a0ac75f/node_modules/nuxt/dist/head/runtime/components")['Html']
export const Body: typeof import("../../../node_modules/.pnpm/nuxt@3.21.4_@parcel+watcher@2.5.6_@types+node@20.19.39_@vue+compiler-sfc@3.5.33_cac@6.7_772185285ef9222927cfcb560a0ac75f/node_modules/nuxt/dist/head/runtime/components")['Body']
export const NuxtIsland: typeof import("../../../node_modules/.pnpm/nuxt@3.21.4_@parcel+watcher@2.5.6_@types+node@20.19.39_@vue+compiler-sfc@3.5.33_cac@6.7_772185285ef9222927cfcb560a0ac75f/node_modules/nuxt/dist/app/components/nuxt-island")['default']
export const LazyScene: LazyComponent<typeof import("../components/canvas/Scene.vue")['default']>
export const LazySlotMachine: LazyComponent<typeof import("../components/canvas/SlotMachine.vue")['default']>
export const LazySymbolCell: LazyComponent<typeof import("../components/canvas/SymbolCell.vue")['default']>
export const LazyReel: LazyComponent<typeof import("../components/slot/Reel.vue")['default']>
export const LazyBalanceDisplay: LazyComponent<typeof import("../components/ui/BalanceDisplay.vue")['default']>
export const LazyBetDisplay: LazyComponent<typeof import("../components/ui/BetDisplay.vue")['default']>
export const LazyChangeBetButton: LazyComponent<typeof import("../components/ui/ChangeBetButton.vue")['default']>
export const LazySpinButton: LazyComponent<typeof import("../components/ui/SpinButton.vue")['default']>
export const LazySpinHistory: LazyComponent<typeof import("../components/ui/SpinHistory.vue")['default']>
export const LazyNuxtWelcome: LazyComponent<typeof import("../../../node_modules/.pnpm/nuxt@3.21.4_@parcel+watcher@2.5.6_@types+node@20.19.39_@vue+compiler-sfc@3.5.33_cac@6.7_772185285ef9222927cfcb560a0ac75f/node_modules/nuxt/dist/app/components/welcome.vue")['default']>
export const LazyNuxtLayout: LazyComponent<typeof import("../../../node_modules/.pnpm/nuxt@3.21.4_@parcel+watcher@2.5.6_@types+node@20.19.39_@vue+compiler-sfc@3.5.33_cac@6.7_772185285ef9222927cfcb560a0ac75f/node_modules/nuxt/dist/app/components/nuxt-layout")['default']>
export const LazyNuxtErrorBoundary: LazyComponent<typeof import("../../../node_modules/.pnpm/nuxt@3.21.4_@parcel+watcher@2.5.6_@types+node@20.19.39_@vue+compiler-sfc@3.5.33_cac@6.7_772185285ef9222927cfcb560a0ac75f/node_modules/nuxt/dist/app/components/nuxt-error-boundary.vue")['default']>
export const LazyClientOnly: LazyComponent<typeof import("../../../node_modules/.pnpm/nuxt@3.21.4_@parcel+watcher@2.5.6_@types+node@20.19.39_@vue+compiler-sfc@3.5.33_cac@6.7_772185285ef9222927cfcb560a0ac75f/node_modules/nuxt/dist/app/components/client-only")['default']>
export const LazyDevOnly: LazyComponent<typeof import("../../../node_modules/.pnpm/nuxt@3.21.4_@parcel+watcher@2.5.6_@types+node@20.19.39_@vue+compiler-sfc@3.5.33_cac@6.7_772185285ef9222927cfcb560a0ac75f/node_modules/nuxt/dist/app/components/dev-only")['default']>
export const LazyServerPlaceholder: LazyComponent<typeof import("../../../node_modules/.pnpm/nuxt@3.21.4_@parcel+watcher@2.5.6_@types+node@20.19.39_@vue+compiler-sfc@3.5.33_cac@6.7_772185285ef9222927cfcb560a0ac75f/node_modules/nuxt/dist/app/components/server-placeholder")['default']>
export const LazyNuxtLink: LazyComponent<typeof import("../../../node_modules/.pnpm/nuxt@3.21.4_@parcel+watcher@2.5.6_@types+node@20.19.39_@vue+compiler-sfc@3.5.33_cac@6.7_772185285ef9222927cfcb560a0ac75f/node_modules/nuxt/dist/app/components/nuxt-link")['default']>
export const LazyNuxtLoadingIndicator: LazyComponent<typeof import("../../../node_modules/.pnpm/nuxt@3.21.4_@parcel+watcher@2.5.6_@types+node@20.19.39_@vue+compiler-sfc@3.5.33_cac@6.7_772185285ef9222927cfcb560a0ac75f/node_modules/nuxt/dist/app/components/nuxt-loading-indicator")['default']>
export const LazyNuxtTime: LazyComponent<typeof import("../../../node_modules/.pnpm/nuxt@3.21.4_@parcel+watcher@2.5.6_@types+node@20.19.39_@vue+compiler-sfc@3.5.33_cac@6.7_772185285ef9222927cfcb560a0ac75f/node_modules/nuxt/dist/app/components/nuxt-time.vue")['default']>
export const LazyNuxtRouteAnnouncer: LazyComponent<typeof import("../../../node_modules/.pnpm/nuxt@3.21.4_@parcel+watcher@2.5.6_@types+node@20.19.39_@vue+compiler-sfc@3.5.33_cac@6.7_772185285ef9222927cfcb560a0ac75f/node_modules/nuxt/dist/app/components/nuxt-route-announcer")['default']>
export const LazyNuxtImg: LazyComponent<typeof import("../../../node_modules/.pnpm/nuxt@3.21.4_@parcel+watcher@2.5.6_@types+node@20.19.39_@vue+compiler-sfc@3.5.33_cac@6.7_772185285ef9222927cfcb560a0ac75f/node_modules/nuxt/dist/app/components/nuxt-stubs")['NuxtImg']>
export const LazyNuxtPicture: LazyComponent<typeof import("../../../node_modules/.pnpm/nuxt@3.21.4_@parcel+watcher@2.5.6_@types+node@20.19.39_@vue+compiler-sfc@3.5.33_cac@6.7_772185285ef9222927cfcb560a0ac75f/node_modules/nuxt/dist/app/components/nuxt-stubs")['NuxtPicture']>
export const LazyNuxtPage: LazyComponent<typeof import("../../../node_modules/.pnpm/nuxt@3.21.4_@parcel+watcher@2.5.6_@types+node@20.19.39_@vue+compiler-sfc@3.5.33_cac@6.7_772185285ef9222927cfcb560a0ac75f/node_modules/nuxt/dist/pages/runtime/page")['default']>
export const LazyNoScript: LazyComponent<typeof import("../../../node_modules/.pnpm/nuxt@3.21.4_@parcel+watcher@2.5.6_@types+node@20.19.39_@vue+compiler-sfc@3.5.33_cac@6.7_772185285ef9222927cfcb560a0ac75f/node_modules/nuxt/dist/head/runtime/components")['NoScript']>
export const LazyLink: LazyComponent<typeof import("../../../node_modules/.pnpm/nuxt@3.21.4_@parcel+watcher@2.5.6_@types+node@20.19.39_@vue+compiler-sfc@3.5.33_cac@6.7_772185285ef9222927cfcb560a0ac75f/node_modules/nuxt/dist/head/runtime/components")['Link']>
export const LazyBase: LazyComponent<typeof import("../../../node_modules/.pnpm/nuxt@3.21.4_@parcel+watcher@2.5.6_@types+node@20.19.39_@vue+compiler-sfc@3.5.33_cac@6.7_772185285ef9222927cfcb560a0ac75f/node_modules/nuxt/dist/head/runtime/components")['Base']>
export const LazyTitle: LazyComponent<typeof import("../../../node_modules/.pnpm/nuxt@3.21.4_@parcel+watcher@2.5.6_@types+node@20.19.39_@vue+compiler-sfc@3.5.33_cac@6.7_772185285ef9222927cfcb560a0ac75f/node_modules/nuxt/dist/head/runtime/components")['Title']>
export const LazyMeta: LazyComponent<typeof import("../../../node_modules/.pnpm/nuxt@3.21.4_@parcel+watcher@2.5.6_@types+node@20.19.39_@vue+compiler-sfc@3.5.33_cac@6.7_772185285ef9222927cfcb560a0ac75f/node_modules/nuxt/dist/head/runtime/components")['Meta']>
export const LazyStyle: LazyComponent<typeof import("../../../node_modules/.pnpm/nuxt@3.21.4_@parcel+watcher@2.5.6_@types+node@20.19.39_@vue+compiler-sfc@3.5.33_cac@6.7_772185285ef9222927cfcb560a0ac75f/node_modules/nuxt/dist/head/runtime/components")['Style']>
export const LazyHead: LazyComponent<typeof import("../../../node_modules/.pnpm/nuxt@3.21.4_@parcel+watcher@2.5.6_@types+node@20.19.39_@vue+compiler-sfc@3.5.33_cac@6.7_772185285ef9222927cfcb560a0ac75f/node_modules/nuxt/dist/head/runtime/components")['Head']>
export const LazyHtml: LazyComponent<typeof import("../../../node_modules/.pnpm/nuxt@3.21.4_@parcel+watcher@2.5.6_@types+node@20.19.39_@vue+compiler-sfc@3.5.33_cac@6.7_772185285ef9222927cfcb560a0ac75f/node_modules/nuxt/dist/head/runtime/components")['Html']>
export const LazyBody: LazyComponent<typeof import("../../../node_modules/.pnpm/nuxt@3.21.4_@parcel+watcher@2.5.6_@types+node@20.19.39_@vue+compiler-sfc@3.5.33_cac@6.7_772185285ef9222927cfcb560a0ac75f/node_modules/nuxt/dist/head/runtime/components")['Body']>
export const LazyNuxtIsland: LazyComponent<typeof import("../../../node_modules/.pnpm/nuxt@3.21.4_@parcel+watcher@2.5.6_@types+node@20.19.39_@vue+compiler-sfc@3.5.33_cac@6.7_772185285ef9222927cfcb560a0ac75f/node_modules/nuxt/dist/app/components/nuxt-island")['default']>

export const componentNames: string[]
