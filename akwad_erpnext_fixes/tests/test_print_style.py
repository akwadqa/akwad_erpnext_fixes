# Copyright (c) 2026, Akwad Programming and contributors
# For license information, please see license.txt

import frappe
from frappe.tests import IntegrationTestCase

from akwad_erpnext_fixes.patches.create_print_style import DEFAULT_ACCENT, PRINT_STYLE_NAME


class IntegrationTestPrintStyleCache(IntegrationTestCase):
	def setUp(self):
		frappe.db.set_single_value("Print Settings", "print_style", PRINT_STYLE_NAME)
		frappe.cache.hset("bootinfo", frappe.session.user, {"stale": 1})

	def save_style(self, name):
		frappe.get_doc("Print Style", name).save(ignore_permissions=True)

	def test_saving_selected_style_clears_bootinfo(self):
		self.save_style(PRINT_STYLE_NAME)

		self.assertIsNone(frappe.cache.hget("bootinfo", frappe.session.user))

	def test_saving_unselected_style_keeps_bootinfo(self):
		self.save_style("Classic")

		self.assertEqual(frappe.cache.hget("bootinfo", frappe.session.user), {"stale": 1})

	def test_saving_akwad_style_clears_bootinfo_when_another_style_is_selected(self):
		frappe.db.set_single_value("Print Settings", "print_style", "Classic")

		self.save_style(PRINT_STYLE_NAME)

		self.assertIsNone(frappe.cache.hget("bootinfo", frappe.session.user))

	def test_boot_carries_akwad_theme_when_another_style_is_selected(self):
		from akwad_erpnext_fixes.boot import boot_session

		frappe.db.set_single_value("Print Settings", "print_style", "Classic")
		bootinfo = frappe._dict()

		boot_session(bootinfo)

		self.assertIn(".akwad-report", bootinfo.akwad_report_theme_css)

	def get_boot_theme_css_with_color(self, custom_color):
		from akwad_erpnext_fixes.boot import boot_session

		frappe.db.set_value("Print Style", PRINT_STYLE_NAME, "custom_color", custom_color)
		bootinfo = frappe._dict()
		boot_session(bootinfo)
		return bootinfo.akwad_report_theme_css

	def test_boot_theme_uses_custom_color_as_accent(self):
		css = self.get_boot_theme_css_with_color("#aa0000")

		self.assertIn("border-top: 1px solid #aa0000", css)
		self.assertNotIn(DEFAULT_ACCENT, css)

	def test_boot_theme_keeps_default_accent_without_custom_color(self):
		self.assertIn(DEFAULT_ACCENT, self.get_boot_theme_css_with_color(None))

	def test_boot_theme_ignores_invalid_custom_color(self):
		css = self.get_boot_theme_css_with_color("red;}</style><script>")

		self.assertIn(DEFAULT_ACCENT, css)
		self.assertNotIn("<script>", css)
