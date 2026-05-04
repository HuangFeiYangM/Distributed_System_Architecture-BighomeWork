"""
缺口用例 HTTP 集成测试（urllib，无第三方依赖）。
覆盖 TC-G01/G02/G07、TC-U05/U07/U08/U09/U10、TC-O02/O04/O06/O07、TC-M17、TC-P07/P08。
用法: python tests/run_backend_api_gap_tests.py [--base-url URL] [--sleep SEC]
"""
from __future__ import annotations

import argparse
import datetime
import json
import os
import sys
import time
import urllib.error
import urllib.parse
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
    timeout: int = 30,
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
        raise RuntimeError(f"[{label}] 登录失败，请检查账号与角色。")
    return token


def login_user_id(base: str, phone: str, password: str) -> Tuple[Optional[str], Optional[int]]:
    url = f"{base}/api/user/login"
    status, resp = request_json("POST", url, json_body={"phone": phone, "password": password})
    print_response("POST", url, status, resp)
    token = extract_token(resp)
    uid = None
    data = extract_data(resp)
    if isinstance(data, dict):
        u = data.get("userId")
        if isinstance(u, int):
            uid = u
        elif isinstance(u, str) and u.isdigit():
            uid = int(u)
    return token, uid


def bootstrap_today_menu(
    base: str, merchant_token: str
) -> bool:
    """若环境无今日在售菜单，则创建两道菜并发布今日菜单（与 run_backend_api_tests 一致）。"""
    dish_payload = {
        "name": "缺口测试菜A",
        "description": "gap bootstrap",
        "price": 9.9,
        "category": "主食",
        "image": "https://example.com/gap-a.jpg",
    }
    st, resp = request_json("POST", f"{base}/api/dish", headers=auth_header(merchant_token), json_body=dish_payload)
    if st != 200 or not isinstance(resp, dict) or resp.get("code") != 200:
        print(f"[WARN] bootstrap dish A failed: {resp}")
        return False
    d1 = extract_data(resp)
    id1 = d1.get("id") if isinstance(d1, dict) else None
    dish_payload2 = {
        "name": "缺口测试菜B",
        "description": "gap bootstrap",
        "price": 8.8,
        "category": "主食",
        "image": "https://example.com/gap-b.jpg",
    }
    st, resp = request_json("POST", f"{base}/api/dish", headers=auth_header(merchant_token), json_body=dish_payload2)
    if st != 200 or not isinstance(resp, dict) or resp.get("code") != 200:
        print(f"[WARN] bootstrap dish B failed: {resp}")
        return False
    d2 = extract_data(resp)
    id2 = d2.get("id") if isinstance(d2, dict) else None
    if not id1 or not id2:
        return False
    today = datetime.date.today().isoformat()
    now = datetime.datetime.now()
    start_time = (now - datetime.timedelta(hours=1)).time().replace(microsecond=0).isoformat()
    end_time = (now + datetime.timedelta(hours=2)).time().replace(microsecond=0).isoformat()
    menu_payload = {
        "name": "缺口自动今日菜单",
        "saleDate": today,
        "startTime": start_time,
        "endTime": end_time,
        "items": [
            {"dishId": id1, "salePrice": 9.9, "stock": 80},
            {"dishId": id2, "salePrice": 8.8, "stock": 80},
        ],
    }
    st, resp = request_json("POST", f"{base}/api/menu", headers=auth_header(merchant_token), json_body=menu_payload)
    if st != 200 or not isinstance(resp, dict) or resp.get("code") != 200:
        print(f"[WARN] bootstrap menu failed: {resp}")
        return False
    return True


def parse_today_menu(base: str, user_token: str) -> Tuple[Optional[Any], Optional[Any]]:
    url = f"{base}/api/menu/today"
    status, resp = request_json("GET", url, headers=auth_header(user_token))
    print_response("GET", url, status, resp)
    if not isinstance(resp, dict) or not isinstance(resp.get("data"), list) or not resp["data"]:
        return None, None
    first_menu = resp["data"][0]
    if not isinstance(first_menu, dict):
        return None, None
    dishes = first_menu.get("dishes")
    if not isinstance(dishes, list) or not dishes:
        return None, None
    fd = dishes[0]
    if not isinstance(fd, dict):
        return None, None
    return fd.get("id"), fd.get("dishId")


def create_order(
    base: str, user_token: str, window_id: Any, menu_dish_id: Any, remark: str = "gap-test"
) -> Tuple[Optional[int], Optional[str]]:
    url = f"{base}/api/order"
    body = {"windowId": window_id, "remark": remark, "items": [{"menuDishId": menu_dish_id, "quantity": 1}]}
    status, resp = request_json("POST", url, headers=auth_header(user_token), json_body=body)
    print_response("POST", url, status, resp)
    data = extract_data(resp)
    if not isinstance(data, dict):
        return None, None
    oid = data.get("id")
    if isinstance(oid, str) and oid.isdigit():
        oid = int(oid)
    pc = data.get("pickupCode")
    if not isinstance(oid, int) or not isinstance(pc, str):
        return None, None
    return oid, pc


def main() -> int:
    parser = argparse.ArgumentParser(description="缺口用例 HTTP 集成测试")
    parser.add_argument("--base-url", default=BASE_URL_DEFAULT, help="Gateway base url")
    parser.add_argument("--sleep", type=float, default=0.4, help="Sleep between steps")
    parser.add_argument(
        "--admin-password",
        default=os.environ.get("CANTEEN_ADMIN_PASSWORD", "admin123"),
        help="管理员登录密码（可与环境 CANTEEN_ADMIN_PASSWORD 一致；本地若重置过可用 123456）",
    )
    args = parser.parse_args()
    base = args.base_url.rstrip("/")
    pause = args.sleep

    admin = {"phone": "13800000000", "password": args.admin_password}
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

    print("\n" + "=" * 80)
    print("TC-G01 / TC-G02 / TC-G07")
    print("=" * 80)
    me_url = f"{base}/api/user/me"
    st, resp = request_json("GET", me_url, headers=None)
    print_response("GET", me_url, st, resp)
    c, m = extract_code_msg(resp)
    record("TC-G01-no-token", st == 401 and c == 401 and (m or "") == "缺少Token", f"http={st}, code={c}")

    st2, resp2 = request_json("GET", me_url, headers={"Authorization": "TokenOnly"})
    print_response("GET", me_url, st2, resp2)
    c2, m2 = extract_code_msg(resp2)
    record("TC-G02-non-bearer", st2 == 401 and c2 == 401, f"http={st2}, code={c2}, msg={m2!r}")

    login_url = f"{base}/api/user/login"
    st3, resp3 = request_json("POST", login_url, json_body={"phone": user["phone"], "password": "wrongpwd"})
    print_response("POST", login_url, st3, resp3)
    c3, _ = extract_code_msg(resp3)
    record("TC-G07-login-no-auth-header", st3 == 200 and c3 == 1004, f"code={c3}")

    time.sleep(pause)
    print("\n" + "=" * 80)
    print("登录固定账号")
    print("=" * 80)
    user_token = must_login(base, user, "USER")
    time.sleep(pause)
    merchant_token = must_login(base, merchant, "MERCHANT")
    time.sleep(pause)
    admin_token = must_login(base, admin, "ADMIN")
    time.sleep(pause)

    _, merchant_user_id = login_user_id(base, merchant["phone"], merchant["password"])
    if merchant_user_id is None:
        record("prepare-merchant-user-id", False, "无法从登录响应解析 merchant userId")
    else:
        record("prepare-merchant-user-id", True, f"merchantUserId={merchant_user_id}")

    print("\n" + "=" * 80)
    print("TC-U05 修改个人信息")
    print("=" * 80)
    st, me0 = request_json("GET", me_url, headers=auth_header(user_token))
    print_response("GET", me_url, st, me0)
    orig_nick = None
    d0 = extract_data(me0)
    if isinstance(d0, dict) and isinstance(d0.get("nickname"), str):
        orig_nick = d0["nickname"]
    new_nick = (orig_nick or "user") + "-gap-u05"
    put_url = f"{base}/api/user/me"
    st, resp = request_json(
        "PUT",
        put_url,
        headers=auth_header(user_token),
        json_body={"nickname": new_nick, "avatar": "http://example.com/gap-avatar.png"},
    )
    print_response("PUT", put_url, st, resp)
    c, _ = extract_code_msg(resp)
    time.sleep(pause)
    st, me1 = request_json("GET", me_url, headers=auth_header(user_token))
    print_response("GET", me_url, st, me1)
    d1 = extract_data(me1)
    nick_ok = isinstance(d1, dict) and d1.get("nickname") == new_nick
    record("TC-U05-update-me", st == 200 and c in (200, None) and nick_ok)
    if orig_nick is not None:
        st, _ = request_json(
            "PUT", put_url, headers=auth_header(user_token), json_body={"nickname": orig_nick}
        )
        print(f"[INFO] restored nickname to {orig_nick!r}")
    time.sleep(pause)

    print("\n" + "=" * 80)
    print("TC-U07 / U08 / U09 / U10（临时账号）")
    print("=" * 80)
    ts = int(time.time())
    temp_phone = f"1{ts % 10000000000:010d}"
    temp_pwd = "gapTemp123"
    temp_student = f"GAP{ts % 100000000}"
    reg_url = f"{base}/api/user/register"
    st, resp = request_json(
        "POST",
        reg_url,
        json_body={
            "phone": temp_phone,
            "password": temp_pwd,
            "nickname": "缺口临时用户",
            "studentNo": temp_student,
        },
    )
    print_response("POST", reg_url, st, resp)
    c, _ = extract_code_msg(resp)
    record("TC-temp-register", st == 200 and (c == 200 or c is None), f"code={c}")
    time.sleep(pause)

    temp_token, temp_uid = login_user_id(base, temp_phone, temp_pwd)
    if not temp_token or temp_uid is None:
        record("TC-U07-wrong-old-password", False, "跳过：临时用户未就绪")
        record("TC-U07-same-password", False, "跳过")
        record("TC-U07-change-ok", False, "跳过")
        record("TC-U10-reset-password", False, "跳过")
        record("TC-U08-disable-login", False, "跳过")
        record("TC-U08-enable", False, "跳过")
        temp_uid = None
    else:
        pwd_url = f"{base}/api/user/me/password"
        st, resp = request_json(
            "PUT",
            pwd_url,
            headers=auth_header(temp_token),
            json_body={"oldPassword": "wrong", "newPassword": "xnew99999"},
        )
        print_response("PUT", pwd_url, st, resp)
        c, _ = extract_code_msg(resp)
        record("TC-U07-wrong-old-password", c == 1004, f"code={c}")

        st, resp = request_json(
            "PUT",
            pwd_url,
            headers=auth_header(temp_token),
            json_body={"oldPassword": temp_pwd, "newPassword": temp_pwd},
        )
        print_response("PUT", pwd_url, st, resp)
        c, _ = extract_code_msg(resp)
        record("TC-U07-same-password", c == 400, f"code={c}")

        new_pwd = "gapTemp456"
        st, resp = request_json(
            "PUT",
            pwd_url,
            headers=auth_header(temp_token),
            json_body={"oldPassword": temp_pwd, "newPassword": new_pwd},
        )
        print_response("PUT", pwd_url, st, resp)
        c, _ = extract_code_msg(resp)
        record("TC-U07-change-ok", st == 200 and (c == 200 or c is None), f"code={c}")
        time.sleep(pause)

        reset_url = f"{base}/api/user/{temp_uid}/reset-password"
        st, resp = request_json(
            "POST", reset_url, headers=auth_header(admin_token), json_body={"password": "gapReset789"}
        )
        print_response("POST", reset_url, st, resp)
        c, _ = extract_code_msg(resp)
        t789, _ = login_user_id(base, temp_phone, "gapReset789")
        ok_u10 = st == 200 and (c == 200 or c is None) and t789 is not None
        record("TC-U10-reset-password", ok_u10)
        time.sleep(pause)
        st, resp = request_json(
            "POST", reset_url, headers=auth_header(admin_token), json_body={"password": temp_pwd}
        )
        print_response("POST", reset_url, st, resp)
        time.sleep(pause)

        status_url = f"{base}/api/user/{temp_uid}/status"
        st, resp = request_json("PUT", f"{status_url}?value=0", headers=auth_header(admin_token))
        print_response("PUT", f"{status_url}?value=0", st, resp)
        c, _ = extract_code_msg(resp)
        time.sleep(pause)
        st_l, resp_l = request_json("POST", login_url, json_body={"phone": temp_phone, "password": temp_pwd})
        print_response("POST", login_url, st_l, resp_l)
        c_l, _ = extract_code_msg(resp_l)
        record("TC-U08-disable-login", st == 200 and st_l == 200 and c_l == 403, f"login_code={c_l}")

        st, resp = request_json("PUT", f"{status_url}?value=1", headers=auth_header(admin_token))
        print_response("PUT", f"{status_url}?value=1", st, resp)
        time.sleep(pause)
        t_back, _ = login_user_id(base, temp_phone, temp_pwd)
        record("TC-U08-enable", t_back is not None)

    print("\n" + "=" * 80)
    print("TC-U09 删除管理员拒绝")
    print("=" * 80)
    list_url = f"{base}/api/user/list?page=1&size=50"
    st, resp = request_json("GET", list_url, headers=auth_header(admin_token))
    print_response("GET", list_url, st, resp)
    admin_row_id: Optional[int] = None
    data = extract_data(resp)
    if isinstance(data, dict):
        recs = data.get("records")
        if isinstance(recs, list):
            for row in recs:
                if not isinstance(row, dict):
                    continue
                if row.get("role") == 2:
                    rid = row.get("id")
                    if isinstance(rid, int):
                        admin_row_id = rid
                        break
                    if isinstance(rid, str) and rid.isdigit():
                        admin_row_id = int(rid)
                        break
    if admin_row_id is None:
        record("TC-U09-delete-admin-forbidden", False, "未找到 role=2 的用户")
    else:
        del_url = f"{base}/api/user/{admin_row_id}"
        st, resp = request_json("DELETE", del_url, headers=auth_header(admin_token))
        print_response("DELETE", del_url, st, resp)
        c, msg = extract_code_msg(resp)
        ok = st == 200 and c == 403 and isinstance(msg, str) and "管理员" in msg
        record("TC-U09-delete-admin-forbidden", ok, f"code={c}")

    if temp_uid is not None:
        del_temp = f"{base}/api/user/{temp_uid}"
        st, resp = request_json("DELETE", del_temp, headers=auth_header(admin_token))
        print_response("DELETE", del_temp, st, resp)
        c, _ = extract_code_msg(resp)
        record("TC-cleanup-delete-temp-user", st == 200 and (c == 200 or c is None), f"code={c}")
    time.sleep(pause)

    print("\n" + "=" * 80)
    print("TC-M17 / TC-O04 / O06 / O07 / O02（依赖今日菜单与窗口）")
    print("=" * 80)
    menu_dish_id, dish_id_today = parse_today_menu(base, user_token)
    if menu_dish_id is None or dish_id_today is None:
        print("[INFO] /api/menu/today 为空，尝试自动发布今日菜单…")
        if bootstrap_today_menu(base, merchant_token):
            time.sleep(pause)
            menu_dish_id, dish_id_today = parse_today_menu(base, user_token)
    if menu_dish_id is None or dish_id_today is None:
        record("prepare-menu-today", False, "无今日菜单或 dishes 为空")
    else:
        record("prepare-menu-today", True, f"menuDishId={menu_dish_id}, dishId={dish_id_today}")

    if isinstance(dish_id_today, int) or (isinstance(dish_id_today, str) and str(dish_id_today).isdigit()):
        did = int(dish_id_today)
        dup_url = f"{base}/api/dish/{did}"
        st, resp = request_json(
            "PUT",
            dup_url,
            headers=auth_header(merchant_token),
            json_body={
                "name": "gap-try-rename",
                "description": "x",
                "price": 1.0,
                "category": "主食",
                "image": "https://example.com/x.jpg",
            },
        )
        print_response("PUT", dup_url, st, resp)
        c, _ = extract_code_msg(resp)
        record("TC-M17-dish-menu-conflict", c == 3008, f"code={c}")
    else:
        record("TC-M17-dish-menu-conflict", False, "跳过：无 dishId")

    win_url = f"{base}/api/pickup/window"
    window_id_for_orders: Optional[int] = None
    if merchant_user_id is None:
        record("prepare-window-for-orders", False, "无 merchantUserId")
    else:
        st, resp = request_json(
            "POST",
            win_url,
            headers=auth_header(admin_token),
            json_body={
                "name": f"gap-orders-{int(time.time())}",
                "location": "gap",
                "merchantId": merchant_user_id,
                "pickupPrefix": "G",
            },
        )
        print_response("POST", win_url, st, resp)
        wd = extract_data(resp)
        wid = wd.get("id") if isinstance(wd, dict) else None
        if isinstance(wid, str) and wid.isdigit():
            wid = int(wid)
        if isinstance(wid, int):
            window_id_for_orders = wid
            record("prepare-window-for-orders", True, f"windowId={wid}")
        else:
            record("prepare-window-for-orders", False, "创建窗口失败")

    order_id_cancel: Optional[int] = None
    order_id_remark: Optional[int] = None
    order_id_batch: Optional[int] = None
    pickup_for_p: Optional[str] = None

    if menu_dish_id is not None and window_id_for_orders is not None:
        oid, _ = create_order(base, user_token, window_id_for_orders, menu_dish_id, "cancel-me")
        if oid:
            order_id_cancel = oid
            curl = f"{base}/api/order/{oid}/cancel"
            st, resp = request_json("PUT", curl, headers=auth_header(user_token))
            print_response("PUT", curl, st, resp)
            c, _ = extract_code_msg(resp)
            time.sleep(pause)
            det_url = f"{base}/api/order/{oid}"
            st, resp = request_json("GET", det_url, headers=auth_header(user_token))
            print_response("GET", det_url, st, resp)
            d = extract_data(resp)
            ok = st == 200 and isinstance(d, dict) and d.get("status") == 5
            record("TC-O04-user-cancel", ok, f"status={d.get('status') if isinstance(d, dict) else None}")
        else:
            record("TC-O04-user-cancel", False, "下单失败")

        time.sleep(pause)
        oid2, _ = create_order(base, user_token, window_id_for_orders, menu_dish_id, "remark-me")
        if oid2:
            order_id_remark = oid2
            remark_q = urllib.parse.quote("商家备注GAP", safe="")
            rmk = f"{base}/api/order/{oid2}/remark?remark={remark_q}"
            st, resp = request_json("POST", rmk, headers=auth_header(merchant_token))
            print_response("POST", rmk, st, resp)
            c, _ = extract_code_msg(resp)
            time.sleep(pause)
            st, resp = request_json("GET", f"{base}/api/order/{oid2}", headers=auth_header(user_token))
            print_response("GET", f"{base}/api/order/{oid2}", st, resp)
            d = extract_data(resp)
            remark_ok = isinstance(d, dict) and d.get("remark") == "商家备注GAP"
            record("TC-O06-merchant-remark", st == 200 and (c == 200 or c is None) and remark_ok)
        else:
            record("TC-O06-merchant-remark", False, "下单失败")

        time.sleep(pause)
        oid3, _ = create_order(base, user_token, window_id_for_orders, menu_dish_id, "batch-me")
        if oid3:
            order_id_batch = oid3
            bs = f"{base}/api/order/batch/status"
            st, resp = request_json(
                "POST", bs, headers=auth_header(merchant_token), json_body={"orderIds": [oid3], "status": 1}
            )
            print_response("POST", bs, st, resp)
            c, _ = extract_code_msg(resp)
            time.sleep(pause)
            st, resp = request_json("GET", f"{base}/api/order/{oid3}", headers=auth_header(user_token))
            d = extract_data(resp)
            batch_ok = isinstance(d, dict) and d.get("status") == 1
            record("TC-O07-batch-status", st == 200 and (c == 200 or c is None) and batch_ok)

            st, resp = request_json(
                "POST", bs, headers=auth_header(merchant_token), json_body={"orderIds": [], "status": 1}
            )
            print_response("POST", bs, st, resp)
            c_neg, _ = extract_code_msg(resp)
            record("TC-O07-batch-empty-ids", c_neg == 400, f"code={c_neg}")
        else:
            record("TC-O07-batch-status", False, "下单失败")
            record("TC-O07-batch-empty-ids", False, "跳过")

        if order_id_remark:
            st, resp = request_json(
                "GET", f"{base}/api/order/{order_id_remark}", headers=auth_header(merchant_token)
            )
            print_response("GET", f"{base}/api/order/{order_id_remark}", st, resp)
            c, _ = extract_code_msg(resp)
            record("TC-O02-others-order-forbidden", c == 403 or st == 403, f"code={c}, http={st}")
        else:
            record("TC-O02-others-order-forbidden", False, "跳过")
    else:
        record("TC-O04-user-cancel", False, "缺少 menu 或 window")
        record("TC-O06-merchant-remark", False, "缺少 menu 或 window")
        record("TC-O07-batch-status", False, "缺少 menu 或 window")
        record("TC-O07-batch-empty-ids", False, "缺少 menu 或 window")
        record("TC-O02-others-order-forbidden", False, "缺少 menu 或 window")

    print("\n" + "=" * 80)
    print("TC-P07 / TC-P08")
    print("=" * 80)
    if menu_dish_id is None or merchant_user_id is None:
        record("TC-P07-delete-window-blocked", False, "缺少依赖")
        record("TC-P08-window-history", False, "缺少依赖")
    else:
        st, resp = request_json(
            "POST",
            win_url,
            headers=auth_header(admin_token),
            json_body={
                "name": f"gap-p7-{int(time.time())}",
                "location": "gap-p7",
                "merchantId": merchant_user_id,
                "pickupPrefix": "P",
            },
        )
        print_response("POST", win_url, st, resp)
        wd = extract_data(resp)
        p7_wid = wd.get("id") if isinstance(wd, dict) else None
        if isinstance(p7_wid, str) and p7_wid.isdigit():
            p7_wid = int(p7_wid)
        if not isinstance(p7_wid, int):
            record("TC-P07-delete-window-blocked", False, "创建 P7 窗口失败")
            record("TC-P08-window-history", False, "创建 P7 窗口失败")
        else:
            oid, pc = create_order(base, user_token, p7_wid, menu_dish_id, "p7-flow")
            pickup_for_p = pc
            if not oid:
                record("TC-P07-delete-window-blocked", False, "下单失败")
                record("TC-P08-window-history", False, "下单失败")
            else:
                for act in ["accept", "cook", "ready"]:
                    u = f"{base}/api/order/{oid}/{act}"
                    st, resp = request_json("PUT", u, headers=auth_header(merchant_token))
                    print_response("PUT", u, st, resp)
                    time.sleep(pause)
                del_w = f"{base}/api/pickup/window/{p7_wid}"
                st, resp = request_json("DELETE", del_w, headers=auth_header(admin_token))
                print_response("DELETE", del_w, st, resp)
                c, msg = extract_code_msg(resp)
                ok_p7 = (
                    st == 200
                    and c == 4090
                    and isinstance(msg, str)
                    and ("活动订单" in msg or "不能删除" in msg)
                )
                record("TC-P07-delete-window-blocked", ok_p7, f"code={c}")

                hist = f"{base}/api/pickup/window/{p7_wid}/history"
                st, resp = request_json("GET", hist, headers=auth_header(user_token))
                print_response("GET", hist, st, resp)
                dh = extract_data(resp)
                record(
                    "TC-P08-window-history",
                    st == 200 and isinstance(dh, list),
                    f"len={len(dh) if isinstance(dh, list) else 'n/a'}",
                )

                if isinstance(pc, str):
                    call_u = f"{base}/api/pickup/{p7_wid}/call"
                    st, resp = request_json("POST", call_u, headers=auth_header(merchant_token))
                    print_response("POST", call_u, st, resp)
                    time.sleep(pause)
                    vf = f"{base}/api/pickup/verify"
                    st, resp = request_json("POST", vf, headers=auth_header(merchant_token), json_body={"pickupCode": pc})
                    print_response("POST", vf, st, resp)
                    time.sleep(pause)
                st, resp = request_json("DELETE", del_w, headers=auth_header(admin_token))
                print_response("DELETE", del_w, st, resp)
                c, _ = extract_code_msg(resp)
                record("TC-P07-cleanup-delete-window", st == 200 and (c == 200 or c is None), f"code={c}")

    print("\n执行完成")
    print(f"PASSED={passed}, FAILED={failed}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
