import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const read = (file) => readFile(new URL(file, import.meta.url), "utf8");
const parse = (text) => JSON.parse(text.replace(/^\uFEFF/, ""));
const record = (file) => read(file).then(parse);
const data = await record("./src/accounts.json");
const snapshotFile = new URL("./src/awards.json", import.meta.url);

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

function validDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value));
}

function https(value) {
  return typeof value === "string" && URL.canParse(value) && new URL(value).protocol === "https:";
}

const [candidatesFile] = process.argv.slice(2);
if (candidatesFile) {
  const candidates = parse(await readFile(resolve(candidatesFile), "utf8"));
  requireValue(candidates.startDate === data.meta.startDate && candidates.endDate === data.meta.asOf,
    "Award retrieval dates must match the methodology.");
  const awards = Object.fromEntries(data.accounts.map((account) => {
    const group = candidates.accounts.find((entry) => entry.account === account.id);
    const row = group?.rows.find((award) => award["Award ID"] === account.awardId);
    requireValue(row && row.generated_internal_id, "Selected award missing from API response: " + account.awardId);
    return [account.id, {
      id: row["Award ID"],
      date: row["Start Date"],
      recipient: row["Recipient Name"],
      amount: row["Award Amount"],
      agency: row["Awarding Sub Agency"],
      url: "https://www.usaspending.gov/award/" + encodeURIComponent(row.generated_internal_id)
    }];
  }));
  await writeFile(snapshotFile, JSON.stringify(awards, null, 2) + "\n");
}

const awards = await record("./src/awards.json");
const { meta, rubric } = data;
requireValue(data.accounts.length === 10 && new Set(data.accounts.map((account) => account.id)).size === 10,
  "The shortlist must contain ten distinct accounts.");
requireValue(meta.credits === 0 && meta.deeplineSearches === 10, "The prototype requires ten free-only searches at zero credits.");
requireValue(rubric.reduce((sum, dimension) => sum + dimension.max, 0) === 100, "Score maxima must total 100.");

const accounts = data.accounts.map((account) => {
  const award = awards[account.id];
  requireValue(award?.id === account.awardId && validDate(award.date) && Number.isFinite(award.amount) &&
    award.recipient && award.agency && https(award.url), account.id + ": invalid federal evidence.");
  requireValue(validDate(account.signal.date) && account.signal.date <= meta.asOf && https(account.signal.url),
    account.id + ": invalid commercial evidence.");
  requireValue(account.stakeholders.length >= 3 &&
    account.stakeholders.some((person) => person.name && person.status === "Company-confirmed") &&
    account.stakeholders.every((person) => person.name ? https(person.url) : !person.url),
    account.id + ": a named public sponsor and complete stakeholder role map are required.");
  requireValue(account.outreach.subject && account.outreach.body && account.next && account.validation,
    account.id + ": incomplete action brief.");
  const ageInDays = (Date.parse(meta.asOf) - Date.parse(award.date)) / 86400000;
  const awardPoints = ageInDays <= 365 ? 25 : ageInDays <= 730 ? 21 : 17;
  const confirmed = account.stakeholders.filter((person) => person.status === "Company-confirmed").length;
  const named = account.stakeholders.filter((person) => person.name).length;
  const access = confirmed >= 2 ? 15 : named >= 2 ? 12 : 10;
  const points = { fit: account.operationalFit, timing: account.signalSpecificity, award: awardPoints, access };
  requireValue(rubric.every(({ key, max }) => Number.isInteger(points[key]) && points[key] >= 0 && points[key] <= max),
    account.id + ": score is outside its rubric bounds.");
  const score = Object.values(points).reduce((sum, value) => sum + value, 0);
  const priority = score >= 88 ? "Prioritize" : score >= 79 ? "Explore" : "Monitor";
  return { ...account, award, score, points, priority };
}).sort((first, second) => second.score - first.score || second.signal.date.localeCompare(first.signal.date));

const [template, app] = await Promise.all([read("./src/dashboard.html"), read("./src/dashboard.js")]);
const safeJson = JSON.stringify({ accounts, meta, rubric }).replaceAll("<", "\\u003c");
const index = template.replace("__SNAPSHOT__", () => safeJson).replace("__APP__", () => app);
await writeFile(new URL("./index.html", import.meta.url), index);
console.log("Built standalone dashboard with " + accounts.length + " Account Action Briefs.");
