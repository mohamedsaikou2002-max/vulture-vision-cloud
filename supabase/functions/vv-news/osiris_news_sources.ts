/**
 * Publisher RSS/Atom feed selections reviewed from OSIRIS (MIT).
 * References: simplifaisoul/osiris/src/lib/oi/newsroom.ts and src/app/api/news/route.ts
 * Discovered publisher endpoints only: no Telegram posts, aircraft/flight/ADS-B,
 * CCTV, satellites, ships, geophysical feeds, scanners, weather, or broadcast players.
 * Sources and story origins remain the original publishers (not OSIRIS).
 * OSIRIS is credited for source discovery, NOT counted as an independent publisher.
 * Feed availability, robots rules, freshness, article URLs and coverage are
 * validated by Vulture Vision's existing catalog ingestion pipeline.
 */
export const osirisNewsSources = [
  {
    "id": "osiris-news-001",
    "name": "The Guardian",
    "homepage": "https://www.theguardian.com",
    "source_country": "GB",
    "language": "en",
    "category": "general",
    "feed_urls": [
      "https://www.theguardian.com/world/rss"
    ],
    "allowed_hosts": []
  },
  {
    "id": "osiris-news-002",
    "name": "The New York Times",
    "homepage": "https://www.nytimes.com",
    "source_country": "US",
    "language": "en",
    "category": "general",
    "feed_urls": [
      "https://rss.nytimes.com/services/xml/rss/nyt/World.xml"
    ],
    "allowed_hosts": []
  },
  {
    "id": "osiris-news-003",
    "name": "France 24",
    "homepage": "https://www.france24.com",
    "source_country": "FR",
    "language": "en",
    "category": "general",
    "feed_urls": [
      "https://www.france24.com/en/rss"
    ],
    "allowed_hosts": []
  },
  {
    "id": "osiris-news-004",
    "name": "Politico",
    "homepage": "https://www.politico.com",
    "source_country": "US",
    "language": "en",
    "category": "general",
    "feed_urls": [
      "https://rss.politico.com/politics-news.xml"
    ],
    "allowed_hosts": []
  },
  {
    "id": "osiris-news-005",
    "name": "The New York Times",
    "homepage": "https://www.nytimes.com",
    "source_country": "US",
    "language": "en",
    "category": "general",
    "feed_urls": [
      "https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml"
    ],
    "allowed_hosts": []
  },
  {
    "id": "osiris-news-006",
    "name": "BBC News",
    "homepage": "https://www.bbc.com",
    "source_country": "GB",
    "language": "en",
    "category": "general",
    "feed_urls": [
      "https://feeds.bbci.co.uk/news/politics/rss.xml"
    ],
    "allowed_hosts": []
  },
  {
    "id": "osiris-news-007",
    "name": "The Hill",
    "homepage": "https://thehill.com",
    "source_country": "US",
    "language": "en",
    "category": "general",
    "feed_urls": [
      "https://thehill.com/feed/"
    ],
    "allowed_hosts": []
  },
  {
    "id": "osiris-news-008",
    "name": "BBC News",
    "homepage": "https://www.bbc.com",
    "source_country": "GB",
    "language": "en",
    "category": "finance",
    "feed_urls": [
      "https://feeds.bbci.co.uk/news/business/rss.xml"
    ],
    "allowed_hosts": []
  },
  {
    "id": "osiris-news-009",
    "name": "The New York Times",
    "homepage": "https://www.nytimes.com",
    "source_country": "US",
    "language": "en",
    "category": "finance",
    "feed_urls": [
      "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml"
    ],
    "allowed_hosts": []
  },
  {
    "id": "osiris-news-010",
    "name": "The Guardian",
    "homepage": "https://www.theguardian.com",
    "source_country": "GB",
    "language": "en",
    "category": "finance",
    "feed_urls": [
      "https://www.theguardian.com/business/rss"
    ],
    "allowed_hosts": []
  },
  {
    "id": "osiris-news-011",
    "name": "CNBC",
    "homepage": "https://www.cnbc.com",
    "source_country": "US",
    "language": "en",
    "category": "finance",
    "feed_urls": [
      "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114"
    ],
    "allowed_hosts": []
  },
  {
    "id": "osiris-news-012",
    "name": "CNBC",
    "homepage": "https://www.cnbc.com",
    "source_country": "US",
    "language": "en",
    "category": "finance",
    "feed_urls": [
      "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664"
    ],
    "allowed_hosts": []
  },
  {
    "id": "osiris-news-013",
    "name": "MarketWatch",
    "homepage": "https://www.marketwatch.com",
    "source_country": "US",
    "language": "en",
    "category": "finance",
    "feed_urls": [
      "https://feeds.content.dowjones.io/public/rss/mw_topstories"
    ],
    "allowed_hosts": []
  },
  {
    "id": "osiris-news-014",
    "name": "Yahoo Finance",
    "homepage": "https://finance.yahoo.com",
    "source_country": "US",
    "language": "en",
    "category": "finance",
    "feed_urls": [
      "https://finance.yahoo.com/news/rssindex"
    ],
    "allowed_hosts": []
  },
  {
    "id": "osiris-news-015",
    "name": "CoinDesk",
    "homepage": "https://www.coindesk.com",
    "source_country": "US",
    "language": "en",
    "category": "finance",
    "feed_urls": [
      "https://www.coindesk.com/arc/outboundfeeds/rss/"
    ],
    "allowed_hosts": []
  },
  {
    "id": "osiris-news-016",
    "name": "Cointelegraph",
    "homepage": "https://cointelegraph.com",
    "source_country": "ZZ",
    "language": "en",
    "category": "finance",
    "feed_urls": [
      "https://cointelegraph.com/rss"
    ],
    "allowed_hosts": []
  },
  {
    "id": "osiris-news-017",
    "name": "Decrypt",
    "homepage": "https://decrypt.co",
    "source_country": "US",
    "language": "en",
    "category": "finance",
    "feed_urls": [
      "https://decrypt.co/feed"
    ],
    "allowed_hosts": []
  },
  {
    "id": "osiris-news-018",
    "name": "The Block",
    "homepage": "https://www.theblock.co",
    "source_country": "US",
    "language": "en",
    "category": "finance",
    "feed_urls": [
      "https://www.theblock.co/rss.xml"
    ],
    "allowed_hosts": []
  },
  {
    "id": "osiris-news-019",
    "name": "Ars Technica",
    "homepage": "https://arstechnica.com",
    "source_country": "US",
    "language": "en",
    "category": "tech",
    "feed_urls": [
      "https://feeds.arstechnica.com/arstechnica/index"
    ],
    "allowed_hosts": []
  },
  {
    "id": "osiris-news-020",
    "name": "BBC News",
    "homepage": "https://www.bbc.com",
    "source_country": "GB",
    "language": "en",
    "category": "tech",
    "feed_urls": [
      "https://feeds.bbci.co.uk/news/technology/rss.xml"
    ],
    "allowed_hosts": []
  },
  {
    "id": "osiris-news-021",
    "name": "The New York Times",
    "homepage": "https://www.nytimes.com",
    "source_country": "US",
    "language": "en",
    "category": "tech",
    "feed_urls": [
      "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml"
    ],
    "allowed_hosts": []
  },
  {
    "id": "osiris-news-022",
    "name": "OilPrice.com",
    "homepage": "https://oilprice.com",
    "source_country": "US",
    "language": "en",
    "category": "finance",
    "feed_urls": [
      "https://oilprice.com/rss/main"
    ],
    "allowed_hosts": []
  },
  {
    "id": "osiris-news-023",
    "name": "The Guardian",
    "homepage": "https://www.theguardian.com",
    "source_country": "GB",
    "language": "en",
    "category": "finance",
    "feed_urls": [
      "https://www.theguardian.com/environment/energy/rss"
    ],
    "allowed_hosts": []
  },
  {
    "id": "osiris-news-024",
    "name": "Defense News",
    "homepage": "https://www.defensenews.com",
    "source_country": "US",
    "language": "en",
    "category": "general",
    "feed_urls": [
      "https://www.defensenews.com/arc/outboundfeeds/rss/?outputType=xml"
    ],
    "allowed_hosts": []
  },
  {
    "id": "osiris-news-025",
    "name": "Breaking Defense",
    "homepage": "https://breakingdefense.com",
    "source_country": "US",
    "language": "en",
    "category": "general",
    "feed_urls": [
      "https://breakingdefense.com/feed/"
    ],
    "allowed_hosts": []
  },
  {
    "id": "osiris-news-026",
    "name": "The War Zone",
    "homepage": "https://www.twz.com",
    "source_country": "US",
    "language": "en",
    "category": "general",
    "feed_urls": [
      "https://www.twz.com/feed"
    ],
    "allowed_hosts": []
  },
  {
    "id": "osiris-news-027",
    "name": "STAT",
    "homepage": "https://www.statnews.com",
    "source_country": "US",
    "language": "en",
    "category": "general",
    "feed_urls": [
      "https://www.statnews.com/feed/"
    ],
    "allowed_hosts": []
  },
  {
    "id": "osiris-news-028",
    "name": "BBC News",
    "homepage": "https://www.bbc.com",
    "source_country": "GB",
    "language": "en",
    "category": "general",
    "feed_urls": [
      "https://feeds.bbci.co.uk/news/health/rss.xml"
    ],
    "allowed_hosts": []
  },
  {
    "id": "osiris-news-029",
    "name": "BBC News",
    "homepage": "https://www.bbc.com",
    "source_country": "GB",
    "language": "en",
    "category": "tech",
    "feed_urls": [
      "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml"
    ],
    "allowed_hosts": []
  },
  {
    "id": "osiris-news-030",
    "name": "ScienceDaily",
    "homepage": "https://www.sciencedaily.com",
    "source_country": "US",
    "language": "en",
    "category": "tech",
    "feed_urls": [
      "https://www.sciencedaily.com/rss/all.xml"
    ],
    "allowed_hosts": []
  },
  {
    "id": "osiris-news-031",
    "name": "The Guardian",
    "homepage": "https://www.theguardian.com",
    "source_country": "GB",
    "language": "en",
    "category": "general",
    "feed_urls": [
      "https://www.theguardian.com/environment/climate-crisis/rss"
    ],
    "allowed_hosts": []
  },
  {
    "id": "osiris-news-032",
    "name": "BBC Sport",
    "homepage": "https://www.bbc.com/sport",
    "source_country": "GB",
    "language": "en",
    "category": "general",
    "feed_urls": [
      "https://feeds.bbci.co.uk/sport/rss.xml"
    ],
    "allowed_hosts": []
  },
  {
    "id": "osiris-news-033",
    "name": "ESPN",
    "homepage": "https://www.espn.com",
    "source_country": "US",
    "language": "en",
    "category": "general",
    "feed_urls": [
      "https://www.espn.com/espn/rss/news"
    ],
    "allowed_hosts": []
  },
  {
    "id": "osiris-news-034",
    "name": "The Guardian",
    "homepage": "https://www.theguardian.com",
    "source_country": "GB",
    "language": "en",
    "category": "general",
    "feed_urls": [
      "https://www.theguardian.com/sport/rss"
    ],
    "allowed_hosts": []
  },
  {
    "id": "osiris-news-035",
    "name": "Times of Israel",
    "homepage": "https://www.timesofisrael.com",
    "source_country": "IL",
    "language": "en",
    "category": "general",
    "feed_urls": [
      "https://www.timesofisrael.com/feed/"
    ],
    "allowed_hosts": []
  },
  {
    "id": "osiris-news-036",
    "name": "TASS",
    "homepage": "https://tass.com",
    "source_country": "RU",
    "language": "en",
    "category": "general",
    "feed_urls": [
      "https://tass.com/rss/v2.xml"
    ],
    "allowed_hosts": []
  },
  {
    "id": "osiris-news-037",
    "name": "Anadolu Agency",
    "homepage": "https://www.aa.com.tr",
    "source_country": "TR",
    "language": "en",
    "category": "general",
    "feed_urls": [
      "https://www.aa.com.tr/en/rss/default?cat=world"
    ],
    "allowed_hosts": []
  },
  {
    "id": "osiris-news-038",
    "name": "SCMP",
    "homepage": "https://www.scmp.com",
    "source_country": "HK",
    "language": "en",
    "category": "general",
    "feed_urls": [
      "https://www.scmp.com/rss/91/feed"
    ],
    "allowed_hosts": []
  },
  {
    "id": "osiris-news-039",
    "name": "CNA",
    "homepage": "https://www.channelnewsasia.com",
    "source_country": "SG",
    "language": "en",
    "category": "general",
    "feed_urls": [
      "https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml"
    ],
    "allowed_hosts": []
  },
  {
    "id": "osiris-news-040",
    "name": "Africanews",
    "homepage": "https://www.africanews.com",
    "source_country": "ZZ",
    "language": "en",
    "category": "general",
    "feed_urls": [
      "https://www.africanews.com/feed/rss"
    ],
    "allowed_hosts": []
  }
] as const;
