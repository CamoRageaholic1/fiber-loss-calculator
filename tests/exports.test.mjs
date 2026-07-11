import test from "node:test";
import assert from "node:assert/strict";

import { calculateLink, createScenario } from "../src/calculator.js";
import { PRESETS } from "../src/config.js";
import { buildReport, createPdfBytes, createXlsxBytes } from "../src/exporters.js";

test("XLSX export is a ZIP-based OOXML workbook with equations and sources", () => {
  const report = buildReport(calculateLink(createScenario()), new Date("2026-07-10T12:00:00Z"));
  const bytes = createXlsxBytes(report);
  assert.equal(String.fromCharCode(...bytes.slice(0, 2)), "PK");
  const text = new TextDecoder().decode(bytes);
  assert.match(text, /xl\/worksheets\/sheet1\.xml/);
  assert.match(text, /Passive plant loss/);
  assert.match(text, /TIA component allowances/);
  assert.match(text, /Tx minimum/);
  assert.match(text, /Rx overload/);
  assert.match(text, /Overload headroom/);
  assert.match(text, /FOA Installation Standard 2025 V1/);
});

test("PDF export contains a valid catalog, pages, calculations, and EOF marker", () => {
  const report = buildReport(calculateLink(createScenario()), new Date("2026-07-10T12:00:00Z"));
  const text = new TextDecoder().decode(createPdfBytes(report));
  assert.ok(text.startsWith("%PDF-1.4"));
  assert.match(text, /\/Type \/Catalog/);
  assert.match(text, /LOSS LEDGER/);
  assert.match(text, /RESULT:/);
  assert.ok(text.endsWith("%%EOF"));
});

test("definitive budget failure outranks a selected-loss overload advisory", () => {
  const scenario = createScenario({
    profile: "custom",
    lengthKm: 0,
    connections: 0,
    extras: [{ id: "loss", label: "Loss", quantity: 1, lossDb: 2 }],
    txPowerDbm: 0,
    txMaxDbm: 10,
    rxSensitivityDbm: -1,
    rxOverloadDbm: 1,
    engineeringMarginDb: 0,
    minimumPlantLossDb: null,
  });
  const link = calculateLink(scenario);
  const report = buildReport(link);
  assert.equal(link.status, "fail");
  assert.ok(link.designHeadroomDb < 0);
  assert.equal(link.overloadDefinitive, false);
  assert.equal(link.isOverloaded, true);
  assert.match(report.status, /^FAIL — usable loss budget exceeded/);
  assert.match(report.status, /overload advisory also triggered/);
});

test("report includes a row for every splitter and custom passive component", () => {
  const scenario = createScenario({
    splitters: [{ id: "s", ratio: "1:4", quantity: 1, lossDb: 6.8 }],
    extras: [{ id: "e", label: "CWDM", quantity: 2, lossDb: 0.7 }],
  });
  const report = buildReport(calculateLink(scenario));
  assert.ok(report.rows.some((row) => row.label.includes("1:4 splitter")));
  assert.ok(report.rows.some((row) => row.label === "CWDM"));
  assert.ok(report.rows.every((row) => row.equation.includes("=")));
});

test("v1.1 reports export both PON outputs, 1:128, OTDR, telemetry, and creator attribution", () => {
  const scenario = createScenario({
    ...structuredClone(PRESETS.pon128.patch),
    otdrForwardLossDb: 26.1,
    otdrReverseLossDb: 26.5,
    otdrUncertaintyDb: 0.3,
    oltTxDbm: 4,
    ontRxDbm: -22.3,
    ontTxDbm: 2,
    oltRxDbm: -24.3,
  });
  const report = buildReport(calculateLink(scenario), new Date("2026-07-11T12:00:00Z"));
  assert.equal(report.version, "1.1");
  assert.equal(report.author, "David Osisek");
  assert.equal(report.outputs.length, 2);
  assert.deepEqual(report.outputs.map((output) => output.label), ["GPON B+", "XGS-PON N1"]);
  assert.deepEqual(
    report.outputs.map((output) => [output.downstreamWavelengthNm, output.upstreamWavelengthNm]),
    [[1490, 1310], [1577, 1270]],
  );
  assert.equal(report.outputs[0].upstreamAttenuationDbPerKm, 0.4);
  assert.equal(report.outputs[0].upstreamCoexistenceLossDb, 0.8);
  assert.equal(report.outputs[0].upstreamSelectedLossDb, 26.5);
  assert.ok(report.rows.some((row) => row.label.includes("1:128 splitter") && row.lossEachDb === 24));
  assert.equal(report.diagnostics.otdr.title, "OTDR loss comparison");
  assert.match(report.diagnostics.downstream.title, /Downstream OLT/);
  assert.match(report.diagnostics.upstream.title, /Upstream ONT/);

  const xlsxText = new TextDecoder().decode(createXlsxBytes(report));
  for (const expected of [
    /Fiber Ledger v1\.1/,
    /David Osisek/,
    /GPON B\+/,
    /XGS-PON N1/,
    /1:128 splitter/,
    /OTDR loss comparison/,
    /Downstream OLT/,
    /Upstream ONT/,
    /Upstream fiber attenuation/,
    /Upstream coexistence element/,
  ]) assert.match(xlsxText, expected);
  assert.doesNotMatch(xlsxText, /OLTS/i);

  const pdfText = new TextDecoder().decode(createPdfBytes(report));
  for (const expected of [
    /Fiber Ledger v1\.1/,
    /Created by David Osisek/,
    /GPON B\+/,
    /XGS-PON N1/,
    /1:128 splitter/,
    /OTDR loss comparison/,
    /Downstream OLT/,
    /Upstream ONT/,
    /Upstream fiber attenuation/,
    /Upstream coexistence element/,
  ]) assert.match(pdfText, expected);
  assert.doesNotMatch(pdfText, /OLTS/i);
});
