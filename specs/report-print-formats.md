# JS-Based Report Print Formats

## Goal

Build clean, professional, print/PDF-ready Print Formats for reports, using
Frappe's JS-based Report Print Format feature (`Print Format.print_format_for
= "Report"`, `print_format_type = "JS"`), with a shared look across reports
and reusable CSS/JS instead of copy-pasting per format.

Scope rule: report lives in Frappe core -> `akwad_frappe_fixes`. Report lives
in ERPNext -> `akwad_erpnext_fixes`. Each app's print formats are self
contained; they do not depend on each other at runtime.

Naming convention: `<Report Name> - Default`.

## Approach: Tracer Bullets

Ship one real report end-to-end first (General Ledger), hitting every layer
of the system (DocType fixture sync, the JS templating engine, the shared
Print Style, PDF generation via wkhtmltopdf, Desk's print dialog) before
generalizing. Everything under "Lessons from the tracer bullet" below is a
real, confirmed constraint discovered by actually shipping it — not a guess.

## Architecture

- **Print Style** (`patches/create_print_style.py`): creates/updates a
  Print Style doc named `Akwad Print Style`. Self-contained — modeled on
  `akwad_frappe_fixes`'s Standard Print Style as a design reference, but
  does not read its CSS variables/classes at runtime. Holds `.pf-*` classes
  (for future DocType-type formats) and `.akwad-report` classes (for report
  print formats).
- **Shared JS helpers**, both loaded via `app_include_js` as bundle names
  so `bench build` content-hashes them, both in the `frappe.akwad_report`
  namespace:
  - `public/js/report_print_style.bundle.js` — template-rendering helpers
    used inside a Print Format's own `html`: `get_style_tag()`,
    `build_header()` (title block + filter strip), `render_filter_strip()`,
    `render_rows()` (depth-first, flat-or-nested), `footer()`,
    `letterhead_footer()`,
    `get_extra_columns()` / `render_extra_headers()` /
    `render_extra_cells()` (generic optional-column rendering — see
    Future Plan). Every report print format calls into this instead of
    redefining styling.
  - `public/js/report_print_dialog.bundle.js` — Desk-side only: injects the
    column-template picker into the native print/PDF settings dialog (see
    Column choice, below).
- **Print Format per report**: one JSON fixture per report under
  `akwad_erpnext_fixes/print_format/<doctype_scrub>___default/`, `html`
  field written in Frappe's EJS-like micro-template syntax
  (`{% %}` / `{%= %}`, see `frappe/public/js/frappe/microtemplate.js`).
  Still exactly one Print Format per report — column variation never adds
  a second one.
- **Column choice**: `Report Print Template` doctype — a named column
  preset per report (`report` + `template_name`, autoname `format:
  {report} - {template_name}`), child table `Report Print Template
  Column` with a single `field` Autocomplete, same picker-population
  mechanism as the deleted `Report Print Configuration` (run the report
  with best-effort filters, read its live columns). Chosen *inside the
  native print/PDF settings dialog* (`report_print_dialog.bundle.js`):
  for enabled reports, a "Columns" section appears once a Print Format is
  picked — a "Column Template" Link (empty = Default, no extra columns),
  a MultiCheck visually mirroring core's Pick Columns but with its own
  fieldname (`extra_columns`), and a perm-gated "Update Template" button
  that appears when the checkboxes diverge from the selected template's
  saved fields. Selecting a template auto-checks its fields; the user may
  tweak per print run. A report is enabled by its presence in
  `PRINT_COLUMNS_BY_REPORT` (boot-injected), which also filters the
  pickable columns. Superseded the second-dialog radio picker with live
  iframe preview (Phase 4), which superseded the per-column-checkbox
  dialog (Phase 3), which superseded the admin-config-only `Report Print
  Configuration` doctype (Phase 1/1.A/2) — see progress.md Phase 3/4/5.

## Lessons from the tracer bullet (General Ledger)

These constrain every future report print format in this app:

1. **Fixture sync is modified-timestamp gated.** `bench migrate` only
   re-imports a standard-doc JSON fixture if its `modified` field is
   strictly newer than the DB's. Bump `modified` on every content edit or
   the change silently never lands.
2. **Desk is a SPA.** `app_include_js` only loads on a real browser
   reload, not on in-app navigation. A stale JS helper can make a print
   format look "not updated" even when the server-side fixture is correct.
3. **nginx caches `/assets/*` for a year** (`max-age=31536000`). A raw
   unhashed asset path can genuinely get stuck stale even across reloads.
   Fixed by renaming to `report_print_style.bundle.js` — esbuild
   content-hashes the output filename on every `bench build`, so the URL
   itself changes whenever the content does (see progress.md Phase 1.A).
4. **`print_format_for == "Report"` always forces `standard = "No"`** on
   every save (`frappe/printing/doctype/print_format/print_format.py:
   before_save`), including during fixture import. This is expected,
   harmless, and unrelated to whether fixture sync works (that's governed
   purely by the `modified` check above).
5. **MultiSelectList filters return `[]` when unset**, which is truthy in
   JS. Any "only show this filter if set" check must treat empty arrays as
   absent. Handled centrally in `build_header()`'s `has_value`/
   `format_value`, not per call site.
6. **"Pick Columns" in the print dialog is incompatible with custom Report
   Print Formats.** `get_print_template()` in `query_report.js` swaps in
   Frappe's generic `print_grid` template unconditionally the moment
   `print_settings.columns?.length` is truthy, and `print_utils.js`
   actively zeroes `pick_columns`/`columns` whenever a `print_format` is
   chosen — our Print Format's `html`/`css` never even runs. Not fixable
   by reusing that field: we use a different one (`print_settings
   .extra_columns`) that neither chokepoint knows about. See Future Plan
   / Lesson 10.
7. **Report PDF generation always goes through wkhtmltopdf**
   (`frappe.utils.print_format.report_to_pdf`), never chrome/weasyprint.
   Still true in v16: `report_to_pdf` calls `get_pdf` directly, and the
   Print Format's `pdf_generator = chrome` field is ignored for reports.
   CSS must avoid Grid. *Amended in Phase 8:* the original advice "use
   flexbox" was wrong for this engine. See Lesson 16 for what it
   supports.
8. **Letterhead header is automatic** (rendered by `akwad_frappe_fixes`'s
   global print-page wrapper). **Letterhead footer is a real gap in
   Frappe core** for the Report-print flow — fetched into
   `print_settings.letter_head.footer` but never rendered anywhere, since
   the wrapper's footer block is gated behind `repeat_header_footer`,
   which the Report print dialog never sets. We render it ourselves via
   `letterhead_footer()`.
9. **A pickable column that's already rendered elsewhere silently
   double-renders instead of erroring.** General Ledger's `remarks`
   column is rendered via the report's own interactive `show_remarks`
   filter, a deliberately separate axis from `Report Print Template` (see
   Decisions) — it must never be offered as a template column, or it'd
   render twice with no runtime check stopping it. Fixed by one shared
   exclusion list (`PRINT_COLUMNS_BY_REPORT` in
   `report_print_template.py`) consulted by the Autocomplete query that
   populates the child table's `field` picker. (The exact same fix,
   applied against the same risk, twice now: first in the deleted `Report
   Print Configuration`, now here — same registry shape, different owner
   module each time Phase 3/4 changed where column choice is stored.)
10. **No plugin hook exists to extend the Report print dialog or its
    print/PDF actions** — `frappe.ui.get_print_settings` (the settings
    prompt) and `frappe.views.QueryReport.prototype.print_report`/
    `pdf_report` (the actual render) are plain functions/methods with no
    override point. Extending them means monkey-patching. We patch the
    narrowest, lowest-risk point: wrap `print_report`/`pdf_report` on the
    `QueryReport` prototype once (at bundle load, not per page-load — SPA
    navigation doesn't matter), gated by a report-name whitelist
    (`REPORTS_WITH_COLUMN_PREVIEW`) so every other report's print/PDF
    behavior is untouched. Considered and rejected: patching the shared
    `frappe.ui.get_print_settings` instead (used by report print, list
    view print, and tree view print) — would have meant copying ~30 lines
    of core dialog-building code and carrying a 3-caller blast radius for
    no benefit, since the settings dialog itself needs no changes.
11. **`frappe.ui.get_print_settings` nulls `settings.print_format` on the
    shared settings object immediately after invoking its callback**
    (`print_utils.js`: "clean up print format to avoid affecting next
    print") — synchronously, not after the callback's own async work
    finishes. Our `print_report`/`pdf_report` override doesn't call the
    real renderer inline; it opens a dialog and waits for the user, so by
    the time anything in that dialog reads `print_settings.print_format`,
    it's already `null`. Surfaced as a live bug: the real print/PDF call
    failed server-side with "`None` is not an enabled Print Format for a
    Report" (`frappe/desk/query_report.py: get_print_format_data`) the
    first time this was tried end-to-end. Fixed by capturing
    `print_format` into a local at the very top of
    `show_column_preview()`, before any `await`/dialog, and restoring it
    onto `print_settings.print_format` right before calling the real
    `render_fn`. Any future code that holds onto a `print_settings` object
    across an async gap must do the same — never re-read
    `.print_format` from it later. (Moot since Phase 5 structurally
    removed the async gap — no second dialog — but the constraint stands
    for any future code that reintroduces one.)
12. **`print_settings` is one shared, session-lifetime object**
    (`locals[":Print Settings"]["Print Settings"]`, mutated in place by
    every print action across every report and doctype) — not a fresh
    object per print. Restoring `print_format` onto it (Lesson 11) without
    also clearing it again afterward leaks that value into the *next*,
    unrelated print action: reopening the print dialog and leaving
    "Print Format" untouched doesn't reset it to empty (jQuery's
    `$.extend` skips `undefined` source values, and an untouched Link
    field reads as `undefined`, not `""`), so the stale value survives and
    can wrongly re-trigger this dialog later. Fixed two ways: (a) null
    `print_settings.print_format` again immediately after handing off to
    the real `render_fn`, restoring the invariant `print_utils.js` itself
    intends; (b) `should_preview()` additionally checks the format name
    actually starts with `"<report.report_name> - "` (this app's naming
    convention), not just truthiness — defends against any leftover value
    from a different report/doctype entirely, not only this app's own
    stale values.
13. **`frappe.templates["print_template"]`
    (`frappe/public/html/print_template.html`) directly references
    `title`, `columns.length`, and `can_use_smaller_font` in its own
    markup** (`<title>{{ title }}</title>`, a `columns.length > 20` check,
    a smaller-font toggle) — leaving any of them out of the context object
    passed to `frappe.render_template("print_template", {...})` throws
    inside the compiled microtemplate function (`ReferenceError: title is
    not defined` for the first one hit, since `with(obj){...}` only
    shadows properties `obj` actually has). The real
    `QueryReport.pdf_report()` always passes all of them
    (`query_report.js`); anything that calls `render_template
    ("print_template", ...)` directly — like the preview dialog — must
    replicate that full context, not just the fields it happens to use
    itself. (Historical since Phase 5 deleted the preview dialog; kept
    because the constraint is core's, not ours.)
14. **`frappe.ui.get_print_settings` is fully synchronous and builds its
    dialog through one `frappe.prompt` call, returning the dialog** —
    there is still no field-extension hook (Lesson 10), but this shape
    allows the narrowest possible injection: wrap `get_print_settings`,
    and for enabled query-reports only, swap `frappe.prompt` for the
    duration of the original call (restore in `finally`), appending our
    fields to the fields array it receives. Zero core code copied; other
    callers (list view, tree view, other reports) hit the untouched
    original. This breaks loudly — not silently — if core ever makes
    `get_print_settings` async or stops routing it through
    `frappe.prompt`; re-verify both on every Frappe upgrade.
15. **`FieldGroup.get_values()` drops null-ish values instead of
    overwriting** (`if (!is_null(v)) ret[...] = v`), and the print dialog
    `$.extend`s its values onto the shared session-lifetime
    `print_settings` object (Lesson 12). An unchecked MultiCheck or empty
    Link therefore does *not* clear a stale value from a previous print —
    it silently keeps it. Any injected field must be normalized in the
    prompt callback (`values.extra_columns = values.extra_columns || []`)
    before core's `$.extend` runs, or a previous run's choice leaks into
    the next.
16. **wkhtmltopdf 0.12.6.1 (this bench) ignores CSS custom properties
    and modern flexbox.** Confirmed by a probe page rendered with
    `wkhtmltoimage` on 2026-11-03: `var(--x)` in a border or color is
    dropped (the rule falls back as if unset), `display: flex` and
    `display: -webkit-flex` lay children out as blocks, and only the
    2009 `display: -webkit-box` syntax places children side by side.
    `gap` and `font-variant-numeric` are also ignored. Also,
    `report_to_pdf` pins wkhtmltopdf to a dead proxy and bypasses it only
    for the site's own hosts (`_pdf_bypass_proxy_hosts`), so an
    `@import` from Google Fonts never loads in a PDF. The browser print
    window shows none of this, so "Print looks right, PDF does not" is
    the expected symptom. Every `.akwad-report` rule must use literal
    colors, `-webkit-box` or tables for row layout, and no external
    font import.
17. **A Print Style reaches report output only through
    `frappe.boot.print_css`, and only when it is the one selected in
    Print Settings.** `boot.py: load_print_css` calls
    `printview.get_print_style(print_settings.print_style)`, which
    renders core's `standard.css` with the Print Settings font and font
    size and appends that one Print Style's CSS. Core injects the
    result into the `<head>` of both the print window
    (`microtemplate.js: render_grid`) and the PDF HTML
    (`query_report.js: pdf_report` → `print_template.html`). Nothing
    reads any other Print Style. Two consequences: a Print Style that
    is not selected is inert data, and a `<style>` block emitted inside
    the format body comes later in the document, so at equal
    specificity it overrides the selected style. Also, `frappe.boot` is
    cached in Redis per user (`sessions.py: get`) and
    `PrintStyle.on_update` does not clear that cache (only
    `PrintSettings.on_update` calls `frappe.clear_cache()`), so an
    edited Print Style does not show until the cache is cleared and the
    browser is reloaded (Lesson 2).

## Future Plan

### Configurable columns — superseded (was Phase 1 / 1.A / 2)

The original design was one `Report Print Configuration` doc per report
(admin-configured, injected into `frappe.boot`), later generalized to
render any configured fieldname generically. Shelved and replaced outright
by the visual column picker below — see progress.md Phase 3 for why
(admin-level, per-site config vs. a per-print-run visual choice turned out
to be the wrong axis). The doctype, its child table, the `boot_session`
hook, and its whitelisted methods were deleted, not just disconnected —
nothing referenced them after Phase 3 and they were still uncommitted.
`get_enabled_columns()`/`get_configured_columns()`/`is_column_enabled()`
no longer exist; see `get_extra_columns()` below.

### Visual column picker, v1: raw checkboxes — superseded same-day (was
### Phase 3)

First cut: every optional column as its own checkbox in the preview
dialog, no persistence. Replaced before it was even verified live —
the user wanted named, reusable presets ("template with Cost Center,
template without"), not a column-by-column checklist every time, and
didn't want N near-duplicate Print Formats either (ruled out a day
earlier). `get_extra_columns()`/`render_extra_headers()`/
`render_extra_cells()` from this iteration carried forward unchanged;
only *what feeds* `print_settings.extra_columns` changed again.

### Named column templates in a second dialog — superseded (was Phase 4)

`Report Print Template` doctype: one doc per named preset (not per
report — a report can have several), `report` + `template_name`, child
table `Report Print Template Column` (`field` Autocomplete, same
run-the-report-to-get-columns mechanism as the deleted `Report Print
Configuration`, see `get_report_columns`/`PRINT_COLUMNS_BY_REPORT` in
`report_print_template.py`). `get_report_print_templates(report)`
(whitelisted) returns an implicit "Default" entry (no extra columns) plus
every configured template, each with its resolved fieldname list.

The preview dialog (`report_column_preview.bundle.js`) fetches this list,
renders one radio option per template, and shows a live iframe preview of
the selected one — switching options re-renders instantly, same template
+ CSS + letterhead as the real print. Confirming calls the real
`print_report`/`pdf_report` with `print_settings.extra_columns` set to
the chosen template's columns.

The doctype survived into Phase 5 unchanged; the second dialog (radio
list + live iframe preview) did not — the user wanted the choice inside
the native print dialog, visually like Pick Columns, and judged named
presets + visible checkboxes enough feedback to retire the live preview
(decision log amended). Deleting the second dialog also deleted the
Lesson 11/12 capture/restore machinery and the Lesson 13 preview-context
code wholesale, since no async gap remains between the settings prompt
and the render.

### Native-dialog template picker (shipped — see progress.md Phase 5)

`report_print_dialog.bundle.js` wraps `frappe.ui.get_print_settings`
(Lesson 14) and, for enabled reports, appends a "Columns" section to the
native dialog, shown only while a Print Format is chosen (the exact
inverse of core's Pick Columns visibility, so the two pickers never
coexist): a "Column Template" Link (empty = Default), an
`extra_columns` MultiCheck mirroring Pick Columns visually (options =
the report's visible columns minus exclusions, order preserved), and an
"Update Template" button shown only when the selection diverges from the
selected template's saved fields *and* the user can write `Report Print
Template` (read-only users still get a muted "Modified" note and a
one-off tweaked print). Selecting a template fetches its fields
(`get_template_columns`) and auto-checks them — compared and applied
over the currently-available columns only, since a template may
reference a column the current run was filtered without. Enablement and
column filtering both come from `PRINT_COLUMNS_BY_REPORT`, boot
-injected as a static dict (`boot.akwad_report_print_columns`): a report
is enabled by having a key there, so report #N costs one Python entry
plus its Print Format fixture.

The print-format-side contract is unchanged from Phase 3: still
`extra_columns = get_extra_columns(print_settings.extra_columns,
columns)` in the template, still `render_extra_headers`/
`render_extra_cells` for the actual markup. Four sourcing strategies have
now shared that one contract (boot-injected config, dialog checkboxes, a
second-dialog template picker, now native-dialog fields) — it was never
the bottleneck.

### Phase 6 — Print dialog UX fixes (shipped — see progress.md)

Four fixes to the native-dialog picker shipped in Phase 5, requested after
a live look at the dialog. No new doctypes; no fieldtype changes.

1. **Column labels in the `field` Autocomplete, not raw fieldnames.**
   Root cause: `ControlAutocomplete.format_for_input()` only resolves a
   label by looking the value up in the control's own `_data` cache, and
   that cache is only populated once the user types and the live
   `get_report_columns_query` call returns — so on load (and, since
   `editable_grid: 1` renders a real control per visible row, on every
   row, not just an opened one) it falls back to showing the raw value.
   Fix: eagerly fetch the full column list for `frm.doc.report` on
   `refresh`/`report`-change and push `{value, label}` into the row
   controls' caches so labels resolve immediately, no keystroke required.
   Deliberately not a fieldtype change to Select — Select's stored value
   and displayed text are the same string, and `get_extra_columns()`
   matches the stored value against the live report's `fieldname`;
   storing the label instead would break that match. Confined to
   `report_print_template.js`, reusing the existing
   `get_report_columns_query`.
2. **"Columns" section must depend on *this report's* Print Format, not
   any Print Format.** Current `depends_on: "print_format"` on
   `akwad_columns_section` only checks truthiness — shows for any format
   the user picks, not specifically `"<report> - Default"`. Fix: a
   function-based `depends_on` checking `doc.print_format === report.name
   + " - Default"`, the same naming-convention check Lesson 12's
   `should_preview()` already relies on elsewhere. One-line change in
   `report_print_dialog.bundle.js`.
3. **Always-there (excluded/static) columns shown grayed-out and checked**
   in the Columns section, so the user can see what's already included
   instead of those fields just silently not being offered. Deliberately
   *not* added as real, disabled entries inside the `extra_columns`
   MultiCheck: Frappe's `MultiCheck` doesn't actually wire up disabled
   checkboxes (its `select_all()` checks `checkbox.disabled` but
   `get_checkbox_element()` never sets it), and its `selected_options`
   array is independent of DOM checked state — a "checked" always-there
   option would flow into the submitted `extra_columns` value and get
   double-rendered server-side (the exact failure mode Lesson 9 already
   named once). Instead: a separate, purely visual list styled to match
   the checkboxes (grayed, pre-"checked"), built from
   `PRINT_COLUMNS_BY_REPORT` ∩ the current run's visible columns, never
   part of the real MultiCheck options or value.
4. **"Create New Template" button** in the Columns section: shown when no
   template is selected (`report_print_template` empty) but at least one
   `extra_columns` checkbox is checked, gated on
   `frappe.model.can_create("Report Print Template")`. Prompts for a
   name, calls a new whitelisted create method (sibling to
   `update_template_columns`) to insert the doc, then auto-selects it in
   the Link field. Formalizes the "Save as new template…" horizon item
   below.

### Phase 7 — Report filter + dialog polish (shipped — see progress.md)

1. **`Report Print Template.report` limited to reports with a
   `"<report> - Default"` Print Format.** Only that format renders
   template columns, so a template for any other report is dead data.
   Enforced in two places: `report_query` (Link search) and `validate()`
   (all writes).
2. **Dialog redesign, same behavior.** The MultiCheck is now labelled
   "Optional Columns". The note and the Update/Create button share one
   inline row, which replaces the two stacked Button fields. The
   always-included columns are one muted text line, not the grayed
   checkbox grid from Phase 6 item 3. Columns that can't be toggled should
   not look like controls. The Lesson 9 separation from the MultiCheck
   stays.

### Phase 8 — Theme ownership, PDF fidelity, filters, dialog accuracy (code done — see progress.md; live PDF check pending)

Four problems reported after a live look at the General Ledger print on
2026-11-03, plus one question. The root causes below come from reading
core and from the wkhtmltopdf probe (Lesson 16), not from a live
reproduction. Step 0 of the phase is to reproduce each item on
`akw.localhost` before changing code.

1. **The "Always included" line lists the wrong columns.**
   Root cause: `render_static_columns()` builds the line from
   `PRINT_COLUMNS_BY_REPORT` ∩ the run's visible columns. That
   registry answers a different question: which report fieldnames the
   format *consumes*, so that they are not offered as optional columns
   (Lesson 9). For General Ledger it holds eleven fieldnames, so the line
   reads "Posting Date, Account, Debit (QAR), Credit (QAR), Balance
   (QAR), Voucher Type, Voucher No, Against Account, Party, Supplier
   Invoice No, Remarks". The printed table has six columns: Date,
   Particulars, Party, Debit, Credit, Balance. `voucher_type`,
   `voucher_no`, `account` and `bill_no` are merged into Particulars,
   `against` is a fallback for Party, and `remarks` is a seventh column
   only while the report's own `show_remarks` filter is on. One list
   cannot serve both purposes.
   Fix: give each registry entry a second, explicit list, the printed
   column labels in print order, and build the line from that. Proposed
   shape: `{"General Ledger": {"excluded_fieldnames": [...],
   "printed_columns": ["Date", "Particulars", "Party", "Debit",
   "Credit", "Balance"]}}`, still one entry per report and still
   boot-injected under `boot.akwad_report_print_columns` (the JS and the
   boot test adapt to the new shape). Labels are English strings
   translated client-side with `__()`. The print format uses the same
   strings, so the dialog and the paper match. Remarks is not listed:
   the report's own filter governs it and the user sees that filter on
   the report page. The Lesson 9 separation from the MultiCheck is
   unchanged.

2. **Editing `Akwad Print Style` changes nothing on paper.** Two
   confirmed causes, both in current code.
   (a) The Print Style is never read. `report_print_style.bundle.js`
   carries its own copy of the same `.akwad-report` rules in `ns.CSS`,
   and `get_style_tag()` writes that copy into the format body. The two
   copies already drift: `.akwad-letterhead-footer` exists in the bundle
   only. Per Lesson 17, the only path from a Print Style to any print
   output is `frappe.boot.print_css`, and only for the style selected in
   Print Settings. So the user's reading is correct: `Akwad Print Style`
   is inert unless selected, and even when selected, the bundle's
   in-body copy comes later in the document at equal specificity and
   wins every rule. Item 5 fixes this.
   (b) Saving a Print Style does not clear the cached `frappe.boot`
   (Lesson 17). Fix: a `doc_events` hook on `Print Style.on_update` that
   calls `frappe.clear_cache()` when the saved style is the selected
   one. A supported hook, no monkey patch, and it also fixes the same
   stale-boot problem for core's own styles on this site. Python
   regression test: save the selected style, assert the bootinfo cache
   key is gone.

3. **PDF output loses most of the styling.** Root cause: Lesson 16.
   Everything that carries the design in the current CSS is a feature
   wkhtmltopdf drops. `var(--akwad-accent)` on the table header borders,
   the filter box border and labels, and the closing row borders.
   `display: flex` plus `gap` on `.akwad-report-header` and
   `.akwad-report-filters`, so company/period and the filter rows stack
   vertically. The Rubik `@import`, so the font falls back. The browser
   print window renders all of it, which is why Print looks right and
   PDF does not.
   Fix: write the CSS for wkhtmltopdf, the lowest common denominator.
   Literal colors instead of `var()`. `display: -webkit-box` or a plain
   two-cell table for the header and filter rows, no `gap`. No
   `font-variant-numeric`. No external `@import`: the font comes from
   Print Settings (item 5). Verification is a real PDF downloaded from
   `akw.localhost`, not the print window.

4. **"Include filters" should behave like core.** Core builds
   `filters_html` in `get_filters_html_for_print()`: one `.filter-row`
   per applied filter, with empty values and `hidden_due_to_dependency`
   filters skipped, labels from the filter's DocField, values through
   `frappe.format(..., {for_print: true})`, and Check filters as Yes/No.
   It passes that HTML to the template as `subtitle` only when the
   dialog's "Include filters" box is checked, in both `print_report` and
   `pdf_report`. `print_grid.html` renders `{{ subtitle }}` under the
   title. Our template ignores `subtitle` and renders its own
   hand-picked `meta` list on every print, so the checkbox does nothing
   for our formats.
   Fix: `build_header()` takes `filters_html`, the template passes
   `subtitle`, and the helper renders it inside `.akwad-report-filters`
   when non-empty. The `meta` option and the General Ledger `meta` list
   are removed: core's list is the record of what was applied, and
   keeping both would print the same filter twice. Core's row markup
   (`<div class="filter-row"><strong>Label:</strong> value</div>`)
   already uses the class our CSS styles, so the box keeps its look.
   Company and Period stay in the title header on every print: they
   identify the statement, and they also appear in the filter list when
   the box is checked, same as core. Trade-off accepted: the Phase 0
   curation that hid flags such as "Include Dimensions" is gone. A
   checked flag prints as "Yes" and an unchecked one as "No", exactly as
   core prints it. If that is unwanted later, the fix is a per-report
   skip list in the registry, not a return to `meta`.

5. **Take colors and fonts from the Print Style selected in Print
   Settings.** Yes. It is the design core already has (Lesson 17): the
   selected Print Style, the Print Settings font and the font size all
   reach every report print and PDF through `print_css`. Decision for
   this phase, recommended and pending the user's confirmation:
   - The Print Style selected in Print Settings owns the theme: font
     family, colors, backgrounds, accent borders. `Akwad Print Style`
     becomes the shipped default theme for `.akwad-report` and must be
     *selected* in Print Settings to apply. It stays a seeded doc:
     `create_print_style.py` seeds it, the admin owns it after that.
   - The bundle owns structure only: table layout, column widths,
     alignment, indents, page-break rules, nowrap. No color, no
     font-family, no font-size in `ns.CSS`. With another Print Style
     selected (Redesign, Classic) the table stays readable in core's
     default look and has no Akwad accent.
   - Because of Lesson 16, every `.akwad-report` rule in the Print Style
     uses the literal accent color. `--akwad-accent` stays for the
     `.pf-*` DocType formats only.
   - The duplicate `.akwad-report` rules leave `ns.CSS`. `get_style_tag()`
     emits only the structural rules. One owner for the theme, which is
     what item 2 was missing.

   Superseded in part on 2026-11-04: the format embeds `Akwad Print Style`
   from boot, so selecting it in Print Settings is no longer required (see
   progress.md, Phase 8 follow-up).

   Item 5 was implemented as recommended; the user confirmed it by
   asking for implementation of the planned phase.

   Order of work (tracer bullet): item 5 on General Ledger first (move
   the theme into the Print Style, select it, verify Print and PDF), item
   3 inside the same CSS rewrite, then items 4, 1 and 2b. Each item ships
   with a regression test (the JS harness for items 1 and 4, Python for
   2b), a temp-revert check, and a live check on `akw.localhost` with a
   real PDF.

### Phase 9 — Look: option E "Classic Masar Mix" (code done, 2026-11-04; live check pending)

Five looks for the report print format were mocked up as A4 artboards on
the design canvas https://claude.ai/artifact/2BqXHuZYY7ori4DXF2HprY
(title "Report Print Looks"), each with the same General Ledger sample
data, letterhead placeholder and an accent color control:

- **A · Ledger Classic** — serif, monochrome, filters as a two-column
  key/value table. Timeless and perfect in grayscale; least brand presence.
- **B · Akwad Corporate** — accent band header, filled table header,
  filters as wrapped chips. Branded and scannable; most ink, chips wrap
  unevenly with long values.
- **C · Masar Ink & Signal** — the Masar workspace look: Rubik, near-black
  ink, Signal Blue, soft grey cards with 8px corners, filter chips with on
  and off tints, KPI strip, solid black closing row. App-like and fresh;
  needs Rubik installed on the server for PDFs.
- **D · Compact Register** — dense operational type, filters as one run-in
  strip with Yes/No flags collapsed into an Options line. Most rows per
  page; tiring for long reads.
- **E · Classic Masar Mix** — A's centred title block and ruled table, D's
  one-line filter strip with the Yes/No flags as on and off pills, all in
  C's Rubik, Masar greys and 4px radii. Accent on title, rules and closing
  balance.

**Decision (user, 2026-11-04): option E.** It is the shipped look for every
`.akwad-report` format. The split from Phase 8 item 5 stands: the Print
Style owns colors, fonts, borders and backgrounds; the bundle owns the
box model, alignment and type sizes.

What E changes in the implementation:

1. **Title block.** `build_header()` renders one centred block with the
   title, the company line and the period line, ruled above and below in
   the accent color. The two-cell company/period table is gone. The General
   Ledger period line adds "Amounts in <currency>" when a presentation
   currency is set.
2. **Filter strip.** `render_filter_strip()` takes core's `filters_html`
   (Phase 8 item 4 is unchanged: the "Include filters" box still governs
   it) and re-lays it out: value filters become one run-in line of
   "Label value" pairs separated by a middle dot; filters whose value is
   `__("Yes")` or `__("No")` (core prints Check filters that way) move to
   an "Options" line as pills, tinted for Yes and plain for No. The row
   shape is parsed from core's fixed markup (`<div class="filter-row">
   <strong>Label:</strong> value</div>`); if no row matches, the HTML is
   placed in the strip untouched, so a core change degrades to the Phase 8
   look rather than to nothing. A Select filter whose value is literally
   Yes or No is treated as a flag too; that is the intended reading.
3. **Table.** Uppercase, letter-spaced header in the accent color with
   1px accent rules; 1px light rules between rows; the date cell muted;
   the opening row italic and muted (`akwad-row-opening`, new); the total
   row with a dark top rule; the closing row with an accent top rule, a
   double accent bottom rule and the balance cell in the accent color.
   Voucher number and account print as muted sub-lines under the voucher
   type. The spacer row has its own class (`akwad-row-spacer`) so the
   theme can drop its rule.
4. **Cell padding is `!important`** in the bundle. The embedded Print
   Style carries `.print-format td, th { padding: 2px 4px !important }`
   for the DocType formats (the "Known" note of the Phase 8 follow-up), and
   that rule won over the report padding. Higher specificity plus
   `!important` on the report cells restores the 6px padding without
   touching the DocType rule.
5. **Font.** `.akwad-report` asks for Rubik, then "Helvetica Neue", Arial,
   sans-serif. Rubik is not installed on this bench (`fc-list` finds none)
   and Lesson 16 rules out the Google Fonts import for PDFs, so PDFs fall
   back to the next family until the font is installed on the server. The
   browser print window shows Rubik where the Print Style's existing
   `@import` loads it.

Tests: node 7/7 (`report_print_bundles.test.js`: title block, pills and
inline rows, unknown-markup fallback, empty filters, color-free structure,
theme embedding, dialog line) and Python 15/15. Temp-revert check: with
flag detection returning false, the pills test fails. The accent test in
`test_print_style.py` now asserts the 1px rule E uses.

Deployed on `akw.localhost`: `create_print_style` re-executed by hand (no
new patch, per the Phase 8 follow-up decision), `bench migrate` synced the
fixture (`modified` 2026-11-04 12:00), assets rebuilt with Node 24, cache
cleared. Not done: the Desk print and the real PDF download. The test
site's recorded logins no longer work, so the live check needs a working
session (see progress.md).

### Follow-up — report PDF stalls two minutes on the Google Fonts import (found 2026-11-04, not fixed)

Symptom: a General Ledger PDF with `General Ledger - Default` chosen takes
about two minutes even for an empty ledger. The same PDF with no Print
Format chosen takes under a second.

Cause: the Akwad Print Style CSS starts with an `@import` of Rubik from
Google Fonts. Since the Phase 8 follow-up, `get_style_tag()` embeds the
whole style CSS into every report print body, so every report PDF carries
the import. `report_to_pdf` pins wkhtmltopdf to the dead proxy
`http://0.0.0.0:0` (Lesson 16). Qt does not fail fast on that proxy. It
waits for its own timeout, about 120 seconds, before `load-error-handling:
ignore` lets the render continue. Before the follow-up the same stall
happened whenever Akwad Print Style was the selected style, through core's
`print_css`. Core's own grid never carries the import, which is why it is
fast.

Measured on this bench with wkhtmltopdf 0.12.6.1 and the report path's
options:

| Page | Time |
|---|---|
| Bare page | 0.4 s |
| Plus the site print CSS over loopback | 0.7 s |
| Plus the Google Fonts `@import`, through the proxy pin | 2 min 0 s |
| Same `@import` without the proxy pin (DocType PDF path) | 1.5 s |

Cost model: the browser builds the HTML, the server writes an Access Log
row with that HTML, runs wkhtmltopdf as a synchronous subprocess and
streams the bytes back. Work grows linearly with pages. The gunicorn
worker is blocked for the whole render, and production gunicorn kills a
request at 120 seconds by default, so the stall can surface as a failure
after two minutes and holds one worker per attempt. Extra columns and
templates add cells only, nothing the engine fetches.

Dev-only extra: `akw.localhost` is not in `/etc/hosts`, so the server
side takes 10 seconds to resolve it. wkhtmltopdf fetches the print CSS
and the letterhead logo from that host, so each fetch adds 10 seconds on
this machine. Add `127.0.0.1 akw.localhost` to `/etc/hosts` to remove it.
Real domains resolve through DNS and do not have this problem.

Fix to make: strip `@import` rules from the theme CSS when boot embeds it
(`get_report_theme_css`), with a Python test that fails without the strip.
The import can never load in a report PDF, so nothing is lost. The DocType
formats keep their import and still pay the network fetch per PDF. The
long-term answer is Rubik installed on each PDF server and no import in
any Print Style, which also closes the Phase 9 font gap.

### Next

- Second report (candidate: Trial Balance) to prove the registry gate and
  `PRINT_COLUMNS_BY_REPORT` actually generalize across reports, not
  just General Ledger.
- Mass rollout to (almost) all native reports is the stated goal. Open
  question for that scale: does hand-authoring each report's exclusion
  list stay tolerable, or does it want auto-derivation from the report's
  print format itself?
- A `frm.set_intro()` or similar on `Report Print Template`'s form
  listing the report's excluded/static columns, mirroring the old
  doctype's UX, if an admin ever asks why a field isn't offered.

## Decisions explicitly made (don't re-litigate without reason)

- One shared, self-contained Print Style per app (not inherited/extended
  from another app's Print Style).
- All implementation restricted to `akwad_erpnext_fixes` for ERPNext
  reports; no runtime dependency on `akwad_frappe_fixes`.
- No QR codes or signature blocks on report print formats.
- The report look is option E "Classic Masar Mix" from the design canvas
  (Phase 9, 2026-11-04). Options A–D were considered and are recorded
  there; a new look is a new canvas round, not a tweak of the theme CSS.
- Exactly one Print Format per report, always — column variation is never
  solved by adding a second (or Nth) named Print Format. Ruled out
  explicitly; don't re-propose without new information.
- Column choice is visual and made at print time, inside the *native*
  print settings dialog (no second dialog), with the *set of available
  choices* admin-defined and persisted (`Report Print Template`) plus
  per-print-run tweaking of the checkboxes. The live iframe preview was
  explicitly retired in Phase 5 (user decision, 2026-10-20): named
  presets + visible checkboxes are enough feedback, and dropping it
  deleted the Lesson 11/12/13 machinery. If it's ever missed, the agreed
  fallback is an on-demand "Preview" button in the Columns section, not a
  return to the second dialog.
- `Report Print Template` is one doc per *named preset*, not one per
  report (unlike the deleted `Report Print Configuration`, which was
  `autoname: field:report` — at most one config per report). A report can
  have several templates; autoname is `format:{report} - {template_name}`
  instead.
- The picker extends Frappe by wrapping `frappe.ui.get_print_settings`
  with a scoped `frappe.prompt` interception (Lesson 14). This *reverses*
  the Phase-3 decision to wrap `QueryReport.prototype` methods instead —
  legitimately, because that decision's premise ("the settings dialog
  itself needs no changes") stopped holding the moment the user asked for
  the choice inside the native dialog. The 3-caller blast radius concern
  is answered by gating: non-enabled contexts call the untouched original.
- Static/excluded-per-report columns live in one shared Python registry
  (`PRINT_COLUMNS_BY_REPORT` in `report_print_template.py`), not
  duplicated per call site — a single source of truth that's cheap to
  extend for the next report. Since Phase 5 it is also the *enablement*
  gate (a report with a key there gets the dialog section; the
  Phase-3/4 JS whitelist is gone) and reaches the client via a
  `boot_session` hook as a static dict — unlike the deleted Phase-1 boot
  hook, no DB access, so none of the reasons that killed that one apply.
- `Report Print Template` carries a read-only `All` permission row
  (write stays System Manager): the native Link field search and the
  template fetch run as the printing user, so without read permission
  regular users would see an empty picker. The old second dialog hid this
  because its whitelisted fetch used permission-ignoring `frappe.get_all`.
