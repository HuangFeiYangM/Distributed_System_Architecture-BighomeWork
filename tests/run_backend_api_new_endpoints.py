import argparse
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, Optional, Tuple


def request_json(method: str, url: str, headers: Optional[Dict[str, str]] = None, body: Optional[Any] = None) -> Tuple[int, Any]:
    payload = None
    req_headers = dict(headers or {})
    if body is not None:
        payload = json.dumps(body, ensure_ascii=False).encode("utf-8")
        req_headers.setdefault("Content-Type", "application/json")
    req = urllib.request.Request(url=url, method=method.upper(), headers=req_headers, data=payload)
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            status = resp.status
            text = resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        status = e.code
        text = e.read().decode("utf-8", errors="replace")
    return status, json.loads(text) if text else None


def token_from_login(base_url: str, phone: str, password: str) -> str:
    status, resp = request_json("POST", f"{base_url}/api/user/login", body={"phone": phone, "password": password})
    if status != 200 or not isinstance(resp, dict):
        raise RuntimeError("login failed")
    token = ((resp.get("data") or {}).get("accessToken") or "").strip()
    if not token:
        raise RuntimeError("empty token")
    return token


def auth(token: str) -> Dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def with_query(base_url: str, params: Dict[str, Any]) -> str:
    return f"{base_url}?{urllib.parse.urlencode(params)}"

def first_menu_dish_id(base_url: str, token: str) -> Optional[int]:
    status, resp = request_json("GET", f"{base_url}/api/menu/today", headers=auth(token))
    if status != 200 or not isinstance(resp, dict):
        return None
    data = resp.get("data")
    if not isinstance(data, list):
        return None
    for menu in data:
        if not isinstance(menu, dict):
            continue
        dishes = menu.get("dishes")
        if not isinstance(dishes, list):
            continue
        for dish in dishes:
            if isinstance(dish, dict) and isinstance(dish.get("id"), int):
                return dish["id"]
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description="New endpoint smoke tests for P0/P1/P2 APIs")
    parser.add_argument("--base-url", default="http://127.0.0.1:8080")
    parser.add_argument("--admin-phone", default="13800000000")
    parser.add_argument("--admin-password", default="admin123")
    parser.add_argument("--merchant-phone", default="13800000001")
    parser.add_argument("--merchant-password", default="123456")
    args = parser.parse_args()
    base = args.base_url.rstrip("/")

    admin = token_from_login(base, args.admin_phone, args.admin_password)
    merchant = token_from_login(base, args.merchant_phone, args.merchant_password)

    cases = []

    def record(name: str, ok: bool, detail: str = ""):
        cases.append((name, ok, detail))
        print(f"[{'PASS' if ok else 'FAIL'}] {name} {detail}")

    status, resp = request_json("GET", with_query(f"{base}/api/order/merchant", {"page": 1, "size": 5}), headers=auth(merchant))
    data = resp.get("data") if isinstance(resp, dict) else None
    record("order-merchant-list", status == 200 and isinstance(data, dict) and isinstance(data.get("records"), list))

    status, resp = request_json("GET", with_query(f"{base}/api/order/list", {"page": 1, "size": 5}), headers=auth(admin))
    data = resp.get("data") if isinstance(resp, dict) else None
    record("order-admin-list", status == 200 and isinstance(data, dict) and isinstance(data.get("records"), list))

    status, resp = request_json("GET", with_query(f"{base}/api/menu/list", {"page": 1, "size": 5}), headers=auth(admin))
    data = resp.get("data") if isinstance(resp, dict) else None
    record("menu-list", status == 200 and isinstance(data, dict))

    status, resp = request_json("GET", with_query(f"{base}/api/menu/stock/merchant", {"page": 1, "size": 5}), headers=auth(merchant))
    data = resp.get("data") if isinstance(resp, dict) else None
    record("menu-stock-merchant", status == 200 and isinstance(data, dict) and isinstance(data.get("records"), list))

    status, resp = request_json("GET", with_query(f"{base}/api/menu/stock/list", {"page": 1, "size": 5}), headers=auth(admin))
    data = resp.get("data") if isinstance(resp, dict) else None
    record("menu-stock-admin", status == 200 and isinstance(data, dict) and isinstance(data.get("records"), list))

    menu_dish_id = first_menu_dish_id(base, merchant)
    if menu_dish_id:
        status, resp = request_json(
            "PUT",
            f"{base}/api/menu/stock/{menu_dish_id}",
            headers=auth(merchant),
            body={"op": "INCR", "value": 1, "reason": "smoke"},
        )
        code = resp.get("code") if isinstance(resp, dict) else None
        record("menu-stock-update", status == 200 and code == 200)
    else:
        record("menu-stock-update", False, "missing menuDishId")

    status, resp = request_json("GET", with_query(f"{base}/api/dish/list", {"page": 1, "size": 5, "name": "测"}), headers=auth(admin))
    data = resp.get("data") if isinstance(resp, dict) else None
    record("dish-list-filter", status == 200 and isinstance(data, dict))

    status, resp = request_json("GET", with_query(f"{base}/api/pickup/windows", {"page": 1, "size": 5, "keyword": "窗口"}), headers=auth(admin))
    data = resp.get("data") if isinstance(resp, dict) else None
    record("pickup-window-page", status == 200 and isinstance(data, dict))

    status, resp = request_json("GET", with_query(f"{base}/api/user/list", {"page": 1, "size": 5, "nickname": "a"}), headers=auth(admin))
    data = resp.get("data") if isinstance(resp, dict) else None
    record("user-list-filter", status == 200 and isinstance(data, dict))

    status, resp = request_json("GET", f"{base}/api/stat/admin/dashboard", headers=auth(admin))
    data = resp.get("data") if isinstance(resp, dict) else None
    record("admin-dashboard", status == 200 and isinstance(data, dict) and "totalOrders" in data)

    status, resp = request_json("GET", f"{base}/api/stat/merchant/dashboard", headers=auth(merchant))
    data = resp.get("data") if isinstance(resp, dict) else None
    record("merchant-dashboard", status == 200 and isinstance(data, dict) and "totalOrders" in data)

    failed = [c for c in cases if not c[1]]
    print(f"TOTAL={len(cases)} FAIL={len(failed)}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
