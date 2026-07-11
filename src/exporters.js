import { FIBER_TYPES, SOURCES, STANDARD_PROFILES } from "./config.js";
import { fromKilometers } from "./calculator.js";
import { formatNumber } from "./format.js";

const encoder = new TextEncoder();

export function buildReport(link, generatedAt = new Date()) {
  const { scenario, selected, typical, tia } = link;
  const enteredLength = fromKilometers(scenario.lengthKm, scenario.unit);
  const unitLabel = scenario.unit === "ft" ? "ft" : "km";
  const rows = [
    row("Fiber", `${FIBER_TYPES[scenario.fiberType]?.label ?? scenario.fiberType} at ${scenario.wavelengthNm} nm`, scenario.lengthKm, "km", selected.attenuationDbPerKm, selected.fiberDb),
    row("Connections", "Mated connector pairs", scenario.connections, "pairs", scenario.connectionDb, selected.connectionDb),
    row("Splices", "Fusion splices", scenario.fusionSplices, "events", scenario.fusionSpliceDb, selected.fusionSpliceDb),
    row("Splices", "Mechanical splices", scenario.mechanicalSplices, "events", scenario.mechanicalSpliceDb, selected.mechanicalSpliceDb),
    ...selected.splitterRows.map((item) =>
      row("Splitters", `${item.ratio} splitter on selected path`, item.quantity, "stages", item.lossDb, item.subtotalDb),
    ),
    ...selected.extraRows.map((item) =>
      row("Other", item.label || "Custom passive component", item.quantity, "items", item.lossDb, item.subtotalDb),
    ),
  ];

  return {
    title: "Fiber Ledger — Optical Link Budget Report",
    generated: generatedAt.toISOString(),
    scenarioName: scenario.name,
    inputs: [
      ["Entered length", `${format(enteredLength, scenario.unit === "ft" ? 1 : 4)} ${unitLabel}`],
      ["Normalized length", `${format(scenario.lengthKm, 6)} km`],
      ["Fiber", FIBER_TYPES[scenario.fiberType]?.label ?? scenario.fiberType],
      ["Wavelength", `${scenario.wavelengthNm} nm`],
      ["Profile", STANDARD_PROFILES[scenario.profile]?.label ?? scenario.profile],
      ["Attenuation", `${format(scenario.attenuationDbPerKm, 3)} dB/km`],
      ["OLTS reference", link.reference.label],
      ["Tx minimum", `${format(scenario.txPowerDbm, 3)} dBm`],
      ["Tx maximum", `${format(scenario.txMaxDbm, 3)} dBm`],
      ["Rx sensitivity", `${format(scenario.rxSensitivityDbm, 3)} dBm`],
      ["Rx overload", `${format(scenario.rxOverloadDbm, 3)} dBm`],
      ["Engineering margin", `${format(scenario.engineeringMarginDb, 3)} dB`],
      ["Overload loss basis", link.overloadDefinitive ? `${format(link.overloadBasisDb, 3)} dB minimum path loss` : `${format(link.overloadBasisDb, 3)} dB selected loss · advisory only`],
    ],
    rows,
    totals: [
      ["Passive plant loss · selected design", selected.totalDb, "dB"],
      ["FOA typical estimate", typical.totalDb, "dB"],
      ["TIA component allowances + entered passive-device IL", tia.totalDb, "dB"],
      ["Equipment power budget", link.powerBudgetDb, "dB"],
      ["Engineering margin", scenario.engineeringMarginDb, "dB"],
      ["Usable plant budget", link.usableBudgetDb, "dB"],
      ["Predicted receive power · Tx minimum", link.predictedRxDbm, "dBm"],
      [link.overloadDefinitive ? "Worst-case receive power · entered minimum loss" : "Receive power at Tx max · selected loss advisory", link.predictedRxMaxDbm, "dBm"],
      ["Overload headroom", link.overloadHeadroomDb, "dB"],
      ["Design headroom", link.designHeadroomDb, "dB"],
    ],
    status:
      link.status === "invalid"
        ? "INVALID — resolve input errors"
        : link.designHeadroomDb < 0
          ? `FAIL — usable loss budget exceeded${link.isOverloaded ? link.overloadDefinitive ? "; receiver overload also fails at entered minimum path loss" : "; overload advisory also triggered at selected loss" : ""}`
          : link.isOverloaded && link.overloadDefinitive
        ? "FAIL — receiver overload at entered minimum path loss"
        : link.isOverloaded
          ? "REVIEW — overload advisory uses selected loss"
          : link.status.toUpperCase(),
    measurement: link.measurement
      ? [
          ["Measured loss", link.measurement.measuredDb, "dB"],
          ["Measurement uncertainty", link.measurement.uncertaintyDb, "±dB"],
          ["TIA component-adjusted test limit + entered device IL", link.tiaTestLimitDb, "dB"],
          ["Field comparison", link.measurement.status.toUpperCase(), ""],
        ]
      : [],
    sources: Object.values(SOURCES).map((source) => [source.label, source.url]),
    disclaimer:
      "Planning aid only. TIA-based totals combine TIA fiber/connection/splice allowances with entered splitter and custom-device insertion loss; they are not pure TIA device maxima or a certification result. Project specifications, manufacturer data, application limits, and current purchased standards govern acceptance.",
  };
}

export function createXlsxBytes(report) {
  const sheetRows = [
    [{ value: report.title, style: 1, mergeAcross: 7 }],
    ["Project", report.scenarioName],
    ["Generated", report.generated],
    [],
    [{ value: "Inputs", style: 2, mergeAcross: 7 }],
    ...report.inputs,
    [],
    [
      { value: "Category", style: 2 },
      { value: "Line item", style: 2 },
      { value: "Quantity", style: 2 },
      { value: "Unit", style: 2 },
      { value: "Loss each (dB)", style: 2 },
      { value: "Equation", style: 2 },
      { value: "Subtotal (dB)", style: 2 },
    ],
    ...report.rows.map((item) => [
      item.category,
      item.label,
      { value: item.quantity, style: 3 },
      item.unit,
      { value: item.lossEachDb, style: 3 },
      item.equation,
      { value: item.subtotalDb, style: 3 },
    ]),
    [],
    [{ value: "Totals & power budget", style: 2, mergeAcross: 7 }],
    ...report.totals.map(([label, value, unit]) => [label, { value, style: 3 }, unit]),
    ["Result", report.status],
    [],
    ...(report.measurement.length
      ? [[{ value: "Field measurement", style: 2, mergeAcross: 7 }], ...report.measurement]
      : []),
    [],
    [{ value: "References", style: 2, mergeAcross: 7 }],
    ...report.sources.map(([label, url]) => [{ value: label, style: 4 }, { value: url, style: 4, mergeAcross: 6 }]),
    [],
    [{ value: "Important", style: 4 }, { value: report.disclaimer, style: 4, mergeAcross: 6 }],
  ];

  const files = {
    "[Content_Types].xml": contentTypesXml(),
    "_rels/.rels": rootRelationshipsXml(),
    "docProps/app.xml": appPropertiesXml(),
    "docProps/core.xml": corePropertiesXml(report),
    "xl/workbook.xml": workbookXml(),
    "xl/_rels/workbook.xml.rels": workbookRelationshipsXml(),
    "xl/styles.xml": stylesXml(),
    "xl/worksheets/sheet1.xml": worksheetXml(sheetRows),
  };
  return zipStore(files);
}

export function createPdfBytes(report) {
  const lines = reportLines(report);
  const linesPerPage = 55;
  const pages = [];
  for (let index = 0; index < lines.length; index += linesPerPage) {
    pages.push(lines.slice(index, index + linesPerPage));
  }
  const objects = [];
  const fontRegularId = 3 + pages.length * 2;
  const fontBoldId = fontRegularId + 1;
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  const pageIds = pages.map((_, index) => 3 + index * 2);
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  pages.forEach((pageLines, pageIndex) => {
    const pageId = 3 + pageIndex * 2;
    const streamId = pageId + 1;
    const stream = pdfContentStream(pageLines, pageIndex + 1, pages.length);
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${streamId} 0 R >>`;
    objects[streamId] = `<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}\nendstream`;
  });
  objects[fontRegularId] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  objects[fontBoldId] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";

  let pdf = "%PDF-1.4\n% Fiber Ledger\n";
  const offsets = [0];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = encoder.encode(pdf).length;
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefOffset = encoder.encode(pdf).length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return encoder.encode(pdf);
}

export function downloadBytes(bytes, filename, mimeType) {
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function row(category, label, quantity, unit, lossEachDb, subtotalDb) {
  return {
    category,
    label,
    quantity,
    unit,
    lossEachDb,
    subtotalDb,
    equation: `${format(quantity, 6)} × ${format(lossEachDb, 4)} dB = ${format(subtotalDb, 4)} dB`,
  };
}

function worksheetXml(rows) {
  const merges = [];
  const rowXml = rows
    .map((cells, rowIndex) => {
      const cellXml = cells
        .map((cell, columnIndex) => {
          const span = cell && typeof cell === "object" ? Number(cell.mergeAcross ?? 1) : 1;
          if (span > 1) {
            merges.push(`${columnName(columnIndex)}${rowIndex + 1}:${columnName(columnIndex + span - 1)}${rowIndex + 1}`);
          }
          return xlsxCell(cell, columnIndex, rowIndex + 1);
        })
        .join("");
      const wrapped = cells.some((cell) => cell && typeof cell === "object" && cell.style === 4);
      const title = rowIndex === 0;
      const height = title ? ' ht="26" customHeight="1"' : wrapped ? ' ht="34" customHeight="1"' : "";
      return `<row r="${rowIndex + 1}"${height}>${cellXml}</row>`;
    })
    .join("");
  const mergeXml = merges.length
    ? `<mergeCells count="${merges.length}">${merges.map((reference) => `<mergeCell ref="${reference}"/>`).join("")}</mergeCells>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews>
  <cols><col min="1" max="1" width="40" customWidth="1"/><col min="2" max="2" width="48" customWidth="1"/><col min="3" max="3" width="14" customWidth="1"/><col min="4" max="4" width="13" customWidth="1"/><col min="5" max="5" width="18" customWidth="1"/><col min="6" max="6" width="38" customWidth="1"/><col min="7" max="7" width="17" customWidth="1"/></cols>
  <sheetData>${rowXml}</sheetData>${mergeXml}
</worksheet>`;
}

function xlsxCell(rawCell, columnIndex, rowNumber) {
  const cell = rawCell && typeof rawCell === "object" && "value" in rawCell ? rawCell : { value: rawCell };
  if (cell.value === undefined || cell.value === null || cell.value === "") return "";
  const reference = `${columnName(columnIndex)}${rowNumber}`;
  const style = cell.style ? ` s="${cell.style}"` : "";
  if (typeof cell.value === "number") return `<c r="${reference}"${style}><v>${cell.value}</v></c>`;
  return `<c r="${reference}" t="inlineStr"${style}><is><t>${escapeXml(cell.value)}</t></is></c>`;
}

function columnName(index) {
  let name = "";
  let number = index + 1;
  while (number > 0) {
    const remainder = (number - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    number = Math.floor((number - 1) / 26);
  }
  return name;
}

function contentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;
}

function rootRelationshipsXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;
}

function workbookXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Link Budget" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;
}

function workbookRelationshipsXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1"><numFmt numFmtId="164" formatCode="0.0000"/></numFmts>
  <fonts count="2"><font><sz val="10"/><name val="Aptos"/></font><font><b/><sz val="11"/><color rgb="FFF1D18A"/><name val="Aptos Display"/></font></fonts>
  <fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF101820"/><bgColor indexed="64"/></patternFill></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf></cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

function corePropertiesXml(report) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${escapeXml(report.scenarioName)}</dc:title><dc:creator>Fiber Ledger</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${escapeXml(report.generated)}</dcterms:created>
</cp:coreProperties>`;
}

function appPropertiesXml() {
  return `<?xml version="1.0" encoding="UTF-8"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Fiber Ledger</Application></Properties>`;
}

function zipStore(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const [name, contents] of Object.entries(files)) {
    const nameBytes = encoder.encode(name);
    const data = typeof contents === "string" ? encoder.encode(contents) : contents;
    const checksum = crc32(data);
    const local = new Uint8Array(30 + nameBytes.length + data.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(data, 30 + nameBytes.length);
    localParts.push(local);

    const central = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centralParts.push(central);
    offset += local.length;
  }
  const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, centralParts.length, true);
  endView.setUint16(10, centralParts.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  return concatBytes([...localParts, ...centralParts, end]);
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function concatBytes(parts) {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function reportLines(report) {
  const lines = [
    { text: report.title, bold: true, size: 15 },
    { text: report.scenarioName, bold: true, size: 11 },
    { text: `Generated ${report.generated}`, size: 8 },
    { text: "" },
    { text: "INPUTS", bold: true },
    ...report.inputs.map(([label, value]) => ({ text: `${label}: ${value}` })),
    { text: "" },
    { text: "LOSS LEDGER", bold: true },
    ...report.rows.map((item) => ({ text: `${item.category} | ${item.label} | ${item.equation}` })),
    { text: "" },
    { text: "TOTALS & POWER BUDGET", bold: true },
    ...report.totals.map(([label, value, unit]) => ({ text: `${label}: ${format(value, 3)} ${unit}` })),
    { text: `RESULT: ${report.status}`, bold: true },
    ...(report.measurement.length
      ? [{ text: "" }, { text: "FIELD MEASUREMENT", bold: true }, ...report.measurement.map(([label, value, unit]) => ({ text: `${label}: ${typeof value === "number" ? format(value, 3) : value} ${unit}` }))]
      : []),
    { text: "" },
    { text: "REFERENCES", bold: true },
    ...report.sources.map(([label, url]) => ({ text: `${label}: ${url}`, size: 7 })),
    { text: "" },
    { text: report.disclaimer, size: 7 },
  ];
  return lines.flatMap((line) => wrapLine(line, line.size <= 7 ? 112 : 96));
}

function pdfContentStream(lines, pageNumber, pageCount) {
  const commands = ["BT", "/F1 9 Tf", "40 756 Td", "12 TL"];
  for (const line of lines) {
    commands.push(`/${line.bold ? "F2" : "F1"} ${line.size ?? 9} Tf`);
    commands.push(`(${escapePdf(line.text)}) Tj`, "T*");
  }
  commands.push("/F1 7 Tf", `0 -10 Td`, `(Page ${pageNumber} of ${pageCount}) Tj`, "ET");
  return commands.join("\n");
}

function wrapLine(line, maxLength) {
  const text = asciiText(line.text ?? "");
  if (text.length <= maxLength) return [{ ...line, text }];
  const words = text.split(/\s+/);
  const result = [];
  let current = "";
  for (const word of words) {
    if (`${current} ${word}`.trim().length > maxLength && current) {
      result.push({ ...line, text: current });
      current = word;
    } else current = `${current} ${word}`.trim();
  }
  if (current) result.push({ ...line, text: current });
  return result;
}

function asciiText(value) {
  return String(value)
    .replaceAll("µ", "u")
    .replaceAll("×", "x")
    .replaceAll("·", " - ")
    .replaceAll("±", "+/-")
    .replace(/[–—]/g, "-")
    .replace(/[^ -~]/g, "?");
}

function escapePdf(value) {
  return asciiText(value).replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function format(value, digits) {
  return formatNumber(value, digits);
}
