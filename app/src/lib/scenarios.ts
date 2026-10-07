export type Scenario = { id: string; prompt: string };

/** Short texting situations. Answers should be one or two messages long. */
export const SCENARIOS: Scenario[] = [
  { id: "ride-2am", prompt: "A friend texts at 2:07am: \"u up? i need a ride.\" Reply." },
  { id: "dinner", prompt: "The group chat asks what everyone wants for dinner. Answer." },
  { id: "haircut", prompt: "A friend sends a photo of their new haircut. React." },
  { id: "boss-sunday", prompt: "Your boss (or teacher) messages on a Sunday: \"Quick question when you get a sec.\" Reply." },
  { id: "saturday", prompt: "A friend asks you to describe your perfect Saturday in one text." },
  { id: "late", prompt: "You're 20 minutes late. Text the person waiting for you." },
  { id: "outfit", prompt: "A friend sends \"rate my outfit\" with a photo. Respond." },
  { id: "doing-rn", prompt: "Someone asks \"what are you even doing right now.\" Answer honestly." },
  { id: "im-fine", prompt: "Your friend just got dumped and texts \"i'm fine.\" Reply." },
  { id: "food-take", prompt: "Share your most unhinged food opinion." },
  { id: "borrow-50", prompt: "A friend asks to borrow $50. Reply." },
  { id: "pineapple", prompt: "Someone wants your hot take on pineapple pizza." },
  { id: "business", prompt: "A friend texts \"we should start a business.\" Respond." },
  { id: "seen-it", prompt: "Someone sends you a video you've already seen three times. React." },
  { id: "song", prompt: "A friend asks what song is stuck in your head." },
  { id: "driving", prompt: "Group chat: \"who's driving tonight?\" Answer." },
  { id: "coffee", prompt: "Someone asks how you take your coffee or tea." },
  { id: "lost-game", prompt: "You just lost a game you were sure you'd win. Text the winner." },
  { id: "10k", prompt: "A friend asks what you'd do with $10,000 you must spend this weekend." },
  { id: "comfort-show", prompt: "Someone asks what your comfort show is and why." },
  { id: "gym-6am", prompt: "A friend proposes a 6am gym session. Reply." },
  { id: "dog", prompt: "You see a great dog on the street. Text a friend about it." },
  { id: "boat", prompt: "A friend asks what you'd name a boat." },
  { id: "most-you", prompt: "Someone asks \"what's the most you thing you've done this week.\"" },
];

/** Questions the owner answers when building their twin; answers double as samples. */
export const QUIZ: string[] = [
  "How do you say hi in a text?",
  "What do you type when something is actually funny?",
  "Describe your weekend in one text.",
  "A word or phrase you overuse?",
  "Something you would never say?",
  "Your go-to text when you're running late.",
];

export const ANSWERS_PER_ATTEMPT = 3;

export function scenarioById(id: string) {
  return SCENARIOS.find((s) => s.id === id);
}

export function pickScenarios(count = ANSWERS_PER_ATTEMPT): Scenario[] {
  const pool = [...SCENARIOS];
  const picked: Scenario[] = [];
  while (picked.length < count && pool.length) {
    const i = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(i, 1)[0]);
  }
  return picked;
}
