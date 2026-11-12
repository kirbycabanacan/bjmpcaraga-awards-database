/**
 * Google Apps Script backend for Employee Awards Registry.
 *
 * HOW TO USE
 * 1. Open the Google Sheet.
 * 2. Extensions > Apps Script.
 * 3. Replace the default Code.gs with this file.
 * 4. Deploy > New deployment > Web app.
 * 5. Execute as: Me
 * 6. Who has access: Anyone with the link (or your organization's equivalent).
 * 7. Copy the Web app URL into app.js as CONFIG.APPS_SCRIPT_URL.
 *
 * The script reads the first sheet by default. If you want a specific tab,
 * put its tab name in SHEET_NAME.
 */

const SPREADSHEET_ID = "1bJ6TCJjhKCGPpTggZaoDGC4ydng2rWh0AACf4Bt0O5g";
const SHEET_NAME = ""; // Example: "Awards"; leave blank to use the first tab.

function doGet(e) {
  const callback = sanitizeCallback(e && e.parameter ? e.parameter.callback : "");
  try {
    const payload = { ok: true, rows: readAwards() };
    return outputJsonp(callback, payload);
  } catch (err) {
    return outputJsonp(callback, { ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function readAwards() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = SHEET_NAME ? ss.getSheetByName(SHEET_NAME) : ss.getSheets()[0];
  if (!sheet) throw new Error("The configured sheet tab was not found.");

  const range = sheet.getDataRange();
  const values = range.getDisplayValues();
  const rich = range.getRichTextValues();
  const formulas = range.getFormulas();

  if (values.length < 2) return [];

  const headers = values[0].map(normalizeHeader);
  const col = {
    rank: findHeader(headers, ["rank"]),
    name: findHeader(headers, ["name", "employee name"]),
    specificAward: findHeader(headers, ["specific award", "award"]),
    awardType: findHeader(headers, ["award type", "type"]),
    dateConferred: findHeader(headers, ["date conferred", "date"]),
    soGo: findHeader(headers, ["so/go #", "so/go", "go/so #", "go/so"]),
    givenBy: findHeader(headers, ["given by"]),
    certificate: findHeader(headers, ["certificate #", "certificate"]),
    awardStanding: findHeader(headers, ["award standing", "standing"])
  };

  if (col.name === -1) throw new Error("Could not find the NAME column in row 1.");

  const rows = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const name = cell(row, col.name);
    if (!name) continue;

    rows.push({
      rank: cell(row, col.rank),
      name,
      specificAward: cell(row, col.specificAward),
      awardType: cell(row, col.awardType),
      dateConferred: cell(row, col.dateConferred),
      soGo: cell(row, col.soGo),
      soGoUrl: cellLink(rich, formulas, r, col.soGo),
      givenBy: cell(row, col.givenBy),
      certificate: cell(row, col.certificate),
      awardStanding: cell(row, col.awardStanding)
    });
  }
  return rows;
}

function cell(row, index) {
  return index >= 0 && index < row.length ? String(row[index] || "").trim() : "";
}

function normalizeHeader(v) {
  return String(v || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function findHeader(headers, candidates) {
  for (const candidate of candidates) {
    const i = headers.indexOf(candidate);
    if (i !== -1) return i;
  }
  return -1;
}

function cellLink(rich, formulas, rowIndex, colIndex) {
  if (colIndex < 0) return "";

  try {
    const rt = rich[rowIndex][colIndex];
    if (rt) {
      const direct = rt.getLinkUrl();
      if (direct) return direct;

      const runs = rt.getRuns();
      if (runs) {
        for (const run of runs) {
          const url = run.getLinkUrl();
          if (url) return url;
        }
      }
    }
  } catch (_) {}

  // Fallback for =HYPERLINK("https://...", "display text")
  const formula = formulas[rowIndex][colIndex] || "";
  const match = formula.match(/HYPERLINK\(\s*"([^"]+)"/i);
  return match ? match[1] : "";
}

function sanitizeCallback(value) {
  const callback = String(value || "callback");
  return /^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback) ? callback : "callback";
}

function outputJsonp(callback, payload) {
  const body = callback + "(" + JSON.stringify(payload) + ");";
  return ContentService
    .createTextOutput(body)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
