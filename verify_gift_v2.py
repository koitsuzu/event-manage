import re

def calculate_dynamic_cart_mock(process_items, announcements):
    rules = []
    for a_content in announcements:
        match = re.search(r"滿\s*(\d+)\s*送\s*([^\s,，。!！]+)", a_content)
        if match:
            rules.append({"threshold": float(match.group(1)), "gift_name": match.group(2).strip()})

    base_total = sum(float(it["price"]) * float(it["quantity"]) for it in process_items)
    
    rules.sort(key=lambda x: x["threshold"], reverse=True)
    applied_rule = None
    for r in rules:
        if base_total >= r["threshold"]:
            applied_rule = r
            break

    res = []
    final_total = 0.0
    for it in process_items:
        item_is_gift = False
        if applied_rule and (applied_rule["gift_name"] in it["product_name"] or it["product_name"] in applied_rule["gift_name"]):
            item_is_gift = True
            applied_rule = None
            
        res_item = {**it, "is_gift": item_is_gift}
        res_item["subtotal"] = 0.0 if item_is_gift else round(float(it["price"]) * float(it["quantity"]), 1)
        res.append(res_item)
        if not item_is_gift:
            final_total += res_item["subtotal"]
            
    return res, round(final_total, 1)

# Test Cases
test_items = [
    {"product_id": 1, "product_name": "高麗菜", "price": 100, "quantity": 11}, # Total 1100
    {"product_id": 2, "product_name": "草莓", "price": 300, "quantity": 1}
]
test_anns = ["滿1000送草莓"]

res, total = calculate_dynamic_cart_mock(test_items, test_anns)
print(f"Total: {total}")
for it in res:
    print(f"Item: {it['product_name']}, Qty: {it['quantity']}, Gift: {it['is_gift']}, Sub: {it['subtotal']}")

assert total == 1100.0, f"Expected 1100, got {total}"
assert res[1]["is_gift"] == True
assert res[1]["subtotal"] == 0.0
print("Verification Success!")
