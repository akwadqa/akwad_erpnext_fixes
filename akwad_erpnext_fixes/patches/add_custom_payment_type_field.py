import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields
from frappe import _

def execute():
    try:
        custom_fields = {
            "Quotation Item": [
                {
                    "fieldname": "custom_payment_type",
                    "module": "Akwad ERPNext Fixes",
                    "fieldtype": "Data",
                    "label": _("Payment Type"),
                    "insert_after": "stock_uom"
                }
            ]
        }

        create_custom_fields(custom_fields, ignore_validate=True)

    except Exception:
        frappe.log_error("Patch Error: Add Custom Field", frappe.get_traceback())
        raise