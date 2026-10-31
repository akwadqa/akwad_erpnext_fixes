# Progress: JS-Based Report Print Formats

Spec: `report-print-formats.md`

## Phase 0 — Tracer bullet: General Ledger (DONE)

- [x] `Akwad Print Style` Print Style doc, created via
      `patches/create_print_style.py`, self-contained CSS.
- [x] Shared JS helpers in `public/js/report_print_style.js`
      (`frappe.akwad_report`: `get_style_tag`, `build_header`,
      `render_rows`, `strip_prefix`, `footer`, `letterhead_footer`),
      wired via `app_include_js` in `hooks.py`.
- [x] `General Ledger - Default` Print Format fixture
      (`print_format/general_ledger___default/`), `print_format_for =
      Report`, `print_format_type = JS`.
- [x] Title: "Statement of Accounts".
- [x] Opening / Period Total / Closing Balance rows detected and styled
      distinctly from entry rows.
- [x] Filters summary box: Account, Party, Categorized By, Currency —
      curated, not the full raw filter dump (deliberately drops
      internal/processing flags like "Consider Accounting Dimensions").
- [x] Letterhead footer gap in Frappe core patched via
      `letterhead_footer()`.
- [x] Date column widened + `white-space: nowrap` (was truncating).
- [x] Fixed: empty-array MultiSelectList filters (`account`, `party`)
      no longer falsely shown as "set" in the filters box.
- [x] Verified against a faithful reproduction of Frappe's actual
      microtemplate compiler (not just visual inspection) before every
      round of live testing.

Open/known, deliberately not fixed yet:
- "Pick Columns" in the print dialog still silently bypasses our Print
  Format (Lesson 6) — not fixable from within the Print Format; the
  column-config mechanism (Phase 1) is the workaround, not a fix to this.

## Phase 1 — Tracer bullet: configurable columns (DONE)

- [x] `Report Print Configuration` DocType (one doc per report, `autoname:
      field:report`) + child `Report Print Column`.
- [x] `boot_session` hook (`akwad_erpnext_fixes.boot.boot_session`)
      injecting `bootinfo.akwad_report_columns`, built from a single
      `frappe.get_all` query grouped in Python (no DB calls in a loop).
- [x] `frappe.akwad_report.get_configured_columns()` /
      `is_column_enabled()` helpers.
- [x] Wired "Cost Center" into General Ledger's template as the proof
      column, not Remarks as originally planned — Remarks is already
      gated by the report's own `show_remarks` filter (an interactive,
      per-print-run choice), which is a different axis from this
      mechanism's admin-level, per-site structural config. Cost Center
      was genuinely absent from the template before this, so toggling it
      via the new DocType gives an unambiguous signal that doesn't
      conflict with existing logic.
- [x] Verified end-to-end: rendered the template with the harness both
      with and without a configured column (header, cell, and spacer
      colspan all react correctly), then confirmed for real — created a
      live config record for General Ledger via Desk and read it back
      through `boot.py`'s query.
- [x] Considered an alternative raised mid-phase: a single document
      covering all reports instead of one document per report. Rejected:
      a shared document means two admins configuring different reports'
      columns hit save conflicts with each other (Frappe's optimistic
      locking is per-document), and a single flat grid loses the List
      View's "which reports have configs" discoverability. One document
      per report avoids both.
- [x] Migration hiccup worth remembering: hand-written new DocType JSON
      fixtures (not exported from Desk) need the controller `.py` stub
      written by hand too — `bench migrate`'s fixture-sync importer
      inserts the DocType record then immediately tries to load its
      controller module; it does not scaffold the boilerplate the way
      Desk's "New DocType" save flow does.

## Phase 1.A — Fixes (DONE)

- [x] **Renamed parent doctype** `Report Print Columns` ->
      `Report Print Configuration`: a non-Single doctype shouldn't carry
      a plural name (plural is conventionally reserved for Singles like
      "Print Settings"), and the old name was one letter away from the
      child doctype `Report Print Column` — too easy to misread. Verified
      no orphaned `DocField`/table/`Module Def` rows were left behind by
      an earlier, unrelated single-document experiment that was tried and
      discarded in the same session.
  - Caution for next time: renaming a doctype via Desk's own rename flow
    renamed the on-disk folder but left the `.json`/`.py` files inside
    with their old names and stale `name:`/class content — had to finish
    the rename by hand (also tripped an unrelated error from
    `fcm_frappe`, which monkey-patches `Document.insert`/`_save` globally
    for notification alerts; confirmed via DB check that it didn't
    corrupt anything, just interrupted the file-side half of the rename).
- [x] **`report_print_style.js` -> `report_print_style.bundle.js`**: this
      was the parked Lesson 3 fix, now actually necessary ("refuses to
      work" — a real instance of the caching risk, not just a theoretical
      one). `app_include_js` now references the bare bundle name, which
      `bundled_asset()` resolves through `assets.json` to a
      content-hashed path on every `bench build` — confirmed a changed
      file now produces a new hash/URL automatically.
  - Node wasn't on `PATH` for `bench build` in this shell (nvm-managed);
    had to export it explicitly. Not a code issue, just an environment
    note.
- [x] **Child table redesign**: replaced the free-text `fieldname` + an
      optional `label` override with a single `field` (Autocomplete).
      Options are fetched live from the selected report's actual columns
      via a new whitelisted `get_report_columns_query`, wired through the
      doctype's own client script using the same `df.get_query` mechanism
      Link/MultiSelectList fields already use elsewhere in this codebase
      — not a bespoke pattern. Frappe's Autocomplete control natively
      displays the picked label while storing the underlying fieldname
      (`ControlAutocomplete.format_for_input`/`get_input_value`), so the
      "hidden read-only fetch field" idea turned out to be unnecessary —
      one field does both jobs.
  - The `label` override is gone entirely; the print format now reads the
    real label straight from the report's own `columns` metadata at
    render time instead of duplicating it anywhere.
  - Real gotcha: script report column sets are computed at runtime, not
    stored as DocFields, so fetching them means actually running the
    report with best-effort default filters (company/last month/today).
    Columns that are themselves gated behind a filter toggle (Cost Center
    needs `include_dimensions`) won't appear unless that toggle is also
    enabled in the best-effort filter set — fixed by turning on the
    common optional-column toggles (`include_dimensions`, `show_remarks`)
    when fetching the picklist. This is a "limited checks" heuristic, not
    a fully general solution for every possible report's required
    filters.
  - Known, accepted limitation: a saved row shows its raw fieldname (not
    the label) until that cell is focused/typed in at least once, since
    the Autocomplete's label cache is only populated by the dynamic query
    — acceptable for now, not worth the extra pre-fetch-on-load code yet.
  - The doctype's schema change (dropped `fieldname`/`label` columns,
    added `field`) wiped the existing test row's data, as expected for an
    early-stage doctype with only throwaway test data in it.

## Phase 2 — Generalized column rendering + static columns (DONE)

- [x] Root cause of "Report Print Configuration doesn't seem to work":
      the Cost Center tracer bullet wired one hardcoded fieldname
      (`cost_center`) into the General Ledger template; every other
      fieldname an admin configured (`party`, `posting_date`, `credit`,
      `against_voucher`) was silently a no-op because the template never
      looked at them. Confirmed via a stale `Report Print Configuration`
      record left over from debugging.
- [x] One shared exclusion registry (`EXCLUDED_COLUMNS_BY_REPORT` /
      `get_excluded_fieldnames()` in `report_print_configuration.py`)
      replacing the single-fieldname special case, enforced in three
      places: the Autocomplete picker (`get_report_columns_query`), a new
      `get_static_columns()` whitelisted method, and `boot.py`'s
      `get_report_print_columns()` (defense in depth against
      pre-existing/directly-written rows).
- [x] Found and fixed a real collision during design: General Ledger's
      `remarks` column is rendered via the report's own `show_remarks`
      filter, a separate axis from this doctype (see spec Decision Log).
      Left pickable, it would double-render once column rendering
      generalized. Added to the exclusion registry alongside the truly
      static fields (Date, Particulars components, Debit/Credit/Balance).
- [x] Generic column rendering in `frappe.akwad_report`:
      `get_enabled_columns()`, `render_extra_headers()`,
      `render_extra_cells()` — reuses `frappe.format(value, column, {
      for_print: true })` (Frappe's own generic field formatter, same one
      `query_report.js` uses for its grid) instead of hand-rolled
      per-fieldtype formatting. General Ledger's template now has zero
      per-fieldname branching for configured columns.
- [x] Static-columns display: `frm.set_intro()` on the `Report Print
      Configuration` form (standard Frappe form API, no new DocType
      field) listing fields that are already shown and not configurable
      here.
- [x] Verified the edited template against a faithful reproduction of
      Frappe's real microtemplate compiler + the actual (unmodified)
      `report_print_style.bundle.js`, with cases for: one configured
      column, two configured columns, zero configured columns, and
      correct `<td>`/colspan counts across entry/spacer/opening/total/
      closing row types.
- [x] Regression test (`test_report_print_configuration.py`): a stale
      excluded-fieldname row must never surface via `frappe.boot`.
      Verified by temporarily reverting the `boot.py` filter and
      confirming the leak reproduces, then restoring the fix — per this
      app's regression-test convention.
- [x] Live proof on the dev site: `against_voucher` (configured since the
      original debugging session, previously a no-op) now renders
      automatically alongside `cost_center` with zero template changes —
      the generalization claim holding up end-to-end, not just in the
      harness.
- [x] Could not run `bench run-tests` end-to-end on `qhmc.localhost`:
      Frappe's legacy test-record bootstrapper walks every linked
      doctype transitively for *any* `FrappeTestCase` in the app and
      ends up invoking ERPNext's `Company` test suite, which tries to
      create master data (e.g. `Price List "Standard Buying"`) that
      already exists on this live dev site. Pre-existing environment
      friction, unrelated to this feature and reproducible with the
      pre-existing empty `test_akwad_erpnext_fixes.py` test class too.
      Worked around by verifying the exact same code paths directly via
      `bench console` (including the temp-revert regression check)
      instead of reshaping the site to satisfy the test runner.

## Phase 3 — Visual column picker, replacing Report Print Configuration (DONE)

- [x] Decided against both prior directions for column choice: a second
      named Print Format per column combination (rejected — user wants
      one format, not N near-duplicates to maintain) and the
      `Report Print Configuration` admin-config doctype as originally
      shipped (rejected — user wants column choice made visually, at
      print time, with a live preview of the effect, not a pre-configured
      admin setting with no feedback).
- [x] Confirmed via Frappe core source (`print_utils.js`, `query_report
      .js`, `print_format.py`) that `Print Format.report` has no
      uniqueness constraint and the print dialog's format picker already
      lists every report-type JS format for the current report — ruled
      out as the mechanism here only because the user explicitly didn't
      want multiple formats, not because it doesn't work.
- [x] Confirmed no live-preview infrastructure exists anywhere in Frappe
      core (not for reports, not for documents) — `frappe.render_grid`
      and `pdf_report` just `window.open()` the final HTML. The preview
      dialog is new, not an extension of an existing one.
- [x] `report_column_preview.bundle.js` (new file, new `app_include_js`
      bundle entry): `show_column_preview()` builds a dialog with one
      checkbox per optional column and an iframe that re-renders via
      `frappe.render()` + the `print_template` wrapper on every toggle —
      same template/CSS/letterhead as the real print, so the preview is
      the real output, not an approximation.
- [x] Hook point: wrapped `frappe.views.QueryReport.prototype
      .print_report`/`pdf_report` once at bundle load (prototype-level,
      so SPA navigation doesn't matter), gated by a report-name whitelist
      (`REPORTS_WITH_COLUMN_PREVIEW`, currently just General Ledger) so
      no other report or document-print flow is touched. Considered and
      rejected overriding the shared `frappe.ui.get_print_settings`
      instead — same outcome, but a 3-caller blast radius (also used by
      list view and tree view print) and a ~30-line copy of core dialog
      code to maintain, for no actual benefit (the settings prompt itself
      needs no changes, only what happens after it).
- [x] `report_print_style.bundle.js`: replaced
      `get_configured_columns()`/`is_column_enabled()`/`get_enabled_columns
      ()` with one pure `get_extra_columns(wanted_fieldnames,
      available_columns)` — same intersect-and-degrade behavior, now fed
      from `print_settings.extra_columns` (the dialog's checkboxes for
      this print run) instead of `frappe.boot`.
      `render_extra_headers()`/`render_extra_cells()` unchanged, reused
      as-is.
- [x] General Ledger template: one-line change,
      `get_enabled_columns("General Ledger", columns)` →
      `get_extra_columns(print_settings.extra_columns, columns)`. No
      second Print Format, no template duplication.
- [x] Deleted `Report Print Configuration` + `Report Print Column`
      doctypes outright (not left disconnected) — confirmed via `bench
      console` that both DocTypes and a live `General Ledger` config doc
      existed on `qhmc.localhost`, deleted the data doc then both
      DocTypes with `force=True`, confirmed gone
      (`frappe.db.exists(...)` → `None`), *then* removed the files.
      Removed `boot.py` and its `boot_session` hook entirely — nothing
      else used it. Confirmed via `git status` that none of this was
      committed yet, so nothing was lost.
- [x] Deleted `test_report_print_configuration.py` along with the
      doctype — its three tests only made sense against the deleted
      mechanism (picker exclusion, static-columns metadata, boot-leak
      regression); nothing analogous persisted for this phase, since the
      new picker has no server-side config to leak (everything is
      re-derived from the current print run, nothing saved).
- [x] `bench migrate` run clean on `qhmc.localhost` after the doctype
      deletion — no errors, "Removing orphan doctypes" step found nothing
      left over.

Known gap, resolved in Phase 4: no `bench build` had been run yet, and the
first live click-through (user-run, after `bench build`) immediately hit a
real bug — see Phase 4.

## Phase 4 — Named column templates, replacing the raw checkbox picker
## (DONE)

- [x] User ran `bench build` and tried the Phase 3 checkbox picker live:
      failed with a server error, "`None` is not an enabled Print Format
      for a Report" when actually printing. Traced to
      `frappe/desk/query_report.py: get_print_format_data` rejecting a
      null `print_format` — root cause was `print_utils.js` nulling
      `settings.print_format` on the shared settings object synchronously
      right after handing off to our `print_report` override, long before
      our dialog's async chain or the user's eventual click ever read it
      again. See spec Lesson 11. Fixed by capturing `print_format` into a
      local at the top of `show_column_preview()` and restoring it onto
      `print_settings` right before the real render call — applies
      regardless of what UI the dialog ends up using, so folded into the
      same rewrite as the point below.
- [x] Separately, user rejected the raw-checkbox UI itself: wanted named,
      reusable presets ("template with Cost Center, template without"),
      not a per-column checklist rebuilt every print — while still not
      wanting a second named Print Format (ruled out the day before).
      Landed on: a doctype holding named column presets per report, shown
      as a radio list with live preview in the same dialog.
- [x] Created `Report Print Template` (parent: `report` + `template_name`,
      autoname `format:{report} - {template_name}`) + `Report Print
      Template Column` (child: `field` Autocomplete) via `frappe.get_doc
      (...).insert()` through `bench console` rather than hand-writing the
      JSON — Frappe's own doctype-creation machinery scaffolds the
      `.py`/`.js`/`__init__.py`/test-stub boilerplate this way, avoiding
      the Phase 1 gotcha where a hand-written fixture needs the controller
      stub written by hand too.
- [x] `report_print_template.py`: restored (trimmed) the column
      -introspection machinery from the deleted `Report Print
      Configuration` — `get_report_columns()` (runs the report with
      best-effort filters since script-report columns aren't stored
      DocFields), `EXCLUDED_COLUMNS_BY_REPORT`/`get_excluded_fieldnames()`,
      `get_report_columns_query()` (Autocomplete source for the child
      table). New: `get_report_print_templates(report)`, two queries total
      (templates, then their columns in one batched `parent in [...]`
      lookup — no DB call in a loop), prepending a synthetic "Default"
      entry so the picker always has a baseline even with zero configured
      templates.
- [x] `report_print_template.js`: wired the child table's `field`
      Autocomplete via `get_query`, same `df.get_query` pattern used
      elsewhere in this codebase (Phase 1.A).
- [x] Rewrote `report_column_preview.bundle.js`: radio list of templates
      (fetched via `get_report_print_templates`) instead of a checkbox per
      column; selecting a template sets `print_settings.extra_columns` to
      that template's resolved fieldnames and re-renders the iframe.
      `REPORTS_WITH_TEMPLATE_PREVIEW` replaces the old
      `REPORTS_WITH_COLUMN_PREVIEW` name; same prototype-wrap mechanism
      (Lesson 10), unchanged.
- [x] Demo data: created `General Ledger - With Cost Center`
      (`columns: [cost_center]`) via `bench console`; "Default" needs no
      row (synthetic). Verified `get_report_print_templates("General
      Ledger")` returns both.
- [x] `bench migrate` clean on `qhmc.localhost` after doctype creation —
      no errors, both new doctypes present, nothing orphaned.
- [x] No JS execution environment available in this session (no `node` on
      PATH, no JS engine in Python) to run the previous phases'
      microtemplate-harness verification style — relied on static
      review (brace/paren balance, careful re-read) plus the server-side
      half (`get_report_print_templates`) verified for real via `bench
      console`. Live Desk click-through still needed — see Next.

### Phase 4 addendum — two bugs from the first live attempt (fixed by
### review; never re-verified live — the whole dialog was superseded and
### deleted by Phase 5 before a re-test happened)

- [x] **Dialog misfiring with no Print Format picked** — root cause: the
      shared `print_settings` object (Lesson 12) kept a stale
      `print_format` from a prior successful print (restored by the
      Lesson 11 fix but never cleared again), which survives an untouched
      Link field on the next print dialog. Fixed by nulling
      `print_settings.print_format` again right after handing off to the
      real `render_fn`, and by hardening `should_preview()` to check the
      format name's `"<report> - "` prefix, not just truthiness. See spec
      Lesson 12.
- [x] **Template list not appearing in the dialog** — the `.catch()`
      added this round immediately paid off: real browser error was
      `ReferenceError: title is not defined` inside
      `frappe.render_template("print_template", ...)`
      (`build_preview_html()`). Root cause: `print_template.html`
      references `title`/`columns.length`/`can_use_smaller_font` directly
      in its own markup, and `build_preview_html()`'s outer
      `render_template` call was missing all three — the real
      `pdf_report()` always supplies them. Fixed by computing `columns`/
      `title` once and passing the exact same context shape
      `pdf_report()` uses, including `can_use_smaller_font` (derived from
      `report.report_doc.is_standard`, same formula as core). Confirms
      Lesson 12's contamination fix wasn't the cause of this particular
      symptom — this was always going to fail once the templates list
      itself rendered far enough to reach a preview attempt — but the
      `.catch()` is what made it diagnosable in one round-trip instead of
      more guessing. See spec Lesson 13.

## Phase 5 — Template picker inside the native print dialog (DONE,
## pending live click-through)

User redirected before Phase 4's live re-test: column choice should live
in the *native* print popup, visually like Pick Columns — a template Link
that auto-selects checkboxes, user-modifiable, with an update-template
button. Direction settled through a 9-question grilling session
(2026-10-20); decisions recorded in the spec's Decision Log. Highlights:
live iframe preview explicitly retired (checkboxes are the feedback); the
literal native Pick Columns fields can't be reused (core hides them when
a format is chosen, nulls `columns` in its callback, and force-swaps to
`print_grid` on truthy `columns` — Lesson 6), so ours mirror them
visually under distinct fieldnames; one Python registry now gates
enablement AND exclusions, boot-injected (user plans rollout to almost
all native reports, so adding report #N = one dict entry + one fixture).

- [x] `report_print_dialog.bundle.js` (replaces
      `report_column_preview.bundle.js`, deleted): wraps
      `frappe.ui.get_print_settings`, intercepts its synchronous
      `frappe.prompt` call for enabled reports only (spec Lesson 14), and
      appends a "Columns" section — `Column Template` Link (empty =
      Default, `only_select`), `extra_columns` MultiCheck (visible
      columns minus exclusions, report order preserved), muted
      "Modified" note, and a perm-gated `Update "<name>"` button shown
      only when selection diverges from the saved template. A
      `TemplatePicker` object owns the injected fields and their state.
- [x] Core API facts verified by reading source before coding: Button
      fields call `df.click` and have `set_label()`; MultiCheck fires
      `df.on_change` and is set programmatically via
      `selected_options` + `refresh_input()`; Link/Data controls call
      `df.change`; `FieldGroup.get_values()` drops null-ish values (spec
      Lesson 15 — normalized `extra_columns` in the wrapped callback so a
      previous run can't leak through the shared `print_settings`).
- [x] Server side: `get_report_print_templates` (radio-list fetcher +
      synthetic Default) deleted, replaced by `get_template_columns`
      (ordered child rows) and `update_template_columns` (replace rows +
      `doc.save()`, so write permission is enforced by the document
      itself). `boot.py` restored — static `EXCLUDED_COLUMNS_BY_REPORT`
      only, no DB access.
- [x] Permission fix the old flow masked: `Report Print Template` got a
      read-only `All` row (write stays System Manager) — the native Link
      search runs as the printing user, and the deleted fetcher had been
      bypassing permissions via `frappe.get_all`.
- [x] Node harness (node 24 found under nvm; v20 fails Frappe's engine
      check): loaded the real bundle against a stubbed `frappe`
      replicating core's sync `frappe.prompt` call shape — verified
      route/registry/no-options pass-throughs, the five injected fields,
      exclusion filtering, `frappe.prompt` restoration (including on
      throw), callback normalization, template auto-select filtered to
      currently-available columns, dirty-detection + short button label,
      update round-trip, and read-only behavior. All passed.
- [x] Rewrote `test_report_print_template.py` for the new surface
      (exclusion in picker query, `get_template_columns` order,
      `update_template_columns` replace semantics, boot shape) — the old
      tests targeted the deleted fetcher. `bench run-tests` still blocked
      by the known master-data bootstrap collision; equivalent checks run
      for real via `bench console` (boot dict, synced DocPerm rows, and a
      live update/restore round-trip on `General Ledger - With Cost
      Center`, which incidentally cleaned six leftover debug columns down
      to the intended `cost_center`).
- [x] `bench build` (new hashed bundle `report_print_dialog.bundle.
      GHNAMPZ7.js`) and `bench migrate` on qhmc.localhost, both clean.

## Next

- [ ] Live click-through in Desk (browser reload first — Lesson 2): open
      General Ledger → Print; confirm Pick Columns behaves natively with
      no format chosen; choose the Default format → Columns section
      appears (and Pick Columns hides); pick "With Cost Center" →
      checkbox auto-checks; toggle a column → Modified note +
      `Update "With Cost Center"` button; update → child rows change;
      print and PDF both render extra columns via the unchanged
      `extra_columns` contract; reopen the dialog afterwards and confirm
      nothing stale persists (Lessons 12/15).
- [ ] Verify as a non-System-Manager user: template picker populates
      (All-read row), Update button never appears.
- [ ] Migrate the existing Remarks toggle onto this mechanism too, if we
      decide the interactive-filter vs template distinction isn't worth
      keeping as two separate mechanisms.
- [ ] Second report (candidate: Trial Balance) to prove the registry gate
      and exclusions generalize — first step of the stated goal to cover
      almost all native reports; watch the exclusion-authoring cost there.
- [ ] Horizon (user-confirmed, not this phase): "Save as new template…"
      in the dialog; column labels instead of fieldnames in the doctype's
      child table; `frm.set_intro()` listing excluded columns on the
      template form.
- [x] ~~A proper way to run `bench run-tests` for this app~~ RESOLVED —
      see Phase 5 addendum below.

### Phase 5 addendum — `bench run-tests` unblocked (DONE)

The Phase 2 "master-data bootstrap collision" turned out to be two
separable problems, each with its own switch:

- **`before_tests` hooks**: ERPNext's hook re-runs setup-wizard-style
  master-data creation, wrong for a live dev site. Skipped with the
  `--skip-before-tests` flag (user's suggestion — it only gates the
  hooks, `frappe/testing/environment.py:181`, not the record walk, so it
  was necessary but not sufficient).
- **The test-record dependency walk**: `IntegrationTestCase.setUpClass`
  walks link fields transitively (`get_missing_records_doctypes`); merely
  *visiting* a doctype imports its test module, and
  `erpnext/setup/doctype/company/test_company.py` creates master data at
  **import time** (`erpnext/tests/utils.py` module-level → `make_master_
  data` → Price List "Standard Buying", inserted without
  `ignore_if_duplicate`) — colliding with the site's existing records.
  Cut with `IGNORE_TEST_RECORD_DEPENDENCIES = ["Report"]` in the test
  module: Report is this doctype's only outbound link, and the tests use
  the site's real General Ledger report, so the walk isn't needed.
  (fcm_frappe's `Document.insert` monkey-patch appears in the traceback
  but is not the culprit — it forwards `ignore_if_duplicate` faithfully;
  ERPNext's own `make_records` passes the default `False`.)

Verified before/after: failed with the exact Phase 2 symptom before the
ignore constant, then `--module ...test_report_print_template` and the
full `--app akwad_erpnext_fixes` run both pass (4/4). The recipe for this
site: `bench --site qhmc.localhost run-tests --skip-before-tests --app
akwad_erpnext_fixes`, plus per-test-module pruning of any link chain that
reaches ERPNext masters. A dedicated clean test site remains the cleaner
long-term answer if future test classes need real ERPNext master records
rather than pruning.

## Phase 6 — Print dialog UX fixes (CODE IN PLACE, live check pending)

See spec's "Phase 6 — Print dialog UX fixes" for root causes and the
design decision behind each item. No new doctypes.

- [x] `field` Autocomplete shows column labels, not raw fieldnames, from
      first render (row controls pre-seeded with `{value, label}`, not
      waiting on a keystroke). `report_print_template.js`.
- [x] "Columns" section `depends_on` tightened to the specific
      `"<report> - Default"` Print Format, not any Print Format.
      `report_print_dialog.bundle.js`.
- [x] Always-there (excluded/static) columns shown as a grayed,
      pre-"checked" visual list in the Columns section — built separately
      from the real `extra_columns` MultiCheck, never part of its options
      or submitted value (avoids the Lesson-9 double-render risk).
      `report_print_dialog.bundle.js`.
- [x] "Create New Template" button: visible when no template is selected
      but at least one column is checked, gated on
      `frappe.model.can_create`; prompts for a name, inserts via a new
      whitelisted method, auto-selects the result.
      `report_print_dialog.bundle.js` + `report_print_template.py`.
- [ ] Regression tests per this app's convention (temp-revert each fix,
      confirm the test catches it, restore).

Status 2026-10-28: all four items were found already implemented in the
working tree (uncommitted; bundle built). Verified this session:
- `bench run-tests` on `akw.localhost` (with `--app` and
  `--skip-before-tests`): 6/6 pass, including `create_template`
  insert and permission tests.
- Node harness (stubbed `frappe`, not committed) confirmed `depends_on`
  matches only `"<report> - Default"`, and excluded columns land in the
  static list and not in the MultiCheck options.
Not yet done:
- [ ] Live Desk click-through of all four items (label resolution in the
      template form, grayed list, Create button flow).
- [ ] Regression JS tests: no JS test runner in this app; harness above
      is throwaway. Decide whether to commit one.
- [ ] Temp-revert check that the Python tests fail without `create_template`.

## Phase 7 — Report filter + dialog polish (DONE, 2026-10-31)

- [x] `Report Print Template.report` only offers reports that have an
      enabled `"<report> - Default"` Print Format — the only format that
      renders template columns. Client: `frm.set_query("report")` →
      whitelisted `report_query`. Server: `validate()` rejects any other
      report, so the rule holds for API/import writes too.
- [x] Print dialog redesign, same behavior, no new server calls:
  - MultiCheck label "Columns" → "Optional Columns" (the section already
    says "Columns").
  - "Modified" note + Update/Create buttons merged into one inline row
    (note left, one `btn-xs` right); the two stacked Button fields are
    gone. Update and Create are mutually exclusive, so one row is enough.
    Create is now labelled "Save as Template". Users without write
    permission still see the "Modified from template" note, but no button.
  - "Always Included" disabled-checkbox grid → one muted line
    ("Always included: …"). Columns that can't be toggled should not look
    like controls.
- [x] Tests: 2 new (`report_query` filter, `validate` rejection), 8/8 pass
      on `akw.localhost`. Temp-revert check: both new tests fail without
      the fix.
- [x] Live check on `akw.localhost` (`bench serve`, agent-browser):
      empty, selection-without-template ("Save as Template") and
      modified-template (`Update "Test One"`) states all render correctly.
