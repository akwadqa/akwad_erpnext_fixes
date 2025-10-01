import frappe
from frappe import _
from .property_setters import get_property_setters  # separate file to keep it clean

def after_install():
    insert_property_setters()
    apply_site_settings()

def insert_property_setters():
    property_setters = get_property_setters()
    for ps in property_setters:
        if not frappe.db.exists("DocType", ps["doc_type"]):
            continue
        if not frappe.db.exists("Property Setter", ps["name"]):
            try:
                frappe.get_doc(ps).insert(ignore_permissions=True)
            except Exception as e:
                frappe.log_error(
                    f"Error inserting Property Setter {ps['name']}: {e}",
                    title="after_install Property Setter Insertion Error"
                )

def apply_site_settings():
    # Portal Settings
    portal_settings = frappe.get_single("Portal Settings")
    portal_settings.default_role = "Customer"
    portal_settings.save(ignore_permissions=True)

    # Log Settings
    log_settings = frappe.get_single("Log Settings")
    log_settings.append("logs_to_clear", {
            "ref_doctype": "BOM Update Log",
            "days": 1
        })        
    log_settings.save(ignore_permissions=True)

    # Global Search Settings
    global_search_settings = frappe.get_single("Global Search Settings")
    doctype_list = ["Customer", "Supplier"]

    existing_doctypes = {d.document_type for d in global_search_settings.allowed_in_global_search}

    for doctype in doctype_list:
        if doctype not in existing_doctypes:
            global_search_settings.append("allowed_in_global_search", {
                "document_type": doctype
            })

    global_search_settings.save(ignore_permissions=True)


    # Accounts Settings
    accounts_settings = frappe.get_single("Accounts Settings")
    accounts_settings.book_asset_depreciation_entry_automatically = 0
    accounts_settings.save(ignore_permissions=True)

    # Stock Settings
    stock_settings = frappe.get_single("Stock Settings")
    stock_settings.update_existing_price_list_rate = 1
    stock_settings.disable_serial_no_and_batch_selector = 1
    stock_settings.save(ignore_permissions=True)

    # Selling Settings
    selling_settings = frappe.get_single("Selling Settings")
    selling_settings.maintain_same_sales_rate = 1
    selling_settings.validate_selling_price = 1
    selling_settings.editable_bundle_item_rates = 1
    selling_settings.save(ignore_permissions=True)

    # Global Defaults
    global_defaults = frappe.get_single("Global Defaults")
    global_defaults.default_distance_unit = "Kilometer"
    global_defaults.disable_rounded_total = 1
    global_defaults.save(ignore_permissions=True)

    # CRM Settings
    crm_settings = frappe.get_single("CRM Settings")
    crm_settings.carry_forward_communication_and_comments = 1
    crm_settings.save(ignore_permissions=True)

    # Currency Exchange Settings
    currency_exchange_settings = frappe.get_single("Currency Exchange Settings")
    currency_exchange_settings.disabled = 1
    currency_exchange_settings.save(ignore_permissions=True)

