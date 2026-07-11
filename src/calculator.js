import {
  attenuationFor,
  DEFAULT_SCENARIO,
  FIBER_TYPES,
  SPLITTERS,
  STANDARD_PROFILES,
} from "./config.js?v=1.1";

export const FEET_PER_KILOMETER = 3280.83989501312;

export function toKilometers(value, unit) {
  const numeric = finiteNumber(value, 0);
  return unit === "ft" ? numeric * 0.0003048 : numeric;
}

export function fromKilometers(value, unit) {
  const numeric = finiteNumber(value, 0);
  return unit === "ft" ? numeric * FEET_PER_KILOMETER : numeric;
}

export function createScenario(patch = {}) {
  const migrated = structuredClone(patch ?? {});
  if (migrated.otdrForwardLossDb === undefined && migrated.measuredLossDb !== undefined) {
    migrated.otdrForwardLossDb = migrated.measuredLossDb;
  }
  if (migrated.otdrUncertaintyDb === undefined && migrated.measurementUncertaintyDb !== undefined) {
    migrated.otdrUncertaintyDb = migrated.measurementUncertaintyDb;
  }
  const scenario = {
    ...structuredClone(DEFAULT_SCENARIO),
    ...migrated,
  };
  scenario.unit = ["ft", "km"].includes(scenario.unit) ? scenario.unit : DEFAULT_SCENARIO.unit;
  scenario.fiberType = FIBER_TYPES[scenario.fiberType] ? scenario.fiberType : DEFAULT_SCENARIO.fiberType;
  scenario.splitters = normalizeRowIds(
    structuredClone(migrated.splitters ?? DEFAULT_SCENARIO.splitters),
    "splitter",
  );
  scenario.extras = normalizeRowIds(
    structuredClone(migrated.extras ?? DEFAULT_SCENARIO.extras),
    "extra",
  );
  scenario.channels = normalizeRowIds(
    structuredClone(migrated.channels ?? DEFAULT_SCENARIO.channels),
    "channel",
  );
  applyProfileDefaults(scenario, scenario.profile);
  syncDiagnosticService(scenario);
  return scenario;
}

export function applyProfileDefaults(scenario, profile) {
  const nextProfile = STANDARD_PROFILES[profile] ? profile : "typical";
  scenario.profile = nextProfile;
  if (nextProfile === "custom") return scenario;
  const values = STANDARD_PROFILES[nextProfile];
  scenario.attenuationDbPerKm = attenuationFor(
    nextProfile,
    scenario.fiberType,
    scenario.wavelengthNm,
  );
  scenario.connectionDb = values.connectionDb;
  scenario.fusionSpliceDb = values.fusionSpliceDb;
  scenario.mechanicalSpliceDb = values.mechanicalSpliceDb;
  for (const channel of scenario.channels ?? []) {
    channel.attenuationDbPerKm = attenuationFor(
      nextProfile,
      scenario.fiberType,
      channel.wavelengthNm,
    );
    channel.upstreamAttenuationDbPerKm = attenuationFor(
      nextProfile,
      scenario.fiberType,
      channel.upstreamWavelengthNm,
    );
  }
  return scenario;
}

export function syncFiberDefaults(scenario) {
  const fiber = FIBER_TYPES[scenario.fiberType] ?? FIBER_TYPES.os2;
  if (!(scenario.channels?.length > 0) && !fiber.wavelengths.includes(Number(scenario.wavelengthNm))) {
    scenario.wavelengthNm = fiber.wavelengths[0];
  }
  if (scenario.profile !== "custom") {
    scenario.attenuationDbPerKm = attenuationFor(
      scenario.profile,
      scenario.fiberType,
      scenario.wavelengthNm,
    );
    for (const channel of scenario.channels ?? []) {
      channel.attenuationDbPerKm = attenuationFor(
        scenario.profile,
        scenario.fiberType,
        channel.wavelengthNm,
      );
      channel.upstreamAttenuationDbPerKm = attenuationFor(
        scenario.profile,
        scenario.fiberType,
        channel.upstreamWavelengthNm,
      );
    }
  }
  return scenario;
}

export function calculateLink(input) {
  const validation = validateScenario(input);
  const scenario = normalizeScenario(input);
  const channels = scenario.channels.length ? scenario.channels : [primaryChannel(scenario)];
  const outputs = channels.map((channel) => calculateOutput(scenario, channel));
  if (outputs.some((output) => hasNonfiniteNumber(output))) {
    validation.errors.push(issue("NONFINITE_RESULT", "calculation", "The entered values overflow the calculator's numeric range; reduce the length, quantity, or loss values."));
  }
  let status = worstStatus(outputs.map((output) => output.status));
  if (validation.errors.length) {
    status = "invalid";
    outputs.forEach((output) => (output.status = "invalid"));
  }
  const primary = outputs[0];
  const diagnosticOutput =
    outputs.find((output) => output.id === scenario.diagnosticServiceId) ?? primary;
  const diagnostics = calculateDiagnostics(scenario, diagnosticOutput);

  return {
    scenario,
    outputs,
    diagnosticOutputId: diagnosticOutput.id,
    diagnostics,
    status,
    selected: primary.selected,
    typical: primary.typical,
    tia: primary.tia,
    powerBudgetDb: primary.powerBudgetDb,
    availableBudgetDb: primary.availableBudgetDb,
    usableBudgetDb: primary.usableBudgetDb,
    predictedRxDbm: primary.predictedRxDbm,
    predictedRxMaxDbm: primary.predictedRxMaxDbm,
    rawHeadroomDb: primary.rawHeadroomDb,
    designHeadroomDb: primary.worstDesignHeadroomDb,
    overloadHeadroomDb: primary.overloadHeadroomDb,
    overloadBasisDb: primary.overloadBasisDb,
    overloadDefinitive: primary.overloadDefinitive,
    isOverloaded: primary.isOverloaded,
    errors: validation.errors,
    warnings: validation.warnings,
  };
}

export function validateScenario(input = {}) {
  const errors = [];
  const warnings = [];
  if (!["ft", "km"].includes(input.unit)) {
    errors.push(issue("INVALID_UNIT", "unit", "Length unit must be feet or kilometers."));
  }
  if (!FIBER_TYPES[input.fiberType]) {
    errors.push(issue("INVALID_FIBER_TYPE", "fiberType", "Select a supported fiber designation."));
  }
  if (!STANDARD_PROFILES[input.profile]) {
    errors.push(issue("INVALID_PROFILE", "profile", "Select a supported allowance profile."));
  }
  const requiredNonnegative = [
    ["lengthKm", input.lengthKm],
    ["connectionDb", input.connectionDb],
    ["fusionSpliceDb", input.fusionSpliceDb],
    ["mechanicalSpliceDb", input.mechanicalSpliceDb],
    ["engineeringMarginDb", input.engineeringMarginDb],
    ["otdrUncertaintyDb", input.otdrUncertaintyDb],
  ];
  if (!(input.channels?.length > 0)) {
    requiredNonnegative.push(["attenuationDbPerKm", input.attenuationDbPerKm]);
  }
  for (const [path, value] of requiredNonnegative) {
    if (value === "" || value === null || value === undefined || !Number.isFinite(Number(value))) {
      errors.push(issue("INVALID_NUMBER", path, `${path} must be a number.`));
    } else if (Number(value) < 0) {
      errors.push(issue("NEGATIVE_VALUE", path, `${path} cannot be negative.`));
    }
  }
  for (const [path, value] of [
    ["connections", input.connections],
    ["fusionSplices", input.fusionSplices],
    ["mechanicalSplices", input.mechanicalSplices],
  ]) {
    if (!Number.isInteger(Number(value)) || Number(value) < 0) {
      errors.push(issue("NON_INTEGER_QUANTITY", path, `${path} must be a nonnegative whole number.`));
    }
  }
  for (const [collectionName, rows] of [
    ["splitters", input.splitters],
    ["extras", input.extras],
  ]) {
    if (!Array.isArray(rows)) continue;
    rows.forEach((row, index) => {
      if (!Number.isInteger(Number(row.quantity)) || Number(row.quantity) < 0) {
        errors.push(issue("NON_INTEGER_QUANTITY", `${collectionName}[${index}].quantity`, "Component quantity must be a nonnegative whole number."));
      }
      if (!Number.isFinite(Number(row.lossDb)) || Number(row.lossDb) < 0) {
        errors.push(issue("INVALID_LOSS", `${collectionName}[${index}].lossDb`, "Component loss must be a nonnegative number."));
      }
      if (collectionName === "extras" && !String(row.label ?? "").trim()) {
        errors.push(issue("MISSING_LABEL", `${collectionName}[${index}].label`, "Custom components need a label."));
      }
    });
  }

  if (input.channels?.length > 0) {
    input.channels.forEach((channel, index) => validateChannel(channel, index, errors));
  } else {
    validatePowerWindow(input, "power", errors);
  }

  if (input.minimumPlantLossDb !== null && input.minimumPlantLossDb !== undefined && input.minimumPlantLossDb !== "") {
    if (!Number.isFinite(Number(input.minimumPlantLossDb)) || Number(input.minimumPlantLossDb) < 0) {
      errors.push(issue("INVALID_MINIMUM_LOSS", "minimumPlantLossDb", "Minimum plant loss must be a nonnegative number or left blank."));
    }
  }
  for (const key of ["otdrForwardLossDb", "otdrReverseLossDb"]) {
    const value = input[key];
    if (value !== null && value !== undefined && value !== "") {
      if (!Number.isFinite(Number(value))) {
        errors.push(issue("INVALID_OTDR_LOSS", key, "OTDR loss must be numeric or left blank."));
      } else if (Number(value) < 0) {
        warnings.push(issue("NEGATIVE_OTDR_LOSS", key, "A negative OTDR path loss indicates a trace setup or interpretation problem."));
      }
    }
  }
  for (const key of ["oltTxDbm", "ontRxDbm", "ontTxDbm", "oltRxDbm"]) {
    const value = input[key];
    if (value !== null && value !== undefined && value !== "" && !Number.isFinite(Number(value))) {
      errors.push(issue("INVALID_TELEMETRY", key, "Optical telemetry must be numeric or left blank."));
    }
  }
  for (const [txKey, rxKey, label] of [
    ["oltTxDbm", "ontRxDbm", "downstream"],
    ["ontTxDbm", "oltRxDbm", "upstream"],
  ]) {
    const hasTx = hasNumber(input[txKey]);
    const hasRx = hasNumber(input[rxKey]);
    if (hasTx !== hasRx) {
      warnings.push(issue("INCOMPLETE_TELEMETRY_PAIR", txKey, `Enter both ${label} transmit and receive readings to calculate live path loss.`));
    }
  }
  if (!(input.channels?.length > 0) && Number(input.txPowerDbm) - Number(input.rxSensitivityDbm) <= 0) {
    warnings.push(issue("NONPOSITIVE_BUDGET", "power", "The equipment power budget is zero or negative."));
  }
  if ((input.splitters?.length ?? 0) > 0) {
    warnings.push(issue("SPLITTER_PATH_SCOPE", "splitters", "Splitter loss must represent only stages traversed by this selected optical path."));
  }
  const fiber = FIBER_TYPES[input.fiberType];
  if (fiber?.family === "multimode") {
    warnings.push(issue("DISPERSION_NOT_EVALUATED", "fiberType", "OM class affects bandwidth and reach; this calculator evaluates loss, not dispersion limits."));
  }
  if (input.profile === "custom") {
    warnings.push(issue("CUSTOM_PROFILE", "profile", "Custom values should be verified against project specifications or manufacturer data."));
  }
  if (input.channels?.length > 0) {
    warnings.push(issue("PON_CLASS_COMPATIBILITY", "channels", "PON class windows are planning limits; confirm the exact OLT, ONT/ONU, coexistence element, and splitter specifications."));
  }
  if (hasNumber(input.otdrForwardLossDb) || hasNumber(input.otdrReverseLossDb)) {
    warnings.push(issue("OTDR_DIAGNOSTIC_ONLY", "otdr", "OTDR is an indirect diagnostic comparison and does not replace required OLTS/LSPM insertion-loss acceptance testing."));
    if (!(hasNumber(input.otdrForwardLossDb) && hasNumber(input.otdrReverseLossDb))) {
      warnings.push(issue("ONE_WAY_OTDR", "otdr", "Only one OTDR direction is entered; bidirectional averaging is required for reliable splice-loss characterization."));
    }
  }
  return { errors, warnings };
}

export function idealSplitterLoss(outputs) {
  return 10 * Math.log10(Math.max(1, finiteNumber(outputs, 1)));
}

function calculateOutput(scenario, channel) {
  const selectedAllowances = {
    attenuationDbPerKm: channel.attenuationDbPerKm,
    connectionDb: scenario.connectionDb,
    fusionSpliceDb: scenario.fusionSpliceDb,
    mechanicalSpliceDb: scenario.mechanicalSpliceDb,
  };
  const coexistenceLossDb = nonnegative(channel.coexistenceLossDb);
  const upstreamCoexistenceLossDb = nonnegative(channel.upstreamCoexistenceLossDb);
  const selected = calculatePassive(scenario, selectedAllowances, coexistenceLossDb);
  const upstreamSelected = calculatePassive(
    scenario,
    {
      ...selectedAllowances,
      attenuationDbPerKm: channel.upstreamAttenuationDbPerKm,
    },
    upstreamCoexistenceLossDb,
  );
  const typical = calculatePassive(
    scenario,
    profileValues(scenario, channel.wavelengthNm, "typical"),
    coexistenceLossDb,
  );
  const tia = calculatePassive(
    scenario,
    profileValues(scenario, channel.wavelengthNm, "tia"),
    coexistenceLossDb,
  );
  const powerBudgetDb = channel.txPowerDbm - channel.rxSensitivityDbm;
  const equipmentPathBudgetDb = powerBudgetDb - channel.opticalPenaltyDb;
  const availableBudgetDb = channel.maximumOdnLossDb === null
    ? equipmentPathBudgetDb
    : Math.min(equipmentPathBudgetDb, channel.maximumOdnLossDb);
  const usableBudgetDb = availableBudgetDb - scenario.engineeringMarginDb;
  const predictedRxDbm = channel.txPowerDbm - selected.totalDb;
  const classMinimum = channel.minimumOdnLossDb;
  const overloadDefinitive = classMinimum !== null || scenario.minimumPlantLossDb !== null;
  const overloadBasisDb = classMinimum !== null
    ? Math.min(classMinimum, selected.totalDb)
    : scenario.minimumPlantLossDb !== null
      ? scenario.minimumPlantLossDb
      : selected.totalDb;
  const predictedRxMaxDbm = channel.txMaxDbm - overloadBasisDb;
  const rawHeadroomDb = availableBudgetDb - selected.totalDb;
  const designHeadroomDb = usableBudgetDb - selected.totalDb;
  const upstreamAvailableBudgetDb = channel.maximumOdnLossDb === null
    ? availableBudgetDb
    : channel.maximumOdnLossDb;
  const upstreamUsableBudgetDb = upstreamAvailableBudgetDb - scenario.engineeringMarginDb;
  const upstreamRawHeadroomDb = upstreamAvailableBudgetDb - upstreamSelected.totalDb;
  const upstreamDesignHeadroomDb = upstreamUsableBudgetDb - upstreamSelected.totalDb;
  const worstDesignHeadroomDb = Math.min(designHeadroomDb, upstreamDesignHeadroomDb);
  const overloadHeadroomDb = channel.rxOverloadDbm - predictedRxMaxDbm;
  const isOverloaded = predictedRxMaxDbm > channel.rxOverloadDbm;
  const downstreamBelowClassMinimum = classMinimum !== null && selected.totalDb < classMinimum;
  const upstreamBelowClassMinimum = classMinimum !== null && upstreamSelected.totalDb < classMinimum;
  const downstreamAboveClassMaximum = channel.maximumOdnLossDb !== null && selected.totalDb > channel.maximumOdnLossDb;
  const upstreamAboveClassMaximum = channel.maximumOdnLossDb !== null && upstreamSelected.totalDb > channel.maximumOdnLossDb;
  const belowClassMinimum = downstreamBelowClassMinimum || upstreamBelowClassMinimum;
  const aboveClassMaximum = downstreamAboveClassMaximum || upstreamAboveClassMaximum;
  let status = "pass";
  if ((overloadDefinitive && isOverloaded) || worstDesignHeadroomDb < 0 || belowClassMinimum || aboveClassMaximum) status = "fail";
  else if (isOverloaded || worstDesignHeadroomDb < 1) status = "review";
  return {
    ...channel,
    selected,
    upstreamSelected,
    typical,
    tia,
    powerBudgetDb,
    equipmentPathBudgetDb,
    availableBudgetDb,
    usableBudgetDb,
    predictedRxDbm,
    predictedRxMaxDbm,
    rawHeadroomDb,
    designHeadroomDb,
    upstreamAvailableBudgetDb,
    upstreamUsableBudgetDb,
    upstreamRawHeadroomDb,
    upstreamDesignHeadroomDb,
    worstDesignHeadroomDb,
    overloadHeadroomDb,
    overloadBasisDb,
    overloadDefinitive,
    isOverloaded,
    belowClassMinimum,
    aboveClassMaximum,
    downstreamBelowClassMinimum,
    upstreamBelowClassMinimum,
    downstreamAboveClassMaximum,
    upstreamAboveClassMaximum,
    status,
  };
}

function calculateDiagnostics(scenario, output) {
  return {
    outputId: output.id,
    otdr: otdrResult(
      scenario.otdrForwardLossDb,
      scenario.otdrReverseLossDb,
      scenario.otdrUncertaintyDb,
      output.selected.totalDb,
    ),
    downstream: telemetryPathResult(
      scenario.oltTxDbm,
      scenario.ontRxDbm,
      output,
      true,
    ),
    upstream: telemetryPathResult(
      scenario.ontTxDbm,
      scenario.oltRxDbm,
      output,
      false,
      output.upstreamSelected.totalDb,
    ),
  };
}

function otdrResult(forwardLossDb, reverseLossDb, uncertaintyDb, modeledLossDb) {
  const readings = [forwardLossDb, reverseLossDb]
    .filter(hasNumber)
    .map(Number);
  if (!readings.length) return null;
  const measuredDb = sum(readings) / readings.length;
  const uncertainty = nonnegative(uncertaintyDb);
  const lowerDb = measuredDb - uncertainty;
  const upperDb = measuredDb + uncertainty;
  const status = upperDb <= modeledLossDb ? "pass" : lowerDb > modeledLossDb ? "fail" : "review";
  return {
    measuredDb,
    forwardDb: hasNumber(forwardLossDb) ? Number(forwardLossDb) : null,
    reverseDb: hasNumber(reverseLossDb) ? Number(reverseLossDb) : null,
    bidirectional: readings.length === 2,
    uncertaintyDb: uncertainty,
    lowerDb,
    upperDb,
    modeledLossDb,
    deltaDb: measuredDb - modeledLossDb,
    status,
  };
}

function telemetryPathResult(txDbm, rxDbm, output, evaluateReceiver, modeledLossDb = output.selected.totalDb) {
  if (!(hasNumber(txDbm) && hasNumber(rxDbm))) return null;
  const tx = Number(txDbm);
  const rx = Number(rxDbm);
  const pathLossDb = tx - rx;
  const deltaDb = pathLossDb - modeledLossDb;
  let status = "pass";
  if (output.minimumOdnLossDb !== null && pathLossDb < output.minimumOdnLossDb) status = "fail";
  if (output.maximumOdnLossDb !== null && pathLossDb > output.maximumOdnLossDb) status = "fail";
  let receiverStatus = null;
  if (evaluateReceiver) {
    receiverStatus = rx < output.rxSensitivityDbm || rx > output.rxOverloadDbm
      ? "fail"
      : rx - output.rxSensitivityDbm < 1 || output.rxOverloadDbm - rx < 1
        ? "review"
        : "pass";
    status = worstStatus([status, receiverStatus]);
  }
  return {
    txDbm: tx,
    rxDbm: rx,
    pathLossDb,
    modeledLossDb,
    deltaDb,
    minimumOdnLossDb: output.minimumOdnLossDb,
    maximumOdnLossDb: output.maximumOdnLossDb,
    receiverStatus,
    status,
  };
}

function validateChannel(channel, index, errors) {
  const prefix = `channels[${index}]`;
  for (const key of [
    "wavelengthNm",
    "upstreamWavelengthNm",
    "attenuationDbPerKm",
    "upstreamAttenuationDbPerKm",
    "opticalPenaltyDb",
    "coexistenceLossDb",
    "upstreamCoexistenceLossDb",
  ]) {
    const value = channel[key];
    if (value === "" || value === null || value === undefined || !Number.isFinite(Number(value))) {
      errors.push(issue("INVALID_CHANNEL_VALUE", `${prefix}.${key}`, `${channel.label || "PON channel"} requires a numeric ${key}.`));
    } else if (Number(value) < 0) {
      errors.push(issue("NEGATIVE_CHANNEL_VALUE", `${prefix}.${key}`, `${channel.label || "PON channel"} ${key} cannot be negative.`));
    }
  }
  validatePowerWindow(channel, prefix, errors);
  for (const key of ["minimumOdnLossDb", "maximumOdnLossDb"]) {
    const value = channel[key];
    if (value !== null && value !== undefined && value !== "" && (!Number.isFinite(Number(value)) || Number(value) < 0)) {
      errors.push(issue("INVALID_ODN_WINDOW", `${prefix}.${key}`, "ODN class limits must be nonnegative numbers."));
    }
  }
  if (hasNumber(channel.minimumOdnLossDb) && hasNumber(channel.maximumOdnLossDb) && Number(channel.maximumOdnLossDb) <= Number(channel.minimumOdnLossDb)) {
    errors.push(issue("INVALID_ODN_WINDOW", `${prefix}.maximumOdnLossDb`, "Maximum ODN loss must be greater than minimum ODN loss."));
  }
}

function validatePowerWindow(values, path, errors) {
  const powerValues = [values.txPowerDbm, values.txMaxDbm, values.rxSensitivityDbm, values.rxOverloadDbm];
  if (powerValues.some((value) => value === "" || value === null || value === undefined || !Number.isFinite(Number(value)))) {
    errors.push(issue("INVALID_POWER", path, "Transmitter and receiver power values are required."));
    return;
  }
  if (Number(values.txMaxDbm) < Number(values.txPowerDbm)) {
    errors.push(issue("INVALID_TX_WINDOW", `${path}.txMaxDbm`, "Transmitter maximum must be greater than or equal to transmitter minimum."));
  }
  if (Number(values.rxOverloadDbm) <= Number(values.rxSensitivityDbm)) {
    errors.push(issue("INVALID_RECEIVER_WINDOW", `${path}.rxOverloadDbm`, "Receiver overload must be greater than receiver sensitivity."));
  }
}

function profileValues(scenario, wavelengthNm, profile) {
  const standard = STANDARD_PROFILES[profile];
  return {
    attenuationDbPerKm: attenuationFor(profile, scenario.fiberType, wavelengthNm),
    connectionDb: standard.connectionDb,
    fusionSpliceDb: standard.fusionSpliceDb,
    mechanicalSpliceDb: standard.mechanicalSpliceDb,
  };
}

function calculatePassive(scenario, allowances, coexistenceLossDb = 0) {
  const fiberDb = scenario.lengthKm * nonnegative(allowances.attenuationDbPerKm);
  const connectionDb = scenario.connections * nonnegative(allowances.connectionDb);
  const fusionSpliceDb = scenario.fusionSplices * nonnegative(allowances.fusionSpliceDb);
  const mechanicalSpliceDb = scenario.mechanicalSplices * nonnegative(allowances.mechanicalSpliceDb);
  const splitterRows = scenario.splitters.map((row) => ({
    ...row,
    subtotalDb: nonnegative(row.quantity) * nonnegative(row.lossDb),
    idealDb: SPLITTERS[row.ratio]?.idealDb ?? idealSplitterLoss(splitterOutputs(row.ratio)),
  }));
  const extraRows = scenario.extras.map((row) => ({
    ...row,
    subtotalDb: nonnegative(row.quantity) * nonnegative(row.lossDb),
  }));
  const splitterDb = sum(splitterRows.map((row) => row.subtotalDb));
  const extraDb = sum(extraRows.map((row) => row.subtotalDb));
  const coexistenceDb = nonnegative(coexistenceLossDb);
  const totalDb = fiberDb + connectionDb + fusionSpliceDb + mechanicalSpliceDb + splitterDb + extraDb + coexistenceDb;
  return {
    attenuationDbPerKm: nonnegative(allowances.attenuationDbPerKm),
    connectionAllowanceDb: nonnegative(allowances.connectionDb),
    fusionSpliceAllowanceDb: nonnegative(allowances.fusionSpliceDb),
    mechanicalSpliceAllowanceDb: nonnegative(allowances.mechanicalSpliceDb),
    fiberDb,
    connectionDb,
    fusionSpliceDb,
    mechanicalSpliceDb,
    splitterDb,
    extraDb,
    coexistenceDb,
    splitterRows,
    extraRows,
    totalDb,
  };
}

function primaryChannel(scenario) {
  return {
    id: "primary",
    label: "Current link",
    technology: "Point-to-point",
    standard: "Project equipment",
    direction: "Tx → Rx",
    wavelengthNm: scenario.wavelengthNm,
    upstreamWavelengthNm: scenario.wavelengthNm,
    attenuationDbPerKm: scenario.attenuationDbPerKm,
    upstreamAttenuationDbPerKm: scenario.attenuationDbPerKm,
    txPowerDbm: scenario.txPowerDbm,
    txMaxDbm: scenario.txMaxDbm,
    rxSensitivityDbm: scenario.rxSensitivityDbm,
    rxOverloadDbm: scenario.rxOverloadDbm,
    opticalPenaltyDb: 0,
    minimumOdnLossDb: scenario.minimumPlantLossDb,
    maximumOdnLossDb: null,
    coexistenceLossDb: 0,
    upstreamCoexistenceLossDb: 0,
  };
}

function normalizeScenario(input) {
  const scenario = {
    ...structuredClone(DEFAULT_SCENARIO),
    ...structuredClone(input ?? {}),
  };
  scenario.unit = ["ft", "km"].includes(scenario.unit) ? scenario.unit : DEFAULT_SCENARIO.unit;
  scenario.fiberType = FIBER_TYPES[scenario.fiberType] ? scenario.fiberType : DEFAULT_SCENARIO.fiberType;
  scenario.profile = STANDARD_PROFILES[scenario.profile] ? scenario.profile : DEFAULT_SCENARIO.profile;
  scenario.lengthKm = nonnegative(scenario.lengthKm);
  scenario.connections = integerCount(scenario.connections);
  scenario.fusionSplices = integerCount(scenario.fusionSplices);
  scenario.mechanicalSplices = integerCount(scenario.mechanicalSplices);
  scenario.attenuationDbPerKm = nonnegative(scenario.attenuationDbPerKm);
  scenario.connectionDb = nonnegative(scenario.connectionDb);
  scenario.fusionSpliceDb = nonnegative(scenario.fusionSpliceDb);
  scenario.mechanicalSpliceDb = nonnegative(scenario.mechanicalSpliceDb);
  scenario.engineeringMarginDb = nonnegative(scenario.engineeringMarginDb);
  scenario.otdrUncertaintyDb = nonnegative(scenario.otdrUncertaintyDb);
  scenario.txPowerDbm = finiteNumber(scenario.txPowerDbm, DEFAULT_SCENARIO.txPowerDbm);
  scenario.txMaxDbm = finiteNumber(scenario.txMaxDbm, DEFAULT_SCENARIO.txMaxDbm);
  scenario.rxSensitivityDbm = finiteNumber(scenario.rxSensitivityDbm, DEFAULT_SCENARIO.rxSensitivityDbm);
  scenario.rxOverloadDbm = finiteNumber(scenario.rxOverloadDbm, DEFAULT_SCENARIO.rxOverloadDbm);
  scenario.minimumPlantLossDb = nullableNumber(scenario.minimumPlantLossDb);
  for (const key of ["otdrForwardLossDb", "otdrReverseLossDb", "oltTxDbm", "ontRxDbm", "ontTxDbm", "oltRxDbm"]) {
    scenario[key] = nullableNumber(scenario[key]);
  }
  scenario.splitters = Array.isArray(scenario.splitters) ? scenario.splitters : [];
  scenario.extras = Array.isArray(scenario.extras) ? scenario.extras : [];
  scenario.channels = (Array.isArray(scenario.channels) ? scenario.channels : []).map(normalizeChannel);
  syncDiagnosticService(scenario);
  return scenario;
}

function normalizeChannel(channel) {
  return {
    ...channel,
    wavelengthNm: nonnegative(channel.wavelengthNm),
    upstreamWavelengthNm: nonnegative(channel.upstreamWavelengthNm),
    attenuationDbPerKm: nonnegative(channel.attenuationDbPerKm),
    upstreamAttenuationDbPerKm: nonnegative(channel.upstreamAttenuationDbPerKm),
    txPowerDbm: finiteNumber(channel.txPowerDbm, 0),
    txMaxDbm: finiteNumber(channel.txMaxDbm, 0),
    rxSensitivityDbm: finiteNumber(channel.rxSensitivityDbm, -1),
    rxOverloadDbm: finiteNumber(channel.rxOverloadDbm, 0),
    opticalPenaltyDb: nonnegative(channel.opticalPenaltyDb),
    minimumOdnLossDb: nullableNumber(channel.minimumOdnLossDb),
    maximumOdnLossDb: nullableNumber(channel.maximumOdnLossDb),
    coexistenceLossDb: nonnegative(channel.coexistenceLossDb),
    upstreamCoexistenceLossDb: nonnegative(channel.upstreamCoexistenceLossDb),
  };
}

function syncDiagnosticService(scenario) {
  const validIds = scenario.channels?.length
    ? scenario.channels.map((channel) => channel.id)
    : ["primary"];
  if (!validIds.includes(scenario.diagnosticServiceId)) scenario.diagnosticServiceId = validIds[0];
}

function splitterOutputs(ratio) {
  const outputs = String(ratio).split(":")[1];
  return finiteNumber(outputs, 1);
}

function worstStatus(statuses) {
  const rank = { pass: 0, review: 1, fail: 2, invalid: 3 };
  return statuses.reduce((worst, status) => (rank[status] > rank[worst] ? status : worst), "pass");
}

function integerCount(value) {
  return Math.max(0, Math.round(finiteNumber(value, 0)));
}

function nullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function hasNumber(value) {
  return value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
}

function nonnegative(value) {
  return Math.max(0, finiteNumber(value, 0));
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function hasNonfiniteNumber(value, seen = new Set()) {
  if (typeof value === "number") return !Number.isFinite(value);
  if (!value || typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  return Object.values(value).some((item) => hasNonfiniteNumber(item, seen));
}

function issue(code, path, message) {
  return { code, path, message };
}

function normalizeRowIds(rows, prefix) {
  const used = new Set();
  return (Array.isArray(rows) ? rows : []).map((row, index) => {
    const cleaned = String(row.id ?? "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48);
    const base = cleaned || `${prefix}-${index + 1}`;
    let id = base;
    let suffix = 2;
    while (used.has(id)) {
      id = `${base}-${suffix}`;
      suffix += 1;
    }
    used.add(id);
    return { ...row, id };
  });
}
