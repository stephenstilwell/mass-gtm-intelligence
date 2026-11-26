# MASS Group GTM intelligence prototype

Open `index.html` directly in a browser. The single file contains the data, styles, and interaction code. It also works as the root `index.html` of a GitHub Pages publishing branch or folder.

The dashboard includes ten Account Action Briefs, the public evidence behind each brief, named and role-based stakeholders, and draft outreach. Search, segment filtering, sorting, filtered CSV export, brief downloads, and draft copying run in the browser. The snapshot is dated November 25, 2026.

## Rebuild the dashboard

Use Node.js 22 or newer. No package installation or credentials are needed.

```powershell
node .\build.mjs
```

Edit the reviewed commercial evidence, stakeholder map, and copy in `src/accounts.json`. The selected federal award records are in `src/awards.json`.

## Retrieve government award candidates

```powershell
$awardFile = Join-Path ([System.IO.Path]::GetTempPath()) 'mass-gtm-award-candidates.json'
.\refresh-awards.ps1 -EndDate '2026-11-25' -OutFile $awardFile
node .\build.mjs $awardFile
```

The script queries the public USAspending award search by recipient name. It limits results to DoD prime contract records and retains up to twelve candidates for each named account. Review subsidiary identity and award relevance before changing the selected award IDs. For a later snapshot, update the dates and evidence in `src/accounts.json` before rebuilding.

## Source and cost notes

- USAspending supplies federal award evidence. Company reports and SEC filings supply commercial signals, and company leadership pages corroborate public names and roles.
- Deepline GTM, Research, and Scoring guided the source and qualification workflow. Ten Deepline Native People Search requests used the `free_only` setting and returned a combined zero-credit receipt total. Candidate titles from that search are marked for verification.
- The fit score is a research prioritization rubric. It uses dated evidence of operating fit and change, federal-award recency, and quality of the stakeholder evidence. Buyer ownership, an active evaluation, and a software budget remain discovery questions.
- The dataset contains public business facts and professional roles. The drafts use one public signal per account and are available for review in the dashboard.
