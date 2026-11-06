# SCOFIS Google Ads landing pages

Two conversion-focused landing pages for Sunshine Coast Oral, Facial & Implant
Specialists, built to receive paid search traffic.

| File | Ad group it serves |
|---|---|
| `index.html` | Dental implants, All-on-4 and full arch |
| `wisdom-teeth.html` | Wisdom teeth removal (GA in hospital, GA in clinic, IV sedation) |

Both pages share `assets/site.css` and `assets/site.js`, so a change to the
header, buttons, form or colours only needs making once.

---

## 1. Deploy

Push the folder to GitHub and import it into Vercel as a new project. There is
no build step. Vercel will pick up `api/lead.js` as a serverless function and
install `nodemailer` from `package.json` automatically.

Suggested final URLs for the campaigns:

- `https://<domain>/` for the implants ad group
- `https://<domain>/wisdom-teeth` for the wisdom teeth ad group

`vercel.json` has `cleanUrls` on, so `/wisdom-teeth` works without the `.html`.

---

## 2. Environment variables (required before the form works)

Set these in Vercel under **Settings → Environment Variables**, for Production
and Preview. See `.env.example`.

| Variable | Notes |
|---|---|
| `SMTP_HOST` | Any provider that enforces TLS, e.g. SMTP2GO |
| `SMTP_PORT` | `465` for implicit TLS (recommended) or `587` for STARTTLS |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password |
| `MAIL_FROM` | e.g. `no-reply@sunshinecoastofis.com.au` |
| `LEAD_INTAKE` | Optional. Overrides the SmileOx intake address. |
| `NOTIFY_TO` | Optional. Sends reception a plain-English copy of each enquiry. |

The SmileOx intake address is already hard-coded as the default:

```
contact-submissions+50d8ee08-b736-4740-a84b-ae94788ca250@intake.smileox.com.au
```

TLS is enforced in code. On port 587 `requireTLS` is set, so a server that
will not upgrade is rejected rather than sending the payload in clear text.

---

## 3. How the form reaches SmileOx

1. The browser POSTs the form as JSON to `/api/lead`.
2. `api/lead.js` validates it, normalises the phone number to `+61` E.164,
   drops empty fields, and appends `gclid` plus any `utm_*` parameters from the
   landing page URL.
3. It emails `JSON.stringify(payload)` as the plain text body to the intake
   address over TLS, which creates the lead in the CRM pipeline.

Payload shape:

```json
{
  "firstName": "Taylor",
  "lastName": "Ray",
  "email": "taylor@example.com",
  "phoneNumber": "+61412345678",
  "enquiryType": "All-on-4 / full arch",
  "hasReferral": "No",
  "message": "...",
  "source": "Google Ads landing page",
  "pageType": "dental-implants",
  "pageUrl": "https://...",
  "gclid": "...",
  "utmCampaign": "...",
  "submittedAt": "2026-11-06T02:00:00.000Z"
}
```

Because `gclid` travels with the lead, a booked consultation in SmileOx can be
traced back to the exact keyword that produced it.

**Test before launch:** submit the form on the deployed URL and confirm a lead
appears in the SmileOx pipeline with every field populated.

---

## 4. Tracking

GTM container `GTM-TZ7DJSC2` is installed on both pages, head snippet plus the
`<noscript>` iframe. `assets/site.js` pushes these events to `dataLayer`:

| Event | Fires when | Use it for |
|---|---|---|
| `call_click` | Any tap on a `tel:` link or call button | Google Ads **Calls from website** conversion |
| `enquiry_click` | Any tap on an enquiry CTA | Micro-conversion / engagement |
| `form_start` | First keystroke in the form | Funnel diagnostics |
| `generate_lead` | Form submitted successfully | Google Ads **Book online** conversion |

Every event carries `page_type` (`dental-implants` or `wisdom-teeth`), so the
two ad groups can be reported separately. `call_click` also carries
`call_source` (header, hero, sticky, footer, form-aside) so you can see which
placement drives the calls.

Build the two Google Ads conversion actions in GTM off `generate_lead` and
`call_click`, and set them as Primary. Everything else stays Secondary.

---

## 5. What is on the page, and why

- **The hero is a video**, the same Vimeo background loop as the main site
  (`1226478707`), with a navy scrim for text legibility and a still fallback
  behind it so the hero is never blank.
- **The form sits low on the page**, after the proof, the explainers and the
  surgeons. The CTAs above it are a call button and an enquiry button that
  scrolls down to the form.
- **Specialist positioning throughout**, built on what the surgeons actually
  hold: medical and dental degrees, FRACDS (OMS), on-site CBCT, five accredited
  private hospitals. No comparisons against other practitioners anywhere.
- **Location signals** for paid search relevance: Buderim, the Sunshine Coast,
  and the Gympie, Noosa, Nambour, Maroochydore, Hervey Bay and Brisbane
  catchment.
- **Money callouts**: payment plans and early release of super on the implants
  page, payment plans and health fund rebates on the wisdom teeth page. Super
  is deliberately absent from the wisdom teeth page.
- **AHPRA numbers and the surgical risk disclaimer** are in the footer of both
  pages.
- Both pages are `noindex, follow` so they do not compete with the main site's
  service pages in organic search.

---

## 6. Optimisations to do at launch

- **Self-host the practice photography.** The surgeon portraits and interior
  shots currently load from `sunshinecoastofis.com.au/images/`. Copying those
  files into `images/` and updating the `src` attributes removes a third-party
  request and improves the landing page experience score. The clinical
  renders are already local.
- **Confirm the fonts.** The pages use Crimson Pro and Instrument Sans, which
  match the rest of the SCOFIS collateral. If the main site uses a different
  pairing, change `--display` and `--sans` at the top of `assets/site.css` and
  the Google Fonts `<link>` in each page head. Nothing else needs touching.
- **Set a favicon** if you want something other than the logo.

---

Built by Generate Your Audience · generateyouraudience.com.au
