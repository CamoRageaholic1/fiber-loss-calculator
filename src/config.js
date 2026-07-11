export const SOURCES = Object.freeze({
  foaInstallation: {
    label: "FOA Installation Standard 2025 V1",
    url: "https://www.foa.org/tech/ref/1pstandards/FOA%20Installation%20Standard%202025%20V1.pdf",
  },
  tia568: {
    label: "ANSI/TIA-568.3-E announcement",
    url: "https://tiaonline.org/standardannouncement/tia-issues-updated-optical-fiber-cabling-component-standard-ansi-tia-568-3-e/",
  },
  foaBudget: {
    label: "FOA loss-budget reference",
    url: "https://www.foa.org/tech/lossbudg.htm",
  },
  foaSplitters: {
    label: "FOA Optical Splitters (2024)",
    url: "https://foa.org/tech/ref/install/Optical_splitter.html",
  },
  foaNomenclature: {
    label: "FOA cable-plant nomenclature",
    url: "https://www.foa.org/tech/OM.html",
  },
});

export const FIBER_TYPES = Object.freeze({
  om1: { label: "OM1 · 62.5/125 µm", family: "multimode", environment: "premises", wavelengths: [850, 1300] },
  om2: { label: "OM2 · 50/125 µm", family: "multimode", environment: "premises", wavelengths: [850, 1300] },
  om3: { label: "OM3 · laser optimized", family: "multimode", environment: "premises", wavelengths: [850, 1300] },
  om4: { label: "OM4 · laser optimized", family: "multimode", environment: "premises", wavelengths: [850, 1300] },
  om5: { label: "OM5 · wideband MMF", family: "multimode", environment: "premises", wavelengths: [850, 1300] },
  os1: { label: "OS1 / OS1a · premises SM", family: "singlemode", environment: "premises", wavelengths: [1310, 1550] },
  os2: { label: "OS2 · outside-plant SM", family: "singlemode", environment: "outside-plant", wavelengths: [1310, 1550] },
});

export const STANDARD_PROFILES = Object.freeze({
  typical: {
    label: "FOA typical planning",
    shortLabel: "FOA typical",
    description: "FOA planning values; 0.30 dB connections assume adhesive/polish construction.",
    connectionDb: 0.3,
    fusionSpliceDb: 0.15,
    mechanicalSpliceDb: 0.3,
  },
  tia: {
    label: "ANSI/TIA maximum allowance",
    shortLabel: "TIA maximum",
    description: "Worst-case ANSI/TIA-568 component allowances summarized by FOA 2025.",
    connectionDb: 0.75,
    fusionSpliceDb: 0.3,
    mechanicalSpliceDb: 0.3,
  },
  custom: {
    label: "Custom / manufacturer",
    shortLabel: "Custom",
    description: "Project or manufacturer values. Verify them against the governing specification.",
  },
});

export const ATTENUATION = Object.freeze({
  typical: {
    multimode: { 850: 3.0, 1300: 1.0 },
    "singlemode:premises": { 1310: 0.5, 1550: 0.5 },
    "singlemode:outside-plant": { 1310: 0.4, 1550: 0.3 },
  },
  tia: {
    multimode: { 850: 3.5, 1300: 1.5 },
    "singlemode:premises": { 1310: 1.0, 1550: 1.0 },
    "singlemode:outside-plant": { 1310: 0.5, 1550: 0.5 },
  },
});

export const SPLITTERS = Object.freeze({
  "1:2": { outputs: 2, idealDb: 3.0, typicalDb: 3.6 },
  "1:4": { outputs: 4, idealDb: 6.0, typicalDb: 6.8 },
  "1:8": { outputs: 8, idealDb: 9.0, typicalDb: 10.0 },
  "1:16": { outputs: 16, idealDb: 12.0, typicalDb: 13.0 },
  "1:32": { outputs: 32, idealDb: 15.0, typicalDb: 16.0 },
  "1:64": { outputs: 64, idealDb: 18.0, typicalDb: 19.5 },
});

export const REFERENCE_METHODS = Object.freeze({
  "1-cord": {
    label: "1-cord reference · both ends measured",
    excludedConnections: 0,
    note: "Preferred FOA method when the test set supports the installed connector type.",
  },
  "2-cord": {
    label: "2-cord reference · one end normalized out",
    excludedConnections: 1,
    note: "The expected measured limit is reduced by one connection allowance.",
  },
  "3-cord": {
    label: "3-cord reference · both ends normalized out",
    excludedConnections: 2,
    note: "Common for plug-and-jack styles such as MPO; two connection allowances are removed.",
  },
});

export const DEFAULT_SCENARIO = Object.freeze({
  name: "New optical link",
  unit: "ft",
  lengthKm: 0.3048,
  fiberType: "os2",
  wavelengthNm: 1310,
  profile: "typical",
  attenuationDbPerKm: 0.4,
  connections: 2,
  connectionDb: 0.3,
  fusionSplices: 0,
  fusionSpliceDb: 0.15,
  mechanicalSplices: 0,
  mechanicalSpliceDb: 0.3,
  splitters: [],
  extras: [],
  txPowerDbm: -3,
  txMaxDbm: -1,
  rxSensitivityDbm: -18,
  rxOverloadDbm: -1,
  minimumPlantLossDb: null,
  engineeringMarginDb: 3,
  referenceMethod: "1-cord",
  measuredLossDb: null,
  measurementUncertaintyDb: 0.5,
});

export const PRESETS = Object.freeze({
  blank: { label: "Blank link", patch: {} },
  lan: {
    label: "100 m OM4 LAN example",
    patch: {
      name: "100 m OM4 LAN",
      unit: "ft",
      lengthKm: 0.1,
      fiberType: "om4",
      wavelengthNm: 850,
      connections: 4,
      fusionSplices: 0,
      txPowerDbm: -2,
      txMaxDbm: 0,
      rxSensitivityDbm: -10,
      rxOverloadDbm: 0,
      engineeringMarginDb: 2,
    },
  },
  campus: {
    label: "2 km OS2 campus example",
    patch: {
      name: "2 km OS2 campus backbone",
      unit: "km",
      lengthKm: 2,
      fiberType: "os2",
      wavelengthNm: 1310,
      connections: 4,
      fusionSplices: 4,
      txPowerDbm: -3,
      txMaxDbm: 0,
      rxSensitivityDbm: -18,
      rxOverloadDbm: -1,
      engineeringMarginDb: 3,
    },
  },
  pon: {
    label: "10 km 1:32 PON planning example",
    patch: {
      name: "10 km 1:32 PON planning path",
      unit: "km",
      lengthKm: 10,
      fiberType: "os2",
      wavelengthNm: 1550,
      connections: 4,
      fusionSplices: 8,
      txPowerDbm: 4,
      txMaxDbm: 7,
      rxSensitivityDbm: -28,
      rxOverloadDbm: -8,
      engineeringMarginDb: 3,
      splitters: [{ id: "preset-pon-32", ratio: "1:32", quantity: 1, lossDb: 16 }],
    },
  },
});

export function attenuationFor(profile, fiberType, wavelengthNm) {
  if (profile === "custom") return null;
  const fiber = FIBER_TYPES[fiberType] ?? FIBER_TYPES.os2;
  const key = fiber.family === "multimode" ? "multimode" : `${fiber.family}:${fiber.environment}`;
  return ATTENUATION[profile]?.[key]?.[Number(wavelengthNm)] ?? null;
}
