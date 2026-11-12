/*
  Employee Awards Registry
  Replace APPS_SCRIPT_URL with the deployed Google Apps Script Web App URL.
*/
const CONFIG = {
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbxDgwAPWd4nrddjPzrHiXGBC1tuvxTI7mc7ViTwj6-gt3_2cRHfN-3u0iwx0zOdBSeO-A/exec",
  SUGGESTION_LIMIT: 8
};

let employees = [];
let selectedEmployee = null;

const $ = (id) => document.getElementById(id);
const searchInput = $("employeeSearch");
const suggestions = $("suggestions");

document.addEventListener("DOMContentLoaded", () => {
  $("clearBtn").addEventListener("click", clearSearch);
  $("retryBtn").addEventListener("click", loadDatabase);
  searchInput.addEventListener("input", onSearchInput);
  searchInput.addEventListener("keydown", onSearchKeydown);
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-wrap")) hideSuggestions();
  });
  loadDatabase();
});

function loadDatabase() {
  $("status").textContent = "Loading awards database…";
  $("errorState").hidden = true;

  if (CONFIG.APPS_SCRIPT_URL.includes("PASTE_YOUR")) {
    showError("Set APPS_SCRIPT_URL in app.js to the URL of your deployed Google Apps Script web app.");
    return;
  }

  const callbackName = "__awardsCallback_" + Date.now();
  window[callbackName] = (payload) => {
    try {
      if (!payload || payload.ok !== true) throw new Error(payload?.error || "The data source returned an error.");
      employees = normalizeRows(payload.rows || []);
      $("status").textContent = `${employees.length.toLocaleString()} award records loaded`;
      if (employees.length === 0) $("status").textContent = "Database loaded, but no award records were found.";
    } catch (err) {
      showError(err.message);
    } finally {
      delete window[callbackName];
      script.remove();
    }
  };

  const script = document.createElement("script");
  script.src = CONFIG.APPS_SCRIPT_URL + (CONFIG.APPS_SCRIPT_URL.includes("?") ? "&" : "?")
            + "callback=" + encodeURIComponent(callbackName);
  script.onerror = () => {
    delete window[callbackName];
    script.remove();
    showError("Could not connect to the Google Sheets database. Check that the Apps Script web app is deployed for access.");
  };
  document.body.appendChild(script);
}

function normalizeRows(rows) {
  return rows
    .filter(r => r && String(r.name || "").trim())
    .map(r => ({
      rank: clean(r.rank),
      name: clean(r.name),
      specificAward: clean(r.specificAward) || "Unspecified Award",
      awardType: clean(r.awardType),
      dateConferred: clean(r.dateConferred),
      soGo: clean(r.soGo),
      soGoUrl: clean(r.soGoUrl),
      givenBy: clean(r.givenBy),
      certificate: clean(r.certificate),
      awardStanding: clean(r.awardStanding)
    }));
}

function clean(v) {
  return v == null ? "" : String(v).trim();
}

function uniqueEmployees() {
  const map = new Map();
  for (const row of employees) {
    const key = row.name.toLowerCase();
    if (!map.has(key)) map.set(key, { name: row.name, rank: row.rank });
  }
  return [...map.values()].sort((a,b) => a.name.localeCompare(b.name));
}

function onSearchInput() {
  const q = searchInput.value.trim();
  $("clearBtn").style.display = q ? "block" : "none";

  if (!q) {
    hideSuggestions();
    hideResults();
    return;
  }

  const qLower = q.toLowerCase();
  const matches = uniqueEmployees()
    .filter(e => e.name.toLowerCase().includes(qLower) || e.rank.toLowerCase().includes(qLower))
    .slice(0, CONFIG.SUGGESTION_LIMIT);

  renderSuggestions(matches);
}

function renderSuggestions(matches) {
  suggestions.innerHTML = "";
  if (!matches.length) {
    suggestions.innerHTML = `<div class="suggestion"><div><div class="suggestion-name">No employee found</div><div class="suggestion-rank">Try another spelling</div></div></div>`;
    suggestions.hidden = false;
    return;
  }

  matches.forEach((employee) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "suggestion";
    button.innerHTML = `
      <div>
        <div class="suggestion-name">${escapeHtml(employee.rank || "Rank not recorded")} ${escapeHtml(employee.name)}</div>
      </div>`;
    button.addEventListener("click", () => selectEmployee(employee.name));
    suggestions.appendChild(button);
  });
  suggestions.hidden = false;
}



function selectEmployee(name) {
  searchInput.value = name;
  hideSuggestions();
  $("clearBtn").style.display = "block";
  const rows = employees.filter(r => r.name.toLowerCase() === name.toLowerCase());
  if (!rows.length) return;

  selectedEmployee = { name: rows[0].name, rank: rows[0].rank, rows };
  renderEmployee(selectedEmployee);
}

function renderEmployee(employee) {
  $("emptyState").hidden = true;
  $("errorState").hidden = true;
  $("results").hidden = false;

  $("profileInitials").textContent = initials(employee.name);
  $("employeeName").textContent = employee.name;
  $("employeeRank").textContent = employee.rank || "Rank not recorded";
  $("totalAwards").textContent = employee.rows.length.toLocaleString();

  const groups = groupAwards(employee.rows);
  $("uniqueAwards").textContent = `${groups.length} unique award${groups.length === 1 ? "" : "s"}`;

  $("awardSummary").innerHTML = groups.map((group, i) => awardCard(group, i)).join("");

  document.querySelectorAll(".award-toggle").forEach(btn => {
    btn.addEventListener("click", () => {
      btn.closest(".award-card").classList.toggle("open");
    });
  });
}

function groupAwards(rows) {
  const map = new Map();

  for (const row of rows) {
    const key = [row.specificAward.toLowerCase(), row.awardType.toLowerCase()].join("|");
    if (!map.has(key)) map.set(key, {
      name: row.specificAward,
      type: row.awardType,
      records: []
    });
    map.get(key).records.push(row);
  }

  return [...map.values()].sort((a,b) => {
    const ad = a.records[0].dateConferred || "";
    const bd = b.records[0].dateConferred || "";
    return bd.localeCompare(ad) || a.name.localeCompare(b.name);
  });
}

function awardCard(group, index) {
  const records = [...group.records].sort((a,b) => b.dateConferred.localeCompare(a.dateConferred));
  const details = records.map((r, i) => `
    <div class="detail-row">
      <div class="detail-value">
        ${detail("Date Conferred", r.dateConferred)}
        ${r.soGo ? `<div style="margin-top:5px">GO/SO: ${r.soGoUrl
          ? `<a class="so-link" href="${escapeAttr(r.soGoUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(r.soGo)}</a>`
          : escapeHtml(r.soGo)}</div>` : ""}
        ${detail("Given By", r.givenBy)}
        ${detail("Certificate #", r.certificate)}
        ${detail("Award Standing", r.awardStanding)}
      </div>
    </div>`).join("");

  return `
    <article class="award-card ${index === 0 ? "open" : ""}">
      <button class="award-toggle" type="button" aria-expanded="${index === 0}">
        <div class="award-count">${group.records.length}</div>
        <div class="award-title">
          <div class="award-name">${escapeHtml(group.name)}</div>
        </div>
        <div class="chevron">⌄</div>
      </button>
      <div class="award-details">${details}</div>
    </article>`;
}

function detail(label, value) {
  if (!value) return "";
  return `<div><span class="detail-label">${escapeHtml(label)}:</span> ${escapeHtml(value)}</div>`;
}

function onSearchKeydown(e) {
  if (e.key === "Enter") {
    const first = suggestions.querySelector(".suggestion");
    if (first && !suggestions.hidden) first.click();
  }
  if (e.key === "Escape") hideSuggestions();
}

function clearSearch() {
  searchInput.value = "";
  $("clearBtn").style.display = "none";
  hideSuggestions();
  hideResults();
  searchInput.focus();
}

function hideSuggestions() {
  suggestions.hidden = true;
}

function hideResults() {
  selectedEmployee = null;
  $("results").hidden = true;
  $("errorState").hidden = true;
  $("emptyState").hidden = false;
}

function showError(message) {
  $("status").textContent = "Database connection error";
  $("errorState").hidden = false;
  $("emptyState").hidden = true;
  $("results").hidden = true;
  $("errorText").textContent = message;
}

// function initials(name) {
//   return name.split(/\s+/).filter(Boolean).slice(0,2).map(x => x[0]).join("").toUpperCase() || "—";
// }

function initials(name) {
  const words = name.split(/\s+/).filter(Boolean);

  if (words.length >= 2) {
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }

  return words.length === 1 ? words[0][0].toUpperCase() : "—";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[ch]));
}

function escapeAttr(value) {
  return escapeHtml(value);
}
