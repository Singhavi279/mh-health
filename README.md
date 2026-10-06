# Maharashtra Times Swasthya Sangam 2026 — event website

Plain HTML, CSS and JavaScript. No build step, no dependencies. Hosts as-is on GitHub Pages.

```
index.html          the whole site (one page, sections with stable #anchors)
css/styles.css      design tokens + styles (mobile first)
js/main.js          mobile menu + form submission (optional enhancement)
assets/img/         logos, poster (social share image), favicon
llms.txt            plain-text summary for AI/LLM crawlers
robots.txt          allows search + AI crawlers
sitemap.xml
design-system/      tokens and design notes
content.txt         source copy
```

## Deploy on GitHub Pages
1. Push this folder to a repo. Settings → Pages → Deploy from branch → `main` / root.
2. (Done for singhavi279.github.io/mh-health.) To move to another URL, replace it everywhere with your real one (user site, project site or custom domain):
   ```
   grep -rl "https://singhavi279.github.io/mh-health" . | xargs sed -i '' 's|https://singhavi279.github.io/mh-health|https://your.real/url|g'
   ```
   (on Linux drop the `''` after `-i`). It appears in canonical/OG tags, JSON-LD, `robots.txt`, `sitemap.xml` and `llms.txt`.
3. For a custom domain add a `CNAME` file containing the domain.

All asset links are relative, so the site also works under a `/repo-name/` sub-path.

## Forms
GitHub Pages has no backend. Set `data-form-endpoint` on `<body>` in `index.html` to a form service URL (Formspree, Google Apps Script, etc.). It receives a JSON POST. Until set, forms show an "opening soon" message.

## Updating content
Search `index.html` for "To be announced" to find every placeholder (date, venue, contacts, jury, speakers, agenda, partners). Keep `llms.txt` and the JSON-LD block in `<head>` in sync when facts change.
