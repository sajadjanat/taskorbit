# Optional email password recovery

The sign-in form includes **Forgot password?**. Without configured mail delivery, it explains how to ask the instance administrator for a reset. No reset link is exposed in the API, application or logs.

Configure these environment variables privately on the server:

| Variable                  | Meaning                                                 |
| ------------------------- | ------------------------------------------------------- |
| SMTP_HOST                 | Your mail server hostname                               |
| SMTP_PORT                 | 587 by default; commonly 465 for implicit TLS           |
| SMTP_SECURE               | `true` for implicit TLS; otherwise STARTTLS is required |
| SMTP_USER / SMTP_PASSWORD | Optional authentication credentials                     |
| MAIL_FROM                 | Sender address accepted by your mail provider           |
| APP_ORIGIN                | Exact public application origin used in reset links     |

For Compose, keep values in an ignored `.env` and include the mail overlay, for example:

```sh
docker compose -f compose.image.yaml -f compose.mail.yaml up -d
```

If you use the HTTPS or updater overlays, include those too. Restart the server after changing mail configuration. Server configuration means recovery is available, not that a provider has verified delivery; exercise a real request with an account you control after setting up your provider.

Responses are generic for missing, disabled and active accounts, including mail delivery failures. Delivery runs after the response so SMTP latency does not disclose account existence. Login/recovery routes share an abuse limiter. A link expires in 30 minutes, is stored only as a SHA-256 hash, and is consumed once. Successful reset revokes existing sessions, personal API/MCP tokens and other reset links. New passwords require 12–128 characters. SMTP failure discards its token.

No SMTP provider is configured or externally verified by the default installation. Invitations and notification emails remain future work.
