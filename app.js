
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


async function loadDatabase() {
  $("status").textContent = "Loading awards database…";
  $("errorState").hidden = true;

  try {
    const response = await fetch("/api/awards", {
      method: "GET",
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(
        `Database server returned error: ${response.status}`
      );
    }

    const csv = await response.text();

    if (!csv.trim()) {
      throw new Error("The Google Sheets database is empty.");
    }

    const rows = parseCSV(csv);

    if (rows.length < 2) {
      throw new Error("No award records were found.");
    }

    employees = normalizeRows(rows);

    $("status").textContent =
      `${employees.length.toLocaleString()} award records loaded`;

    console.log("Database loaded successfully.");
    console.log("Total records:", employees.length);
    console.log("First record:", employees[0]);

    if (employees.length === 0) {
      $("status").textContent =
        "Database loaded, but no award records were found.";
    }

  } catch (err) {
    console.error("Database loading error:", err);

    showError(
      "Could not load the Google Sheets database. " +
      err.message
    );
  }
}


// ==========================================
// CSV PARSER
// Handles commas, quotation marks and
// line breaks inside spreadsheet cells.
// ==========================================

function parseCSV(csv) {
  const rows = [];
  let row = [];
  let value = "";
  let insideQuotes = false;

  csv = csv.replace(/^\uFEFF/, "");

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    const next = csv[i + 1];

    if (char === '"') {
      if (insideQuotes && next === '"') {
        value += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    }

    else if (char === "," && !insideQuotes) {
      row.push(value);
      value = "";
    }

    else if (
      (char === "\n" || char === "\r") &&
      !insideQuotes
    ) {
      if (char === "\r" && next === "\n") {
        i++;
      }

      row.push(value);

      if (row.some(cell => cell.trim() !== "")) {
        rows.push(row);
      }

      row = [];
      value = "";
    }

    else {
      value += char;
    }
  }

  if (value.length || row.length) {
    row.push(value);
    rows.push(row);
  }

  return rows;
}




// ==========================================
// NORMALIZE GOOGLE SHEETS DATA
// ==========================================


function normalizeRows(rows) {

  if (!rows || rows.length < 2) return [];

  const headers = rows[0].map(normalizeHeader);

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

  // Fallback to your known spreadsheet column positions.
  // A=0, B=1, C=2 ... J=9
  const fallbackIndexes = {
    rank: 0,
    name: 1,
    specificAward: 2,
    awardType: 3,
    dateConferred: 4,
    soGo: 5,
    soGoUrl: 6,
    givenBy: 7,
    certificate: 8,
    awardStanding: 9
  };

  for (const field of Object.keys(fallbackIndexes)) {
    if (columnIndex[field] === -1) {
      columnIndex[field] = fallbackIndexes[field];
    }
  }

  console.log("Detected spreadsheet columns:", columnIndex);

  const records = rows.slice(1)
    .map(row => {

      const record = {};

      for (const [field, index] of Object.entries(columnIndex)) {
        record[field] = clean(row[index]);
      }

      return record;
    })
    .filter(record => record.name)
    .map(record => ({
      rank: record.rank,
      name: record.name,
      specificAward: record.specificAward || "Unspecified Award",
      awardType: record.awardType,
      dateConferred: record.dateConferred,
      soGo: record.soGo,
      soGoUrl: record.soGoUrl,
      givenBy: record.givenBy,
      certificate: record.certificate,
      awardStanding: record.awardStanding
    }));

  // Debug GO/SO links.
  console.table(records.map(record => ({
    employee: record.name,
    soGo: record.soGo,
    link: record.soGoUrl
  })));

  return records;
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

    let soGoHTML = "";

    if (r.soGo) {
      soGoHTML = url
        ? `<a class="so-link"
             href="${escapeAttr(url)}"
             target="_blank"
             rel="noopener noreferrer">
             ${escapeHtml(r.soGo)}
           </a>`
        : `<span>${escapeHtml(r.soGo)}</span>`;
    }

    return `
      <div class="detail-row">
        <div class="detail-value">

          ${detail("Date Conferred", r.dateConferred)}

          ${r.soGo ? `
            <div style="margin-top:5px">
              <span class="detail-label">GO/SO:</span>
              ${soGoHTML}
            </div>
          ` : ""}


        </div>
      </div>
    `;
  }).join("");

  return `
    <article class="award-card ${index === 0 ? "open" : ""}">

      <button class="award-toggle"
        type="button"
        aria-expanded="${index === 0}">

        <div class="award-count">${group.records.length}</div>

        <div class="award-title">
          <div class="award-name">
            ${escapeHtml(group.name)}
          </div>
        </div>

        <div class="chevron">⌄</div>

      </button>

      <div class="award-details">${details}</div>

    </article>
  `;
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

  if (!value) return "";

  try {

    let cleanedUrl = String(value).trim();

    // Add HTTPS if the URL has no protocol.
    if (!/^https?:\/\//i.test(cleanedUrl)) {
      cleanedUrl = "https://" + cleanedUrl;
    }

    const url = new URL(cleanedUrl);

    if (
      url.protocol === "https:" ||
      url.protocol === "http:"
    ) {
      return url.href;
    }

  } catch (err) {

    console.warn("Invalid GO/SO URL:", value);

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
