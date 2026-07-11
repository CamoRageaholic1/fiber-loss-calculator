import test from "node:test";
import assert from "node:assert/strict";

import {
  applyProfileDefaults,
  calculateLink,
  createScenario,
  fromKilometers,
  idealSplitterLoss,
  syncFiberDefaults,
  toKilometers,
  validateScenario,
} from "../src/calculator.js";
import { formatNumber } from "../src/format.js";

const closeTo = (actual, expected, tolerance = 1e-12) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} ≈ ${expected}`);

test("feet and kilometers convert without changing physical length", () => {
  closeTo(toKilometers(3280.83989501312, "ft"), 1);
  closeTo(fromKilometers(1, "ft"), 3280.83989501312);
  closeTo(toKilometers(10000, "ft"), 3.048);
});

test("integer formatting never strips significant trailing zeroes", () => {
  assert.equal(formatNumber(1000, 0), "1000");
  assert.equal(formatNumber(10000, 0), "10000");
  assert.equal(formatNumber(1000.5, 2), "1000.5");
});

test("FOA typical OS2 example calculates every passive subtotal", () => {
  const scenario = createScenario({
    lengthKm: 10,
    fiberType: "os2",
    wavelengthNm: 1310,
    profile: "typical",
    connections: 2,
    fusionSplices: 4,
    mechanicalSplices: 0,
    txPowerDbm: -3,
    txMaxDbm: 0,
    rxSensitivityDbm: -20,
    rxOverloadDbm: 0,
    engineeringMarginDb: 3,
  });
  const link = calculateLink(scenario);
  closeTo(link.selected.fiberDb, 4);
  closeTo(link.selected.connectionDb, 0.6);
  closeTo(link.selected.fusionSpliceDb, 0.6);
  closeTo(link.selected.totalDb, 5.2);
  closeTo(link.predictedRxDbm, -8.2);
  closeTo(link.rawHeadroomDb, 11.8);
  closeTo(link.designHeadroomDb, 8.8);
  assert.equal(link.status, "pass");
});

test("ANSI/TIA maximum profile applies worst-case component allowances", () => {
  const scenario = createScenario({
    lengthKm: 2,
    fiberType: "om4",
    wavelengthNm: 850,
    profile: "tia",
    connections: 4,
    fusionSplices: 2,
    txPowerDbm: -4,
    txMaxDbm: -1,
    rxSensitivityDbm: -18,
    rxOverloadDbm: 0,
    engineeringMarginDb: 3,
  });
  const link = calculateLink(scenario);
  closeTo(link.selected.totalDb, 10.6);
  closeTo(link.predictedRxDbm, -14.6);
  closeTo(link.designHeadroomDb, 0.4);
  assert.equal(link.status, "review");
});

test("profile changes update editable fiber and event coefficients", () => {
  const scenario = createScenario({ fiberType: "os2", wavelengthNm: 1550 });
  applyProfileDefaults(scenario, "tia");
  assert.equal(scenario.attenuationDbPerKm, 0.5);
  assert.equal(scenario.connectionDb, 0.75);
  assert.equal(scenario.fusionSpliceDb, 0.3);
  applyProfileDefaults(scenario, "typical");
  assert.equal(scenario.attenuationDbPerKm, 0.3);
  assert.equal(scenario.connectionDb, 0.3);
  assert.equal(scenario.fusionSpliceDb, 0.15);
});

test("fiber changes constrain wavelength and preserve standard source", () => {
  const scenario = createScenario({ fiberType: "os2", wavelengthNm: 1550, profile: "typical" });
  scenario.fiberType = "om3";
  syncFiberDefaults(scenario);
  assert.equal(scenario.wavelengthNm, 850);
  assert.equal(scenario.attenuationDbPerKm, 3);
});

test("splitter stages add only the selected path insertion loss", () => {
  const scenario = createScenario({
    lengthKm: 20,
    fiberType: "os2",
    wavelengthNm: 1550,
    connections: 2,
    fusionSplices: 10,
    splitters: [
      { id: "a", ratio: "1:4", quantity: 1, lossDb: 6.8 },
      { id: "b", ratio: "1:8", quantity: 1, lossDb: 10 },
    ],
    txPowerDbm: 3,
    txMaxDbm: 5,
    rxSensitivityDbm: -28,
    rxOverloadDbm: -5,
    engineeringMarginDb: 3,
  });
  const link = calculateLink(scenario);
  closeTo(link.selected.splitterDb, 16.8);
  closeTo(link.selected.totalDb, 24.9);
  closeTo(link.predictedRxDbm, -21.9);
  closeTo(link.designHeadroomDb, 3.1);
});

test("repeated splitter quantity multiplies stages, not output ports", () => {
  const scenario = createScenario({
    lengthKm: 0,
    connections: 0,
    splitters: [{ id: "a", ratio: "1:8", quantity: 2, lossDb: 10 }],
  });
  assert.equal(calculateLink(scenario).selected.splitterDb, 20);
});

test("ideal symmetrical splitter loss follows 10 log10 N", () => {
  closeTo(idealSplitterLoss(32), 15.051499783199061);
});

test("custom passive rows retain their separate equations", () => {
  const scenario = createScenario({
    lengthKm: 0,
    connections: 0,
    extras: [
      { id: "a", label: "WDM", quantity: 2, lossDb: 1.25 },
      { id: "b", label: "Filter", quantity: 3, lossDb: 0.4 },
    ],
  });
  closeTo(calculateLink(scenario).selected.extraDb, 3.7);
});

test("exact design boundary passes with zero headroom", () => {
  const scenario = createScenario({
    profile: "custom",
    lengthKm: 0,
    connections: 0,
    extras: [{ id: "loss", label: "Loss", quantity: 1, lossDb: 10 }],
    txPowerDbm: -5,
    txMaxDbm: -5,
    rxSensitivityDbm: -18,
    rxOverloadDbm: 0,
    engineeringMarginDb: 3,
  });
  const link = calculateLink(scenario);
  closeTo(link.designHeadroomDb, 0);
  assert.equal(link.status, "review");
});

test("loss above the design boundary fails", () => {
  const scenario = createScenario({
    profile: "custom",
    lengthKm: 0,
    connections: 0,
    extras: [{ id: "loss", label: "Loss", quantity: 1, lossDb: 10.01 }],
    txPowerDbm: -5,
    txMaxDbm: -5,
    rxSensitivityDbm: -18,
    rxOverloadDbm: 0,
    engineeringMarginDb: 3,
  });
  closeTo(calculateLink(scenario).designHeadroomDb, -0.01);
  assert.equal(calculateLink(scenario).status, "fail");
});

test("maximum transmitter power drives receiver overload check", () => {
  const scenario = createScenario({
    profile: "custom",
    lengthKm: 0,
    connections: 0,
    extras: [{ id: "loss", label: "Loss", quantity: 1, lossDb: 5 }],
    txPowerDbm: -2,
    txMaxDbm: 0,
    rxSensitivityDbm: -20,
    rxOverloadDbm: -8,
    minimumPlantLossDb: 5,
    engineeringMarginDb: 3,
  });
  const link = calculateLink(scenario);
  closeTo(link.predictedRxMaxDbm, -5);
  closeTo(link.overloadHeadroomDb, -3);
  assert.equal(link.isOverloaded, true);
  assert.equal(link.overloadDefinitive, true);
  assert.equal(link.status, "fail");
});

test("overload remains advisory without an explicit minimum-loss bound", () => {
  const scenario = createScenario({
    profile: "custom",
    lengthKm: 0,
    connections: 0,
    extras: [{ id: "loss", label: "Loss", quantity: 1, lossDb: 5 }],
    txPowerDbm: -2,
    txMaxDbm: 0,
    rxSensitivityDbm: -20,
    rxOverloadDbm: -8,
    minimumPlantLossDb: null,
    engineeringMarginDb: 3,
  });
  const link = calculateLink(scenario);
  assert.equal(link.isOverloaded, true);
  assert.equal(link.overloadDefinitive, false);
  assert.equal(link.status, "review");
});

test("OLTS reference method adjusts only end-connection allowance", () => {
  const base = createScenario({ lengthKm: 0, connections: 4, connectionDb: 0.3 });
  const one = calculateLink({ ...base, referenceMethod: "1-cord" });
  const two = calculateLink({ ...base, referenceMethod: "2-cord" });
  const three = calculateLink({ ...base, referenceMethod: "3-cord" });
  closeTo(one.selectedTestLimitDb, 1.2);
  closeTo(two.selectedTestLimitDb, 0.9);
  closeTo(three.selectedTestLimitDb, 0.6);
});

test("measurement uncertainty creates a review band near the test limit", () => {
  const scenario = createScenario({
    lengthKm: 0,
    connections: 2,
    profile: "tia",
    measuredLossDb: 1.7,
    measurementUncertaintyDb: 0.3,
  });
  const link = calculateLink(scenario);
  closeTo(link.tiaTestLimitDb, 1.5);
  assert.equal(link.measurement.status, "review");
});

test("measurement below the limit still reviews when uncertainty crosses it", () => {
  const scenario = createScenario({
    lengthKm: 0,
    connections: 2,
    profile: "tia",
    measuredLossDb: 1.4,
    measurementUncertaintyDb: 0.3,
  });
  const link = calculateLink(scenario);
  closeTo(link.tiaTestLimitDb, 1.5);
  assert.equal(link.measurement.status, "review");
});

test("invalid noninteger quantities cannot produce a pass", () => {
  const scenario = createScenario();
  scenario.fusionSplices = 1.5;
  const link = calculateLink(scenario);
  assert.equal(link.status, "invalid");
  assert.ok(link.errors.some((error) => error.code === "NON_INTEGER_QUANTITY"));
});

test("negative custom component loss is rejected", () => {
  const scenario = createScenario({ extras: [{ id: "bad", label: "Bad", quantity: 1, lossDb: -0.1 }] });
  const validation = validateScenario(scenario);
  assert.ok(validation.errors.some((error) => error.code === "INVALID_LOSS"));
});

test("invalid transmitter and receiver windows are rejected", () => {
  const scenario = createScenario({ txPowerDbm: 1, txMaxDbm: 0, rxSensitivityDbm: -8, rxOverloadDbm: -20 });
  const codes = validateScenario(scenario).errors.map((error) => error.code);
  assert.ok(codes.includes("INVALID_TX_WINDOW"));
  assert.ok(codes.includes("INVALID_RECEIVER_WINDOW"));
});

test("nonnumeric receiver overload and minimum loss are rejected", () => {
  const scenario = createScenario();
  scenario.rxOverloadDbm = "not-a-number";
  scenario.minimumPlantLossDb = -1;
  const codes = validateScenario(scenario).errors.map((error) => error.code);
  assert.ok(codes.includes("INVALID_POWER"));
  assert.ok(codes.includes("INVALID_MINIMUM_LOSS"));
});

test("blank power-window inputs are rejected instead of becoming zero", () => {
  const scenario = createScenario();
  scenario.txMaxDbm = "";
  scenario.rxOverloadDbm = "";
  assert.ok(validateScenario(scenario).errors.some((error) => error.code === "INVALID_POWER"));
  assert.equal(calculateLink(scenario).status, "invalid");
});

test("shared scenario row identifiers are normalized and deduplicated", () => {
  const scenario = createScenario({
    splitters: [
      { id: '\"><img src=x onerror=alert(1)>', ratio: "1:2", quantity: 1, lossDb: 3.6 },
      { id: '\"><img src=x onerror=alert(1)>', ratio: "1:4", quantity: 1, lossDb: 6.8 },
    ],
  });
  assert.match(scenario.splitters[0].id, /^[a-zA-Z0-9_-]+$/);
  assert.notEqual(scenario.splitters[0].id, scenario.splitters[1].id);
});

test("calculation does not mutate a deeply frozen scenario", () => {
  const scenario = createScenario({ splitters: [{ id: "a", ratio: "1:2", quantity: 1, lossDb: 3.6 }] });
  Object.freeze(scenario.splitters[0]);
  Object.freeze(scenario.splitters);
  Object.freeze(scenario.extras);
  Object.freeze(scenario);
  assert.doesNotThrow(() => calculateLink(scenario));
});
