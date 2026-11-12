# Employee Awards Registry

A responsive employee award-search website backed by the supplied Google Sheet.

## Files
- `index.html` - website
- `styles.css` - design
- `app.js` - search, suggestions, grouping, dropdowns and GO/SO links
- `Code.gs` - Google Apps Script backend that reads the Google Sheet and preserves GO/SO hyperlinks

## Setup

### 1. Install the Google Apps Script backend
Open the supplied Google Sheet:

https://docs.google.com/spreadsheets/d/1bJ6TCJjhKCGPpTggZaoDGC4ydng2rWh0AACf4Bt0O5g/edit

Then:
1. Extensions > Apps Script.
2. Paste the contents of `Code.gs`.
3. If your awards data is not on the first sheet tab, set `SHEET_NAME`.
4. Save.
5. Deploy > New deployment.
6. Select `Web app`.
7. Execute as `Me`.
8. Set access to `Anyone with the link` (or your organization's allowed setting).
9. Deploy and copy the Web app URL.

### 2. Connect the website
Open `app.js` and replace:

`PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE`

with the deployed Web app URL.

### 3. Publish the website
Upload `index.html`, `styles.css`, and `app.js` to any static hosting provider:
- GitHub Pages
- Netlify
- Vercel
- Cloudflare Pages
- your own web server

You can also open `index.html` locally for development, but some browsers restrict local-file requests. Static hosting is recommended.

## Expected sheet columns

The backend recognizes the screenshot's columns:
1. RANK
2. NAME
3. SPECIFIC AWARD
4. AWARD TYPE
5. DATE CONFERED
6. SO/GO #
7. Given By
8. CERTIFICATE #
9. AWARD STANDING

The code accepts both `CONFERED` and `CONFERRED`-style labels through the generic date header matching.

## Behavior
- Search suggestions appear while typing.
- Suggestions show rank + employee name.
- Selecting an employee shows every award record.
- Repeated awards are grouped by Specific Award + Award Type.
- The large number on each card is the number of times that award was received.
- Clicking an award card expands the individual award records.
- GO/SO # becomes a clickable link when the Google Sheet cell contains a hyperlink or HYPERLINK formula.
- The database is loaded from the Google Sheet at runtime, so the website does not need a manually maintained copy of the awards data.

## Important privacy note
The deployed Apps Script endpoint can expose the award records to anyone who can reach the website. If this is personnel data that should not be public, deploy the site and backend inside your organization's authenticated environment instead of using "Anyone with the link".
