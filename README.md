# Vyratec corporate AI training website

A lightweight, responsive HTML/CSS/JavaScript site with Cloudflare Pages Functions. No runtime frontend dependencies or framework are required. Retains the existing GitHub-to-Cloudflare Pages deployment.

## Local development

Use Node.js 22 or later:

```sh
npm run dev
npm test
npm run build
```

Preview: http://127.0.0.1:4173/. The local server runs the actual enquiry handler. Without email configuration it returns a clear failure and direct email link; it never pretends an email was sent. Automated tests mock the provider, so tests send no real emails.

Cloudflare's production build command is `npm run build`, with `dist` as the output directory. Keep `functions/` at the repository root; Pages bundles Functions separately. `_routes.json` limits function invocation to `/api/*`. Do not publish the source root as the static output; use `dist`.

## Email setup before production

In Resend, verify a sender domain you control (for example, a sending subdomain of vyratec.com) and create a sending API key. In the existing Cloudflare Pages project's production **Settings → Variables and Secrets**, add:

| Name | Value | Storage |
| --- | --- | --- |
| `RESEND_API_KEY` | Your Resend sending API key | Secret |
| `CONTACT_FROM` | A sender on the domain verified with Resend | Variable |
| `CONTACT_TO` | `shop@vyratec.com` | Variable |
| `CONTACT_BCC` | The business operator's private copy address | Secret |

`CONTACT_TO` defaults to the public business inbox. The API key, sender and BCC address must be configured before the handler accepts enquiries. The private BCC address is deliberately absent from public source and browser assets. Reply-to is the visitor's work email. Requirements are plain text in the notification; server-side validation, a honeypot, origin checks, actual streamed-body size limits and provider timeouts protect the endpoint. A stable Resend idempotency key prevents duplicate email delivery when the same submission is retried within Resend's 24-hour window.

Redeploy after changing configuration. Submit a real test enquiry and verify the business inbox and BCC receive it, reply-to is correct and the website displays confirmation. Resend acceptance confirms the provider accepted the email, not that an inbox has received it; inspect delivery status during the launch test.

If email configuration is unavailable, `/api/enquire` returns 503 and the website keeps the visitor's entries and presents the business email. Provider errors return 502. Both are failures and never record successful enquiries. A no-JavaScript submission gets a standalone HTML confirmation or error from the same handler.

## Analytics

The site sends fixed anonymous labels for `page_view`, `cta_click` and `enquiry_start` to `/api/events`. The server records `enquiry_success` only after Resend accepts the notification. Visitors cannot submit success events to the analytics endpoint. No submitted details, query strings, visitor IDs or IP addresses are included in these custom events; DNT and GPC signals suppress recording.

To retain queryable conversion events, add an **Analytics Engine** binding in Cloudflare Pages **Settings → Bindings**:

- Variable name: `ANALYTICS`
- Dataset: `vyratec_conversions`

Redeploy after adding the binding. Records use `blob1` for event name, `blob2` for CTA location, `blob3` for the provider receipt on successful enquiries, and `double1` for event count. The stable receipt allows accepted retries to be grouped together when reporting qualified enquiries. Without the binding the same events go to function logs; this is diagnostic logging, not a retained analytics dashboard. Enable Cloudflare Web Analytics in the Pages project for aggregate traffic/performance metrics; the CSP permits its official beacon. No GA or advertising tag is added.

Example event totals through Cloudflare's Analytics Engine SQL API:

```sql
SELECT blob1 AS event, blob2 AS location, SUM(_sample_interval * double1) AS events
FROM vyratec_conversions
WHERE timestamp > NOW() - INTERVAL '30' DAY
GROUP BY event, location
```

For enquiry reporting, group successful rows by `blob3` to inspect unique provider receipts and avoid counting retries as new leads. Analytics Engine may sample data at higher volumes; counts are estimates. The inbox is the authoritative record of received enquiries. This site does not store enquiries in a database or provide an admin dashboard.

## Content and visual updates

- `index.html`: copy, programmes, capability rows and enquiry form.
- `styles.css`: design tokens, typography and responsive layouts.
- `main.js`: navigation, programme preselection, form feedback and anonymous events.
- `functions/api/enquire.js`: validated email delivery and confirmation.
- `functions/api/events.js`: anonymous visitor events.
- `privacy.html`: notice describing the actual website implementation.
- `assets/applied-structure.svg`: original technical hero illustration, editable as SVG.

When changing programme labels, update `functions/_lib.mjs` and the form options together. Preserve the existing Vyratec wordmarks and favicons. There are no fabricated testimonials, ROI figures, case-study results or current-client claims. Mercedes-Benz is identified as internship experience; NSP as a tailored pilot. Public pricing and participant caps from the private planning document are not published.

## Asset provenance

- Vyratec logo, light wordmark, favicon and touch icons: supplied in the existing project.
- Hero illustration: original vector artwork created for this redesign.
- NSP: official site's logo, https://www.nspsurfboards.com/wp-content/uploads/2024/11/NSP-Logo-White-spaced-out-V03.webp ; rendered in monochrome with CSS.
- Mercedes-Benz: https://commons.wikimedia.org/wiki/File:Mercedes-Benz_free_logo.svg ; public-domain geometric logo file, trademark rights retained by its owner.
- The business owner confirmed permission to show both company logos on 14 October 2026. Their use accompanies accurate descriptions of prior experience, not customer or endorsement labels.

## Launch verification

Build and function-bundle checks, desktop/mobile checks, keyboard navigation and enquiry integration tests are included in the handoff. Confirm the production custom domain resolves to the intended Pages project and that its Git production branch and output directory match this project. Configure email and analytics, then run the actual delivery and event-retention checks before merging to the production branch.

Official references: [Cloudflare Pages Functions](https://developers.cloudflare.com/pages/functions/), [Pages bindings and secrets](https://developers.cloudflare.com/pages/functions/bindings/), [Resend email API](https://resend.com/docs/api-reference/emails/send-email), [Resend retry idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).
