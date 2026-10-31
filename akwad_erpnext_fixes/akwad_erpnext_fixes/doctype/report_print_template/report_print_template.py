# Copyright (c) 2026, Akwad Programming and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


class ReportPrintTemplate(Document):
	def validate(self):
		if self.report not in get_reports_with_default_print_format():
			frappe.throw(
				_("Report {0} has no enabled Print Format named {1}").format(
					frappe.bold(self.report), frappe.bold(f"{self.report} - Default")
				)
			)


def get_reports_with_default_print_format():
	# Only the "<report> - Default" format renders template columns; the print
	# dialog shows the picker for that format alone.
	formats = frappe.get_all(
		"Print Format",
		filters={"print_format_for": "Report", "disabled": 0, "name": ["like", "% - Default"]},
		fields=["name", "report"],
	)
	return [f.report for f in formats if f.name == f"{f.report} - Default"]


@frappe.whitelist()
@frappe.validate_and_sanitize_search_inputs
def report_query(doctype, txt, searchfield, start, page_len, filters):
	reports = get_reports_with_default_print_format()
	if not reports:
		return []

	return frappe.get_list(
		"Report",
		filters={"name": ["in", reports]},
		or_filters={"name": ["like", f"%{txt}%"]} if txt else None,
		fields=["name"],
		limit_start=start,
		limit=page_len,
		order_by="name",
		as_list=True,
	)


# Fieldnames each report's print format always renders itself, or handles via interactive filter
EXCLUDED_COLUMNS_BY_REPORT = {
	"General Ledger": [
		"posting_date", "voucher_type", "voucher_no", "account", "bill_no",
		"party", "against", "remarks", "debit", "credit", "balance",
	],
}


def get_excluded_fieldnames(report):
	return EXCLUDED_COLUMNS_BY_REPORT.get(report, [])


def get_report_columns(report):
	# Script report column sets are computed at runtime, not stored as
	# DocFields, so the only generic way to read them is to run the report.
	from frappe.desk.query_report import run

	filters = {
		"company": frappe.defaults.get_user_default("Company") or frappe.db.get_value("Company", {}, "name"),
		"from_date": frappe.utils.add_months(frappe.utils.today(), -1),
		"to_date": frappe.utils.today(),
		# Best-effort: some optional columns (e.g. General Ledger's Cost
		# Center) are themselves gated behind a filter toggle. Enable the
		# common ones so the picker offers the fullest column set.
		"include_dimensions": 1,
		"show_remarks": 1,
	}

	result = run(report_name=report, filters=filters)
	columns = result.get("columns") or []

	return [{"fieldname": c.get("fieldname"), "label": c.get("label")} for c in columns if c.get("fieldname")]


@frappe.whitelist()
def get_report_columns_query(txt=None, report=None, **kwargs):
	if not report:
		return []

	txt = (txt or "").lower()
	excluded = set(get_excluded_fieldnames(report))
	columns = [c for c in get_report_columns(report) if c["fieldname"] not in excluded]

	return [
		{"value": c["fieldname"], "label": c["label"]}
		for c in columns
		if not txt or txt in (c["label"] or "").lower() or txt in c["fieldname"].lower()
	]


@frappe.whitelist()
def get_template_columns(template=None):
	if not template:
		return []

	rows = frappe.get_all(
		"Report Print Template Column",
		filters={"parenttype": "Report Print Template", "parent": template},
		fields=["field"],
		order_by="idx",
	)
	return [row.field for row in rows]


@frappe.whitelist()
def update_template_columns(template=None, fields=None):
	if isinstance(fields, str):
		fields = frappe.parse_json(fields)

	doc = frappe.get_doc("Report Print Template", template)
	doc.columns = []
	for fieldname in fields or []:
		doc.append("columns", {"field": fieldname})
	doc.save()


@frappe.whitelist()
def create_template(report=None, template_name=None, fields=None):
	if isinstance(fields, str):
		fields = frappe.parse_json(fields)

	doc = frappe.get_doc({
		"doctype": "Report Print Template",
		"report": report,
		"template_name": template_name,
		"columns": [{"field": fieldname} for fieldname in fields or []],
	})
	# insert() enforces create permission, mirroring update_template_columns'
	# reliance on doc.save() for write permission
	doc.insert()
	return doc.name
