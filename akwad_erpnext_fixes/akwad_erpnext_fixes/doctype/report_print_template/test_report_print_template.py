# Copyright (c) 2026, Akwad Programming and Contributors
# See license.txt

import frappe
from frappe.tests import IntegrationTestCase

from akwad_erpnext_fixes.akwad_erpnext_fixes.doctype.report_print_template.report_print_template import (
	EXCLUDED_COLUMNS_BY_REPORT,
	create_template,
	get_report_columns_query,
	get_template_columns,
	report_query,
	update_template_columns,
)

EXTRA_TEST_RECORD_DEPENDENCIES = []
# Report's dependency chain reaches ERPNext's Company test module, which
# creates master data at import time and collides with this live dev
# site's existing records. These tests use the site's real General Ledger
# report, so the walk isn't needed.
IGNORE_TEST_RECORD_DEPENDENCIES = ["Report"]


class IntegrationTestReportPrintTemplate(IntegrationTestCase):
	"""Integration tests for ReportPrintTemplate."""

	def make_test_template(self, columns):
		name = "General Ledger - Test Template"
		frappe.delete_doc("Report Print Template", name, force=True)
		frappe.get_doc({
			"doctype": "Report Print Template",
			"report": "General Ledger",
			"template_name": "Test Template",
			"columns": [{"field": fieldname} for fieldname in columns],
		}).insert(ignore_permissions=True)
		self.addCleanup(lambda: frappe.delete_doc("Report Print Template", name, force=True))
		return name

	def test_excluded_columns_not_offered_in_picker(self):
		options = get_report_columns_query(report="General Ledger")
		fieldnames = {o["value"] for o in options}

		self.assertNotIn("balance", fieldnames)
		self.assertNotIn("remarks", fieldnames)
		self.assertIn("cost_center", fieldnames)

	def test_get_template_columns_preserves_row_order(self):
		name = self.make_test_template(["cost_center", "against_voucher"])

		self.assertEqual(get_template_columns(name), ["cost_center", "against_voucher"])
		self.assertEqual(get_template_columns(None), [])

	def test_update_template_columns_replaces_rows(self):
		name = self.make_test_template(["cost_center"])

		update_template_columns(template=name, fields=["against_voucher", "cost_center"])

		self.assertEqual(get_template_columns(name), ["against_voucher", "cost_center"])

	def test_create_template_inserts_and_returns_name(self):
		name = "General Ledger - Created Template"
		frappe.delete_doc("Report Print Template", name, force=True)
		self.addCleanup(lambda: frappe.delete_doc("Report Print Template", name, force=True))

		created = create_template(
			report="General Ledger",
			template_name="Created Template",
			fields='["cost_center", "against_voucher"]',
		)

		self.assertEqual(created, name)
		self.assertEqual(get_template_columns(name), ["cost_center", "against_voucher"])

	def test_create_template_requires_create_permission(self):
		self.addCleanup(lambda: frappe.set_user("Administrator"))
		frappe.set_user("Guest")

		with self.assertRaises(frappe.PermissionError):
			create_template(report="General Ledger", template_name="No Perm", fields=[])

	def test_report_query_offers_only_reports_with_default_format(self):
		# Trial Balance has a "Trial Balance Standard" format, but no "- Default"
		reports = [row[0] for row in report_query("Report", "", "name", 0, 20, {})]

		self.assertIn("General Ledger", reports)
		self.assertNotIn("Trial Balance", reports)

	def test_validate_rejects_report_without_default_format(self):
		doc = frappe.get_doc({
			"doctype": "Report Print Template",
			"report": "Trial Balance",
			"template_name": "No Default Format",
		})

		with self.assertRaises(frappe.ValidationError):
			doc.insert(ignore_permissions=True)

	def test_boot_injects_exclusion_registry(self):
		bootinfo = frappe._dict()

		from akwad_erpnext_fixes.boot import boot_session
		boot_session(bootinfo)

		self.assertIs(bootinfo.akwad_report_print_columns, EXCLUDED_COLUMNS_BY_REPORT)
		self.assertIn("General Ledger", bootinfo.akwad_report_print_columns)
