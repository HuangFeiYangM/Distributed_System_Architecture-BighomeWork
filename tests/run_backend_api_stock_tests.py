import argparse
import json
import sys
import re
import pathlib
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
        raise RuntimeError(f"login failed: http={status}")
    data = resp.get("data")
    if not isinstance(data, dict):
        raise RuntimeError(f"login failed: code={resp.get('code')}, msg={resp.get('msg')}")
    token = (data.get("accessToken") or data.get("token") or data.get("access_token") or data.get("jwt") or "").strip()
    if not token:
        raise RuntimeError(f"empty token: code={resp.get('code')}, msg={resp.get('msg')}, keys={list(data.keys())}")
    return token


def load_accounts_from_password_md(repo_root: str) -> Dict[str, Dict[str, str]]:
    """
    Parse password.md in a locale-agnostic way.
    We extract all (phone, password) pairs in appearance order (backtick values),
    and take the first three as: admin, merchant, user.
    """
    md_path = pathlib.Path(repo_root) / "password.md"
    text = md_path.read_text(encoding="utf-8", errors="replace")

    phones = re.findall(r"phone:\s*`([^`]+)`", text, flags=re.IGNORECASE)
    pwds = re.findall(r"password:\s*`([^`]+)`", text, flags=re.IGNORECASE)
    if len(phones) < 3 or len(pwds) < 3:
        raise RuntimeError("cannot parse at least 3 phone/password pairs from password.md")

    return {
        "admin": {"phone": phones[0].strip(), "password": pwds[0].strip()},
        "merchant": {"phone": phones[1].strip(), "password": pwds[1].strip()},
        "user": {"phone": phones[2].strip(), "password": pwds[2].strip()},
    }


def auth(token: str) -> Dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def with_query(url: str, params: Dict[str, Any]) -> str:
    return f"{url}?{urllib.parse.urlencode(params)}"


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
    parser = argparse.ArgumentParser(description="Stock endpoint integration tests")
    parser.add_argument("--base-url", default="http://127.0.0.1:8080")
    parser.add_argument("--use-password-md", action="store_true", help="Load accounts from repo password.md")
    parser.add_argument("--admin-phone", default="")
    parser.add_argument("--admin-password", default="")
    parser.add_argument("--merchant-phone", default="")
    parser.add_argument("--merchant-password", default="")
    parser.add_argument("--user-phone", default="")
    parser.add_argument("--user-password", default="")
    args = parser.parse_args()
    base = args.base_url.rstrip("/")

    if args.use_password_md:
        accounts = load_accounts_from_password_md(".")
        admin_phone, admin_password = accounts["admin"]["phone"], accounts["admin"]["password"]
        merchant_phone, merchant_password = accounts["merchant"]["phone"], accounts["merchant"]["password"]
        user_phone, user_password = accounts["user"]["phone"], accounts["user"]["password"]
    else:
        # fallback: allow passing via flags; if omitted, fall back to password.md anyway
        accounts = load_accounts_from_password_md(".")
        admin_phone = args.admin_phone or accounts["admin"]["phone"]
        admin_password = args.admin_password or accounts["admin"]["password"]
        merchant_phone = args.merchant_phone or accounts["merchant"]["phone"]
        merchant_password = args.merchant_password or accounts["merchant"]["password"]
        user_phone = args.user_phone or accounts["user"]["phone"]
        user_password = args.user_password or accounts["user"]["password"]

    admin_token = token_from_login(base, admin_phone, admin_password)
    merchant_token = token_from_login(base, merchant_phone, merchant_password)
    user_token = token_from_login(base, user_phone, user_password)

    cases = []

    def record(name: str, ok: bool, detail: str = "") -> None:
        cases.append((name, ok, detail))
        print(f"[{'PASS' if ok else 'FAIL'}] {name} {detail}")

    menu_dish_id = first_menu_dish_id(base, merchant_token)
    if not menu_dish_id:
        record("prepare-menu-dish-id", False, "未找到 menuDishId，请先发布今日菜单")
        print("TOTAL=1 FAIL=1")
        return 1
    record("prepare-menu-dish-id", True, f"menuDishId={menu_dish_id}")

    status, resp = request_json("GET", with_query(f"{base}/api/menu/stock/merchant", {"page": 1, "size": 10}), headers=auth(merchant_token))
    data = resp.get("data") if isinstance(resp, dict) else None
    merchant_records = data.get("records") if isinstance(data, dict) else None
    record("merchant-stock-query", status == 200 and isinstance(merchant_records, list))

    status, resp = request_json("GET", with_query(f"{base}/api/menu/stock/list", {"page": 1, "size": 10}), headers=auth(admin_token))
    data = resp.get("data") if isinstance(resp, dict) else None
    admin_records = data.get("records") if isinstance(data, dict) else None
    record("admin-stock-query", status == 200 and isinstance(admin_records, list))

    status, resp = request_json(
        "PUT",
        f"{base}/api/menu/stock/{menu_dish_id}",
        headers=auth(merchant_token),
        body={"op": "INCR", "value": 1, "reason": "stock-test"},
    )
    code = resp.get("code") if isinstance(resp, dict) else None
    record("merchant-update-own-stock", status == 200 and code == 200)

    status, resp = request_json(
        "PUT",
        f"{base}/api/menu/stock/{menu_dish_id}",
        headers=auth(user_token),
        body={"op": "INCR", "value": 1, "reason": "forbidden-check"},
    )
    code = resp.get("code") if isinstance(resp, dict) else None
    record("normal-user-update-stock-forbidden", (status == 403) or (code == 403), f"http={status}, code={code}")

    status, resp = request_json(
        "PUT",
        f"{base}/api/menu/stock/{menu_dish_id}",
        headers=auth(merchant_token),
        body={"op": "DECR", "value": 9999999, "reason": "conflict-check"},
    )
    code = resp.get("code") if isinstance(resp, dict) else None
    record("decr-overflow-conflict", code in (2002, 2004), f"http={status}, code={code}")

    failed = [c for c in cases if not c[1]]
    print(f"TOTAL={len(cases)} FAIL={len(failed)}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
