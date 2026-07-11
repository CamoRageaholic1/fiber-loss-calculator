import {
  attenuationFor,
  DEFAULT_SCENARIO,
  FIBER_TYPES,
  PRESETS,
  REFERENCE_METHODS,
  SOURCES,
  SPLITTERS,
  STANDARD_PROFILES,
} from "./config.js";
import {
  applyProfileDefaults,
  calculateLink,
  createScenario,
  fromKilometers,
  syncFiberDefaults,
  toKilometers,
} from "./calculator.js";
import {
  buildReport,
  createPdfBytes,
  createXlsxBytes,
  downloadBytes,
} from "./exporters.js";
import { formatNumber } from "./format.js";

const STORAGE_KEY = "fiber-ledger-scenario-v1";
const app = document.querySelector("#app");
const liveRegion = document.querySelector("#live-region");
let scenario = loadInitialScenario();
let selectedRailKey = "fiber";
let announceTimer = 0;

app.innerHTML = buildShell();
bindEvents();
renderAll(true);

function buildShell() {
  return `
    <div class="app-shell">
      <header class="instrument-bar">
        <div class="brand-lockup">
          <span class="brand-mark" aria-hidden="true"><i></i></span>
          <span><h1>Fiber Ledger</h1><small>Optical link budget workstation</small></span>
        </div>
        <div class="bar-readout" aria-label="Live link summary">
          <div><span>Path</span><strong id="bar-length">—</strong></div>
          <div><span>Plant loss</span><strong id="bar-loss">—</strong></div>
          <div><span>Headroom</span><strong id="bar-headroom">—</strong></div>
        </div>
        <div class="bar-actions">
          <span class="autosave"><i></i> Local autosave</span>
          <button class="tool-button" type="button" data-action="share">Copy scenario link</button>
          <button class="tool-button" type="button" data-action="reset">Reset</button>
        </div>
      </header>

      <main class="workbench" id="calculator">
        <aside class="control-rack" aria-label="Link inputs">
          ${panel(
            "Scenario",
            "Link identity",
            `
              <label class="field"><span>Planning example</span>
                <select id="preset-select" aria-label="Planning example">
                  ${Object.entries(PRESETS).map(([key, preset]) => `<option value="${key}">${preset.label}</option>`).join("")}
                </select>
              </label>
              <label class="field"><span>Project / link name</span><input id="scenario-name" data-key="name" type="text" maxlength="90" /></label>
            `,
          )}
          ${panel(
            "Cable plant",
            "Fiber & distance",
            `
              <div class="field"><span>Length unit</span><div class="segmented" role="group" aria-label="Length unit">
                <button type="button" data-unit="ft">Feet</button><button type="button" data-unit="km">Kilometers</button>
              </div></div>
              <label class="field"><span>Selected path length</span><div class="input-unit"><input id="length-input" type="number" min="0" step="any" inputmode="decimal" /><b id="length-unit">ft</b></div><small>One end-to-end optical path, not total project cable footage.</small></label>
              <label class="field"><span>Fiber designation</span><select id="fiber-type">${fiberOptions()}</select></label>
              <label class="field"><span>Wavelength</span><select id="wavelength"></select></label>
              <div class="field"><span>Allowance profile</span><div class="profile-stack" role="group" aria-label="Allowance profile">
                ${Object.entries(STANDARD_PROFILES).map(([key, profile]) => `<button type="button" data-profile="${key}"><strong>${profile.shortLabel}</strong><small>${profile.description}</small></button>`).join("")}
              </div></div>
              <label class="field"><span>Fiber attenuation</span><div class="input-unit"><input id="attenuation" data-key="attenuationDbPerKm" data-customizes-profile type="number" min="0" step="0.01" inputmode="decimal" /><b>dB/km</b></div></label>
            `,
          )}
          ${panel(
            "Equipment",
            "Power window",
            `
              <div class="two-up">
                ${numberField("Tx minimum", "txPowerDbm", "dBm", "0.1")}
                ${numberField("Tx maximum", "txMaxDbm", "dBm", "0.1")}
                ${numberField("Rx sensitivity", "rxSensitivityDbm", "dBm", "0.1")}
                ${numberField("Rx overload", "rxOverloadDbm", "dBm", "0.1")}
                ${numberField("Minimum path loss", "minimumPlantLossDb", "dB", "0.1", 0, true)}
                ${numberField("Design margin", "engineeringMarginDb", "dB", "0.1", 0)}
              </div>
              <p class="microcopy">Use guaranteed transmitter and receiver limits from the equipment data sheet. Leave minimum path loss blank for an advisory overload estimate; enter a verified lower bound for a definitive check. The design margin stays separate from plant loss.</p>
            `,
          )}
        </aside>

        <section class="calculation-deck" aria-label="Loss budget calculations">
          ${panel(
            "Live optical path",
            "Loss budget rail",
            `<div id="budget-rail"></div><div id="rail-detail" class="rail-detail" role="region" aria-label="Selected loss event equation"></div>`,
            "stage-panel",
          )}
          ${panel(
            "Passive events",
            "Connections & splices",
            `
              <div class="component-grid">
                ${componentControl("Mated connections", "connections", "connectionDb", "pairs", "A connection is one mated pair. FOA's 0.30 dB typical default assumes adhesive/polish construction; splice-on and multifiber types may require 0.3–0.75 dB.")}
                ${componentControl("Fusion splices", "fusionSplices", "fusionSpliceDb", "splices", "FOA typical planning range is 0.05–0.15 dB; this calculator defaults to a conservative 0.15 dB.")}
                ${componentControl("Mechanical splices", "mechanicalSplices", "mechanicalSpliceDb", "splices", "FOA typical and ANSI/TIA maximum allowance are both 0.30 dB per mechanical splice.")}
              </div>
            `,
          )}
          ${panel(
            "Passive distribution",
            "Splitter stages",
            `<p class="microcopy">Add only splitters traversed by this receiver path. Cascaded stages add in dB; output ports do not multiply the loss.</p><div id="splitter-rows" class="dynamic-rows"></div><button class="add-button" type="button" data-action="add-splitter">+ Add splitter stage</button>`,
          )}
          ${panel(
            "Project-specific loss",
            "Other passive components",
            `<p class="microcopy">Add WDMs, filters, couplers, attenuators, restoration reserve, or manufacturer-specific events.</p><div id="extra-rows" class="dynamic-rows"></div><button class="add-button" type="button" data-action="add-extra">+ Add custom component</button>`,
          )}
          ${panel("Audit trail", "Every calculation", `<div id="equation-table"></div>`, "equation-panel")}
        </section>

        <aside class="result-rack" aria-label="Results and standards">
          <section id="result-card" class="result-card" aria-labelledby="result-title"><div class="eyebrow">Design verdict</div><h2 id="result-title">Calculating…</h2><div class="result-measure"><strong id="result-total">—</strong><b>dB</b></div><span>estimated passive loss</span><p id="result-copy"></p></section>
          ${panel("Budget", "Power & reserve", `<div id="power-metrics" class="metric-grid"></div>`)}
          ${panel("Cross-check", "Typical vs maximum", `<div id="profile-comparison"></div>`)}
          ${panel(
            "Field test",
            "OLTS comparison",
            `
              <label class="field"><span>Reference method</span><select id="reference-method">${Object.entries(REFERENCE_METHODS).map(([key, method]) => `<option value="${key}">${method.label}</option>`).join("")}</select></label>
              <div class="two-up">
                ${numberField("Measured loss", "measuredLossDb", "dB", "0.01", 0, true)}
                ${numberField("Uncertainty", "measurementUncertaintyDb", "±dB", "0.1", 0)}
              </div>
              <div id="measurement-result"></div>
            `,
          )}
          ${panel("Review", "Assumptions & warnings", `<div id="warnings"></div>`)}
          ${panel(
            "Deliverables",
            "Export report",
            `<div class="export-grid"><button type="button" data-export="xlsx"><strong>.XLSX</strong><span>Excel workbook</span></button><button type="button" data-export="pdf"><strong>.PDF</strong><span>Field report</span></button><button type="button" data-export="json"><strong>.JSON</strong><span>Full scenario data</span></button><button type="button" data-action="print"><strong>PRINT</strong><span>Print-ready view</span></button></div>`,
          )}
          ${panel(
            "Basis",
            "Standards references",
            `<ul class="source-list">${Object.values(SOURCES).map((source) => `<li><a href="${source.url}" target="_blank" rel="noreferrer">${source.label}</a></li>`).join("")}</ul><p class="disclaimer">Planning aid only. Project specifications, manufacturer data, application limits, and the current purchased standards govern acceptance. This tool does not certify TIA compliance.</p>`,
          )}
        </aside>
      </main>
      <footer><span>Fiber Ledger · Calculation method v1.0</span><span>All calculations and exports stay in this browser.</span></footer>
    </div>`;
}

function panel(eyebrow, title, body, className = "") {
  return `<section class="panel ${className}"><header><span><small>${eyebrow}</small><h2>${title}</h2></span></header><div class="panel-body">${body}</div></section>`;
}

function numberField(label, key, unit, step = "any", min = null, nullable = false) {
  const minAttribute = min === null ? "" : ` min="${min}"`;
  return `<label class="field compact"><span>${label}</span><div class="input-unit"><input data-key="${key}" type="number" step="${step}"${minAttribute} inputmode="decimal" ${nullable ? 'data-nullable="true"' : ""}/><b>${unit}</b></div></label>`;
}

function componentControl(label, quantityKey, lossKey, quantityUnit, note) {
  return `<fieldset class="component-card"><legend>${label}</legend><div class="component-equation"><label><span>Quantity</span><input data-key="${quantityKey}" type="number" min="0" step="1" inputmode="numeric" /></label><i>×</i><label><span>Loss each</span><div class="input-unit"><input data-key="${lossKey}" data-customizes-profile type="number" min="0" step="0.01" inputmode="decimal"/><b>dB</b></div></label><i>=</i><output id="${quantityKey}-subtotal">—</output></div><small>${note}</small><span class="quantity-unit">${quantityUnit}</span></fieldset>`;
}

function fiberOptions() {
  return Object.entries(FIBER_TYPES)
    .map(([key, fiber]) => `<option value="${key}">${fiber.label}</option>`)
    .join("");
}

function bindEvents() {
  app.addEventListener("input", handleInput);
  app.addEventListener("change", handleChange);
  app.addEventListener("click", handleClick);
}

function handleInput(event) {
  const target = event.target;
  if (target.id === "length-input") {
    scenario.lengthKm = target.value === "" ? "" : toKilometers(target.value, scenario.unit);
  } else if (target.dataset.key) {
    const key = target.dataset.key;
    scenario[key] = inputValue(target);
    if (target.hasAttribute("data-customizes-profile")) {
      scenario.profile = "custom";
      syncProfileButtons();
    }
  } else if (target.dataset.splitterId) {
    updateRow(scenario.splitters, target.dataset.splitterId, target.dataset.field, inputValue(target));
  } else if (target.dataset.extraId) {
    updateRow(scenario.extras, target.dataset.extraId, target.dataset.field, inputValue(target));
  } else return;
  persist();
  renderOutputs();
}

function handleChange(event) {
  const target = event.target;
  if (target.id === "preset-select") {
    applyPreset(target.value);
    return;
  }
  if (target.id === "fiber-type") {
    scenario.fiberType = target.value;
    syncFiberDefaults(scenario);
    persist();
    renderAll(false);
    return;
  }
  if (target.id === "wavelength") {
    scenario.wavelengthNm = Number(target.value);
    syncFiberDefaults(scenario);
    persist();
    renderAll(false);
    return;
  }
  if (target.id === "reference-method") {
    scenario.referenceMethod = target.value;
    persist();
    renderOutputs();
    return;
  }
  if (target.dataset.splitterId && target.dataset.field === "ratio") {
    const row = scenario.splitters.find((item) => item.id === target.dataset.splitterId);
    if (row) {
      row.ratio = target.value;
      row.lossDb = SPLITTERS[target.value].typicalDb;
      persist();
      renderAll(true);
    }
  }
}

function handleClick(event) {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.unit) {
    scenario.unit = button.dataset.unit;
    persist();
    renderAll(false);
  } else if (button.dataset.profile) {
    applyProfileDefaults(scenario, button.dataset.profile);
    persist();
    renderAll(false);
  } else if (button.dataset.action === "add-splitter") {
    scenario.splitters.push({ id: makeId("splitter"), ratio: "1:2", quantity: 1, lossDb: 3.6 });
    persist();
    renderAll(true);
  } else if (button.dataset.action === "add-extra") {
    scenario.extras.push({ id: makeId("extra"), label: "WDM / passive device", quantity: 1, lossDb: 0.5 });
    persist();
    renderAll(true);
  } else if (button.dataset.removeSplitter) {
    scenario.splitters = scenario.splitters.filter((row) => row.id !== button.dataset.removeSplitter);
    selectedRailKey = "fiber";
    persist();
    renderAll(true);
  } else if (button.dataset.removeExtra) {
    scenario.extras = scenario.extras.filter((row) => row.id !== button.dataset.removeExtra);
    selectedRailKey = "fiber";
    persist();
    renderAll(true);
  } else if (button.dataset.railKey) {
    selectedRailKey = button.dataset.railKey;
    renderOutputs();
  } else if (button.dataset.export) {
    exportReport(button.dataset.export);
  } else if (button.dataset.action === "print") {
    window.print();
  } else if (button.dataset.action === "share") {
    copyScenarioLink(button);
  } else if (button.dataset.action === "reset") {
    scenario = createScenario();
    selectedRailKey = "fiber";
    document.querySelector("#preset-select").value = "blank";
    persist();
    renderAll(true);
    announce("Calculator reset to a blank optical link.");
  }
}

function renderAll(renderRows) {
  syncControls();
  if (renderRows) renderDynamicRows();
  renderOutputs();
}

function syncControls() {
  setControl("scenario-name", scenario.name);
  setControl("length-input", formatInput(fromKilometers(scenario.lengthKm, scenario.unit), scenario.unit));
  setText("length-unit", scenario.unit);
  setControl("fiber-type", scenario.fiberType);
  const wavelength = document.querySelector("#wavelength");
  const validWavelengths = FIBER_TYPES[scenario.fiberType]?.wavelengths ?? [1310, 1550];
  wavelength.innerHTML = validWavelengths.map((value) => `<option value="${value}">${value} nm</option>`).join("");
  wavelength.value = String(scenario.wavelengthNm);
  setControl("attenuation", scenario.attenuationDbPerKm);
  setControl("reference-method", scenario.referenceMethod);
  document.querySelectorAll("[data-key]").forEach((input) => {
    if (input.id === "scenario-name" || input.id === "attenuation") return;
    setControlElement(input, scenario[input.dataset.key]);
  });
  document.querySelectorAll("[data-unit]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.unit === scenario.unit));
  });
  syncProfileButtons();
}

function syncProfileButtons() {
  document.querySelectorAll("[data-profile]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.profile === scenario.profile));
  });
}

function renderDynamicRows() {
  const splitterContainer = document.querySelector("#splitter-rows");
  splitterContainer.innerHTML = scenario.splitters.length
    ? scenario.splitters.map(splitterRowMarkup).join("")
    : `<div class="empty-row">No splitter stages on this path.</div>`;
  const extraContainer = document.querySelector("#extra-rows");
  extraContainer.innerHTML = scenario.extras.length
    ? scenario.extras.map(extraRowMarkup).join("")
    : `<div class="empty-row">No additional passive loss.</div>`;
}

function splitterRowMarkup(row, index) {
  const options = Object.entries(SPLITTERS)
    .map(([ratio, value]) => `<option value="${ratio}" ${ratio === row.ratio ? "selected" : ""}>${ratio} · ${value.typicalDb} dB typical</option>`)
    .join("");
  return `<div class="dynamic-row"><span class="row-index">S${index + 1}</span><label><span>Ratio</span><select data-splitter-id="${row.id}" data-field="ratio">${options}</select></label><label><span>Stages</span><input type="number" min="0" step="1" data-splitter-id="${row.id}" data-field="quantity" value="${escapeAttribute(row.quantity)}" /></label><label><span>Insertion loss</span><div class="input-unit"><input type="number" min="0" step="0.01" data-splitter-id="${row.id}" data-field="lossDb" value="${escapeAttribute(row.lossDb)}"/><b>dB</b></div></label><output>${formatDb(Number(row.quantity) * Number(row.lossDb))}</output><button class="remove-button" type="button" data-remove-splitter="${row.id}" aria-label="Remove splitter stage ${index + 1}">×</button></div>`;
}

function extraRowMarkup(row, index) {
  return `<div class="dynamic-row extra-row"><span class="row-index">P${index + 1}</span><label><span>Component</span><input type="text" maxlength="60" data-extra-id="${row.id}" data-field="label" value="${escapeAttribute(row.label)}" /></label><label><span>Quantity</span><input type="number" min="0" step="1" data-extra-id="${row.id}" data-field="quantity" value="${escapeAttribute(row.quantity)}" /></label><label><span>Loss each</span><div class="input-unit"><input type="number" min="0" step="0.01" data-extra-id="${row.id}" data-field="lossDb" value="${escapeAttribute(row.lossDb)}"/><b>dB</b></div></label><output>${formatDb(Number(row.quantity) * Number(row.lossDb))}</output><button class="remove-button" type="button" data-remove-extra="${row.id}" aria-label="Remove custom component ${index + 1}">×</button></div>`;
}

function renderOutputs() {
  const link = calculateLink(scenario);
  renderHeader(link);
  renderComponentSubtotals(link);
  renderRail(link);
  renderEquations(link);
  renderResults(link);
  renderComparison(link);
  renderMeasurement(link);
  renderWarnings(link);
  document.querySelectorAll("[data-export]").forEach((button) => {
    button.disabled = link.errors.length > 0;
    button.title = link.errors.length ? "Resolve input errors before exporting." : "";
  });
  scheduleAnnouncement(link);
}

function renderHeader(link) {
  const entered = fromKilometers(link.scenario.lengthKm, link.scenario.unit);
  setText("bar-length", `${format(entered, link.scenario.unit === "ft" ? 0 : 3)} ${link.scenario.unit}`);
  setText("bar-loss", formatDb(link.selected.totalDb));
  setText("bar-headroom", `${signed(link.designHeadroomDb)} dB`);
}

function renderComponentSubtotals(link) {
  setText("connections-subtotal", formatDb(link.selected.connectionDb));
  setText("fusionSplices-subtotal", formatDb(link.selected.fusionSpliceDb));
  setText("mechanicalSplices-subtotal", formatDb(link.selected.mechanicalSpliceDb));
}

function railItems(link) {
  return [
    { key: "fiber", label: "Fiber", lossDb: link.selected.fiberDb, equation: `${format(link.scenario.lengthKm, 6)} km × ${format(link.scenario.attenuationDbPerKm, 3)} dB/km` },
    { key: "connections", label: "Connections", lossDb: link.selected.connectionDb, equation: `${link.scenario.connections} pairs × ${format(link.scenario.connectionDb, 3)} dB` },
    { key: "fusion", label: "Fusion splices", lossDb: link.selected.fusionSpliceDb, equation: `${link.scenario.fusionSplices} × ${format(link.scenario.fusionSpliceDb, 3)} dB` },
    { key: "mechanical", label: "Mechanical", lossDb: link.selected.mechanicalSpliceDb, equation: `${link.scenario.mechanicalSplices} × ${format(link.scenario.mechanicalSpliceDb, 3)} dB` },
    ...link.selected.splitterRows.map((row, index) => ({ key: `splitter:${row.id}`, label: `Splitter ${index + 1} · ${row.ratio}`, lossDb: row.subtotalDb, equation: `${row.quantity} stages × ${format(row.lossDb, 3)} dB` })),
    ...link.selected.extraRows.map((row, index) => ({ key: `extra:${row.id}`, label: row.label || `Passive ${index + 1}`, lossDb: row.subtotalDb, equation: `${row.quantity} × ${format(row.lossDb, 3)} dB` })),
  ].filter((item) => item.lossDb > 0 || ["fiber", "connections"].includes(item.key));
}

function renderRail(link) {
  const items = railItems(link);
  if (!items.some((item) => item.key === selectedRailKey)) selectedRailKey = items[0]?.key ?? "fiber";
  const scale = Math.max(link.usableBudgetDb, link.selected.totalDb, 0.01);
  const consumed = Math.min(100, (link.selected.totalDb / scale) * 100);
  const stateClass = link.status === "pass" ? "pass" : link.status === "review" ? "review" : "fail";
  document.querySelector("#budget-rail").innerHTML = `
    <div class="rail-labels"><span>TX ${formatDbm(link.scenario.txPowerDbm)}</span><span>${format(link.selected.totalDb, 2)} dB consumed</span><span>RX ${formatDbm(link.predictedRxDbm)}</span></div>
    <div class="loss-node-track"><span class="terminal tx-terminal">TX</span>${items.map((item) => `<button type="button" class="loss-node ${item.key === selectedRailKey ? "selected" : ""}" data-rail-key="${item.key}" aria-pressed="${item.key === selectedRailKey}" aria-controls="rail-detail" style="--node-share:${Math.max(7, (item.lossDb / scale) * 100)}%"><small>${escapeHtml(item.label)}</small><strong>${format(item.lossDb, 2)} dB</strong></button>`).join("")}<span class="terminal rx-terminal">RX</span></div>
    <div class="budget-meter ${stateClass}" role="meter" aria-label="Usable optical loss budget consumed" aria-valuemin="0" aria-valuemax="${scale}" aria-valuenow="${Math.min(link.selected.totalDb, scale)}"><i style="width:${consumed}%"></i><span>0 dB</span><span>${format(link.usableBudgetDb, 2)} dB usable</span></div>`;
  const selected = items.find((item) => item.key === selectedRailKey) ?? items[0];
  document.querySelector("#rail-detail").innerHTML = selected
    ? `<span>Selected event</span><strong>${escapeHtml(selected.label)}</strong><code>${escapeHtml(selected.equation)} = ${format(selected.lossDb, 4)} dB</code>`
    : "";
}

function renderEquations(link) {
  const rows = railItems(link);
  document.querySelector("#equation-table").innerHTML = `<div class="table-wrap"><table><caption>Selected-profile loss equations</caption><thead><tr><th>Event</th><th>Substitution</th><th>Total</th></tr></thead><tbody>${rows.map((row) => `<tr><th>${escapeHtml(row.label)}</th><td><code>${escapeHtml(row.equation)}</code></td><td>${formatDb(row.lossDb)}</td></tr>`).join("")}<tr class="total-row"><th>Passive plant loss</th><td>Σ all selected-path events</td><td>${formatDb(link.selected.totalDb)}</td></tr><tr><th>Predicted receive power</th><td><code>${format(link.scenario.txPowerDbm, 2)} dBm − ${format(link.selected.totalDb, 4)} dB</code></td><td>${formatDbm(link.predictedRxDbm)}</td></tr><tr><th>Design headroom</th><td><code>${format(link.powerBudgetDb, 2)} − ${format(link.selected.totalDb, 4)} − ${format(link.scenario.engineeringMarginDb, 2)}</code></td><td>${signed(link.designHeadroomDb)} dB</td></tr></tbody></table></div>`;
}

function renderResults(link) {
  const card = document.querySelector("#result-card");
  card.className = `result-card ${link.status}`;
  let title = "DESIGN PASSES";
  let copy = `${format(link.designHeadroomDb, 2)} dB remains after the engineering margin.`;
  if (link.status === "invalid") {
    title = "CHECK INPUTS";
    copy = "Resolve the listed input errors before using or exporting this result.";
  } else if (link.designHeadroomDb < 0) {
    title = "BUDGET EXCEEDED";
    copy = `The path needs ${format(Math.abs(link.designHeadroomDb), 2)} dB more usable budget.`;
    if (link.isOverloaded) {
      copy += link.overloadDefinitive
        ? " Receiver overload also fails at the entered minimum path loss."
        : " A separate overload advisory also triggered at the selected loss."
    }
  } else if (link.isOverloaded && link.overloadDefinitive) {
    title = "OVERLOAD RISK";
    copy = `At the entered minimum path loss, receive power is ${format(Math.abs(link.overloadHeadroomDb), 2)} dB above the receiver maximum.`;
  } else if (link.isOverloaded) {
    title = "REVIEW OVERLOAD";
    copy = `Advisory only: Tx maximum at the selected loss is ${format(Math.abs(link.overloadHeadroomDb), 2)} dB above the receiver maximum. Enter minimum path loss for a definitive check.`;
  } else if (link.status === "review") {
    title = "TIGHT MARGIN";
    copy = `Only ${format(link.designHeadroomDb, 2)} dB remains after the requested margin.`;
  }
  setText("result-title", title);
  setText("result-total", format(link.selected.totalDb, 2));
  setText("result-copy", copy);
  document.querySelector("#power-metrics").innerHTML = [
    ["Tx minimum", formatDbm(link.scenario.txPowerDbm)],
    ["Power budget", formatDb(link.powerBudgetDb)],
    ["Usable budget", formatDb(link.usableBudgetDb)],
    ["Predicted Rx", formatDbm(link.predictedRxDbm)],
    [link.overloadDefinitive ? "Worst-case Rx" : "Rx at Tx max · advisory", formatDbm(link.predictedRxMaxDbm)],
    ["Raw headroom", `${signed(link.rawHeadroomDb)} dB`],
    ["Design headroom", `${signed(link.designHeadroomDb)} dB`],
  ].map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join("");
}

function renderComparison(link) {
  document.querySelector("#profile-comparison").innerHTML = `<div class="comparison-stack"><div><span>FOA typical estimate</span><strong>${formatDb(link.typical.totalDb)}</strong></div><div class="active"><span>Current editable design</span><strong>${formatDb(link.selected.totalDb)}</strong></div><div><span>TIA component allowances + entered device IL</span><strong>${formatDb(link.tia.totalDb)}</strong></div></div><p class="microcopy">Splitter and custom-component insertion losses remain the entered manufacturer/FOA values; this is not a pure ANSI/TIA device maximum.</p>`;
}

function renderMeasurement(link) {
  const container = document.querySelector("#measurement-result");
  if (!link.measurement) {
    container.innerHTML = `<div class="measurement empty"><strong>${formatDb(link.tiaTestLimitDb)}</strong><span>Component-adjusted test limit for ${link.reference.label.toLowerCase()}</span><small>${link.reference.note}</small></div>`;
    return;
  }
  container.innerHTML = `<div class="measurement ${link.measurement.status}"><strong>${link.measurement.status.toUpperCase()}</strong><span>${format(link.measurement.measuredDb, 2)} dB measured · ${format(link.tiaTestLimitDb, 2)} dB limit</span><small>Uncertainty range ${format(link.measurement.lowerDb, 2)}–${format(link.measurement.upperDb, 2)} dB. Review results near the limit rather than treating estimates as absolute.</small></div>`;
}

function renderWarnings(link) {
  const items = [
    ...link.errors.map((item) => ({ ...item, type: "error" })),
    ...link.warnings.map((item) => ({ ...item, type: "warning" })),
    { type: "note", message: "ANSI/TIA values shown here are component allowances summarized by FOA 2025, not a universal application channel budget or certification." },
    { type: "note", message: "Inspect, clean, and re-inspect end faces before testing. OTDR event loss does not replace end-to-end OLTS/LSPM insertion-loss qualification." },
  ];
  document.querySelector("#warnings").innerHTML = `<ul class="warning-list">${items.map((item) => `<li class="${item.type}"><i aria-hidden="true"></i><span>${escapeHtml(item.message)}</span></li>`).join("")}</ul>`;
}

function applyPreset(name) {
  const preset = PRESETS[name] ?? PRESETS.blank;
  scenario = createScenario({ ...structuredClone(DEFAULT_SCENARIO), ...structuredClone(preset.patch) });
  selectedRailKey = "fiber";
  persist();
  renderAll(true);
  announce(`${preset.label} loaded.`);
}

function exportReport(type) {
  const link = calculateLink(scenario);
  if (link.errors.length) return;
  const report = buildReport(link);
  const base = slugify(scenario.name || "fiber-link-budget");
  if (type === "xlsx") {
    downloadBytes(createXlsxBytes(report), `${base}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  } else if (type === "pdf") {
    downloadBytes(createPdfBytes(report), `${base}.pdf`, "application/pdf");
  } else {
    const payload = { schemaVersion: 1, scenario, result: link, report };
    downloadBytes(new TextEncoder().encode(JSON.stringify(payload, null, 2)), `${base}.json`, "application/json");
  }
  announce(`${type.toUpperCase()} report exported.`);
}

async function copyScenarioLink(button) {
  const encoded = encodeScenario(scenario);
  const url = new URL(window.location.href);
  url.searchParams.delete("scenario");
  url.hash = `scenario=${encoded}`;
  try {
    await navigator.clipboard.writeText(url.toString());
    const original = button.textContent;
    button.textContent = "Link copied";
    setTimeout(() => (button.textContent = original), 1400);
    announce("Shareable scenario link copied.");
  } catch {
    window.history.replaceState(null, "", url);
    announce("Scenario added to the current address. Copy it from the address bar.");
  }
}

function loadInitialScenario() {
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
  const urlValue = new URLSearchParams(hash).get("scenario");
  if (urlValue) {
    try {
      return createScenario(decodeScenario(urlValue));
    } catch {
      // Fall through to local storage.
    }
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? createScenario(JSON.parse(saved)) : createScenario();
  } catch {
    return createScenario();
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scenario));
  } catch {
    // Calculation remains fully usable when storage is unavailable.
  }
}

function encodeScenario(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function decodeScenario(value) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

function updateRow(collection, id, field, value) {
  const row = collection.find((item) => item.id === id);
  if (row) row[field] = value;
}

function inputValue(input) {
  if (input.type === "number") {
    if (input.value === "") return input.dataset.nullable === "true" ? null : "";
    return Number(input.value);
  }
  return input.value;
}

function setControl(id, value) {
  const element = document.querySelector(`#${id}`);
  if (element) setControlElement(element, value);
}

function setControlElement(element, value) {
  if (document.activeElement === element) return;
  element.value = value === null || value === undefined ? "" : String(value);
}

function setText(id, value) {
  const element = document.querySelector(`#${id}`);
  if (element) element.textContent = value;
}

function scheduleAnnouncement(link) {
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => {
    announce(`Plant loss ${format(link.selected.totalDb, 2)} decibels. Design headroom ${format(link.designHeadroomDb, 2)} decibels. ${link.status}.`);
  }, 650);
}

function announce(message) {
  liveRegion.textContent = "";
  requestAnimationFrame(() => (liveRegion.textContent = message));
}

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function slugify(value) {
  return String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "fiber-link-budget";
}

function formatInput(value, unit) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  return unit === "ft" ? number.toFixed(2).replace(/\.00$/, "") : number.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}

function format(value, digits = 2) {
  return formatNumber(value, digits);
}

function formatDb(value) {
  return `${format(value, 2)} dB`;
}

function formatDbm(value) {
  return `${signed(value)} dBm`;
}

function signed(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  if (Math.abs(number) < 0.0005) return "0.00";
  return `${number > 0 ? "+" : "−"}${Math.abs(number).toFixed(2)}`;
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value ?? "");
}
