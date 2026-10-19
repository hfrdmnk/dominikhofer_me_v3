import quotes from "../data/quote.json";

/** Values fixed once per build, like Hugo's cached partials. */
export const BUILD_TIME = new Date();
export const QUOTE = quotes[Math.floor(Math.random() * quotes.length)] ?? "trust the process";
