import {
  attenuationFor,
  DEFAULT_SCENARIO,
  FIBER_TYPES,
  REFERENCE_METHODS,
  SPLITTERS,
  STANDARD_PROFILES,
} from "./config.js";

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
  const scenario = {
    ...structuredClone(DEFAULT_SCENARIO),
    ...structuredClone(patch),
  };
  scenario.splitters = normalizeRowIds(
    structuredClone(patch.splitters ?? DEFAULT_SCENARIO.splitters),
    "splitter",
  );
  scenario.extras = normalizeRowIds(
    structuredClone(patch.extras ?? DEFAULT_SCENARIO.extras),
    "extra",
  );
  applyProfileDefaults(scenario, scenario.profile);
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
  return scenario;
}

export function syncFiberDefaults(scenario) {
  const fiber = FIBER_TYPES[scenario.fiberType] ?? FIBER_TYPES.os2;
  if (!fiber.wavelengths.includes(Number(scenario.wavelengthNm))) {
    scenario.wavelengthNm = fiber.wavelengths[0];
  }
  if (scenario.profile !== "custom") {
    scenario.attenuationDbPerKm = attenuationFor(
      scenario.profile,
      scenario.fiberType,
      scenario.wavelengthNm,
    );
  }
  return scenario;
}

export function calculateLink(input) {
  const validation = validateScenario(input);
  const scenario = normalizeScenario(input);
  const selected = calculatePassive(scenario, {
    attenuationDbPerKm: scenario.attenuationDbPerKm,
    connectionDb: scenario.connectionDb,
    fusionSpliceDb: scenario.fusionSpliceDb,
    mechanicalSpliceDb: scenario.mechanicalSpliceDb,
  });
  const typical = calculatePassive(scenario, profileValues(scenario, "typical"));
  const tia = calculatePassive(scenario, profileValues(scenario, "tia"));

  const powerBudgetDb = scenario.txPowerDbm - scenario.rxSensitivityDbm;
  const usableBudgetDb = powerBudgetDb - scenario.engineeringMarginDb;
  const predictedRxDbm = scenario.txPowerDbm - selected.totalDb;
  const overloadDefinitive = scenario.minimumPlantLossDb !== null;
  const overloadBasisDb = overloadDefinitive ? scenario.minimumPlantLossDb : selected.totalDb;
  const predictedRxMaxDbm = scenario.txMaxDbm - overloadBasisDb;
  const rawHeadroomDb = powerBudgetDb - selected.totalDb;
  const designHeadroomDb = usableBudgetDb - selected.totalDb;
  const overloadHeadroomDb = scenario.rxOverloadDbm - predictedRxMaxDbm;
  const isOverloaded = predictedRxMaxDbm > scenario.rxOverloadDbm;
  let status = "pass";
  if ((overloadDefinitive && isOverloaded) || designHeadroomDb < 0) status = "fail";
  else if (isOverloaded || designHeadroomDb < 1) status = "review";
  if (validation.errors.length) status = "invalid";

  const reference = REFERENCE_METHODS[scenario.referenceMethod] ?? REFERENCE_METHODS["1-cord"];
  const excludedConnections = Math.min(reference.excludedConnections, scenario.connections);
  const selectedTestLimitDb = Math.max(
    0,
    selected.totalDb - excludedConnections * scenario.connectionDb,
  );
  const tiaTestLimitDb = Math.max(0, tia.totalDb - excludedConnections * 0.75);
  const measurement = measurementResult(
    scenario.measuredLossDb,
    scenario.measurementUncertaintyDb,
    tiaTestLimitDb,
  );

  return {
    scenario,
    selected,
    typical,
    tia,
    powerBudgetDb,
    usableBudgetDb,
    predictedRxDbm,
    predictedRxMaxDbm,
    rawHeadroomDb,
    designHeadroomDb,
    overloadHeadroomDb,
    overloadBasisDb,
    overloadDefinitive,
    isOverloaded,
    status,
    reference,
    excludedConnections,
    selectedTestLimitDb,
    tiaTestLimitDb,
    measurement,
    errors: validation.errors,
    warnings: validation.warnings,
  };
}

export function validateScenario(input = {}) {
  const errors = [];
  const warnings = [];
  const requiredNonnegative = [
    ["lengthKm", input.lengthKm],
    ["attenuationDbPerKm", input.attenuationDbPerKm],
    ["connectionDb", input.connectionDb],
    ["fusionSpliceDb", input.fusionSpliceDb],
    ["mechanicalSpliceDb", input.mechanicalSpliceDb],
    ["engineeringMarginDb", input.engineeringMarginDb],
    ["measurementUncertaintyDb", input.measurementUncertaintyDb],
  ];
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
        errors.push(
          issue(
            "NON_INTEGER_QUANTITY",
            `${collectionName}[${index}].quantity`,
            "Component quantity must be a nonnegative whole number.",
          ),
        );
      }
      if (!Number.isFinite(Number(row.lossDb)) || Number(row.lossDb) < 0) {
        errors.push(
          issue(
            "INVALID_LOSS",
            `${collectionName}[${index}].lossDb`,
            "Component loss must be a nonnegative number.",
          ),
        );
      }
      if (collectionName === "extras" && !String(row.label ?? "").trim()) {
        errors.push(
          issue("MISSING_LABEL", `${collectionName}[${index}].label`, "Custom components need a label."),
        );
      }
    });
  }
  const powerValues = [input.txPowerDbm, input.txMaxDbm, input.rxSensitivityDbm, input.rxOverloadDbm];
  if (powerValues.some((value) => value === "" || value === null || value === undefined || !Number.isFinite(Number(value)))) {
    errors.push(issue("INVALID_POWER", "power", "Transmitter and receiver power values are required."));
  }
  if (Number(input.txMaxDbm) < Number(input.txPowerDbm)) {
    errors.push(issue("INVALID_TX_WINDOW", "txMaxDbm", "Transmitter maximum must be greater than or equal to transmitter minimum."));
  }
  if (Number(input.rxOverloadDbm) <= Number(input.rxSensitivityDbm)) {
    errors.push(
      issue(
        "INVALID_RECEIVER_WINDOW",
        "rxOverloadDbm",
        "Receiver overload must be greater than receiver sensitivity.",
      ),
    );
  }
  if (input.minimumPlantLossDb !== null && input.minimumPlantLossDb !== undefined && input.minimumPlantLossDb !== "") {
    if (!Number.isFinite(Number(input.minimumPlantLossDb)) || Number(input.minimumPlantLossDb) < 0) {
      errors.push(issue("INVALID_MINIMUM_LOSS", "minimumPlantLossDb", "Minimum plant loss must be a nonnegative number or left blank."));
    }
  }
  if (input.measuredLossDb !== null && input.measuredLossDb !== undefined && input.measuredLossDb !== "") {
    if (!Number.isFinite(Number(input.measuredLossDb))) {
      errors.push(issue("INVALID_MEASUREMENT", "measuredLossDb", "Measured loss must be numeric or left blank."));
    } else if (Number(input.measuredLossDb) < 0) {
      warnings.push(issue("NEGATIVE_MEASUREMENT", "measuredLossDb", "A negative passive-loss reading usually indicates reference or measurement uncertainty; review the test setup."));
    }
  }
  if (Number(input.txPowerDbm) - Number(input.rxSensitivityDbm) <= 0) {
    warnings.push(issue("NONPOSITIVE_BUDGET", "power", "The equipment power budget is zero or negative."));
  }
  if ((input.splitters?.length ?? 0) > 0) {
    warnings.push(
      issue(
        "SPLITTER_PATH_SCOPE",
        "splitters",
        "Splitter loss must represent only stages traversed by this selected optical path.",
      ),
    );
  }
  const fiber = FIBER_TYPES[input.fiberType];
  if (fiber?.family === "multimode") {
    warnings.push(
      issue(
        "DISPERSION_NOT_EVALUATED",
        "fiberType",
        "OM class affects bandwidth and reach; this calculator evaluates loss, not dispersion limits.",
      ),
    );
  }
  if (input.profile === "custom") {
    warnings.push(
      issue(
        "CUSTOM_PROFILE",
        "profile",
        "Custom values should be verified against project specifications or manufacturer data.",
      ),
    );
  }
  return { errors, warnings };
}

export function idealSplitterLoss(outputs) {
  return 10 * Math.log10(Math.max(1, finiteNumber(outputs, 1)));
}

function profileValues(scenario, profile) {
  const standard = STANDARD_PROFILES[profile];
  return {
    attenuationDbPerKm: attenuationFor(profile, scenario.fiberType, scenario.wavelengthNm),
    connectionDb: standard.connectionDb,
    fusionSpliceDb: standard.fusionSpliceDb,
    mechanicalSpliceDb: standard.mechanicalSpliceDb,
  };
}

function calculatePassive(scenario, allowances) {
  const fiberDb = scenario.lengthKm * nonnegative(allowances.attenuationDbPerKm);
  const connectionDb = scenario.connections * nonnegative(allowances.connectionDb);
  const fusionSpliceDb = scenario.fusionSplices * nonnegative(allowances.fusionSpliceDb);
  const mechanicalSpliceDb =
    scenario.mechanicalSplices * nonnegative(allowances.mechanicalSpliceDb);
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
  const totalDb = fiberDb + connectionDb + fusionSpliceDb + mechanicalSpliceDb + splitterDb + extraDb;
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
    splitterRows,
    extraRows,
    totalDb,
  };
}

function normalizeScenario(input) {
  const scenario = {
    ...structuredClone(DEFAULT_SCENARIO),
    ...structuredClone(input ?? {}),
  };
  scenario.lengthKm = nonnegative(scenario.lengthKm);
  scenario.connections = integerCount(scenario.connections);
  scenario.fusionSplices = integerCount(scenario.fusionSplices);
  scenario.mechanicalSplices = integerCount(scenario.mechanicalSplices);
  scenario.attenuationDbPerKm = nonnegative(scenario.attenuationDbPerKm);
  scenario.connectionDb = nonnegative(scenario.connectionDb);
  scenario.fusionSpliceDb = nonnegative(scenario.fusionSpliceDb);
  scenario.mechanicalSpliceDb = nonnegative(scenario.mechanicalSpliceDb);
  scenario.engineeringMarginDb = nonnegative(scenario.engineeringMarginDb);
  scenario.measurementUncertaintyDb = nonnegative(scenario.measurementUncertaintyDb);
  scenario.txPowerDbm = finiteNumber(scenario.txPowerDbm, DEFAULT_SCENARIO.txPowerDbm);
  scenario.txMaxDbm = finiteNumber(scenario.txMaxDbm, DEFAULT_SCENARIO.txMaxDbm);
  scenario.rxSensitivityDbm = finiteNumber(
    scenario.rxSensitivityDbm,
    DEFAULT_SCENARIO.rxSensitivityDbm,
  );
  scenario.rxOverloadDbm = finiteNumber(scenario.rxOverloadDbm, DEFAULT_SCENARIO.rxOverloadDbm);
  scenario.minimumPlantLossDb = nullableNumber(scenario.minimumPlantLossDb);
  scenario.measuredLossDb = nullableNumber(scenario.measuredLossDb);
  scenario.splitters = Array.isArray(scenario.splitters) ? scenario.splitters : [];
  scenario.extras = Array.isArray(scenario.extras) ? scenario.extras : [];
  return scenario;
}

function measurementResult(measuredLossDb, uncertaintyDb, limitDb) {
  if (measuredLossDb === null) return null;
  const measured = finiteNumber(measuredLossDb, 0);
  const uncertainty = nonnegative(uncertaintyDb);
  const lowerDb = measured - uncertainty;
  const upperDb = measured + uncertainty;
  let status = upperDb <= limitDb ? "pass" : lowerDb > limitDb ? "fail" : "review";
  return {
    measuredDb: measured,
    uncertaintyDb: uncertainty,
    lowerDb,
    upperDb,
    limitDb,
    status,
    deltaDb: limitDb - measured,
  };
}

function splitterOutputs(ratio) {
  const outputs = String(ratio).split(":")[1];
  return finiteNumber(outputs, 1);
}

function integerCount(value) {
  return Math.max(0, Math.round(finiteNumber(value, 0)));
}

function nullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
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
