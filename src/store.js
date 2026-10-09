import { create } from 'zustand'

export const TOWNS = [
  { id: 'jamestown', name: 'Jamestown, Accra', sky: '#f6c177', wall: '#2a7fba', dirt: '#b8794a' },
  { id: 'kumasi', name: 'Adum, Kumasi', sky: '#f2d28b', wall: '#c9372c', dirt: '#a8603a' },
  { id: 'tamale', name: 'Tamale Central', sky: '#f4b860', wall: '#e8c547', dirt: '#c98d5a' },
  { id: 'surulere', name: 'Surulere, Lagos', sky: '#e9a77a', wall: '#2e8b57', dirt: '#9c6a45' },
]
export const SPONSORS = [
  { id: 'cola', name: 'Azonto Cola', pay: 40, cost: 0 },
  { id: 'telco', name: 'Kente Mobile', pay: 90, cost: 200 },
  { id: 'bites', name: 'Waakye Bites', pay: 150, cost: 450 },
]
export const PITCH = [
  { name: 'Sandy park', fr: 2.4, color: '#d8b27a' },
  { name: 'Patchy grass', fr: 1.8, color: '#9fae5f' },
  { name: 'Community turf', fr: 1.3, color: '#3d9a50' },
]
export const PITCH_COST = [0, 300, 800]
export const MATCH_SECONDS = 120

export const useGame = create((set, get) => ({
  phase: 'menu', // menu | playing | ended
  town: 'jamestown',
  team: 'Jamestown Stars',
  jersey: { main: '#c8301f', trim: '#f2b705', pattern: 'hoops' },
  faceUrl: null,
  coins: 150,
  pitch: 0,
  sponsor: 'cola',
  signed: ['cola'],
  score: [0, 0],
  time: MATCH_SECONDS,
  boostUntil: 0,
  banner: null,
  last: null,
  upgrade() {
    const { pitch, coins } = get()
    const cost = PITCH_COST[pitch + 1]
    if (cost != null && coins >= cost) set({ pitch: pitch + 1, coins: coins - cost })
  },
  signSponsor(id) {
    const { signed, coins } = get()
    const s = SPONSORS.find((x) => x.id === id)
    if (signed.includes(id)) return set({ sponsor: id })
    if (coins >= s.cost) set({ sponsor: id, signed: [...signed, id], coins: coins - s.cost })
  },
  buyDrink() {
    const { coins, phase } = get()
    if (phase === 'playing' && coins >= 20) set({ coins: coins - 20, boostUntil: Date.now() + 10000 })
  },
  start: () => set({ phase: 'playing', score: [0, 0], time: MATCH_SECONDS, banner: null }),
  end() {
    const { score, sponsor, coins } = get()
    const [h, a] = score
    const pay = SPONSORS.find((s) => s.id === sponsor).pay
    const total = (h > a ? 150 : h === a ? 70 : 30) + h * 20 + pay
    set({ phase: 'ended', coins: coins + total, last: { h, a, total, pay } })
  },
}))
