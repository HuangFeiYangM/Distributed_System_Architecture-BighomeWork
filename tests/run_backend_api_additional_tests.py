import argparse
import datetime
import json
import sys
import time
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional, Tuple


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
        raise RuntimeError(f"Request failed: {method} {url}: {e}") from e

    try:
        parsed = json.loads(raw) if raw else None
    except Exception:
        parsed = raw
    return status, parsed


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


def extract_data(resp: Any) -> Any:
    if isinstance(resp, dict):
        return resp.get("data")
    return None


def extract_token(resp: Any) -> Optional[str]:
    data = extract_data(resp)
    if isinstance(data, dict):
        token = data.get("accessToken")
        if isinstance(token, str) and token.strip():
            return token
    return None


def extract_code_msg(resp: Any) -> Tuple[Optional[int], Optional[str]]:
    if isinstance(resp, dict):
        code = resp.get("code")
        msg = resp.get("msg")
        return (code if isinstance(code, int) else None, msg if isinstance(msg, str) else None)
    return None, None


def must_login(base: str, account: Dict[str, str], label: str) -> str:
    url = f"{base}/api/user/login"
    body = {"phone": account["phone"], "password": account["password"]}
    status, resp = request_json("POST", url, json_body=body)
    print_response("POST", url, status, resp)
    token = extract_token(resp)
    if not token:
        raise RuntimeError(
            f"[{label}] 登录失败，无法继续。请先确认账号存在且密码正确，"
            "并且角色已在数据库中设置后重新登录。"
        )
    return token


def expect_business_code(resp: Any, wanted: List[int]) -> bool:
    code, _ = extract_code_msg(resp)
    return code in wanted

def first_menu_dish_id(base: str, token: str) -> Optional[int]:
    url = f"{base}/api/menu/today"
    status, resp = request_json("GET", url, headers=auth_header(token))
    print_response("GET", url, status, resp)
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
    parser = argparse.ArgumentParser(description="智能食堂后端补充接口测试脚本（覆盖 run_backend_api_tests.py 未测项）")
    parser.add_argument("--base-url", default=BASE_URL_DEFAULT, help="Gateway base url")
    parser.add_argument("--sleep", type=float, default=0.4, help="Sleep between steps")
    parser.add_argument("--strict", action="store_true", help="Any case mismatch => exit 1")
    args = parser.parse_args()

    base = args.base_url.rstrip("/")
    pause = args.sleep
    strict = args.strict

    admin = {"phone": "13800000000", "password": "admin123"}
    merchant = {"phone": "13800000001", "password": "123456"}
    user = {"phone": "13800000002", "password": "user123"}

    passed = 0
    failed = 0

    def record(case_name: str, ok: bool, note: str = "") -> None:
        nonlocal passed, failed
        if ok:
            passed += 1
            print(f"[PASS] {case_name}" + (f" - {note}" if note else ""))
        else:
            failed += 1
            print(f"[FAIL] {case_name}" + (f" - {note}" if note else ""))

    print_step("登录测试账号")
    user_token = must_login(base, user, "USER")
    time.sleep(pause)
    merchant_token = must_login(base, merchant, "MERCHANT")
    time.sleep(pause)
    admin_token = must_login(base, admin, "ADMIN")
    time.sleep(pause)

    print_step("TC-U06: 管理员查询用户列表")
    url = f"{base}/api/user/list?page=1&size=10"
    status, resp = request_json("GET", url, headers=auth_header(admin_token))
    print_response("GET", url, status, resp)
    data = extract_data(resp)
    ok = isinstance(data, dict) and isinstance(data.get("records"), list)
    record("TC-U06-admin-list", ok, "admin list")
    time.sleep(pause)

    print_step("TC-U06: 普通用户越权访问用户列表")
    status, resp = request_json("GET", url, headers=auth_header(user_token))
    print_response("GET", url, status, resp)
    # 部分项目用 401/403；优先接受业务码 403
    code, _ = extract_code_msg(resp)
    ok = (code == 403) or (status == 403)
    record("TC-U06-forbidden-user-list", ok, f"http={status}, code={code}")
    time.sleep(pause)

    print_step("获取 today 菜单与 menuDishId，供后续补充测试")
    today_url = f"{base}/api/menu/today"
    status, resp = request_json("GET", today_url, headers=auth_header(user_token))
    print_response("GET", today_url, status, resp)
    menu_id: Optional[Any] = None
    menu_dish_id: Optional[Any] = None
    dish_id_from_today: Optional[Any] = None
    if isinstance(resp, dict) and isinstance(resp.get("data"), list) and resp["data"]:
        first_menu = resp["data"][0]
        if isinstance(first_menu, dict):
            menu_id = first_menu.get("id")
            dishes = first_menu.get("dishes")
            if isinstance(dishes, list) and dishes:
                first_dish = dishes[0]
                if isinstance(first_dish, dict):
                    menu_dish_id = first_dish.get("id")
                    dish_id_from_today = first_dish.get("dishId")

    if menu_id is None:
        record("prepare-menu-id", False, "未从 /api/menu/today 提取到 menuId")
    else:
        record("prepare-menu-id", True, f"menuId={menu_id}")
    if menu_dish_id is None:
        record("prepare-menu-dish-id", False, "未提取到 menuDishId")
    else:
        record("prepare-menu-dish-id", True, f"menuDishId={menu_dish_id}")
    time.sleep(pause)

    print_step("TC-M06: 查询菜单详情")
    if menu_id is None:
        record("TC-M06-menu-detail", False, "跳过：缺少 menuId")
    else:
        url = f"{base}/api/menu/{menu_id}"
        status, resp = request_json("GET", url, headers=auth_header(user_token))
        print_response("GET", url, status, resp)
        data = extract_data(resp)
        ok = isinstance(data, dict) and data.get("id") is not None
        record("TC-M06-menu-detail", ok)
    time.sleep(pause)

    print_step("TC-M07/M08/M09/M10: 菜品详情/修改/上下架/删除（创建临时菜品）")
    temp_name = "自动化补充测试菜品"
    temp_create_url = f"{base}/api/dish"
    create_payload = {
        "name": temp_name,
        "description": "用于补充脚本测试",
        "price": 18.80,
        "category": "主食",
        "image": "https://example.com/auto-dish.jpg",
    }
    status, resp = request_json("POST", temp_create_url, headers=auth_header(merchant_token), json_body=create_payload)
    print_response("POST", temp_create_url, status, resp)
    temp_dish_id = None
    cdata = extract_data(resp)
    if isinstance(cdata, dict):
        temp_dish_id = cdata.get("id")
    if temp_dish_id is None:
        record("prepare-temp-dish", False, "创建临时菜品失败")
    else:
        record("prepare-temp-dish", True, f"dishId={temp_dish_id}")

    if temp_dish_id is None:
        record("TC-M07-dish-detail", False, "跳过：缺少 dishId")
        record("TC-M08-dish-update", False, "跳过：缺少 dishId")
        record("TC-M09-dish-status", False, "跳过：缺少 dishId")
        record("TC-M10-dish-delete", False, "跳过：缺少 dishId")
    else:
        url = f"{base}/api/dish/{temp_dish_id}"
        status, resp = request_json("GET", url, headers=auth_header(user_token))
        print_response("GET", url, status, resp)
        d = extract_data(resp)
        ok = isinstance(d, dict) and d.get("id") == temp_dish_id
        record("TC-M07-dish-detail", ok)
        time.sleep(pause)

        update_payload = {
            "name": temp_name + "-改",
            "description": "用于补充脚本测试-更新",
            "price": 19.90,
            "category": "主食",
            "image": "https://example.com/auto-dish-updated.jpg",
        }
        url = f"{base}/api/dish/{temp_dish_id}"
        status, resp = request_json("PUT", url, headers=auth_header(merchant_token), json_body=update_payload)
        print_response("PUT", url, status, resp)
        code, _ = extract_code_msg(resp)
        ok = (status == 200) and (code == 200 or code is None)
        record("TC-M08-dish-update", ok)
        time.sleep(pause)

        status_url_down = f"{base}/api/dish/{temp_dish_id}/status?value=0"
        status, resp = request_json("PUT", status_url_down, headers=auth_header(merchant_token))
        print_response("PUT", status_url_down, status, resp)
        code, _ = extract_code_msg(resp)
        ok_down = (status == 200) and (code == 200 or code is None)

        status_url_up = f"{base}/api/dish/{temp_dish_id}/status?value=1"
        status2, resp2 = request_json("PUT", status_url_up, headers=auth_header(merchant_token))
        print_response("PUT", status_url_up, status2, resp2)
        code2, _ = extract_code_msg(resp2)
        ok_up = (status2 == 200) and (code2 == 200 or code2 is None)
        record("TC-M09-dish-status", ok_down and ok_up)
        time.sleep(pause)

        del_url = f"{base}/api/dish/{temp_dish_id}"
        status, resp = request_json("DELETE", del_url, headers=auth_header(merchant_token))
        print_response("DELETE", del_url, status, resp)
        code, _ = extract_code_msg(resp)
        ok_del = (status == 200) and (code == 200 or code is None)
        record("TC-M10-dish-delete", ok_del)
    time.sleep(pause)

    print_step("TC-O09: 查询我的订单")
    url = f"{base}/api/order/my?page=1&size=10"
    status, resp = request_json("GET", url, headers=auth_header(user_token))
    print_response("GET", url, status, resp)
    d = extract_data(resp)
    ok = isinstance(d, dict) and isinstance(d.get("records"), list)
    record("TC-O09-order-my", ok)
    time.sleep(pause)

    print_step("TC-O10: 按取餐码查询订单（优先取 my 列表首条）")
    pickup_code = None
    if isinstance(d, dict) and isinstance(d.get("records"), list) and d["records"]:
        rec0 = d["records"][0]
        if isinstance(rec0, dict):
            pickup_code = rec0.get("pickupCode")
    if not pickup_code:
        record("TC-O10-order-by-pickup-code", False, "未从我的订单中拿到 pickupCode")
    else:
        url = f"{base}/api/order/pickup-code/{pickup_code}"
        status, resp = request_json("GET", url, headers=auth_header(merchant_token))
        print_response("GET", url, status, resp)
        code, _ = extract_code_msg(resp)
        ok = (status == 200) and (code == 200 or code is None)
        record("TC-O10-order-by-pickup-code", ok, f"pickupCode={pickup_code}")
    time.sleep(pause)

    print_step("TC-P06: 查询窗口列表")
    url = f"{base}/api/pickup/windows"
    status, resp = request_json("GET", url, headers=auth_header(user_token))
    print_response("GET", url, status, resp)
    d = extract_data(resp)
    ok = isinstance(d, list)
    record("TC-P06-pickup-windows", ok)
    time.sleep(pause)

    print_step("TC-G05: 无效 Token 测试")
    url = f"{base}/api/user/me"
    status, resp = request_json("GET", url, headers={"Authorization": "Bearer invalid.token.demo"})
    print_response("GET", url, status, resp)
    code, _ = extract_code_msg(resp)
    ok = (status == 401) or (code == 401)
    record("TC-G05-invalid-token", ok, f"http={status}, code={code}")
    time.sleep(pause)

    print_step("TC-G08: 资源不存在测试")
    url1 = f"{base}/api/order/99999999"
    status1, resp1 = request_json("GET", url1, headers=auth_header(user_token))
    print_response("GET", url1, status1, resp1)
    code1, _ = extract_code_msg(resp1)
    ok1 = not ((status1 == 200) and (code1 in (None, 200)))

    url2 = f"{base}/api/dish/99999999"
    status2, resp2 = request_json("GET", url2, headers=auth_header(user_token))
    print_response("GET", url2, status2, resp2)
    code2, _ = extract_code_msg(resp2)
    ok2 = not ((status2 == 200) and (code2 in (None, 200)))
    record("TC-G08-not-found-order-dish", ok1 and ok2, f"order(http={status1},code={code1}) dish(http={status2},code={code2})")
    time.sleep(pause)

    print_step("补充：无订单窗口叫号（近似覆盖 TC-G06）")
    # 创建一个新的临时窗口，不向其中入队，直接叫号，期望失败
    merchant_id = None
    login_url = f"{base}/api/user/login"
    status, resp = request_json("POST", login_url, json_body=merchant)
    print_response("POST", login_url, status, resp)
    if isinstance(resp, dict) and isinstance(resp.get("data"), dict):
        merchant_id = resp["data"].get("userId")
    if merchant_id is None:
        record("prepare-empty-window", False, "无法获取 merchant userId")
    else:
        tmp_window_name = f"空队列窗口-{datetime.datetime.now().strftime('%H%M%S')}"
        create_window_url = f"{base}/api/pickup/window"
        payload = {
            "name": tmp_window_name,
            "location": "测试位置",
            "merchantId": merchant_id,
            "pickupPrefix": "Z",
        }
        status, resp = request_json("POST", create_window_url, headers=auth_header(admin_token), json_body=payload)
        print_response("POST", create_window_url, status, resp)
        window_id = None
        cdata = extract_data(resp)
        if isinstance(cdata, dict):
            window_id = cdata.get("id")
        if window_id is None:
            record("prepare-empty-window", False, "创建临时窗口失败")
        else:
            record("prepare-empty-window", True, f"windowId={window_id}")
            call_url = f"{base}/api/pickup/{window_id}/call"
            status, resp = request_json("POST", call_url, headers=auth_header(merchant_token))
            print_response("POST", call_url, status, resp)
            code, _ = extract_code_msg(resp)
            ok = not ((status == 200) and (code in (None, 200)))
            record("TC-G06-empty-queue-call", ok, f"http={status}, code={code}")

    print_step("执行完成")
    print(f"PASSED={passed}, FAILED={failed}")
    print_step("库存新增接口补充测试")
    menu_dish_id = first_menu_dish_id(base, merchant_token)
    if menu_dish_id is None:
        record("stock-prepare-menu-dish-id", False, "未找到今日菜单菜品，跳过库存接口测试")
    else:
        record("stock-prepare-menu-dish-id", True, f"menuDishId={menu_dish_id}")
        time.sleep(pause)

        url = f"{base}/api/menu/stock/merchant?page=1&size=10"
        status, resp = request_json("GET", url, headers=auth_header(merchant_token))
        print_response("GET", url, status, resp)
        data = extract_data(resp)
        ok = isinstance(data, dict) and isinstance(data.get("records"), list)
        record("stock-merchant-query", ok)
        time.sleep(pause)

        url = f"{base}/api/menu/stock/list?page=1&size=10"
        status, resp = request_json("GET", url, headers=auth_header(admin_token))
        print_response("GET", url, status, resp)
        data = extract_data(resp)
        ok = isinstance(data, dict) and isinstance(data.get("records"), list)
        record("stock-admin-query", ok)
        time.sleep(pause)

        url = f"{base}/api/menu/stock/{menu_dish_id}"
        status, resp = request_json(
            "PUT",
            url,
            headers=auth_header(merchant_token),
            json_body={"op": "INCR", "value": 1, "reason": "additional-tests"},
        )
        print_response("PUT", url, status, resp)
        code, _ = extract_code_msg(resp)
        record("stock-merchant-update", (status == 200) and (code == 200))
        time.sleep(pause)

        status, resp = request_json(
            "PUT",
            url,
            headers=auth_header(merchant_token),
            json_body={"op": "DECR", "value": 9999999, "reason": "conflict"},
        )
        print_response("PUT", url, status, resp)
        code, _ = extract_code_msg(resp)
        record("stock-decr-conflict", code in (2002, 2004), f"http={status}, code={code}")

    print_step("执行完成（含库存补充）")
    print(f"PASSED={passed}, FAILED={failed}")
    if strict and failed > 0:
        print("严格模式开启：存在失败用例，脚本返回 1。")
        return 1
    print("脚本结束。默认模式下即使有失败用例也返回 0，便于先看完整报告。")
    return 0


if __name__ == "__main__":
    sys.exit(main())

