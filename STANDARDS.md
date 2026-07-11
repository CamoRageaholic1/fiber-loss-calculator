# Standards and calculation basis

Fiber Ledger separates three ideas that are often conflated:

1. **FOA typical planning estimate** — realistic expected-performance values.
2. **ANSI/TIA maximum allowance** — worst-case component allowances summarized in the open FOA 2025 installation standard.
3. **Equipment power budget** — the transmitter/receiver operating window supplied by the equipment manufacturer or application standard.

The calculator displays all three and never labels a browser result as certification.

## Primary references

- [FOA Standard for Installing Fiber Optic Cable Plants — 2025 V1](https://www.foa.org/tech/ref/1pstandards/FOA%20Installation%20Standard%202025%20V1.pdf), Annex A
- [TIA announcement for ANSI/TIA-568.3-E](https://tiaonline.org/standardannouncement/tia-issues-updated-optical-fiber-cabling-component-standard-ansi-tia-568-3-e/), released September 29, 2022
- [FOA Calculating Fiber Optic Loss Budgets](https://www.foa.org/tech/lossbudg.htm)
- [FOA Optical Splitters](https://foa.org/tech/ref/install/Optical_splitter.html), 2024
- [FOA Fiber Optic Cable Plant Nomenclature](https://www.foa.org/tech/OM.html)
- [ITU-T G.984.5 — G-PON enhancement band](https://www.itu.int/rec/T-REC-G.984.5-202202-I/en), including G-PON operating bands and coexistence methods
- [ITU-T G.9807.1 Amendment 1 — XGS-PON](https://www.itu.int/epublications/publication/itu-t-g-9807-1-2023-amd-1-2025-05), including wavelength sets and optical-path-loss classes
- [ITU-T G.9805 Amendment 2 — Coexistence of PON systems](https://www.itu.int/epublications/publication/itu-t-g-9805-2022-amd-2-2025-11), including external coexistence elements and multi-PON modules
- [Broadband Forum TR-423 — PON PMD Layer Conformance Test Plan](https://www.broadband-forum.org/pdfs/tr-423-1-0-0.pdf), including GPON B+ and XGS-PON N1 coexistence testing
- [FOA OTDR reference](https://www.foa.org/tech/ref/testing/OTDR/OTDR.html)
- [FOA Testing Fiber To The Home](https://www.foa.org/tech/ref/appln/FTTH-test.html)

## Default component values

| Component | FOA typical planning | ANSI/TIA maximum allowance |
|---|---:|---:|
| Multimode fiber at 850 nm | 3.0 dB/km | 3.5 dB/km |
| Multimode fiber at 1300 nm | 1.0 dB/km | 1.5 dB/km |
| Premises singlemode at 1310/1550 nm | 0.5 dB/km | 1.0 dB/km |
| Outside-plant singlemode at 1310 nm | 0.4 dB/km | 0.5 dB/km |
| Outside-plant singlemode at 1550 nm | 0.3 dB/km | 0.5 dB/km |
| Outside-plant singlemode at 1270 nm | 0.4 dB/km planning band value | 0.5 dB/km |
| Outside-plant singlemode at 1490/1577 nm | 0.3 dB/km planning band value | 0.5 dB/km |
| Mated adhesive/polish connection pair | 0.30 dB | 0.75 dB |
| Fusion splice | 0.15 dB conservative typical | 0.30 dB |
| Mechanical splice | 0.30 dB | 0.30 dB |

The FOA typical fusion-splice range is 0.05–0.15 dB. Fiber Ledger uses 0.15 dB as a conservative editable default. A “connection” means the joint formed by a mated connector pair, not one loose connector. FOA 2025 lists 0.30 dB for adhesive/polish connections, 0.3–0.5 dB for fusion splice-on connectors, 0.5–0.75 dB for mechanical splice-on connectors, and 0.75 dB for single-ferrule multifiber connections; select or enter the construction-appropriate value.

The 1270, 1490, and 1577 nm entries map each PON channel to the corresponding editable outside-plant short- or long-wavelength planning band. They are not presented as separate ANSI/TIA wavelength-specific requirements; measured cable data and the governing equipment/application specification take precedence.

OM class changes bandwidth and application reach, but the generic attenuation values above are the same across the OM presets. Fiber Ledger does not calculate modal/chromatic dispersion or application-specific reach.

## Splitter values

The selected optical path incurs one insertion-loss event for each splitter stage it traverses. Cascaded stages add in dB. The number of output ports does not multiply the event loss.

| Equal splitter | Ideal loss | FOA typical insertion loss |
|---|---:|---:|
| 1:2 | 3.0 dB | 3.6 dB |
| 1:4 | 6.0 dB | 6.8 dB |
| 1:8 | 9.0 dB | 10.0 dB |
| 1:16 | 12.0 dB | 13.0 dB |
| 1:32 | 15.0 dB | 16.0 dB |
| 1:64 | 18.0 dB | 19.5 dB |
| 1:128 | 21.07 dB | 24.0 dB planning default* |

Splitter insertion loss may or may not include connectorized pigtails. Manufacturer data and the project bill of materials control; avoid double counting.

\* The 1:128 ideal value is `10 × log10(128) = 21.07 dB`. FOA states that practical splitter loss exceeds ideal loss and identifies 1:128 as a supported GPON maximum and a common high-split XG(S)-PON case, but its published typical-loss table stops at 1:64. The editable 24.0 dB value is therefore a conservative Fiber Ledger planning default, not an FOA or ANSI/TIA component maximum. Replace it with the selected splitter manufacturer's wavelength-specific value. Cascaded implementations should be entered as their actual stages rather than assumed equivalent to a single 1:128 device.

## GPON and XGS-PON coexistence preset

The v1.1 combo preset models GPON B+ and XGS-PON N1 sharing one passive optical distribution network. Broadband Forum TR-423 uses that class pairing as its primary GPON/XGS-PON coexistence test case. ITU-T G.9805 recognizes external coexistence elements (CEx), OLT multi-PON modules (MPM) with integrated WDM, and splitter-based coexistence methods.

| Channel | Downstream | Upstream | Default OPL class |
|---|---|---|---:|
| GPON B+ | 1490 nm nominal; 1480–1500 nm band | 1310 nm nominal; 1290–1330 nm reduced coexistence band | 13–28 dB |
| XGS-PON N1 | 1577 nm nominal; 1575–1580 nm band (to 1581 nm outdoors) | 1270 nm nominal; 1260–1280 nm band | 14–29 dB |

The physical length, connections, splices, splitters, and custom passive events are shared. Fiber attenuation is calculated separately at each downstream and upstream wavelength, producing 1490/1310 nm GPON and 1577/1270 nm XGS-PON models while the two visual output cards summarize the downstream services. An external CEx adds wavelength-dependent loss, so Fiber Ledger exposes separate editable downstream and upstream CEx insertion-loss fields for both services. Enter zero only when that loss is absent from the modeled reference plane, such as an appropriate integrated MPM design, and use direction- and wavelength-specific equipment or CEx data for final values.

The class window is an ODN optical-path-loss constraint, not a universal transceiver specification. A result below the class minimum can present receiver-overload risk, while a result above the maximum exceeds the class budget. Equipment launch power, sensitivity, overload, wavelength plan, and supported class must still be verified against the actual OLT and ONT data.

## Equations

```text
length_km = length_ft × 0.0003048
fiber_loss = length_km × attenuation_dB_per_km
event_loss = quantity × loss_per_event
passive_plant_loss = fiber + connections + splices + splitters + other_passive + coexistence_element

equipment_power_budget = Tx_min_dBm − Rx_sensitivity_dBm
predicted_Rx_min = Tx_min_dBm − passive_plant_loss
predicted_Rx_max = Tx_max_dBm − passive_plant_loss
available_PON_budget = min(equipment_power_budget − optical_penalty, ODN_class_maximum)
design_headroom = available_budget − passive_plant_loss − engineering_margin

bidirectional_OTDR_average = (OTDR_forward_loss + OTDR_reverse_loss) ÷ 2
downstream_live_path_loss = OLT_Tx_dBm − ONT_Rx_dBm
upstream_live_path_loss = ONT_Tx_dBm − OLT_Rx_dBm
```

The editable engineering margin defaults to 3 dB. It is reserved equipment budget, not invented cable-plant loss.

An overload check requires the minimum possible path loss because the strongest receiver power occurs at transmitter maximum and path-loss minimum. When no minimum-loss bound is supplied, Fiber Ledger shows Tx maximum minus the selected planning loss as an advisory only. It becomes a definitive overload check only after an explicit minimum path loss is entered.

The comparison labeled “TIA component allowances + entered device IL” applies TIA fiber/connection/splice allowances while retaining the entered splitter and custom-device insertion loss. This calculator has no ANSI/TIA-568 maximum for those passive devices and does not imply one.

## Field-test interpretation

Fiber Ledger's OTDR/OLT comparison is a diagnostic correlation view, not an acceptance-test substitution. An OTDR infers distance, attenuation, and event loss from backscatter and reflections rather than directly measuring end-to-end insertion loss. Forward and reverse splice readings can differ because of backscatter-coefficient mismatch; when both directions are supplied, Fiber Ledger averages them. The test direction, wavelength, launch cable, receive cable, pulse width, and acquisition settings remain part of the field record.

PON splitters complicate OTDR interpretation. A trace launched from the OLT side combines backscatter from multiple branches, while a subscriber-side trace normally isolates one branch more clearly. The displayed OTDR loss should therefore be treated as an entered field estimate whose trace and event table require qualified review.

The OLT/ONT telemetry comparison requires paired power values:

- Downstream live path loss is OLT transmit power minus ONT receive power.
- Upstream live path loss is ONT transmit power minus OLT receive power.

An OLT receive reading by itself is not a path-loss measurement. Live telemetry can also vary with burst operation, device calibration, temperature, and the time at which each endpoint was sampled. Compare like directions and wavelengths.

FOA notes that loss estimates and field measurements are not absolute. Fiber Ledger exposes an optional uncertainty band instead of silently adding measurement uncertainty to a TIA allowance. End-to-end insertion loss should still be qualified with a calibrated OLTS/LSPM using the applicable launch conditions. OTDR is valuable for event characterization and troubleshooting but does not replace that acceptance test. Inspect, clean, and re-inspect connector end faces before testing.

## Not calculated

- Modal/chromatic dispersion, bandwidth, BER, or application reach
- Whole-link optical return loss from assumed event reflectance
- Multi-branch PON topology optimization or OTDR trace-file parsing
- Automatic collection from an OLT, ONT, or element-management API
- Active amplifiers or negative-loss events
- Formal ANSI/TIA certification
