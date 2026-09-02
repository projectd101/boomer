// Maps common country names (as stored in the DB) to flag emoji,
// and to ISO 3166-1 alpha-2 codes (used to fetch real flag images from flagcdn.com).
const COUNTRY_CODES = {
  "united states": "us",
  usa: "us",
  "united kingdom": "gb",
  uk: "gb",
  canada: "ca",
  australia: "au",
  germany: "de",
  france: "fr",
  nigeria: "ng",
  india: "in",
  nepal: "np",
  kazakhstan: "kz",
  russia: "ru",
  wadiya: "wadiya", // fictional, no real ISO code
  china: "cn",
  japan: "jp",
  brazil: "br",
  mexico: "mx",
  "south africa": "za",
  pakistan: "pk",
  bangladesh: "bd",
  "sri lanka": "lk",
  indonesia: "id",
  philippines: "ph",
  spain: "es",
  italy: "it",
  netherlands: "nl",
  sweden: "se",
  norway: "no",
  poland: "pl",
  turkey: "tr",
  "south korea": "kr",
  vietnam: "vn",
  thailand: "th",
  egypt: "eg",
  argentina: "ar",
  ireland: "ie",
  "new zealand": "nz",
};

const COUNTRY_FLAGS = {
  "united states": "🇺🇸",
  usa: "🇺🇸",
  "united kingdom": "🇬🇧",
  uk: "🇬🇧",
  canada: "🇨🇦",
  australia: "🇦🇺",
  germany: "🇩🇪",
  france: "🇫🇷",
  nigeria: "🇳🇬",
  india: "🇮🇳",
  nepal: "🇳🇵",
  kazakhstan: "🇰🇿",
  russia: "🇷🇺",
  wadiya: "🏴",
  china: "🇨🇳",
  japan: "🇯🇵",
  brazil: "🇧🇷",
  mexico: "🇲🇽",
  "south africa": "🇿🇦",
  pakistan: "🇵🇰",
  bangladesh: "🇧🇩",
  "sri lanka": "🇱🇰",
  indonesia: "🇮🇩",
  philippines: "🇵🇭",
  spain: "🇪🇸",
  italy: "🇮🇹",
  netherlands: "🇳🇱",
  sweden: "🇸🇪",
  norway: "🇳🇴",
  poland: "🇵🇱",
  turkey: "🇹🇷",
  "south korea": "🇰🇷",
  vietnam: "🇻🇳",
  thailand: "🇹🇭",
  egypt: "🇪🇬",
  argentina: "🇦🇷",
  ireland: "🇮🇪",
  "new zealand": "🇳🇿",
};

export function countryToFlag(country) {
  if (!country) return "🌐";
  const key = country.trim().toLowerCase();
  return COUNTRY_FLAGS[key] || "🌐";
}

// Returns a real flag image URL (flagcdn.com) for a given country name.
// `size` matches flagcdn's width buckets: 20, 40, 80, 160, 320, 640, 1280, 2560.
export function countryToFlagImage(country, size = 160) {
  if (!country) return null;
  const key = country.trim().toLowerCase();
  const code = COUNTRY_CODES[key];
  if (!code || code === "wadiya") return null; // no real-world flag available
  return `https://flagcdn.com/w${size}/${code}.png`;
}