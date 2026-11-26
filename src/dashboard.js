"use strict";

const snapshot = JSON.parse(document.querySelector("#snapshot").textContent);
const { accounts, meta, rubric } = snapshot;
const view = document.querySelector("#view");
const toast = document.querySelector("#toast");
const state = { view: "accounts", account: accounts[0].id, query: "", segment: "", order: "score", evidenceAccount: "" };
const dateFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });
const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
let toastTimer;

function html(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function date(value) {
  return dateFormatter.format(new Date(value + "T00:00:00Z"));
}

function source(url, label) {
  if (!/^https:\/\//i.test(url)) return "";
  return '<a class="source-link" href="' + html(url) + '" target="_blank" rel="noopener noreferrer">' + html(label) + ' ↗</a>';
}

function options(values, selected) {
  return values.map(([value, label]) =>
    '<option value="' + html(value) + '"' + (value === selected ? " selected" : "") + ">" + html(label) + "</option>"
  ).join("");
}

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 2800);
}

function visibleAccounts() {
  const query = state.query.trim().toLowerCase();
  const matches = accounts.filter((account) =>
    (!state.segment || state.segment === account.segment) &&
    [account.name, account.domain, account.segment, account.location, account.workflow,
      ...account.stakeholders.flatMap((role) => [role.name, role.title, role.role])]
      .join(" ").toLowerCase().includes(query)
  );
  return matches.sort((first, second) => {
    if (state.order === "name") return first.name.localeCompare(second.name);
    if (state.order === "signal") return second.signal.date.localeCompare(first.signal.date) || second.score - first.score;
    return second.score - first.score || second.signal.date.localeCompare(first.signal.date);
  });
}

function evidence(account) {
  return [
    {
      label: "Commercial signal", date: account.signal.date, title: account.signal.title,
      detail: account.signal.fact, url: account.signal.url, publisher: account.signal.publisher
    },
    {
      label: "DoD award record", date: account.award.date, title: account.award.id,
      detail: [account.award.agency, account.award.recipient, currency.format(account.award.amount) + " reported award amount"].join(" · "),
      url: account.award.url, publisher: "USAspending award record"
    },
    ...account.stakeholders.filter((role) => role.url).map((role) => ({
      label: "Stakeholder", date: null, title: role.name, detail: role.title + " · " + role.status,
      url: role.url, publisher: role.status === "Company-confirmed" ? "Company source" : "Public professional profile"
    }))
  ];
}

function evidenceTile(item, accountName = "") {
  const timing = item.date ? '<time datetime="' + item.date + '">' + date(item.date) + "</time>" : "";
  return '<article class="tile"><p class="section-label">' + html(accountName ? accountName + " · " + item.label : item.label) +
    "</p>" + timing + "<strong>" + html(item.title) + "</strong><p>" + html(item.detail) + "</p>" + source(item.url, item.publisher) + "</article>";
}

function roleRow(role) {
  const holder = role.name ? "<strong>" + html(role.name) + "</strong>" : '<span class="role-open">Holder to identify</span>';
  return '<div class="role"><p class="tagged">' + html(role.role) + "</p><p>" + holder +
    '<br><span class="small">' + html(role.title) + '</span></p><p class="small">' + html(role.status) +
    (role.url ? "<br>" + source(role.url, "Role evidence") : "") + "</p></div>";
}

function brief(account) {
  const badgeClass = account.score >= 88 ? " high" : account.score < 79 ? " watch" : "";
  const fit = rubric.map((dimension) =>
    "<div><span>" + html(dimension.label) + "</span><strong>" + account.points[dimension.key] + " / " + dimension.max +
    '</strong><progress aria-label="' + html(dimension.label) + '" max="' + dimension.max + '" value="' + account.points[dimension.key] + '"></progress></div>'
  ).join("");
  return `
    <article class="panel brief" data-brief="${html(account.id)}" aria-labelledby="brief-title">
      <header class="brief-header">
        <div>
          <p class="eyebrow">Account Action Brief</p>
          <h2 id="brief-title" tabindex="-1">${html(account.name)}</h2>
          <p class="title-line">${html(account.segment)} · ${html(account.location)} · ${html(account.domain)}</p>
        </div>
        <div class="score-box"><strong>${account.score}</strong><small>Fit / 100</small><br><span class="badge${badgeClass}">${html(account.priority)}</span></div>
      </header>
      <div class="summary"><p><strong>${html(account.workflow)}</strong></p><p>${html(account.fit)}</p></div>
      <section class="section">
        <h3>Evidence behind the brief</h3>
        <div class="evidence-grid">${evidence(account).slice(0, 2).map((item) => evidenceTile(item)).join("")}</div>
        <p class="small" style="margin-top: 7px">${html(account.awardContext)}</p>
      </section>
      <section class="section">
        <h3>Buying hypothesis</h3>
        <div class="pair">
          <div class="tile"><strong>Why it may matter</strong><p>${html(account.hypothesis)}</p></div>
          <div class="tile"><strong>What to validate</strong><p>${html(account.validation)}</p></div>
        </div>
        <div class="fit-grid" aria-label="Fit score breakdown">${fit}</div>
      </section>
      <section class="section">
        <h3>Stakeholder map</h3>
        <div class="roles">${account.stakeholders.map(roleRow).join("")}</div>
        <p class="small">Roles in the buying process are hypotheses. Confirm the site owner and approval path in discovery.</p>
      </section>
      <section class="section">
        <h3>Recommended next action</h3>
        <p>${html(account.next)}</p>
      </section>
      <section class="section outreach">
        <div class="panel-head">
          <div><strong>Personalized outreach draft</strong><p class="small">For review before sending</p></div>
          <div class="actions">
            <button class="btn primary" type="button" data-action="copy" data-id="${html(account.id)}">Copy draft</button>
            <button class="btn" type="button" data-action="brief" data-id="${html(account.id)}">Download brief</button>
          </div>
        </div>
        <div class="outreach-body"><p><strong>Subject</strong> · ${html(account.outreach.subject)}</p><pre class="draft">${html(account.outreach.body)}</pre></div>
      </section>
    </article>`;
}

function renderAccounts() {
  const segments = Array.from(new Set(accounts.map((account) => account.segment))).sort();
  view.innerHTML = `
    <div class="tools">
      <label class="field search">Search accounts or stakeholders
        <input id="account-query" type="search" placeholder="e.g. quality, Hexcel, Miami" value="${html(state.query)}">
      </label>
      <label class="field">Segment <select id="segment">${options([["", "All segments"], ...segments.map((segment) => [segment, segment])], state.segment)}</select></label>
      <label class="field">Sort by <select id="sort">${options([["score", "Fit score"], ["signal", "Newest signal"], ["name", "Account name"]], state.order)}</select></label>
      <button class="btn" type="button" data-action="csv">Export filtered CSV</button>
    </div>
    <div class="layout">
      <aside class="panel account-panel" aria-labelledby="account-list-title">
        <div class="panel-head"><h2 id="account-list-title">Qualified accounts</h2><span id="match-count" class="small" aria-live="polite"></span></div>
        <div class="account-list" id="account-list"></div>
      </aside>
      <div id="brief"></div>
    </div>`;
  updateAccounts();
}

function updateAccounts() {
  const matches = visibleAccounts();
  const account = matches.find((match) => match.id === state.account) ?? matches[0];
  if (account) state.account = account.id;
  document.querySelector("#match-count").textContent = matches.length + " of " + accounts.length;
  document.querySelector("#account-list").innerHTML = matches.map((match) => `
    <button class="account" type="button" data-account="${html(match.id)}" aria-pressed="${match.id === state.account}">
      <span><strong>${html(match.name)}</strong><small>${html(match.segment)} · ${html(match.priority)}</small></span>
      <span class="score-tag" aria-label="${match.score} out of 100">${match.score}</span>
    </button>`).join("");
  document.querySelector("#brief").innerHTML = account ? brief(account) :
    '<div class="panel empty"><h2>No matching accounts</h2><p>Try a different query or clear the segment filter.</p></div>';
}

function renderEvidence() {
  const included = state.evidenceAccount ? accounts.filter((account) => account.id === state.evidenceAccount) : accounts;
  view.innerHTML = `
    <section class="panel evidence-view">
      <h2>Evidence library</h2>
      <p class="small">Award records, dated commercial signals, and public role evidence.</p>
      <div class="tools" style="margin-top: 13px">
        <label class="field">Account <select id="evidence-account">${options([["", "All accounts"], ...accounts.map((account) => [account.id, account.name])], state.evidenceAccount)}</select></label>
      </div>
      <div class="evidence-list">${included.flatMap((account) => evidence(account).map((item) => evidenceTile(item, account.name))).join("")}</div>
    </section>`;
}

function renderMethod() {
  view.innerHTML = `
    <section class="panel method">
      <h2>Qualification methodology</h2>
      <p>Every selected account has a verified U.S. DoD award record tied to a named recipient and a separate public commercial manufacturing or MRO signal. The operational fit is based on the public MASS Group TME® product scope.</p>
      <h3>How fit is scored</h3>
      <ul>${rubric.map((dimension) => "<li><strong>" + html(dimension.label) + " · " + dimension.max +
        " points.</strong> " + html(dimension.explanation) + "</li>").join("")}</ul>
      <p><strong>88–100</strong> Prioritize · <strong>79–87</strong> Explore · <strong>Below 79</strong> Monitor.</p>
      <p>The score is an exploratory ranking. Discovery should validate site ownership, current systems, the change window, and the budget path.</p>
      <h3>Federal award data</h3>
      <p>USAspending Advanced Award Search, DoD awarding agency and prime contract types A–D, recipient-name query and a ${date(meta.startDate)}–${date(meta.asOf)} search window. Awards can appear in this window because of transactions on an earlier award. The dataset retains one reviewed record per account. Displayed amounts are the API's award-level reported amounts. They describe the federal award and are separate from software spending.</p>
      <p class="small">${source(meta.apiDocs, "USAspending API documentation")} · <code>POST ${html(new URL(meta.api).pathname)}</code></p>
      <h3>Commercial signals and stakeholder evidence</h3>
      <p>Company announcements, annual reports, and SEC filings supply the dated operating signals. Deepline Native People Search ran in free-only mode for ${meta.deeplineSearches} company domains. Company pages and public professional profiles corroborate names and roles. Role-only slots identify the approval path to verify.</p>
      <p class="small">${source(meta.mass, "MASS Group aerospace and defense product scope")} · ${source(meta.deepline, "Deepline GTM skill")}</p>
      <h3>Research boundaries</h3>
      <p>This snapshot uses public sources and recorded ${meta.credits} Deepline credits. It contains public names and job titles, source URLs, and unsent draft copy. Existing tools, active MES buying intent, incumbent status, and account ownership require validation.</p>
    </section>`;
}

function readRoute() {
  const [section, accountId] = location.hash.slice(1).split("/");
  state.view = ["accounts", "evidence", "method"].includes(section) ? section : "accounts";
  if (accounts.some((account) => account.id === accountId)) state.account = accountId;
}

function renderRoute() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    if (button.dataset.view === state.view) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  ({ accounts: renderAccounts, evidence: renderEvidence, method: renderMethod })[state.view]();
}

function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvCell(value) {
  const text = String(value ?? "");
  const safeText = /^[=+\-@\t\r]/.test(text) ? "'" + text : text;
  return '"' + safeText.replaceAll('"', '""') + '"';
}

function exportCsv() {
  const matches = visibleAccounts();
  if (!matches.length) {
    showToast("There are no filtered accounts to export.");
    return;
  }
  const rows = [
    ["Account", "Domain", "Segment", "Fit score", "Priority", "Workflow", "Signal date", "Public signal", "Commercial source", "Award ID", "Award date", "Award source", "Lead stakeholder", "Lead role", "Lead source", "Next action"],
    ...matches.map((account) => [
      account.name, account.domain, account.segment, account.score, account.priority, account.workflow,
      account.signal.date, account.signal.fact, account.signal.url, account.award.id, account.award.date, account.award.url,
      account.stakeholders[0].name, account.stakeholders[0].title, account.stakeholders[0].url, account.next
    ])
  ];
  download("mass-group-account-shortlist.csv", "\ufeff" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n"), "text/csv;charset=utf-8");
  showToast("Shortlist exported.");
}

function exportBrief(account) {
  const sections = [
    "# Account Action Brief · " + account.name,
    ["Snapshot " + meta.asOf, account.segment, "Fit " + account.score + "/100 · " + account.priority].join("\n"),
    "## Fit\n" + account.workflow + "\n" + account.fit,
    "## Evidence\n" + evidence(account).slice(0, 2).map((item) => "- " + item.date + " · " + item.title + ". " + item.detail + " [" + item.publisher + "](" + item.url + ")").join("\n"),
    "## Buying hypothesis\n" + account.hypothesis + "\n\nValidate: " + account.validation,
    "## Stakeholders\n" + account.stakeholders.map((role) => "- " + role.role + " · " + (role.name ?? "Holder to identify") + " · " + role.title + " · " + role.status + (role.url ? " [Role evidence](" + role.url + ")" : "")).join("\n"),
    "## Next action\n" + account.next,
    "## Draft for review\nSubject: " + account.outreach.subject + "\n\n" + account.outreach.body
  ];
  download("mass-group-" + account.id + "-brief.md", sections.join("\n\n") + "\n", "text/markdown;charset=utf-8");
  showToast("Account brief downloaded.");
}

async function copyDraft(account) {
  const text = "Subject: " + account.outreach.subject + "\n\n" + account.outreach.body;
  try {
    await navigator.clipboard.writeText(text);
    showToast("Draft copied.");
  } catch {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(document.querySelector(".outreach-body"));
    selection.removeAllRanges();
    selection.addRange(range);
    showToast("Draft selected. Press Ctrl+C or Command+C to copy.");
  }
}

document.querySelector("#snapshot-date").textContent = "PUBLIC SNAPSHOT · " + date(meta.asOf);
const metrics = [
  [accounts.length, "Qualified accounts"],
  [accounts.length, "DoD award records"],
  [accounts.reduce((sum, account) => sum + account.stakeholders.filter((role) => role.name).length, 0), "Named stakeholders"],
  ["$0", "External data spend"]
];
document.querySelector("#metrics").innerHTML = metrics.map(([value, label]) =>
  '<div class="metric"><strong>' + html(value) + "</strong><span>" + html(label) + "</span></div>"
).join("");

document.querySelector(".nav").addEventListener("click", (event) => {
  const button = event.target.closest("[data-view]");
  if (!button) return;
  const target = button.dataset.view;
  location.hash = target === "accounts" ? "accounts/" + state.account : target;
});

view.addEventListener("input", (event) => {
  if (event.target.id !== "account-query") return;
  state.query = event.target.value;
  updateAccounts();
});

view.addEventListener("change", (event) => {
  const fields = { segment: "segment", sort: "order", "evidence-account": "evidenceAccount" };
  const field = fields[event.target.id];
  if (!field) return;
  state[field] = event.target.value;
  if (field === "evidenceAccount") {
    renderEvidence();
    document.querySelector("#evidence-account").focus();
  } else {
    updateAccounts();
  }
});

view.addEventListener("click", (event) => {
  const accountButton = event.target.closest("[data-account]");
  if (accountButton) {
    state.account = accountButton.dataset.account;
    history.replaceState(null, "", "#accounts/" + state.account);
    updateAccounts();
    if (matchMedia("(max-width: 720px)").matches) {
      document.querySelector("#brief-title").focus();
    } else {
      document.querySelector("[data-account][aria-pressed='true']").focus({ preventScroll: true });
    }
    return;
  }
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const account = accounts.find((entry) => entry.id === button.dataset.id);
  if (button.dataset.action === "csv") exportCsv();
  if (button.dataset.action === "brief" && account) exportBrief(account);
  if (button.dataset.action === "copy" && account) void copyDraft(account);
});

window.addEventListener("hashchange", () => {
  if (location.hash === "#main") return;
  readRoute();
  renderRoute();
});

readRoute();
renderRoute();
