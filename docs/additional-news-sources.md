# Additional news sources

The uploaded 207-source catalog is retained under `news-crawler/source-pack/` with its original audit and approval tools. All candidates remain disabled until source-by-source robots and intended-use review. The catalog is not evidence of 207 live integrations or commercial redistribution permission.

The News page can receive additional public RSS metadata directly through `vv-news`; this does not require an external Python host or an additional API key. Only headlines, publisher links, publication timestamps, and provided bylines are returned, not article bodies. Existing source-health reporting identifies failed or empty feeds. No publisher blocks, paywalls, or rate limits are bypassed.

## Added feed subscriptions

| Publisher | Uploaded candidate | Subscription |
| --- | --- | --- |
| Cloudflare Blog | global-extra-011 | https://blog.cloudflare.com/rss/ |
| Ethereum Foundation Blog | global-extra-014 | https://blog.ethereum.org/en/feed.xml |
| The Register | global-extra-016 | https://www.theregister.com/headlines.atom |

These three feeds returned HTTP 200 and parseable entries in a live spot-check. They join Tech Intelligence and the combined news response, with the existing newest-first limits unchanged. Feed access is not a grant of commercial article reuse rights; article-page crawling remains disabled in the candidate catalog. No Nasdaq simulator settings were changed.

The uploaded Python failover worker is not deployed by this change. An always-on worker is a separate deployment, and Lovable Cloud's service-role credential is not available to export to that host. Do not follow the upload notes' instruction to obtain that credential from a dashboard.