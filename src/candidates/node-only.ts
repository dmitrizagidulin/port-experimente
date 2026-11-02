import type { CandidateEntry } from './index'
import { candidates } from './index'

// Kandidaten, die nur in Node laufen, mit ihrem Code. Nicht aus main.ts
// importieren: Automerge-Wasm und Node-Prozesse gehören nicht in den
// Browser-Build.
export const nodeCandidates: Array<CandidateEntry & { make: NonNullable<CandidateEntry['make']> }> = [
  {
    ...candidates.find((c) => c.id === 'keyhive-ark')!,
    make: async () => (await import('./keyhive-ark')).keyhiveArk(),
  },
  {
    ...candidates.find((c) => c.id === 'rltp-beekem-pws')!,
    make: async () => (await import('./pws')).rltpBeekemPws(),
  },
  {
    ...candidates.find((c) => c.id === 'rltp-beekem-datarooms')!,
    make: async () => (await import('./datarooms')).rltpBeekemDatarooms(),
  },
]

/** Alle Kandidaten mit Code, für Berichte in Node. */
export const allCandidates = [
  ...candidates.filter((c): c is CandidateEntry & { make: NonNullable<CandidateEntry['make']> } => !!c.make),
  ...nodeCandidates,
]
