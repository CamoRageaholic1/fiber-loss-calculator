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
import { PRESETS, SPLITTERS } from "../src/config.js";
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

test("1:128 uses ideal 10 log10 loss while preserving editable 24 dB planning loss", () => {
  closeTo(idealSplitterLoss(128), 21.072099696478684, 1e-12);
  closeTo(SPLITTERS["1:128"].idealDb, 21.0721, 1e-7);
  assert.equal(SPLITTERS["1:128"].typicalDb, 24);
  assert.equal(PRESETS.pon128.patch.splitters[0].lossDb, 24);

  const scenario = createScenario(structuredClone(PRESETS.pon128.patch));
  closeTo(calculateLink(scenario).outputs[0].selected.splitterDb, 24);
  scenario.splitters[0].lossDb = 23.25;
  closeTo(calculateLink(scenario).outputs[0].selected.splitterDb, 23.25);
});

test("GPON and XGS-PON combo preset produces two independent wavelength outputs", () => {
  const scenario = createScenario(structuredClone(PRESETS.ponCombo.patch));
  const link = calculateLink(scenario);
  assert.equal(link.errors.length, 0);
  assert.equal(link.outputs.length, 2);

  const gpon = link.outputs.find((output) => output.technology === "GPON");
  const xgs = link.outputs.find((output) => output.technology === "XGS-PON");
  assert.ok(gpon);
  assert.ok(xgs);
  assert.notEqual(gpon.id, xgs.id);
  assert.deepEqual(
    [gpon.wavelengthNm, gpon.upstreamWavelengthNm, xgs.wavelengthNm, xgs.upstreamWavelengthNm],
    [1490, 1310, 1577, 1270],
  );
  closeTo(gpon.selected.attenuationDbPerKm, 0.3);
  closeTo(xgs.selected.attenuationDbPerKm, 0.3);
  closeTo(gpon.selected.fiberDb, 1.5);
  closeTo(xgs.selected.fiberDb, 1.5);
  closeTo(gpon.upstreamSelected.attenuationDbPerKm, 0.4);
  closeTo(xgs.upstreamSelected.attenuationDbPerKm, 0.4);
  closeTo(gpon.upstreamSelected.fiberDb, 2);
  closeTo(xgs.upstreamSelected.fiberDb, 2);
  closeTo(gpon.selected.coexistenceDb, 0.8);
  closeTo(xgs.selected.coexistenceDb, 1);
  closeTo(gpon.selected.totalDb, 23.6);
  closeTo(xgs.selected.totalDb, 23.8);
  closeTo(gpon.upstreamSelected.totalDb, 24.1);
  closeTo(xgs.upstreamSelected.totalDb, 24.3);
  assert.equal(gpon.status, "pass");
  assert.equal(xgs.status, "pass");
  assert.equal(link.status, "pass");

  scenario.channels.find((channel) => channel.technology === "GPON").coexistenceLossDb = 1.8;
  const changed = calculateLink(scenario);
  closeTo(changed.outputs.find((output) => output.technology === "GPON").selected.totalDb, 24.6);
  closeTo(changed.outputs.find((output) => output.technology === "XGS-PON").selected.totalDb, 23.8);
});

test("below-class-minimum PON loss fails and uses the modeled loss for overload", () => {
  for (const [technology, targetLoss, expectedRx] of [
    ["GPON", 12, -7],
    ["XGS-PON", 13, -8],
  ]) {
    const patch = structuredClone(PRESETS.ponCombo.patch);
    const channel = patch.channels.find((item) => item.technology === technology);
    patch.channels = [channel];
    patch.diagnosticServiceId = channel.id;
    patch.lengthKm = 0;
    patch.connections = 0;
    patch.fusionSplices = 0;
    patch.splitters = [];
    patch.extras = [{ id: "low-loss-path", label: "Modeled path", quantity: 1, lossDb: targetLoss - channel.coexistenceLossDb }];
    patch.engineeringMarginDb = 0;
    const output = calculateLink(createScenario(patch)).outputs[0];
    closeTo(output.selected.totalDb, targetLoss);
    closeTo(output.overloadBasisDb, targetLoss);
    closeTo(output.predictedRxMaxDbm, expectedRx);
    assert.equal(output.belowClassMinimum, true);
    assert.equal(output.isOverloaded, true);
    assert.equal(output.status, "fail");
  }
});

test("upstream telemetry compares against wavelength-specific upstream plant loss", () => {
  const scenario = createScenario({
    ...structuredClone(PRESETS.ponCombo.patch),
    diagnosticServiceId: "gpon-bplus",
    ontTxDbm: 0.5,
    oltRxDbm: -23.6,
  });
  const link = calculateLink(scenario);
  closeTo(link.outputs[0].selected.totalDb, 23.6);
  closeTo(link.outputs[0].upstreamSelected.totalDb, 24.1);
  closeTo(link.diagnostics.upstream.pathLossDb, 24.1);
  closeTo(link.diagnostics.upstream.modeledLossDb, 24.1);
  closeTo(link.diagnostics.upstream.deltaDb, 0);
});

test("upstream-only ODN class overrun drives channel and aggregate failure", () => {
  const patch = structuredClone(PRESETS.ponCombo.patch);
  patch.profile = "custom";
  patch.channels = [patch.channels.find((channel) => channel.technology === "GPON")];
  patch.diagnosticServiceId = patch.channels[0].id;
  patch.lengthKm = 20;
  patch.connections = 0;
  patch.fusionSplices = 0;
  patch.splitters = [];
  patch.extras = [{ id: "shared-loss", label: "Shared passive loss", quantity: 1, lossDb: 19.3 }];
  patch.engineeringMarginDb = 0;
  const link = calculateLink(createScenario(patch));
  const output = link.outputs[0];
  closeTo(output.selected.totalDb, 26.1);
  closeTo(output.upstreamSelected.totalDb, 28.1);
  closeTo(output.designHeadroomDb, 1.9);
  closeTo(output.upstreamDesignHeadroomDb, -0.1);
  closeTo(output.worstDesignHeadroomDb, -0.1);
  assert.equal(output.upstreamAboveClassMaximum, true);
  assert.equal(output.status, "fail");
  assert.equal(link.status, "fail");
});

test("one failed PON channel drives aggregate link failure", () => {
  const scenario = createScenario(structuredClone(PRESETS.ponCombo.patch));
  scenario.channels.find((channel) => channel.technology === "GPON").coexistenceLossDb = 6;
  const link = calculateLink(scenario);
  assert.equal(link.outputs.find((output) => output.technology === "GPON").status, "fail");
  assert.equal(link.outputs.find((output) => output.technology === "XGS-PON").status, "pass");
  assert.equal(link.status, "fail");
});

test("missing or unsupported channel attenuation invalidates instead of becoming a zero-loss pass", () => {
  const missingPatch = structuredClone(PRESETS.ponCombo.patch);
  missingPatch.profile = "custom";
  delete missingPatch.channels[0].attenuationDbPerKm;
  const missing = calculateLink(createScenario(missingPatch));
  assert.equal(missing.status, "invalid");
  assert.ok(missing.outputs.every((output) => output.status === "invalid"));
  assert.ok(missing.errors.some((error) =>
    error.code === "INVALID_CHANNEL_VALUE" && error.path === "channels[0].attenuationDbPerKm"
  ));

  const unsupportedPatch = structuredClone(PRESETS.ponCombo.patch);
  unsupportedPatch.channels[1].wavelengthNm = 1625;
  const unsupported = calculateLink(createScenario(unsupportedPatch));
  assert.equal(unsupported.status, "invalid");
  assert.ok(unsupported.errors.some((error) =>
    error.code === "INVALID_CHANNEL_VALUE" && error.path === "channels[1].attenuationDbPerKm"
  ));

  const missingUpstreamPatch = structuredClone(PRESETS.ponCombo.patch);
  missingUpstreamPatch.profile = "custom";
  delete missingUpstreamPatch.channels[0].upstreamAttenuationDbPerKm;
  const missingUpstream = calculateLink(createScenario(missingUpstreamPatch));
  assert.equal(missingUpstream.status, "invalid");
  assert.ok(missingUpstream.errors.some((error) =>
    error.code === "INVALID_CHANNEL_VALUE" && error.path === "channels[0].upstreamAttenuationDbPerKm"
  ));
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

test("bidirectional OTDR averaging applies uncertainty pass, review, and fail bands", () => {
  const cases = [
    { forward: 9.4, reverse: 9.8, uncertainty: 0.3, average: 9.6, status: "pass" },
    { forward: 9.8, reverse: 10, uncertainty: 0.2, average: 9.9, status: "review" },
    { forward: 10.4, reverse: 10.6, uncertainty: 0.2, average: 10.5, status: "fail" },
  ];
  for (const sample of cases) {
    const scenario = createScenario({
      profile: "custom",
      lengthKm: 0,
      connections: 0,
      fusionSplices: 0,
      mechanicalSplices: 0,
      extras: [{ id: "modeled-loss", label: "Modeled loss", quantity: 1, lossDb: 10 }],
      otdrForwardLossDb: sample.forward,
      otdrReverseLossDb: sample.reverse,
      otdrUncertaintyDb: sample.uncertainty,
    });
    const result = calculateLink(scenario).diagnostics.otdr;
    assert.equal(result.bidirectional, true);
    closeTo(result.measuredDb, sample.average);
    closeTo(result.lowerDb, sample.average - sample.uncertainty);
    closeTo(result.upperDb, sample.average + sample.uncertainty);
    closeTo(result.modeledLossDb, 10);
    assert.equal(result.status, sample.status);
  }
});

test("one-way OTDR data remains diagnostic and raises a bidirectional warning", () => {
  const scenario = createScenario({
    otdrForwardLossDb: 2.1,
    otdrReverseLossDb: null,
    otdrUncertaintyDb: 0.2,
  });
  const link = calculateLink(scenario);
  assert.equal(link.diagnostics.otdr.bidirectional, false);
  closeTo(link.diagnostics.otdr.measuredDb, 2.1);
  assert.ok(link.warnings.some((warning) => warning.code === "ONE_WAY_OTDR"));
  assert.ok(link.warnings.some((warning) => warning.code === "OTDR_DIAGNOSTIC_ONLY"));
});

test("paired downstream and upstream terminal telemetry derives live path loss", () => {
  const scenario = createScenario({
    profile: "custom",
    lengthKm: 0,
    connections: 0,
    fusionSplices: 0,
    mechanicalSplices: 0,
    extras: [{ id: "modeled-loss", label: "Modeled loss", quantity: 1, lossDb: 10 }],
    oltTxDbm: 3,
    ontRxDbm: -7,
    ontTxDbm: 2,
    oltRxDbm: -8.5,
  });
  const { downstream, upstream } = calculateLink(scenario).diagnostics;
  closeTo(downstream.pathLossDb, 10);
  closeTo(downstream.deltaDb, 0);
  assert.equal(downstream.receiverStatus, "pass");
  assert.equal(downstream.status, "pass");
  closeTo(upstream.pathLossDb, 10.5);
  closeTo(upstream.deltaDb, 0.5);
  assert.equal(upstream.receiverStatus, null);
  assert.equal(upstream.status, "pass");
});

test("PON telemetry below the class minimum fails in both directions", () => {
  for (const sample of [
    { serviceId: "gpon-bplus", belowMinimumDb: 12, minimumDb: 13 },
    { serviceId: "xgs-n1", belowMinimumDb: 13, minimumDb: 14 },
  ]) {
    const scenario = createScenario(structuredClone(PRESETS.ponCombo.patch));
    const channel = scenario.channels.find((item) => item.id === sample.serviceId);
    scenario.diagnosticServiceId = sample.serviceId;
    scenario.oltTxDbm = channel.txPowerDbm;
    scenario.ontRxDbm = channel.txPowerDbm - sample.belowMinimumDb;
    scenario.ontTxDbm = 0;
    scenario.oltRxDbm = -sample.belowMinimumDb;

    const { downstream, upstream } = calculateLink(scenario).diagnostics;
    assert.equal(downstream.minimumOdnLossDb, sample.minimumDb);
    assert.equal(downstream.receiverStatus, "pass");
    assert.equal(downstream.status, "fail");
    assert.equal(upstream.minimumOdnLossDb, sample.minimumDb);
    assert.equal(upstream.status, "fail");
  }
});

test("incomplete terminal telemetry pair warns and produces no derived comparison", () => {
  const scenario = createScenario({ oltTxDbm: 3, ontRxDbm: null });
  const link = calculateLink(scenario);
  assert.equal(link.diagnostics.downstream, null);
  assert.ok(link.warnings.some((warning) =>
    warning.code === "INCOMPLETE_TELEMETRY_PAIR" && /downstream/.test(warning.message)
  ));
});

test("legacy measured-loss fields migrate to one-way OTDR fields without overriding new data", () => {
  const migrated = createScenario({ measuredLossDb: 7.5, measurementUncertaintyDb: 0.25 });
  assert.equal(migrated.otdrForwardLossDb, 7.5);
  assert.equal(migrated.otdrReverseLossDb, null);
  assert.equal(migrated.otdrUncertaintyDb, 0.25);
  assert.ok(calculateLink(migrated).warnings.some((warning) => warning.code === "ONE_WAY_OTDR"));

  const explicit = createScenario({
    measuredLossDb: 7.5,
    measurementUncertaintyDb: 0.25,
    otdrForwardLossDb: 8,
    otdrUncertaintyDb: 0.1,
  });
  assert.equal(explicit.otdrForwardLossDb, 8);
  assert.equal(explicit.otdrUncertaintyDb, 0.1);
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

test("unsupported shared enums are rejected while scenario creation falls back safely", () => {
  const malformed = createScenario();
  malformed.unit = "yards";
  malformed.fiberType = "mystery-fiber";
  malformed.profile = "fictional-standard";

  const link = calculateLink(malformed);
  const codes = link.errors.map((error) => error.code);
  assert.equal(link.status, "invalid");
  assert.ok(codes.includes("INVALID_UNIT"));
  assert.ok(codes.includes("INVALID_FIBER_TYPE"));
  assert.ok(codes.includes("INVALID_PROFILE"));

  const safe = createScenario({
    unit: "yards",
    fiberType: "mystery-fiber",
    profile: "fictional-standard",
  });
  assert.equal(safe.unit, "ft");
  assert.equal(safe.fiberType, "os2");
  assert.equal(safe.profile, "typical");
});

test("numeric overflow invalidates the link and every visual output", () => {
  const scenario = createScenario({
    profile: "custom",
    lengthKm: 1e308,
    attenuationDbPerKm: 1e308,
  });
  const link = calculateLink(scenario);
  assert.equal(link.status, "invalid");
  assert.ok(link.errors.some((error) => error.code === "NONFINITE_RESULT"));
  assert.ok(link.outputs.every((output) => output.status === "invalid"));
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

test("hostile PON channel identifiers are normalized, deduplicated, and selected safely", () => {
  const channels = structuredClone(PRESETS.ponCombo.patch.channels).map((channel) => ({
    ...channel,
    id: '\"><img src=x onerror=alert(1)>',
  }));
  const scenario = createScenario({
    ...structuredClone(PRESETS.ponCombo.patch),
    channels,
    diagnosticServiceId: '\"><img src=x onerror=alert(1)>',
  });
  assert.equal(new Set(scenario.channels.map((channel) => channel.id)).size, 2);
  assert.ok(scenario.channels.every((channel) => /^[a-zA-Z0-9_-]+$/.test(channel.id)));
  assert.equal(scenario.diagnosticServiceId, scenario.channels[0].id);
  assert.equal(calculateLink(scenario).diagnosticOutputId, scenario.channels[0].id);
});

test("calculation does not mutate a deeply frozen scenario", () => {
  const scenario = createScenario({ splitters: [{ id: "a", ratio: "1:2", quantity: 1, lossDb: 3.6 }] });
  Object.freeze(scenario.splitters[0]);
  Object.freeze(scenario.splitters);
  Object.freeze(scenario.extras);
  Object.freeze(scenario);
  assert.doesNotThrow(() => calculateLink(scenario));
});
