# Copyright (c) 2026, Akwad Programming and contributors
# For license information, please see license.txt

import re

import frappe

from akwad_erpnext_fixes.akwad_erpnext_fixes.doctype.report_print_template.report_print_template import (
	PRINT_COLUMNS_BY_REPORT,
)
from akwad_erpnext_fixes.patches.create_print_style import DEFAULT_ACCENT, PRINT_STYLE_NAME


def boot_session(bootinfo):
	# A report's presence in the registry enables the print dialog's
	# column-template picker; its list filters the pickable columns.
	bootinfo.akwad_report_print_columns = PRINT_COLUMNS_BY_REPORT
	# The report theme comes from Akwad Print Style whichever style is selected
	# in Print Settings; the report format embeds it (see report_print_style.bundle.js).
	bootinfo.akwad_report_theme_css = get_report_theme_css()


def get_report_theme_css():
	css, custom_color = frappe.db.get_value("Print Style", PRINT_STYLE_NAME, ["css", "custom_color"]) or (None, None)

	# Literal colors, not var(): wkhtmltopdf ignores CSS variables (spec Lesson 16).
	# The pattern also keeps the value from closing the <style> tag it is embedded in.
	if css and custom_color and re.fullmatch(r"#[0-9a-fA-F]{3,8}", custom_color):
		return css.replace(DEFAULT_ACCENT, custom_color)

	return css
