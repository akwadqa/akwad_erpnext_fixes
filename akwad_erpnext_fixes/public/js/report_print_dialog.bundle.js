// Copyright (c) 2026, Akwad Programming and contributors
// For license information, please see license.txt

// Injects a named-column-template picker into the native report print
// dialog, for reports registered in EXCLUDED_COLUMNS_BY_REPORT (boot
// -injected). The picker's MultiCheck mirrors core's own Pick Columns
// visually but uses its own fieldname (`extra_columns`), because core
// nulls `columns` whenever a Print Format is chosen and force-swaps the
// template to print_grid when it is set (spec Lesson 6).
frappe.provide("frappe.akwad_report");

(function (ns) {
	var METHOD_BASE =
		"akwad_erpnext_fixes.akwad_erpnext_fixes.doctype.report_print_template.report_print_template.";

	function get_enabled_report() {
		var excluded_by_report = frappe.boot.akwad_report_print_columns || {};
		var route = frappe.get_route();
		if (!route || route[0] !== "query-report" || !frappe.query_report) return null;

		var report_name = frappe.query_report.report_name;
		if (!(report_name in excluded_by_report)) return null;

		return {
			name: report_name,
			excluded_fieldnames: excluded_by_report[report_name] || [],
		};
	}

	// One instance per dialog open: owns the injected fields and their behavior.
	function TemplatePicker(report, visible_columns) {
		this.report = report;
		this.column_options = (visible_columns || [])
			.filter(function (df) {
				return report.excluded_fieldnames.indexOf(df.fieldname) === -1;
			})
			.map(function (df) {
				return { label: __(df.label, null, df.parent), value: df.fieldname };
			});
		// Always-rendered columns of this run, shown grayed+checked for context.
		// Kept out of the MultiCheck entirely: its selected_options ignore the
		// DOM disabled state, so a "checked" static entry would flow into
		// extra_columns and double-render (spec Lesson 9).
		this.static_column_labels = (visible_columns || [])
			.filter(function (df) {
				return report.excluded_fieldnames.indexOf(df.fieldname) !== -1;
			})
			.map(function (df) {
				return __(df.label, null, df.parent);
			});
		// The selected template's saved columns; null = no template selected.
		this.saved_columns = null;
		this.dialog = null;
	}

	TemplatePicker.prototype.has_options = function () {
		return this.column_options.length > 0;
	};

	// Appended after core's fields, under one section that only shows once a
	// Print Format is chosen — core's own Pick Columns shows only while none
	// is (`depends_on: "eval: !doc.print_format"`), so the two pickers never
	// appear together.
	TemplatePicker.prototype.get_fields = function () {
		var picker = this;
		// Truthiness would show the section for *any* chosen format; only this
		// report's own format (the app's naming convention) renders extra_columns.
		var own_format = this.report.name + " - Default";
		return [
			{
				fieldtype: "Section Break",
				fieldname: "akwad_columns_section",
				label: __("Columns"),
				depends_on: function (doc) {
					return doc.print_format === own_format;
				},
			},
			{
				fieldtype: "Link",
				fieldname: "report_print_template",
				label: __("Column Template"),
				options: "Report Print Template",
				placeholder: __("Default"),
				only_select: 1,
				get_query: function () {
					return { filters: { report: picker.report.name } };
				},
				change: function () {
					picker.apply_template(this.get_value());
				},
			},
			{
				fieldtype: "MultiCheck",
				fieldname: "extra_columns",
				label: __("Optional Columns"),
				columns: 2,
				sort_options: false,
				options: this.column_options,
				on_change: function () {
					picker.refresh_actions();
				},
			},
			{
				fieldtype: "HTML",
				fieldname: "template_actions",
			},
			{
				fieldtype: "HTML",
				fieldname: "static_columns_html",
			},
		];
	};

	// A single muted line, not disabled checkboxes: these can't be toggled,
	// so they shouldn't look like controls. Kept out of the MultiCheck — see
	// the constructor comment.
	TemplatePicker.prototype.render_static_columns = function () {
		if (!this.dialog || !this.static_column_labels.length) return;

		$('<div class="text-muted small">')
			.append($('<span class="bold">').text(__("Always included:")))
			.append(document.createTextNode(" " + this.static_column_labels.join(", ")))
			.appendTo(this.dialog.get_field("static_columns_html").$wrapper.empty());
	};

	TemplatePicker.prototype.apply_template = function (template_name) {
		var picker = this;
		if (!template_name) {
			picker.saved_columns = null;
			picker.set_selection([]);
			return;
		}
		frappe
			.call(METHOD_BASE + "get_template_columns", { template: template_name })
			.then(function (r) {
				// A template field absent from the current run's columns (e.g. a
				// dimension the report was run without) has no checkbox; compare
				// and select over the available subset only.
				var available = picker.column_options.map(function (o) {
					return o.value;
				});
				picker.saved_columns = (r.message || []).filter(function (fieldname) {
					return available.indexOf(fieldname) !== -1;
				});
				picker.set_selection(picker.saved_columns);
			});
	};

	TemplatePicker.prototype.set_selection = function (fieldnames) {
		var control = this.dialog.get_field("extra_columns");
		control.selected_options = fieldnames.slice();
		control.refresh_input();
		this.refresh_actions();
	};

	TemplatePicker.prototype.is_modified = function () {
		if (this.saved_columns === null || !this.dialog) return false;
		var selected = (this.dialog.get_field("extra_columns").get_value() || []).slice().sort();
		var saved = this.saved_columns.slice().sort();
		return JSON.stringify(selected) !== JSON.stringify(saved);
	};

	// One inline row under the checkboxes: a short note and, if permitted,
	// the matching button. Update and Create are mutually exclusive (template
	// selected or not), so they share the row instead of stacking.
	TemplatePicker.prototype.refresh_actions = function () {
		if (!this.dialog) return;
		var action = this.get_action();
		var $wrapper = this.dialog.get_field("template_actions").$wrapper.empty().toggle(!!action);
		if (!action) return;

		var $row = $(
			'<div class="flex align-center justify-between" style="gap: var(--padding-sm); padding-bottom: var(--padding-sm);">'
		).append($('<span class="text-muted small">').text(action.message));
		if (action.label) {
			$('<button class="btn btn-xs btn-default" style="flex-shrink: 0;">')
				.text(action.label)
				.on("click", action.click)
				.appendTo($row);
		}
		$row.appendTo($wrapper);
	};

	// Returns {message, label, click} for the row, or null when nothing applies.
	// label is null when the user may see the note but not act on it.
	TemplatePicker.prototype.get_action = function () {
		var template_name = this.dialog.get_value("report_print_template");

		if (template_name) {
			if (!this.is_modified()) return null;
			var short_name = template_name.replace(this.report.name + " - ", "");
			return {
				message: __("Modified from template"),
				label: frappe.model.can_write("Report Print Template")
					? __('Update "{0}"', [short_name])
					: null,
				click: this.update_template.bind(this),
			};
		}

		var selection = this.dialog.get_field("extra_columns").get_value() || [];
		if (!selection.length || !frappe.model.can_create("Report Print Template")) return null;
		return {
			message: __("Reuse this selection later?"),
			label: __("Save as Template"),
			click: this.create_template.bind(this),
		};
	};

	TemplatePicker.prototype.create_template = function () {
		var picker = this;
		var fields = this.dialog.get_field("extra_columns").get_value() || [];
		// By click time the frappe.prompt swap is long restored (it only lives
		// for the original get_print_settings call), so this is core's prompt.
		frappe.prompt(
			{
				fieldtype: "Data",
				fieldname: "template_name",
				label: __("Template Name"),
				reqd: 1,
			},
			function (values) {
				frappe
					.call(METHOD_BASE + "create_template", {
						report: picker.report.name,
						template_name: values.template_name,
						fields: fields,
					})
					.then(function (r) {
						// Triggers the Link's change -> apply_template, which syncs
						// saved_columns and hides this button again.
						picker.dialog.set_value("report_print_template", r.message);
						frappe.show_alert({
							message: __("Template created"),
							indicator: "green",
						});
					});
			},
			__("New Column Template"),
			__("Create")
		);
	};

	TemplatePicker.prototype.update_template = function () {
		var picker = this;
		var template_name = this.dialog.get_value("report_print_template");
		var fields = this.dialog.get_field("extra_columns").get_value() || [];
		frappe
			.call(METHOD_BASE + "update_template_columns", {
				template: template_name,
				fields: fields,
			})
			.then(function () {
				picker.saved_columns = fields.slice();
				picker.refresh_actions();
				frappe.show_alert({ message: __("Template updated"), indicator: "green" });
			});
	};

	var original_get_print_settings = frappe.ui.get_print_settings;

	// No hook exists for the print-settings dialog (spec Lesson 10). The
	// narrowest extension point is wrapping get_print_settings and, for
	// enabled reports only, intercepting its synchronous frappe.prompt call
	// to append our fields (spec Lesson 14).
	frappe.ui.get_print_settings = function (pdf, callback, letter_head, visible_columns) {
		var report = get_enabled_report();
		if (!report) return original_get_print_settings.apply(this, arguments);

		var picker = new TemplatePicker(report, visible_columns);
		if (!picker.has_options()) return original_get_print_settings.apply(this, arguments);

		var original_prompt = frappe.prompt;
		try {
			frappe.prompt = function (fields, prompt_callback) {
				var rest = Array.prototype.slice.call(arguments, 2);
				var wrapped_callback = function (values) {
					// get_values() drops empty values instead of overwriting, and
					// print_settings is one shared session-lifetime object (spec
					// Lesson 12) — normalize so a previous run's choice can't leak
					// into this one, and keep the template name off it entirely.
					values.extra_columns = values.extra_columns || [];
					delete values.report_print_template;
					return prompt_callback(values);
				};
				var dialog = original_prompt.apply(
					frappe,
					[fields.concat(picker.get_fields()), wrapped_callback].concat(rest)
				);
				picker.dialog = dialog;
				picker.render_static_columns();
				picker.refresh_actions();
				return dialog;
			};
			return original_get_print_settings.apply(this, arguments);
		} finally {
			frappe.prompt = original_prompt;
		}
	};

	// Exposed for the test harness.
	ns.TemplatePicker = TemplatePicker;
	ns.get_enabled_report = get_enabled_report;
})(frappe.akwad_report);
