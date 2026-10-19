# Project conventions
- Keep public brand and membership pages outside the workspace authentication guard so visitors can read the offer before signing in.
- Keep landing styles scoped under public page classes; existing terminal pages retain their styling and behavior.
- Use an asset pointer for the original uploaded video and lazy-load the decorative R3F contours so media and content remain available if WebGL fails.
- Link billing customers to stable authenticated user IDs; subscription state is server-written and never derived from editable profile metadata.
- Stage draft schema additions only; do not activate checkout or enforce a new subscription gate before payment configuration and staged membership tables are accepted.