# Vyratec corporate AI training website

A lightweight, responsive HTML/CSS/JavaScript site with Cloudflare Pages Functions. No runtime frontend dependencies or framework are required. Retains the existing GitHub-to-Cloudflare Pages deployment.

## Local development

Use Node.js 22.13 or later (the SMS database tests use Node's built-in SQLite):

```sh
npm run dev
npm test
npm run build
```

Preview: http://127.0.0.1:4173/. The local server runs the actual enquiry handler. Without email configuration it returns a clear failure and direct email link; it never pretends an email was sent. Automated tests mock the provider, so tests send no real emails.

Cloudflare's production build command is `npm run build`, with `dist` as the output directory. Keep `functions/` at the repository root; Pages bundles Functions separately. `_routes.json` limits function invocation to `/api/*`. Do not publish the source root as the static output; use `dist`.

The build gives CSS and JavaScript content-hashed filenames and updates page references automatically. This prevents cached assets from an earlier deployment being reused with new markup. Local development continues to use the source filenames. Unversioned files are retained for the server-generated no-JavaScript response.

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

If email configuration is unavailable, `/api/enquire` returns 503. On a JavaScript form submission, the website retains the visitor’s entries and provides a Contact us email link. Provider errors return 502. Both are failures and never record successful enquiries. A no-JavaScript submission gets a standalone HTML confirmation or error from the same handler.

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

For enquiry reporting, group successful rows by `blob3` to inspect unique provider receipts and avoid counting retries as new leads. Analytics Engine may sample data at higher volumes; counts are estimates. The inbox is the authoritative record of received enquiries. This site does not store enquiry content in a database or provide an admin dashboard.

## Callback requests and optional owner SMS

The contact section offers a training enquiry or a 15-minute callback request. Callback requests collect the caller's name, work email, organisation, phone number, preferred time (Sydney time) and an optional topic. A request is not a confirmed appointment; the business agrees a time separately. Both forms work without JavaScript and deliver through the same Resend configuration, including the private copy. JavaScript retries retain an idempotency token; a fresh native form submission without JavaScript is a new request. Analytics distinguishes accepted callbacks using `callback-form`.

Owner SMS alerts are **disabled by default**. Email remains authoritative. To enable them:

1. Create and verify a ClickSend account, inspect the current Australian rate, and use its default shared numeric sender. Do not enable automatic recharge as part of this setup.
2. Create a Cloudflare D1 database, apply `migrations/sms-alerts.sql`, then bind it to the Pages production environment as `SMS_ALERTS`.
3. Store `CLICKSEND_USERNAME`, `CLICKSEND_API_KEY` and `CALLBACK_SMS_TO` as encrypted production secrets. The destination is the owner's private E.164 mobile number, never the caller's number. Keep these values out of source and logs.
4. Set `CALLBACK_SMS_ENABLED=true` only when the sender, credit and database are ready. Update the privacy policy to disclose ClickSend processing of the caller's name, phone number and organisation before activation. Redeploy, then test one clearly labelled callback and check email and owner SMS delivery.

The SMS contains a shortened caller name and organisation, caller phone and request reference; the owner checks email for the preferred time. A unique claim on the accepted email receipt prevents repeat SMS sends for retried submissions. An atomic database condition limits all claims to ten per UTC day by default; set `CALLBACK_SMS_DAILY_LIMIT` to a whole number from 1 to 25 to change this. Failed and uncertain sends count towards the limit. Use the same D1 binding across every hostname/environment where SMS is enabled so the cap is shared. When the cap is reached, email still delivers and no SMS is attempted.

Claims store only receipt, delivery state and timestamp, with opportunistic cleanup of records older than 30 days on alert attempts. SMS failures never turn an accepted email request into an error. Uncertain delivery is not automatically retried. The API response confirms provider acceptance, not handset delivery. See `functions/_sms.mjs` and its mocked-provider and SQLite tests.

References: [ClickSend SMS API](https://developers.clicksend.com/docs/messaging/sms), [Australian senders](https://help.clicksend.com/en/articles/43652-australia-61), [charges and credit](https://help.clicksend.com/en/articles/42265-payment-and-charges), [Cloudflare D1 bindings](https://developers.cloudflare.com/pages/functions/bindings/#d1-databases).

## Content and visual updates

- `index.html`: copy, programmes, capability rows and enquiry form.
- `styles.css`: design tokens, typography and responsive layouts.
- `main.js`: navigation, programme preselection, form feedback and anonymous events.
- `functions/api/enquire.js`: validated email delivery and confirmation.
- `functions/api/events.js`: anonymous visitor events.
- `content/information.json`: privacy policy, website terms, cookie notice and accessibility information.
- `build-information.cjs`: shared information-page layout and branded 404 fallback.
- `content/sydney.json`: North Sydney base, Sydney workshop delivery and preparation guidance for `/ai-training-sydney`.
- `build-location.cjs`: static Sydney delivery-page layout with the shared header/footer and service schema.
- `assets/training-structure.svg`: original technical hero illustration, editable as SVG; displayed on desktop, omitted on small screens to keep the mobile introduction focused.

When changing programme labels, update `functions/_lib.mjs` and the form options together. Preserve the existing Vyratec wordmarks and favicons. The experience section covers manufacturing AI platform development, supply chain management training and Aroona Surf's customer-facing product recommendation chatbot. The owner confirmed ongoing chatbot maintenance, product data across hundreds of surfboard variants, personalised volume calculations and lead capture. Company entries are descriptions of work, with no fabricated testimonials, ROI figures or endorsement claims. Public pricing and participant caps from the private planning document are not published.

## Asset provenance

- Programme diagrams (`assets/training-*.svg`) and inline capability diagrams are original vector artwork made for Vyratec. The homepage and Sydney page share the programme catalogue classes in `styles.css`; the Sydney markup is generated by `build-location.cjs`. Artwork is static and decorative, with empty image alternatives or hidden SVG semantics.

- Vyratec logo, light wordmark, favicon and touch icons: supplied in the existing project.
- Hero illustration: original vector artwork created for this redesign.
- NSP: official site's logo, https://www.nspsurfboards.com/wp-content/uploads/2024/11/NSP-Logo-White-spaced-out-V03.webp ; rendered in monochrome with CSS.
- Mercedes-Benz: https://commons.wikimedia.org/wiki/File:Mercedes-Benz_Star_2022.svg ; chrome three-dimensional star, trademark rights retained by its owner.
- Aroona Surf: official header wordmark, https://www.aroonasurf.shop/cdn/shop/files/Logo_C.webp?v=1691039817 ; original asset retained, displayed in monochrome on light backgrounds with CSS. The owner requested the company entry on 22 October 2026.
- DM Sans: self-hosted Latin variable WOFF2 from Google Fonts, with its SIL Open Font License in `assets/fonts/OFL.txt`. Fonts load from this site rather than a third-party font service.
- The business owner confirmed permission to show both company logos on 14 October 2026. Their use accompanies accurate descriptions of prior experience, not customer or endorsement labels.

## Launch verification

Build and function-bundle checks, desktop/mobile checks, keyboard navigation and enquiry integration tests are included in the handoff. Confirm the production custom domain resolves to the intended Pages project and that its Git production branch and output directory match this project. Configure email and analytics, then run the actual delivery and event-retention checks before merging to the production branch.

Official references: [Cloudflare Pages Functions](https://developers.cloudflare.com/pages/functions/), [Pages bindings and secrets](https://developers.cloudflare.com/pages/functions/bindings/), [Resend email API](https://resend.com/docs/api-reference/emails/send-email), [Resend retry idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).

## Search pages and crawl behaviour

Programme content lives in `content/programmes.json`. `build-pages.cjs` renders four separate pages with distinct titles, descriptions, canonical URLs, service schema, breadcrumbs and related-programme links. Programme enquiries link to the homepage with a fixed programme slug that preselects the form. Shared navigation and footer markup come from `index.html`; the pages remain static and work without JavaScript.

The build generates `dist/sitemap.xml` from the four published programmes, homepage, Sydney delivery page and four information pages (ten canonical URLs). Use extensionless canonical URLs. Update the relevant last-modified date when content changes; do not add unpublished or missing pages to the sitemap. The original privacy page remains available at `/privacy`, with `/privacy.html` permanently redirected there. Terms and cookie-policy aliases also redirect to their canonical pages.

`content/sydney.json` provides the content for `/ai-training-sydney`, including preparation guidance and links to the four existing programmes. `build-location.cjs` renders it using the existing training-page layout. Keep the confirmed North Sydney base separate from delivery arrangements: Sydney workplace sessions and online delivery are scoped with each organisation, and the business continues to serve Australian teams. The homepage location link and shared footer make this page discoverable without JavaScript. Use the existing enquiry route `/#contact` and approved tracking labels. The schema identifies an `Organization`, a `Service` and breadcrumbs; it does not invent a street address, public office, telephone number, review or `LocalBusiness` listing. Maintain this substantive regional delivery page rather than generating duplicate suburb pages.

`robots.txt` allows public content and images and excludes the enquiry/event API. `/robots.xml` permanently redirects to the standard crawler file. Cloudflare Pages does not define a robots.xml crawl-control format. `_redirects` also preserves `/index.html` as a permanent redirect to the homepage.

`build-information.cjs` generates `dist/404.html`, the Cloudflare Pages fallback for missing pages, including nested routes. It is excluded from indexing and is not a blanket redirect to the homepage. Its header/footer match the rest of the website. Verify the real HTTP 404 status after deployment. The local preview builds the production output and reproduces extensionless routing, redirects and the missing-page status.

The document-start anchor is on the non-sticky body. Keep `#top` off the sticky header; otherwise native fragment scrolling can stop near the current viewport instead of the document start.

`npm test` includes enquiry integration tests and real HTTP checks of the 404 status, legacy redirects, sitemap coverage, distinct page metadata and service schema. Production checks should also verify the custom domain, all sitemap URLs and mobile navigation. Search indexing and rankings are controlled by search engines; these files do not submit a Search Console property.

References: https://developers.cloudflare.com/pages/configuration/serving-pages/ ; https://developers.cloudflare.com/pages/configuration/redirects/ ; https://developers.google.com/search/docs/crawling-indexing/robots/intro ; https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap

## Website information and contact labels

The information pages describe the current enquiry and analytics implementation. Custom conversion records include approved event/location labels and, for accepted enquiries, the provider receipt used for deduplication. DNT/GPC suppression applies to custom events; the cookie notice distinguishes that from Cloudflare Web Analytics and infrastructure processing. The app sets no advertising cookies or persistent visitor identifiers. There is no cosmetic cookie-consent popup.

Website terms cover browsing and enquiries, with training scope, fees and other commercial terms agreed separately. No registered entity, ABN or street address has been invented. Update the public operator details when the business owner supplies them. The accessibility page describes implemented features and gives a contact route; it does not claim a completed conformance audit.

Public email links display “Contact us”. The current mailto destination and delivery settings remain active. When a replacement email is provided, update public mailto links/organisation schema and the Cloudflare `CONTACT_TO` variable together; preserve the private `CONTACT_BCC` secret unless instructed otherwise. Never put the private BCC or API key in public source.

Policy source references: [OAIC privacy-policy guidance](https://www.oaic.gov.au/privacy/australian-privacy-principles/australian-privacy-principles-guidelines/chapter-1-app-1-open-and-transparent-management-of-personal-information), [OAIC small business guidance](https://www.oaic.gov.au/privacy/privacy-guidance-for-organisations-and-government-agencies/organisations/small-business), [ACCC consumer rights](https://www.accc.gov.au/consumers/buying-products-and-services/consumer-rights-and-guarantees), [Cloudflare cookie reference](https://developers.cloudflare.com/fundamentals/reference/policies-compliances/cloudflare-cookies/), [Cloudflare Web Analytics](https://www.cloudflare.com/web-analytics/), [Resend subprocessors](https://resend.com/legal/subprocessors).
