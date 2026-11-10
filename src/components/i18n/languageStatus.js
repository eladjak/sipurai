// Release status of each interface language.
//   "live"   - shown to everyone
//   "beta"   - shown, labelled as beta
//   "hidden" - not offered to anyone (not ready)
// Unknown languages are "hidden" (fail closed).
// Releasing Yiddish after its review (contract I-04b) is a one-line change below.
// Keep the keys in this order (english, hebrew, yiddish): the type-check gate compares error text,
// and the order here decides how an existing error prints the language union.
export const LANGUAGE_STATUS = Object.freeze({
  english: "live",
  hebrew: "live",
  yiddish: "hidden",
});

const ALLOWED = new Set(["live", "beta", "hidden"]);

function statusOf(lang) {
  if (typeof lang !== "string" || !Object.prototype.hasOwnProperty.call(LANGUAGE_STATUS, lang)) {
    return "hidden";
  }
  const status = LANGUAGE_STATUS[lang];
  return ALLOWED.has(status) ? status : "hidden";
}

export const isHidden = (lang) => statusOf(lang) === "hidden";
export const isBeta = (lang) => statusOf(lang) === "beta";
