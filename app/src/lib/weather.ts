/**
 * The weather a resident can pay for. Nobody can move an agent, but anyone living in the
 * town can change the town for a while: the place the weather fills draws people in, they
 * talk more there, and everyone (the payer's own pet included) answers by their own rules.
 *
 * Each kind fills one fixed place. The payer picks the weather and nothing else: never an
 * agent, a pair, or somewhere to send someone. Keep it that way.
 *
 * No server code in this file: the world page imports it for the names and icons.
 */
export const WEATHER = {
  storm: {
    label: "Thunderstorm",
    icon: "⛈",
    place: "tavern",
    move: "heard thunder and ran for",
    scene: "A thunderstorm is raging outside; everyone has crowded into The Tavern to stay dry.",
    start: "summoned a thunderstorm. Everyone is running for The Tavern.",
    end: "The storm passed. The Tavern empties slowly.",
    there: "sheltering from the storm",
  },
  festival: {
    label: "Harvest festival",
    icon: "🎪",
    place: "market",
    move: "heard the festival drums and headed for",
    scene: "A harvest festival fills Market Square: music, food stalls, dancing, crowds.",
    start: "threw a harvest festival in Market Square.",
    end: "The festival winds down; stall-keepers sweep up.",
    there: "at the festival",
  },
  moon: {
    label: "Giant moon",
    icon: "🌕",
    place: "lake",
    move: "saw the huge moon rising and wandered to",
    scene: "An enormous moon hangs over Moonlit Lake and the water glows silver.",
    start: "raised a giant moon over the lake.",
    end: "The moon shrinks back to its usual size.",
    there: "watching the giant moon",
  },
  tournament: {
    label: "Guild tournament",
    icon: "🏆",
    place: "guild",
    move: "heard the tournament bell and went to",
    scene: "The Guild Hall is hosting a tournament; contestants spar and the crowd cheers.",
    start: "called a tournament at the Guild Hall.",
    end: "The tournament is over; the hall goes quiet.",
    there: "at the tournament",
  },
} as const;

export type WeatherKind = keyof typeof WEATHER;
export const WEATHER_KINDS = Object.keys(WEATHER) as [WeatherKind, ...WeatherKind[]];

export function isWeatherKind(kind: string | null | undefined): kind is WeatherKind {
  return typeof kind === "string" && kind in WEATHER;
}
