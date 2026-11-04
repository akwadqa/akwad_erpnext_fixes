# Copyright (c) 2026, Akwad Programming and contributors
# For license information, please see license.txt

import frappe

from akwad_erpnext_fixes.patches.create_print_style import PRINT_STYLE_NAME


def clear_boot_cache_if_selected(doc, method=None):
	# frappe.boot.print_css carries the selected style's CSS and
	# frappe.boot.akwad_report_theme_css the Akwad style's; both are cached per
	# user, and core only clears that cache when Print Settings itself is saved.
	if doc.name in (PRINT_STYLE_NAME, frappe.db.get_single_value("Print Settings", "print_style")):
		frappe.clear_cache()
