# Fiber Ledger

Fiber Ledger is a browser-local optical link-loss and power-budget workstation. It calculates one selected end-to-end fiber path, exposes every equation, compares FOA typical planning values with ANSI/TIA maximum component allowances, and produces field-ready Excel and PDF reports.

Production: [fibercalc.camozeroday.dev](https://fibercalc.camozeroday.dev)

## What it calculates

- Length in feet or kilometers with exact unit preservation
- OM1–OM5 and OS1/OS2 planning profiles at supported wavelengths
- Fiber attenuation, mated connection pairs, fusion splices, and mechanical splices
- Cascaded 1:2 through 1:64 splitter stages on the selected optical path
- Any number of custom passive components
- Selected, FOA typical, and ANSI/TIA maximum plant-loss totals
- Equipment power budget, predicted receive-power window, design headroom, and overload risk
- One-, two-, and three-cord OLTS reference-method adjustments
- Optional field-loss result with a separate measurement-uncertainty review band

Every value remains editable. A custom value is never presented as an ANSI/TIA requirement.

## Reports and sharing

- Native `.xlsx` workbook with inputs, every line-item equation, totals, field comparison, and references
- Native `.pdf` calculation report
- Full `.json` scenario/result archive
- Print-optimized report
- URL-fragment share link (not sent in HTTP requests) and local autosave

All calculations and exports run in the browser. No scenario data is uploaded.

## Local use

```bash
npm test
npm run build
npm start
```

Open `http://127.0.0.1:4174`.

## Standards basis

The open methodology and values are documented in [STANDARDS.md](STANDARDS.md). The primary basis is the FOA 2025 installation standard, including its open summary of ANSI/TIA-568 maximum allowances, plus the current TIA announcement for ANSI/TIA-568.3-E.

This calculator is a planning and audit aid. It does not certify compliance; the project specification, equipment application standard, manufacturer data, and current purchased standards govern acceptance.

## Deployment

Every push to `main` runs the calculation/export suite, builds a deterministic static artifact, deploys to Cloudflare Pages, and smoke-tests the deployment. See [DEPLOYMENT.md](DEPLOYMENT.md).
