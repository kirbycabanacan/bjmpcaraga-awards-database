
/*
  BJMP Caraga Employee Awards Registry
  Database: Google Sheets
  Hosting: Vercel + GitHub
  Connection: Google Visualization API
  No Google Apps Script required.
*/

const CONFIG = {
  SHEET_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vR7a_GVR4J6QFG6s9OcrOCzfJzXT-ytStO9A7WiJkZcaMNbziucbsUiwDnjrCjkFhXSSqGjP_KuPHsk/gviz/tq",
  GID: "0",
  SUGGESTION_LIMIT: 8,
  REQUEST_TIMEOUT: 20000
};

let employees = [];
let selectedEmployee = null;

const $ = (id) => document.getElementById(id);

const searchInput = $("employeeSearch");
const suggestions = $("suggestions");

// ==========================================
// INITIALIZE WEBSITE
// ==========================================

document.addEventListener("DOMContentLoaded", () => {

  $("clearBtn").addEventListener("click", clearSearch);

  $("retryBtn").addEventListener("click", loadDatabase);

  searchInput.addEventListener("input", onSearchInput);

  searchInput.addEventListener("keydown", onSearchKeydown);

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-wrap")) {
      hideSuggestions();
    }
  });

  loadDatabase();
});

// ==========================================
// LOAD GOOGLE SHEETS DATABASE
// ==========================================

function loadDatabase() {

  $("status").textContent = "Loading awards database…";
  $("errorState").hidden = true;

  employees = [];

  const callbackName =
    "__awardsGviz_" +
    Date.now() +
    "_" +
    Math.random().toString(36).slice(2);

  const script = document.createElement("script");

  let finished = false;

  const timeout = setTimeout(() => {
    finishWithError(
      "Connection timed out. Please check your internet connection and Google Sheets publishing settings."
    );
  }, CONFIG.REQUEST_TIMEOUT);

  function cleanup() {
    clearTimeout(timeout);
    delete window[callbackName];
    script.remove();
  }

  function finishWithError(message) {
    if (finished) return;

    finished = true;
    cleanup();

    console.error("Database connection error:", message);

    showError(message);
  }

  window[callbackName] = (payload) => {

    if (finished) return;

    finished = true;
    cleanup();

    try {

      if (!payload || payload.status !== "ok") {

        const apiError =
          payload?.errors?.[0]?.detailed_message ||
          payload?.errors?.[0]?.message ||
          "Google Sheets returned an invalid response.";

        throw new Error(apiError);
      }

      if (!payload.table || !payload.table.cols) {
        throw new Error("Invalid spreadsheet response.");
      }

      const table = payload.table;

      // Extract headers.
      const headers = table.cols.map(col =>
        col.label || col.id || ""
      );

      console.log("Google Sheets headers:", headers);

      // Extract records.
      const rows = table.rows.map(row =>
        (row.c || []).map(cell => {

          if (!cell) return "";

          // Prefer formatted value.
          return cell.f != null
            ? cell.f
            : cell.v != null
              ? cell.v
              : "";

        })
      );

      // Normalize spreadsheet records.
      employees = normalizeRows([headers, ...rows]);

      console.log("Award records loaded:", employees.length);

      if (employees.length === 0) {

        $("status").textContent =
          "Database loaded, but no award records were found.";

        $("emptyState").hidden = false;

        return;
      }

      $("status").textContent =
        `${employees.length.toLocaleString()} award records loaded`;

      $("errorState").hidden = true;

      console.log("First employee record:", employees[0]);

    } catch (err) {

      console.error("Database processing error:", err);

      showError(err.message);
    }
  };

  script.onerror = () => {
    finishWithError(
      "Unable to access Google Sheets. Verify that your spreadsheet is published and publicly accessible."
    );
  };

  const params = new URLSearchParams({
    gid: CONFIG.GID,
    tqx: `out:json;responseHandler:${callbackName}`
  });

  script.src = `${CONFIG.SHEET_URL}?${params.toString()}`;

  document.body.appendChild(script);
}

// ==========================================
// NORMALIZE GOOGLE SHEETS DATA
// ==========================================

function normalizeRows(rows) {

  if (!rows || rows.length < 2) {
    return [];
  }

  const headers = rows[0].map(normalizeHeader);

  // Exact mapping of your A-J columns.
  const columnAliases = {

    rank: ["rank"],

    name: ["name"],

    specificAward: ["specificaward"],

    awardType: ["awardtype"],

    dateConferred: ["dateconfered", "dateconferred"],

    soGo: ["sogo"],

    soGoUrl: ["link"],

    givenBy: ["givenby"],

    certificate: ["certicate", "certificate"],

    awardStanding: ["awardstanding"]

  };

  const columnIndex = {};

  for (const [field, aliases] of Object.entries(columnAliases)) {

    columnIndex[field] = headers.findIndex(header =>
      aliases.includes(header)
    );

  }

  console.log("Column mapping:", columnIndex);

  // Check required columns.
  if (columnIndex.name === -1) {
    throw new Error(
      'The NAME column was not found. Check your spreadsheet headers.'
    );
  }

  if (columnIndex.soGoUrl === -1) {
    console.warn(
      'LINK column was not found. GO/SO links will not be available.'
    );
  }

  return rows.slice(1)

    .map(row => {

      const record = {};

      for (const [field, index] of Object.entries(columnIndex)) {

        record[field] =
          index >= 0
            ? clean(row[index])
            : "";

      }

      return record;

    })

    .filter(record => record.name)

    .map(record => ({

      rank: record.rank,

      name: record.name,

      specificAward:
        record.specificAward || "Unspecified Award",

      awardType: record.awardType,

      dateConferred: record.dateConferred,

      soGo: record.soGo,

      soGoUrl: record.soGoUrl,

      givenBy: record.givenBy,

      certificate: record.certificate,

      awardStanding: record.awardStanding

    }));

}

// ==========================================
// HEADER NORMALIZATION
// ==========================================

function normalizeHeader(value) {

  return String(value || "")

    .replace(/^\uFEFF/, "")

    .trim()

    .toLowerCase()

    .replace(/[^a-z0-9]/g, "");

}

function clean(value) {

  return value == null
    ? ""
    : String(value).trim();

}

// ==========================================
// UNIQUE EMPLOYEES
// ==========================================

function uniqueEmployees() {

  const map = new Map();

  for (const row of employees) {

    const key = row.name.toLowerCase();

    if (!map.has(key)) {

      map.set(key, {

        name: row.name,

        rank: row.rank

      });

    }

  }

  return [...map.values()].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

}

// ==========================================
// EMPLOYEE SEARCH
// ==========================================

function onSearchInput() {

  const q = searchInput.value.trim();

  $("clearBtn").style.display =
    q ? "block" : "none";

  if (!q) {

    hideSuggestions();

    hideResults();

    return;

  }

  const qLower = q.toLowerCase();

  const matches = uniqueEmployees()

    .filter(employee =>

      employee.name.toLowerCase().includes(qLower) ||

      employee.rank.toLowerCase().includes(qLower)

    )

    .slice(0, CONFIG.SUGGESTION_LIMIT);

  renderSuggestions(matches);

}

// ==========================================
// RENDER SEARCH SUGGESTIONS
// ==========================================

function renderSuggestions(matches) {

  suggestions.innerHTML = "";

  if (!matches.length) {

    suggestions.innerHTML = `
      <div class="suggestion">
        <div>
          <div class="suggestion-name">
            No employee found
          </div>
          <div class="suggestion-rank">
            Try another spelling
          </div>
        </div>
      </div>`;

    suggestions.hidden = false;

    return;

  }

  matches.forEach(employee => {

    const button = document.createElement("button");

    button.type = "button";

    button.className = "suggestion";

    button.innerHTML = `
      <div>
        <div class="suggestion-name">
          ${escapeHtml(employee.rank || "Rank not recorded")}
          ${escapeHtml(employee.name)}
        </div>
      </div>`;

    button.addEventListener("click", () =>
      selectEmployee(employee.name)
    );

    suggestions.appendChild(button);

  });

  suggestions.hidden = false;

}

// ==========================================
// SELECT EMPLOYEE
// ==========================================

function selectEmployee(name) {

  searchInput.value = name;

  hideSuggestions();

  $("clearBtn").style.display = "block";

  const rows = employees.filter(row =>
    row.name.toLowerCase() === name.toLowerCase()
  );

  if (!rows.length) return;

  selectedEmployee = {

    name: rows[0].name,

    rank: rows[0].rank,

    rows

  };

  renderEmployee(selectedEmployee);

}

// ==========================================
// RENDER EMPLOYEE PROFILE
// ==========================================

function renderEmployee(employee) {

  $("emptyState").hidden = true;

  $("errorState").hidden = true;

  $("results").hidden = false;

  $("profileInitials").textContent =
    initials(employee.name);

  $("employeeName").textContent =
    employee.name;

  $("employeeRank").textContent =
    employee.rank || "Rank not recorded";

  $("totalAwards").textContent =
    employee.rows.length.toLocaleString();

  const groups = groupAwards(employee.rows);

  $("uniqueAwards").textContent =
    `${groups.length} unique award${groups.length === 1 ? "" : "s"}`;

  $("awardSummary").innerHTML =
    groups.map((group, i) =>
      awardCard(group, i)
    ).join("");

  document.querySelectorAll(".award-toggle").forEach(btn => {

    btn.addEventListener("click", () => {

      btn.closest(".award-card").classList.toggle("open");

    });

  });

}

// ==========================================
// GROUP AWARDS
// ==========================================

function groupAwards(rows) {

  const map = new Map();

  for (const row of rows) {

    const key = [

      row.specificAward.toLowerCase(),

      row.awardType.toLowerCase()

    ].join("|");

    if (!map.has(key)) {

      map.set(key, {

        name: row.specificAward,

        type: row.awardType,

        records: []

      });

    }

    map.get(key).records.push(row);

  }

  return [...map.values()].sort((a, b) => {

    const ad = a.records[0].dateConferred || "";

    const bd = b.records[0].dateConferred || "";

    return bd.localeCompare(ad) ||
      a.name.localeCompare(b.name);

  });

}

// ==========================================
// AWARD CARDS
// ==========================================

function awardCard(group, index) {

  const records = [...group.records].sort((a, b) =>

    b.dateConferred.localeCompare(a.dateConferred)

  );

  const details = records.map(r => {

    const url = safeUrl(r.soGoUrl);

    return `

      <div class="detail-row">

        <div class="detail-value">

          ${detail("Date Conferred", r.dateConferred)}

          ${r.soGo ? `

            <div style="margin-top:5px">

              GO/SO:

              ${url

                ? `<a class="so-link"
                    href="${escapeAttr(url)}"
                    target="_blank"
                    rel="noopener noreferrer">
                    ${escapeHtml(r.soGo)}
                   </a>`

                : escapeHtml(r.soGo)

              }

            </div>

          ` : ""}

          ${detail("Given By", r.givenBy)}

          ${detail("Certificate #", r.certificate)}

          ${detail("Award Standing", r.awardStanding)}

        </div>

      </div>`;

  }).join("");

  return `

    <article class="award-card ${index === 0 ? "open" : ""}">

      <button class="award-toggle"
        type="button"
        aria-expanded="${index === 0}">

        <div class="award-count">
          ${group.records.length}
        </div>

        <div class="award-title">

          <div class="award-name">
            ${escapeHtml(group.name)}
          </div>

        </div>

        <div class="chevron">⌄</div>

      </button>

      <div class="award-details">
        ${details}
      </div>

    </article>`;

}

// ==========================================
// DETAIL DISPLAY
// ==========================================

function detail(label, value) {

  if (!value) return "";

  return `

    <div>

      <span class="detail-label">
        ${escapeHtml(label)}:
      </span>

      ${escapeHtml(value)}

    </div>`;

}

// ==========================================
// URL VALIDATION
// ==========================================

function safeUrl(value) {

  try {

    const url = new URL(value);

    if (
      url.protocol === "https:" ||
      url.protocol === "http:"
    ) {

      return url.href;

    }

  } catch (err) {

    return "";

  }

  return "";

}

// ==========================================
// KEYBOARD CONTROLS
// ==========================================

function onSearchKeydown(e) {

  if (e.key === "Enter") {

    const first =
      suggestions.querySelector(".suggestion");

    if (first && !suggestions.hidden) {
      first.click();
    }

  }

  if (e.key === "Escape") {
    hideSuggestions();
  }

}

// ==========================================
// CLEAR SEARCH
// ==========================================

function clearSearch() {

  searchInput.value = "";

  $("clearBtn").style.display = "none";

  hideSuggestions();

  hideResults();

  searchInput.focus();

}

// ==========================================
// HIDE ELEMENTS
// ==========================================

function hideSuggestions() {

  suggestions.hidden = true;

}

function hideResults() {

  selectedEmployee = null;

  $("results").hidden = true;

  $("errorState").hidden = true;

  $("emptyState").hidden = false;

}

// ==========================================
// ERROR DISPLAY
// ==========================================

function showError(message) {

  $("status").textContent =
    "Database connection error";

  $("errorState").hidden = false;

  $("emptyState").hidden = true;

  $("results").hidden = true;

  $("errorText").textContent = message;

}

// ==========================================
// INITIALS
// ==========================================

function initials(name) {

  const words = name.split(/\s+/).filter(Boolean);

  if (words.length >= 2) {

    return (
      words[0][0] +
      words[words.length - 1][0]
    ).toUpperCase();

  }

  return words.length === 1
    ? words[0][0].toUpperCase()
    : "—";

}

// ==========================================
// HTML ESCAPING
// ==========================================

function escapeHtml(value) {

  return String(value).replace(/[&<>"']/g, ch => ({

    "&": "&amp;",

    "<": "&lt;",

    ">": "&gt;",

    '"': "&quot;",

    "'": "&#039;"

  }[ch]));

}

function escapeAttr(value) {

  return escapeHtml(value);

}
