# Website and robots spot checks — October 19, 2026

These are narrowly scoped checks using public webpage/robots retrieval. **They do not establish full-site crawlability or permission to commercialize, summarize, or redistribute articles.** The repository's previously listed `source-checks.json` failed to reach all 80 sources in its restricted DNS environment; those failures are not evidence that the publishers were offline.

| Candidate | Evidence checked | Technical observation | Production decision |
|---|---|---|---|
| [Cloudflare Blog](https://blog.cloudflare.com/) | [robots.txt](https://blog.cloudflare.com/robots.txt), [/rss/](https://blog.cloudflare.com/rss/) | General `/` allowance with excluded preview/admin fragments; robots publishes explicit content-use signals; RSS served as `application/rss+xml` | TECHNICALLY PROMISING; check terms and respect permitted uses |
| [World Bank Blogs](https://blogs.worldbank.org/en/blogs) | [homepage](https://blogs.worldbank.org/en/blogs), [robots.txt](https://blogs.worldbank.org/robots.txt) | Both retrieved; excludes admin, system, and certain paths | TECHNICALLY PROMISING; check terms |
| [BIS research and press RSS](https://www.bis.org/rss) | [RSS directory](https://www.bis.org/rss), [robots.txt](https://www.bis.org/robots.txt) | Official RSS directory; path-specific exclusions for internal directories | PREFER APPROVED RSS, review terms |
| [Coinbase Blog](https://www.coinbase.com/blog) | [robots.txt](https://www.coinbase.com/robots.txt) | Blog sitemap advertised; excludes account, trading and login routes | Blog paths may be eligible; check publishing terms |
| [Tech in Asia](https://www.techinasia.com/) | [robots.txt](https://www.techinasia.com/robots.txt) | Explicitly excludes `*/feed` and multiple protected routes; special AI crawler restrictions | DO NOT request restricted feeds; terms review required |
| [Spot Uzbekistan](https://www.spot.uz/) | [homepage](https://www.spot.uz/), [robots.txt](https://www.spot.uz/robots.txt) | Homepage and robots retrieved; disallows admin, search and many query-string URLs | TECHNICAL CANDIDATE for allowed paths only |
| [El Observador Uruguay](https://www.elobservador.com.uy/) | [robots.txt](https://www.elobservador.com.uy/robots.txt) | Exposes sitemap links; no general `/` prohibition visible in the public retrieved text | Terms review required |
| [IMF Blogs](https://www.imf.org/en/blogs) | [homepage](https://www.imf.org/en/blogs) | Public posts retrieved; robots file did not return an accessible rule set through the research tool | Terms, robots and feed check needed from crawler host |
| [Nairametrics Nigeria](https://nairametrics.com/) | [homepage](https://nairametrics.com/) | Homepage retrieved | Robots and terms not verified |
| [The Edge Malaysia](https://theedgemalaysia.com/) | [homepage](https://theedgemalaysia.com/) | Homepage retrieved | Robots and terms not verified |
| [EnterpriseAM Egypt](https://enterpriseam.com/egypt/) | [homepage](https://enterpriseam.com/egypt/) | Homepage/research archive retrieved | Robots and newsletter reuse rights not verified |
| [Capital Ethiopia](https://capitalethiopia.com/) | [homepage](https://capitalethiopia.com/) | Homepage and recent business articles retrieved | Robots and terms not verified |
| [Ekonomim Turkey](https://www.ekonomim.com/) | [homepage](https://www.ekonomim.com/) | Homepage retrieved | Robots and terms not verified |
| [5Días Paraguay](https://www.5dias.com.py/) | [homepage](https://www.5dias.com.py/) | Homepage retrieved; browser sees substantial client-rendered layout | May need authorized metadata feed; check terms |
| [The Bell English](https://en.thebell.io/) | [about](https://en.thebell.io/about/), [subscriptions](https://en.thebell.io/paidsubscriptions/) | Publisher documented; subscription-only reporting exists | No paywall bypass |
| [Business Post Ireland](https://www.businesspost.ie/) | [homepage](https://www.businesspost.ie/) | The research browsing agent was rejected by robots; this does not determine every bot's rules | RESTRICTED / obtain feed license or permission |
| [Reuters](https://www.reuters.com/) | [robots.txt](https://www.reuters.com/robots.txt) | Explicit notice disallows automated collection without prior written consent | DO NOT scrape without written authorization; not included in catalog |

## What has *not* been verified

No end-to-end 207-domain crawl test, provider-specific rights review, latency or publication-frequency benchmark was run. The technical host audit script is required before production approval. A sitemap, RSS URL, or a publicly readable article does not by itself authorize scraping for an AI product.
