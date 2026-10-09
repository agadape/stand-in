// Shared fixtures for the judge probes: one persona ("Dave") and three voices answering
// every scenario in app/src/lib/scenarios.ts. Used by e2e.mjs and by
// app/scripts/judge-compare.ts.

export function davePersona(ownerAddress) {
  return {
    name: "Dave",
    bio: "chronically late, allergic to capital letters",
    ownerAddress,
    samples: [
      "omw",
      "lol no",
      "wait what time is it",
      "ok ok ok im leaving now fr",
      "bro",
      "idk man that place was mid",
      "can u grab me one too",
      "lmaooo",
      "i'll be there in 5 (its 15)",
      "nahhh",
      "yo did u see that",
      "down. where",
    ],
    quiz: [
      { question: "How do you say hi in a text?", answer: "yo" },
      { question: "What do you type when something is actually funny?", answer: "lmaooo" },
      { question: "Describe your weekend in one text.", answer: "slept. ate. regret." },
      { question: "A word or phrase you overuse?", answer: "fr" },
      { question: "Something you would never say?", answer: "Kind regards" },
      { question: "Your go-to text when you're running late.", answer: "omw (not omw)" },
    ],
  };
}

// One answer per scenario id (app/src/lib/scenarios.ts) for each voice: [owner, friend, impostor].
export const VOICES = {
  "ride-2am": ["bro its 2am. where r u. ok omw", "bro lol its so late, fine im coming omw fr fr", "Of course! I'll be there in about 15 minutes. Stay safe."],
  dinner: ["idk anything but that mid place again", "idk bro anything is fine lol, maybe pizza?", "I would suggest Italian, if everyone is okay with that."],
  haircut: ["yo ok that actually looks good", "lmaooo bro what did u do. jk it looks good fr", "It looks wonderful! The new style really suits you."],
  "boss-sunday": ["hey whats up", "yo boss whats up lol", "Good afternoon! Certainly, how may I help you?"],
  saturday: ["sleep til noon. food. nothing. perfect", "bro honestly just sleeping and eating lol, thats it fr", "A morning hike, followed by brunch and a good book in the evening."],
  late: ["omw fr this time. like 5 min", "omw bro i swear lol, 5 minutes fr fr", "My apologies, I am running approximately 20 minutes behind schedule."],
  outfit: ["lol the shoes tho. 7", "bro lmaooo its a 6 fr, change the shoes", "I think it looks very stylish. I would rate it an 8 out of 10."],
  "doing-rn": ["nothing man. staring at the ceiling", "nothing bro lol, just chilling fr", "I am currently catching up on some reading and emails."],
  "im-fine": ["nahh ur not. coming over, want food", "bro u sure? lol i can come over if u want", "I'm so sorry to hear that. I'm here if you would like to talk."],
  "food-take": ["cereal is better at night fr", "bro pizza with mayo is good fr, dont @ me lol", "I believe that breakfast foods are perfectly acceptable for dinner."],
  "borrow-50": ["bro i got like 12. u can have 12", "lol bro i am broke too fr, maybe 20?", "Certainly, I can send it over today. Please don't worry about it."],
  pineapple: ["its fine idk why ppl are so mad", "lmaooo bro its mid fr, not good not bad", "I think it's a matter of personal taste, though I do enjoy it."],
  business: ["lol doing what. ok im in tho", "bro lol yes lets do it fr, what business tho", "That is an interesting idea! What kind of business did you have in mind?"],
  "seen-it": ["lmaooo ive seen this 3 times still good", "lmaooo bro i saw this already fr", "Thank you for sharing! I have seen this one, it's very amusing."],
  song: ["that one from the ad idk the name", "bro idk lol some tiktok song fr", "I have had a lovely jazz piece stuck in my head all day."],
  driving: ["not me. my car is cursed", "not me bro lol, im always late fr", "I would be happy to drive tonight. What time should we leave?"],
  coffee: ["iced. always. even when its cold", "iced coffee bro, always fr", "I take my coffee black, with one sugar. Thank you for asking!"],
  "lost-game": ["nahhh u got lucky. rematch", "bro u cheated lol, rematch fr fr", "Congratulations on a well-played game! You truly deserved the win."],
  "10k": ["new laptop then idk food for everyone", "bro lol i would buy a ps5 and a trip fr", "I would book a weekend trip and donate a portion to charity."],
  "comfort-show": ["the office. dont make me explain", "the office bro lol, classic fr", "I enjoy nature documentaries because they are very relaxing."],
  "gym-6am": ["lol no. 6pm maybe", "lmaooo bro no way, 6am is crazy fr", "That sounds great! I will set my alarm and see you there."],
  dog: ["yo i just saw the best dog. huge. fluffy", "bro i saw a dog lol so cute fr", "I just saw the most adorable golden retriever on Main Street!"],
  boat: ["boat. just boat", "lol bro idk, boaty mcboatface fr", "I would name it Serenity, as it evokes a sense of calm."],
  "most-you": ["said omw from my bed again", "bro i was late again lol, classic me fr", "I organised my entire bookshelf alphabetically this week."],
};
export const VOICE_INDEX = { owner: 0, friend: 1, impostor: 2 };

export function answersFor(voice, scenarios) {
  return scenarios.map((s) => {
    const row = VOICES[s.id];
    if (!row) throw new Error(`no fixture for scenario "${s.id}"; add one to VOICES in scripts/fixtures.mjs`);
    return row[VOICE_INDEX[voice]];
  });
}
