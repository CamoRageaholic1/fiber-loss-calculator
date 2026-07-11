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

## Default component values

| Component | FOA typical planning | ANSI/TIA maximum allowance |
|---|---:|---:|
| Multimode fiber at 850 nm | 3.0 dB/km | 3.5 dB/km |
| Multimode fiber at 1300 nm | 1.0 dB/km | 1.5 dB/km |
| Premises singlemode at 1310/1550 nm | 0.5 dB/km | 1.0 dB/km |
| Outside-plant singlemode at 1310 nm | 0.4 dB/km | 0.5 dB/km |
| Outside-plant singlemode at 1550 nm | 0.3 dB/km | 0.5 dB/km |
| Mated adhesive/polish connection pair | 0.30 dB | 0.75 dB |
| Fusion splice | 0.15 dB conservative typical | 0.30 dB |
| Mechanical splice | 0.30 dB | 0.30 dB |

The FOA typical fusion-splice range is 0.05–0.15 dB. Fiber Ledger uses 0.15 dB as a conservative editable default. A “connection” means the joint formed by a mated connector pair, not one loose connector. FOA 2025 lists 0.30 dB for adhesive/polish connections, 0.3–0.5 dB for fusion splice-on connectors, 0.5–0.75 dB for mechanical splice-on connectors, and 0.75 dB for single-ferrule multifiber connections; select or enter the construction-appropriate value.

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

Splitter insertion loss may or may not include connectorized pigtails. Manufacturer data and the project bill of materials control; avoid double counting.

## Equations

```text
length_km = length_ft × 0.0003048
fiber_loss = length_km × attenuation_dB_per_km
event_loss = quantity × loss_per_event
passive_plant_loss = fiber + connections + splices + splitters + other_passive

equipment_power_budget = Tx_min_dBm − Rx_sensitivity_dBm
predicted_Rx_min = Tx_min_dBm − passive_plant_loss
predicted_Rx_max = Tx_max_dBm − passive_plant_loss
design_headroom = equipment_power_budget − passive_plant_loss − engineering_margin
```

The editable engineering margin defaults to 3 dB. It is reserved equipment budget, not invented cable-plant loss.

An overload check requires the minimum possible path loss because the strongest receiver power occurs at transmitter maximum and path-loss minimum. When no minimum-loss bound is supplied, Fiber Ledger shows Tx maximum minus the selected planning loss as an advisory only. It becomes a definitive overload check only after an explicit minimum path loss is entered.

The comparison labeled “TIA component allowances + entered device IL” applies TIA fiber/connection/splice allowances while retaining the entered splitter and custom-device insertion loss. This calculator has no ANSI/TIA-568 maximum for those passive devices and does not imply one.

## Field-test interpretation

The reference-cord method must be documented and must match the connection count used in the comparison:

- 1-cord reference: both end connections remain in the measured loss.
- 2-cord reference: one connection is normalized out.
- 3-cord reference: two connections are normalized out.

FOA notes that loss estimates and field measurements are not absolute. Fiber Ledger exposes an optional uncertainty band, commonly ±0.2–0.5 dB, instead of silently adding uncertainty to a TIA allowance.

End-to-end insertion loss should be qualified with an OLTS/LSPM using the applicable launch conditions. OTDR is valuable for event characterization and troubleshooting but does not replace the end-to-end insertion-loss test. Inspect, clean, and re-inspect connector end faces before testing.

## Not calculated

- Modal/chromatic dispersion, bandwidth, BER, or application reach
- Whole-link optical return loss from assumed event reflectance
- Multi-branch PON topology optimization
- Active amplifiers or negative-loss events
- Formal ANSI/TIA certification
