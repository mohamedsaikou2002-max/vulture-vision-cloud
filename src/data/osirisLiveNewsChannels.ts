/**
 * OSIRIS news broadcast directory (public links only; not an article feed).
 * Source: simplifaisoul/osiris/src/app/api/live-news/route.ts (MIT).
 * No iframes, player scripts, telemetry, airport/aircraft, satellite or cameras.
 * Stream availability may change; these links are not automatically ingested
 * into Vulture Vision news_articles, Gemini context, or swarm simulations.
 */
export const osirisLiveNewsChannels = [
  {
    "id": "nbcnews",
    "name": "NBC News NOW",
    "url": "https://www.youtube.com/channel/UCeY0bbntWzzVIaj2z3QigXg/live",
    "category": "mainstream",
    "language": "en"
  },
  {
    "id": "cbsnews",
    "name": "CBS News 24/7",
    "url": "https://www.youtube.com/channel/UC8p1vwvWtl6T73JiExfWs1g/live",
    "category": "mainstream",
    "language": "en"
  },
  {
    "id": "abcnews",
    "name": "ABC News Live",
    "url": "https://www.youtube.com/channel/UCBi2mrWuNuyYy4gbM6fU18Q/live",
    "category": "mainstream",
    "language": "en"
  },
  {
    "id": "bloomberg",
    "name": "Bloomberg TV",
    "url": "https://www.youtube.com/channel/UC_vQ72b7v5n2938v9d5c80w/live",
    "category": "finance",
    "language": "en"
  },
  {
    "id": "cspan",
    "name": "C-SPAN",
    "url": "https://www.youtube.com/channel/UCb--64Gl51jIEVE-GLDAVTg/live",
    "category": "government",
    "language": "en"
  },
  {
    "id": "cbc",
    "name": "CBC News",
    "url": "https://www.youtube.com/channel/UCKy1dAqELon0zgzZPOz9SVw/live",
    "category": "mainstream",
    "language": "en"
  },
  {
    "id": "skynews",
    "name": "Sky News",
    "url": "https://www.youtube.com/channel/UCoMdktPbSTixAyNGwb-UYkQ/live",
    "category": "mainstream",
    "language": "en"
  },
  {
    "id": "france24en",
    "name": "France 24 EN",
    "url": "https://www.youtube.com/channel/UCQfwfsi5VrQ8yKZ-UWmAEFg/live",
    "category": "mainstream",
    "language": "en"
  },
  {
    "id": "dwnews",
    "name": "DW News",
    "url": "https://www.youtube.com/channel/UCknLrEdhRCp1aegoMqRaCZg/live",
    "category": "mainstream",
    "language": "en"
  },
  {
    "id": "aljazeera",
    "name": "Al Jazeera EN",
    "url": "https://www.youtube.com/channel/UCNye-wNBqNL5ZzHSJj3l8Bg/live",
    "category": "mainstream",
    "language": "en"
  },
  {
    "id": "nhkworld",
    "name": "NHK World",
    "url": "https://www.youtube.com/channel/UCSPEjw8F2nQDtmUKPFNF7_A/live",
    "category": "mainstream",
    "language": "en"
  },
  {
    "id": "cna",
    "name": "CNA 24/7",
    "url": "https://www.youtube.com/channel/UC83jt4dlz1Gjl58fzQrrKZg/live",
    "category": "mainstream",
    "language": "en"
  },
  {
    "id": "wion",
    "name": "WION",
    "url": "https://www.youtube.com/channel/UC_gUM8rL-Lrg6O3adPW9K1g/live",
    "category": "mainstream",
    "language": "en"
  },
  {
    "id": "cgtn",
    "name": "CGTN",
    "url": "https://www.youtube.com/channel/UCgrNz-aDmcr2uuto8_DL2jg/live",
    "category": "state",
    "language": "en"
  },
  {
    "id": "rt",
    "name": "RT News",
    "url": "https://rumble.com/c/RTNewsEN",
    "category": "state",
    "language": "en"
  }
] as const;
