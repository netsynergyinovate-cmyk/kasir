# Design Spec: Tambah Pelanggan Runsnet — Multi-Step Wizard

**Date:** 2026-09-23
**Status:** Approved
**Topic:** Convert the single long "Tambah Pelanggan Runsnet" form into a 4-step wizard, with PPPoE access credentials surfaced on the final step.

## 1. Overview

`TambahPelangganRunsnet.jsx` is currently one long scrolling form. It should become a 4-step wizard so staff fill related fields together, can't accidentally skip required fields out of order, and see the PPPoE Username/Secret Access fields together with a final review instead of buried mid-form. No backend/API changes — this is a frontend-only restructuring of an existing page.

## 2. Step Grouping

1. **Data Pelanggan** — Jenis, Jenis Tagihan, Nama, Kontak, Email, NIK, NPWP.
2. **Lokasi** — Cabang (read-only), Cluster, Alamat, Titik Koordinat (`LocationPicker`).
3. **Paket & Biaya** — Agent/Koordinator, Paket (Profile), Biaya Bulanan, Biaya Instalasi, Tanggal SPK, Tanggal Isolir/Expired.
4. **Ringkasan & Akses** — read-only summary (nama, alamat, paket, harga), Username Access + Secret Access inputs (moved here from step 1), a note that a blank Username/Secret auto-follows the Customer ID Runsnet generates (the real value is only visible in Runsnet after a successful submit, since `submitNewCustomer` doesn't return it — see `api/_lib/runsnetClient.js:505`), then the existing submit result panel.

## 3. Validation

- New pure function `validateStepFields(step, form)` in `src/utils/runsnetCustomerForm.js`, returning an array of missing-field messages scoped to that step only (mirrors the field groups in section 2).
- The "Lanjut" button is disabled when `validateStepFields(step, form).length > 0`; the first missing-field message is shown inline below the button.
- `validateCustomerForm(form)` (existing, whole-form) still runs before the final Runsnet submit as a defense-in-depth safety net — unchanged.

## 4. Navigation

- Local state `step` (1–4) in `TambahPelangganRunsnet.jsx`, starts at 1, resets to 1 after a successful submit (alongside the existing `setForm(emptyForm)`).
- Step indicator: reuse the app's existing rounded-card visual language (not the fictional mockup's Material Symbols/NOC branding) — a row of 4 numbered circles + labels + a thin progress bar, matching Tailwind classes already used elsewhere on this page.
- Bottom fixed nav bar: "Kembali" (arrow-left icon, same as today) appears when `step > 1` and moves back one step. The primary button shows "Lanjut" (moves forward one step, blocked by validation) on steps 1–3, and "Kirim ke Runsnet" (existing `handleSubmit` flow, unchanged) on step 4.

## 5. Out of Scope

- No signature capture, ONT/serial number fields, VLAN, GPS accuracy circles, or NOC-style branding from the reference mockup — those don't correspond to real Runsnet fields.
- No change to `buildCustomerPayload`, `validateCustomerForm`, or any `api/runsnet/*` endpoint.
- No attempt to fetch the Runsnet-generated Customer ID/username after submit (would require an extra list-lookup call against Runsnet; not requested).

## 6. Testing

- New unit tests for `validateStepFields` in `src/utils/__tests__/runsnetCustomerForm.test.js`, covering: missing fields per step, and empty array when a step's fields are complete.
- Existing `validateCustomerForm` and `buildCustomerPayload` tests untouched.
- Manual check in dev: step through all 4 steps, confirm blocked "Lanjut" shows the right message, confirm back/forward preserves entered data, confirm final submit payload is unchanged (same `pac_*` fields as before).
