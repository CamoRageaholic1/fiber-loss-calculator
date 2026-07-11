export const APP_VERSION = "1.1";

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
  ituGpon: {
    label: "ITU-T G.984.2 · GPON PMD",
    url: "https://www.itu.int/rec/T-REC-G.984.2-201908-I/en",
  },
  ituGponCoexistence: {
    label: "ITU-T G.984.5 · GPON coexistence",
    url: "https://www.itu.int/rec/T-REC-G.984.5-202202-I/en",
  },
  ituXgs: {
    label: "ITU-T G.9807.1 · XGS-PON",
    url: "https://www.itu.int/epublications/publication/itu-t-g-9807-1-2023-amd-1-2025-05",
  },
  ituCoexistence: {
    label: "ITU-T G.9805 · PON coexistence",
    url: "https://www.itu.int/epublications/publication/itu-t-g-9805-2022-amd-2-2025-11",
  },
  bbfPonTesting: {
    label: "Broadband Forum TR-423 · PON PMD testing",
    url: "https://www.broadband-forum.org/pdfs/tr-423-1-0-0.pdf",
  },
  foaOtdr: {
    label: "FOA OTDR reference",
    url: "https://www.foa.org/tech/ref/testing/OTDR/OTDR.html",
  },
});

export const FIBER_TYPES = Object.freeze({
  om1: { label: "OM1 · 62.5/125 µm", family: "multimode", environment: "premises", wavelengths: [850, 1300] },
  om2: { label: "OM2 · 50/125 µm", family: "multimode", environment: "premises", wavelengths: [850, 1300] },
  om3: { label: "OM3 · laser optimized", family: "multimode", environment: "premises", wavelengths: [850, 1300] },
  om4: { label: "OM4 · laser optimized", family: "multimode", environment: "premises", wavelengths: [850, 1300] },
  om5: { label: "OM5 · wideband MMF", family: "multimode", environment: "premises", wavelengths: [850, 1300] },
  os1: { label: "OS1 / OS1a · premises SM", family: "singlemode", environment: "premises", wavelengths: [1310, 1550] },
  os2: { label: "OS2 · outside-plant SM", family: "singlemode", environment: "outside-plant", wavelengths: [1270, 1310, 1490, 1550, 1577] },
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
    "singlemode:outside-plant": { 1270: 0.4, 1310: 0.4, 1490: 0.3, 1550: 0.3, 1577: 0.3 },
  },
  tia: {
    multimode: { 850: 3.5, 1300: 1.5 },
    "singlemode:premises": { 1310: 1.0, 1550: 1.0 },
    "singlemode:outside-plant": { 1270: 0.5, 1310: 0.5, 1490: 0.5, 1550: 0.5, 1577: 0.5 },
  },
});

export const SPLITTERS = Object.freeze({
  "1:2": { outputs: 2, idealDb: 3.0, typicalDb: 3.6 },
  "1:4": { outputs: 4, idealDb: 6.0, typicalDb: 6.8 },
  "1:8": { outputs: 8, idealDb: 9.0, typicalDb: 10.0 },
  "1:16": { outputs: 16, idealDb: 12.0, typicalDb: 13.0 },
  "1:32": { outputs: 32, idealDb: 15.0, typicalDb: 16.0 },
  "1:64": { outputs: 64, idealDb: 18.0, typicalDb: 19.5 },
  "1:128": { outputs: 128, idealDb: 21.0721, typicalDb: 24.0 },
});

export const PON_CHANNELS = Object.freeze({
  gponBPlus: {
    id: "gpon-bplus",
    label: "GPON B+",
    technology: "GPON",
    standard: "ITU-T G.984.2",
    direction: "OLT → ONT",
    wavelengthNm: 1490,
    upstreamWavelengthNm: 1310,
    attenuationDbPerKm: 0.3,
    upstreamAttenuationDbPerKm: 0.4,
    txPowerDbm: 1.5,
    txMaxDbm: 5,
    rxSensitivityDbm: -27,
    rxOverloadDbm: -8,
    opticalPenaltyDb: 0.5,
    minimumOdnLossDb: 13,
    maximumOdnLossDb: 28,
    coexistenceLossDb: 0.8,
    upstreamCoexistenceLossDb: 0.8,
  },
  xgsN1: {
    id: "xgs-n1",
    label: "XGS-PON N1",
    technology: "XGS-PON",
    standard: "ITU-T G.9807.1",
    direction: "OLT → ONT",
    wavelengthNm: 1577,
    upstreamWavelengthNm: 1270,
    attenuationDbPerKm: 0.3,
    upstreamAttenuationDbPerKm: 0.4,
    txPowerDbm: 2,
    txMaxDbm: 5,
    rxSensitivityDbm: -28,
    rxOverloadDbm: -9,
    opticalPenaltyDb: 1,
    minimumOdnLossDb: 14,
    maximumOdnLossDb: 29,
    coexistenceLossDb: 1,
    upstreamCoexistenceLossDb: 1,
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
  channels: [],
  diagnosticServiceId: "primary",
  otdrForwardLossDb: null,
  otdrReverseLossDb: null,
  otdrUncertaintyDb: 0.5,
  oltTxDbm: null,
  ontRxDbm: null,
  ontTxDbm: null,
  oltRxDbm: null,
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
  ponCombo: {
    label: "GPON B+ + XGS-PON N1 coexistence · 1:64",
    patch: {
      name: "GPON + XGS-PON coexistence path",
      unit: "km",
      lengthKm: 5,
      fiberType: "os2",
      wavelengthNm: 1490,
      connections: 4,
      fusionSplices: 4,
      engineeringMarginDb: 2,
      splitters: [{ id: "preset-combo-64", ratio: "1:64", quantity: 1, lossDb: 19.5 }],
      channels: [structuredClone(PON_CHANNELS.gponBPlus), structuredClone(PON_CHANNELS.xgsN1)],
      diagnosticServiceId: "gpon-bplus",
    },
  },
  pon128: {
    label: "GPON + XGS-PON 1:128 stress test",
    patch: {
      name: "GPON + XGS-PON 1:128 stress test",
      unit: "km",
      lengthKm: 2,
      fiberType: "os2",
      wavelengthNm: 1490,
      connections: 2,
      fusionSplices: 2,
      engineeringMarginDb: 2,
      splitters: [{ id: "preset-combo-128", ratio: "1:128", quantity: 1, lossDb: 24 }],
      channels: [structuredClone(PON_CHANNELS.gponBPlus), structuredClone(PON_CHANNELS.xgsN1)],
      diagnosticServiceId: "gpon-bplus",
    },
  },
});

export function attenuationFor(profile, fiberType, wavelengthNm) {
  if (profile === "custom") return null;
  const fiber = FIBER_TYPES[fiberType] ?? FIBER_TYPES.os2;
  const key = fiber.family === "multimode" ? "multimode" : `${fiber.family}:${fiber.environment}`;
  return ATTENUATION[profile]?.[key]?.[Number(wavelengthNm)] ?? null;
}
