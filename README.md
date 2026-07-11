# Fiber Ledger

Fiber Ledger v1.1 is a browser-local optical link-loss, PON, and power-budget workstation. It calculates an end-to-end fiber path, exposes every equation, compares FOA typical planning values with ANSI/TIA maximum component allowances, and produces field-ready Excel and PDF reports.

Production: [fibercalc.camozeroday.dev](https://fibercalc.camozeroday.dev)

## What it calculates

- Length in feet or kilometers with exact unit preservation
- OM1–OM5 and OS1/OS2 planning profiles at supported wavelengths
- Fiber attenuation, mated connection pairs, fusion splices, and mechanical splices
- Cascaded 1:2 through 1:128 splitter stages on the selected optical path
- Any number of custom passive components
- Selected, FOA typical, and ANSI/TIA maximum plant-loss totals
- Equipment power budget, predicted receive-power window, design headroom, and overload risk
- GPON B+ + XGS-PON N1 coexistence preset over one shared ODN
- Separate downstream result cards for GPON at 1490 nm and XGS-PON at 1577 nm, with 1310 nm and 1270 nm upstream references
- Editable downstream and upstream coexistence-element insertion loss for each PON channel
- Forward/reverse OTDR averaging and paired OLT/ONT downstream and upstream telemetry comparisons
- Optional field-result uncertainty for diagnostic review

Every value remains editable. A custom value is never presented as an ANSI/TIA requirement.

## Reports and sharing

- Native `.xlsx` workbook with inputs, every line-item equation, totals, both PON outputs, field comparison, and references
- Native `.pdf` calculation report with both PON outputs
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

This calculator is a planning, diagnostic-comparison, and audit aid. Its OTDR/OLT comparison is not a certification result and does not replace calibrated OLTS/LSPM insertion-loss acceptance testing. The project specification, equipment application standard, manufacturer data, and current purchased standards govern acceptance.

## Deployment

Every push to `main` runs the calculation/export suite, builds a deterministic static artifact, deploys to Cloudflare Pages, and smoke-tests the deployment. See [DEPLOYMENT.md](DEPLOYMENT.md).
