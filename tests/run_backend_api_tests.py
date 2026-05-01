import argparse
import json
import sys
import time
import datetime
import urllib.error
import urllib.request
from typing import Any, Dict, Optional, Tuple


BASE_URL_DEFAULT = "http://127.0.0.1:8080"


def _to_bytes_json(obj: Any) -> bytes:
    return json.dumps(obj, ensure_ascii=False).encode("utf-8")


def request_json(
    method: str,
    url: str,
    headers: Optional[Dict[str, str]] = None,
    json_body: Optional[Any] = None,
    timeout: int = 20,
) -> Tuple[int, Any]:
    """
    Send request and try parse response as JSON.
    Returns: (http_status, parsed_json_or_text)
    """
    headers = dict(headers or {})
    data = None
    if json_body is not None:
        data = _to_bytes_json(json_body)
        headers.setdefault("Content-Type", "application/json")

    req = urllib.request.Request(url=url, method=method.upper(), headers=headers, data=data)

    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            status = resp.status
            raw = resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        status = e.code
        raw = e.read().decode("utf-8", errors="replace") if hasattr(e, "read") else ""
    except Exception as e:
        # Non-http error (connection refused, timeout, etc.)
        raise RuntimeError(f"Request failed: {method} {url}: {e}") from e

    # Try JSON parse
    try:
        parsed = json.loads(raw) if raw else None
    except Exception:
        parsed = raw
    return status, parsed


def extract_token(resp: Any) -> Optional[str]:
    """
    Expected response wrapper:
    { code, msg, data: { accessToken, ... } }
    """
    if not isinstance(resp, dict):
        return None
    data = resp.get("data")
    if isinstance(data, dict):
        token = data.get("accessToken")
        if isinstance(token, str) and token.strip():
            return token
    return None


def extract_data(resp: Any) -> Any:
    if isinstance(resp, dict):
        return resp.get("data")
    return None


def find_first_int(obj: Any) -> Optional[int]:
    """
    Heuristic: recursively find first int in JSON-like structure.
    """
    if isinstance(obj, bool):
        return None
    if isinstance(obj, int):
        return obj
    if isinstance(obj, str):
        # avoid parsing numeric strings automatically; keep it strict
        return None
    if isinstance(obj, dict):
        for v in obj.values():
            r = find_first_int(v)
            if r is not None:
                return r
    if isinstance(obj, list):
        for it in obj:
            r = find_first_int(it)
            if r is not None:
                return r
    return None


def print_step(title: str) -> None:
    print("\n" + "=" * 80)
    print(title)
    print("=" * 80)


def print_response(method: str, url: str, status: int, resp: Any) -> None:
    print(f"\n[HTTP] {method} {url}")
    print(f"[STATUS] {status}")
    if isinstance(resp, (dict, list)):
        print("[BODY] " + json.dumps(resp, ensure_ascii=False, indent=2))
    else:
        print("[BODY] " + str(resp))


def auth_header(token: str) -> Dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def main() -> int:
    parser = argparse.ArgumentParser(description="智能食堂后端接口测试（仅打印响应）")
    parser.add_argument("--base-url", default=BASE_URL_DEFAULT, help="Gateway base url")
    parser.add_argument("--skip-registration", action="store_true", help="Skip register, only login")
    parser.add_argument("--register-if-login-fail", action="store_true", help="If login fails, try register once")
    parser.add_argument("--sleep", type=float, default=0.6, help="Sleep between dependent steps")
    args = parser.parse_args()

    base = args.base_url.rstrip("/")

    # Test accounts (from tests/后端接口测试手册.md)
    admin = {"phone": "13800000000", "password": "admin123", "nickname": "系统管理员", "studentNo": "ADMIN001"}
    merchant = {
        "phone": "13800000001",
        "password": "123456",
        "nickname": "1号档口老板",
        "studentNo": "MERCHANT001",
    }
    user = {"phone": "13800000002", "password": "user123", "nickname": "测试学生", "studentNo": "2024001001"}

    # Optional extra user from manual
    sample_user = {
        "phone": "13800138000",
        "password": "123456",
        "nickname": "张三",
        "studentNo": "2024001002",
    }

    # ---- User: login flow
    def login(account: Dict[str, str]) -> Optional[str]:
        url = f"{base}/api/user/login"
        body = {"phone": account["phone"], "password": account["password"]}
        status, resp = request_json("POST", url, json_body=body)
        print_response("POST", url, status, resp)
        token = extract_token(resp)
        return token

    def register(account: Dict[str, str]) -> None:
        url = f"{base}/api/user/register"
        body = {
            "phone": account["phone"],
            "password": account["password"],
            "nickname": account["nickname"],
            "studentNo": account["studentNo"],
        }
        status, resp = request_json("POST", url, json_body=body)
        print_response("POST", url, status, resp)

    def ensure_token(account: Dict[str, str], label: str) -> str:
        print_step(f"[{label}] Login")
        token = login(account)
        if token:
            return token
        if args.skip_registration:
            raise RuntimeError(f"[{label}] Login failed and --skip-registration is on. Stop.")
        if not args.register_if_login_fail:
            raise RuntimeError(
                f"[{label}] Login failed (and register_if_login_fail is not enabled). "
                f"Re-run with --register-if-login-fail to try register once."
            )
        print_step(f"[{label}] Register then retry login")
        register(account)
        token2 = login(account)
        if not token2:
            raise RuntimeError(f"[{label}] Register+Login failed. Stop.")
        return token2

    # ---- TC-U02/U03/U04
    user_token = ensure_token(user, "USER")
    time.sleep(args.sleep)
    print_step("[USER] GET /api/user/me")
    url = f"{base}/api/user/me"
    status, resp = request_json("GET", url, headers=auth_header(user_token))
    print_response("GET", url, status, resp)
    time.sleep(args.sleep)

    print_step("[USER] POST /api/user/refresh")
    url = f"{base}/api/user/refresh"
    status, resp = request_json("POST", url, headers=auth_header(user_token))
    print_response("POST", url, status, resp)
    new_token = extract_token(resp)
    if new_token:
        user_token = new_token
    else:
        print("[WARN] Refresh did not return accessToken. Continue with old token (if still valid).")

    time.sleep(args.sleep)

    # ---- TC-M01~M05 & TC-O01~O03 & TC-P01~P02 (best-effort)
    # We do a minimal "happy path" set that is most likely to work, then stop if IDs cannot be extracted.
    merchant_token = ensure_token(merchant, "MERCHANT")
    time.sleep(args.sleep)
    admin_token = ensure_token(admin, "ADMIN")
    time.sleep(args.sleep)
    # We also need merchant userId for creating window (avoid hard-coded ids).
    merchant_user_id = None
    status_tmp, resp_tmp = request_json(
        "POST",
        f"{base}/api/user/login",
        json_body={"phone": merchant["phone"], "password": merchant["password"]},
    )
    if isinstance(resp_tmp, dict) and isinstance(resp_tmp.get("data"), dict):
        merchant_user_id = resp_tmp["data"].get("userId")

    print_step("[MERCHANT] POST /api/dish")
    # Note: menu creation in manual uses dishId=1/2; but here we will use the returned dishId if possible.
    dish_payload = {
        "name": "宫保鸡丁",
        "description": "经典川菜，花生酥脆",
        "price": 15.00,
        "category": "主食",
        "image": "https://example.com/gongbao.jpg",
    }
    url = f"{base}/api/dish"
    status, resp = request_json("POST", url, headers=auth_header(merchant_token), json_body=dish_payload)
    print_response("POST", url, status, resp)

    if isinstance(resp, dict) and resp.get("code") != 200:
        print(
            "[STOP] Create dish failed. "
            f"code={resp.get('code')}, msg={resp.get('msg')}. "
            "Check that merchant/admin role is set in sys_user.role (MERCHANT=1, ADMIN=2) and re-login."
        )
        return 1

    dish_id_1 = None
    dish_data = extract_data(resp)
    if isinstance(dish_data, dict):
        dish_id_1 = dish_data.get("id")
    if not isinstance(dish_id_1, (int, str)):
        # fall back heuristic (best-effort)
        dish_id_1 = find_first_int(resp)
    if not dish_id_1:
        print("[STOP] Cannot extract dishId from response. Please check dish creation output keys.")
        return 1
    dish_id_1_print = dish_id_1
    time.sleep(args.sleep)

    print_step("[MERCHANT] GET /api/dish/list?page=1&size=10")
    url = f"{base}/api/dish/list?page=1&size=10"
    status, resp = request_json("GET", url, headers=auth_header(merchant_token))
    print_response("GET", url, status, resp)
    if isinstance(resp, dict) and resp.get("code") != 200:
        print(
            "[WARN] Dish list failed (non-blocking). "
            f"code={resp.get('code')}, msg={resp.get('msg')}. "
            "Please check canteen-menu-service console for the exception stack trace."
        )
    time.sleep(args.sleep)

    # Create second dish (to match manual menu examples more closely)
    print_step("[MERCHANT] POST /api/dish (second)")
    dish_payload2 = {
        "name": "糖醋里脊",
        "description": "酸甜口，经典家常菜",
        "price": 12.00,
        "category": "主食",
        "image": "https://example.com/tangcu.jpg",
    }
    url = f"{base}/api/dish"
    status, resp = request_json("POST", url, headers=auth_header(merchant_token), json_body=dish_payload2)
    print_response("POST", url, status, resp)

    if isinstance(resp, dict) and resp.get("code") != 200:
        print(
            "[STOP] Create second dish failed. "
            f"code={resp.get('code')}, msg={resp.get('msg')}. "
            "Check that merchant/admin role is set in sys_user.role (MERCHANT=1, ADMIN=2) and re-login."
        )
        return 1
    dish_id_2 = None
    dish_data2 = extract_data(resp)
    if isinstance(dish_data2, dict):
        dish_id_2 = dish_data2.get("id")
    if not isinstance(dish_id_2, (int, str)):
        dish_id_2 = find_first_int(resp)
    if not dish_id_2:
        print("[STOP] Cannot extract second dishId. Stop.")
        return 1
    time.sleep(args.sleep)

    print_step("[MERCHANT] POST /api/menu")
    # /api/menu/today only returns menus where saleDate == today AND now is within [startTime, endTime]
    today = datetime.date.today().isoformat()
    now = datetime.datetime.now()
    start_time = (now - datetime.timedelta(hours=1)).time().replace(microsecond=0).isoformat()
    end_time = (now + datetime.timedelta(hours=2)).time().replace(microsecond=0).isoformat()
    menu_payload = {
        "name": "今日午餐",
        "saleDate": today,
        "startTime": start_time,
        "endTime": end_time,
        "items": [
            {"dishId": dish_id_1_print, "salePrice": 15.00, "stock": 100},
            {"dishId": dish_id_2, "salePrice": 12.00, "stock": 50},
        ],
    }
    url = f"{base}/api/menu"
    status, resp = request_json("POST", url, headers=auth_header(merchant_token), json_body=menu_payload)
    print_response("POST", url, status, resp)

    if isinstance(resp, dict) and resp.get("code") != 200:
        print(
            "[STOP] Publish menu failed. "
            f"code={resp.get('code')}, msg={resp.get('msg')}. "
            "Verify dish/menu data and that the caller has MERCHANT/ADMIN role."
        )
        return 1
    menu_id = extract_data(resp)
    if not menu_id:
        print("[WARN] Cannot extract menuId from response; continue to query /api/menu/today")
    time.sleep(args.sleep)

    print_step("[USER] GET /api/menu/today")
    url = f"{base}/api/menu/today"
    status, resp = request_json("GET", url, headers=auth_header(user_token))
    print_response("GET", url, status, resp)
    time.sleep(args.sleep)

    # Extract menuDishId (MenuDishDetailVO.id) for order creation
    # /api/menu/today returns: { code, msg, data: [ { ..., dishes: [ { id: menuDishId, ... } ] } ] }
    menu_dish_id = None
    if isinstance(resp, dict) and isinstance(resp.get("data"), list) and resp["data"]:
        for menu in resp["data"]:
            if not isinstance(menu, dict):
                continue
            dishes = menu.get("dishes")
            if not isinstance(dishes, list) or not dishes:
                continue
            first = dishes[0]
            if isinstance(first, dict):
                mid = first.get("id")
                if isinstance(mid, (int, str)):
                    menu_dish_id = mid
                    break
    if not menu_dish_id:
        if isinstance(resp, dict) and isinstance(resp.get("data"), list) and not resp["data"]:
            print(
                "[STOP] /api/menu/today returned empty data[]. "
                "Make sure you published a menu for TODAY and the current time is within startTime~endTime."
            )
        else:
            print("[STOP] Cannot extract menuDishId from /api/menu/today response (expected data[].dishes[].id).")
        return 1

    # Sanity check: menuDish detail should be reachable (order-service depends on it).
    print_step("[USER] GET /api/menu/dish/{menuDishId}")
    url = f"{base}/api/menu/dish/{menu_dish_id}"
    status, resp = request_json("GET", url, headers=auth_header(user_token))
    print_response("GET", url, status, resp)
    if isinstance(resp, dict) and resp.get("code") != 200:
        print(
            "[STOP] /api/menu/dish/{menuDishId} failed. "
            f"code={resp.get('code')}, msg={resp.get('msg')}. "
            "Please check canteen-menu-service console for the exception stack trace."
        )
        return 1
    time.sleep(args.sleep)

    print_step("[ADMIN] POST /api/pickup/window")
    window_payload = {
        "name": "1号档口-盖浇饭",
        "location": "食堂一楼东侧",
        "merchantId": merchant_user_id or 2,
        "pickupPrefix": "A",
    }
    url = f"{base}/api/pickup/window"
    status, resp = request_json("POST", url, headers=auth_header(admin_token), json_body=window_payload)
    print_response("POST", url, status, resp)

    if isinstance(resp, dict) and resp.get("code") != 200:
        print(
            "[STOP] Create window failed. "
            f"code={resp.get('code')}, msg={resp.get('msg')}. "
            "Please check canteen-pickup-service console for the exception stack trace."
        )
        return 1

    window_id = None
    window_data = extract_data(resp)
    if isinstance(window_data, dict):
        window_id = window_data.get("id")
    if not isinstance(window_id, (int, str)):
        window_id = find_first_int(resp)
    if not window_id:
        print("[STOP] Cannot extract windowId from response. Stop.")
        return 1
    time.sleep(args.sleep)

    print_step("[USER] POST /api/order")
    order_payload = {
        "windowId": window_id,
        "remark": "不要辣",
        "items": [{"menuDishId": menu_dish_id, "quantity": 2}],
    }
    url = f"{base}/api/order"
    status, resp = request_json("POST", url, headers=auth_header(user_token), json_body=order_payload)
    print_response("POST", url, status, resp)
    if isinstance(resp, dict) and resp.get("code") != 200:
        print(
            "[STOP] Create order failed. "
            f"code={resp.get('code')}, msg={resp.get('msg')}. "
            "Fix the above error then re-run."
        )
        return 1
    order_data = extract_data(resp)
    order_id = None
    pickup_code = None
    if isinstance(order_data, dict):
        order_id = order_data.get("id")
        pickup_code = order_data.get("pickupCode")
        if not order_id:
            order_id = order_data.get("orderId")
    if not order_id:
        order_id = find_first_int(order_data)
    if not pickup_code:
        # search strings that look like codes
        if isinstance(order_data, dict):
            for v in order_data.values():
                if isinstance(v, str) and len(v) >= 4:
                    if "code" in str(v).lower() or v.isdigit():
                        pickup_code = v
                        break
    if not order_id or not pickup_code:
        print("[STOP] Cannot extract orderId/pickupCode from /api/order response.")
        return 1
    time.sleep(args.sleep)

    print_step("[USER] GET /api/order/{orderId}")
    url = f"{base}/api/order/{order_id}"
    status, resp = request_json("GET", url, headers=auth_header(user_token))
    print_response("GET", url, status, resp)
    time.sleep(args.sleep)

    print_step("[MERCHANT] PUT /api/order/{orderId}/accept")
    for action in ["accept", "cook", "ready"]:
        url = f"{base}/api/order/{order_id}/{action}"
        status, resp = request_json("PUT", url, headers=auth_header(merchant_token), json_body=None)
        print_response("PUT", url, status, resp)
        time.sleep(args.sleep)

    print_step("[PICKUP] GET /api/pickup/{windowId}/queue")
    url = f"{base}/api/pickup/{window_id}/queue"
    status, resp = request_json("GET", url, headers=auth_header(user_token))
    print_response("GET", url, status, resp)
    time.sleep(args.sleep)

    print_step("[PICKUP] GET /api/pickup/{windowId}/display")
    url = f"{base}/api/pickup/{window_id}/display"
    status, resp = request_json("GET", url, headers=auth_header(user_token))
    print_response("GET", url, status, resp)
    time.sleep(args.sleep)

    print_step("[MERCHANT] POST /api/pickup/{windowId}/call")
    url = f"{base}/api/pickup/{window_id}/call"
    status, resp = request_json("POST", url, headers=auth_header(merchant_token))
    print_response("POST", url, status, resp)
    time.sleep(args.sleep)

    print_step("[VERIFY] POST /api/pickup/verify")
    url = f"{base}/api/pickup/verify"
    verify_payload = {"pickupCode": pickup_code}
    status, resp = request_json("POST", url, headers=auth_header(merchant_token), json_body=verify_payload)
    print_response("POST", url, status, resp)

    print("\n✅ Script finished (best-effort). If some ids were missing, the script stops earlier with STOP message.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

