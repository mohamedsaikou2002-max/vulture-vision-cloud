# Additional news sources

The uploaded 207-source catalog is retained under `news-crawler/source-pack/` with its original audit and approval tools. All candidates remain disabled until source-by-source robots and intended-use review. The catalog is not evidence of 207 live integrations or commercial redistribution permission.

The News page can receive additional public RSS metadata directly through `vv-news`; this does not require an external Python host or an additional API key. Only headlines, publisher links, publication timestamps, and provided bylines are returned, not article bodies. Existing source-health reporting identifies failed or empty feeds. No publisher blocks, paywalls, or rate limits are bypassed.

The uploaded Python failover worker is not deployed by this change. An always-on worker is a separate deployment, and Lovable Cloud's service-role credential is not available to export to that host. Do not follow the upload notes' instruction to obtain that credential from a dashboard.