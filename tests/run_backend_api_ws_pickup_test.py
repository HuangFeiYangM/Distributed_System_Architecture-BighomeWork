"""
TC-P05a：WebSocket 收 CALL 消息（可选依赖 websockets）。

  pip install websockets

未安装 websockets 时：打印 [SKIP] 并以退出码 0 结束（不计失败）。
用法:
  python tests/run_backend_api_ws_pickup_test.py [--base-url http://127.0.0.1:8080] [--admin-password ...]
"""
from __future__ import annotations

import argparse
import asyncio
import datetime
import json
import os
import sys
import time
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


def auth_header(token: str) -> Dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def extract_data(resp: Any) -> Any:
    if isinstance(resp, dict):
        return resp.get("data")
    return None


def extract_token(resp: Any) -> Optional[str]:
    data = extract_data(resp)
    if isinstance(data, dict):
        t = data.get("accessToken")
        if isinstance(t, str) and t.strip():
            return t
    return None


def login(base: str, phone: str, password: str) -> Optional[str]:
    st, resp = request_json("POST", f"{base}/api/user/login", json_body={"phone": phone, "password": password})
    return extract_token(resp) if st == 200 else None


def login_user_id(base: str, phone: str, password: str) -> Tuple[Optional[str], Optional[int]]:
    st, resp = request_json("POST", f"{base}/api/user/login", json_body={"phone": phone, "password": password})
    token = extract_token(resp)
    uid = None
    d = extract_data(resp)
    if isinstance(d, dict):
        u = d.get("userId")
        if isinstance(u, int):
            uid = u
        elif isinstance(u, str) and u.isdigit():
            uid = int(u)
    return token, uid


def bootstrap_menu_if_empty(base: str, user_tok: str, merchant_tok: str) -> bool:
    st, resp = request_json("GET", f"{base}/api/menu/today", headers=auth_header(user_tok))
    if st == 200 and isinstance(resp, dict) and isinstance(resp.get("data"), list) and resp["data"]:
        return True
    today = datetime.date.today().isoformat()
    now = datetime.datetime.now()
    st1, r1 = request_json(
        "POST",
        f"{base}/api/dish",
        headers=auth_header(merchant_tok),
        json_body={
            "name": "WS测试菜A",
            "description": "ws",
            "price": 1.0,
            "category": "主食",
            "image": "https://example.com/ws-a.jpg",
        },
    )
    st2, r2 = request_json(
        "POST",
        f"{base}/api/dish",
        headers=auth_header(merchant_tok),
        json_body={
            "name": "WS测试菜B",
            "description": "ws",
            "price": 2.0,
            "category": "主食",
            "image": "https://example.com/ws-b.jpg",
        },
    )
    if st1 != 200 or not isinstance(r1, dict) or r1.get("code") != 200:
        return False
    if st2 != 200 or not isinstance(r2, dict) or r2.get("code") != 200:
        return False
    id1 = extract_data(r1)
    id2 = extract_data(r2)
    d1 = id1.get("id") if isinstance(id1, dict) else None
    d2 = id2.get("id") if isinstance(id2, dict) else None
    if not d1 or not d2:
        return False
    start = (now - datetime.timedelta(hours=1)).time().replace(microsecond=0).isoformat()
    end = (now + datetime.timedelta(hours=2)).time().replace(microsecond=0).isoformat()
    st3, r3 = request_json(
        "POST",
        f"{base}/api/menu",
        headers=auth_header(merchant_tok),
        json_body={
            "name": "WS今日菜单",
            "saleDate": today,
            "startTime": start,
            "endTime": end,
            "items": [
                {"dishId": d1, "salePrice": 1.0, "stock": 50},
                {"dishId": d2, "salePrice": 2.0, "stock": 50},
            ],
        },
    )
    return st3 == 200 and isinstance(r3, dict) and r3.get("code") == 200


def first_menu_dish_id(base: str, user_tok: str) -> Optional[int]:
    st, resp = request_json("GET", f"{base}/api/menu/today", headers=auth_header(user_tok))
    if st != 200 or not isinstance(resp, dict):
        return None
    data = resp.get("data")
    if not isinstance(data, list) or not data:
        return None
    m0 = data[0]
    if not isinstance(m0, dict):
        return None
    dishes = m0.get("dishes")
    if not isinstance(dishes, list) or not dishes:
        return None
    fd = dishes[0]
    if not isinstance(fd, dict):
        return None
    mid = fd.get("id")
    if isinstance(mid, int):
        return mid
    if isinstance(mid, str) and mid.isdigit():
        return int(mid)
    return None


def http_call_pickup(base: str, merchant_token: str, window_id: int) -> None:
    request_json("POST", f"{base}/api/pickup/{window_id}/call", headers=auth_header(merchant_token))


async def run_ws_test(http_base: str, ws_url: str, admin_password: str) -> bool:
    import websockets  # type: ignore

    base = http_base.rstrip("/")
    user_t = login(base, "13800000002", "user123")
    mer_t = login(base, "13800000001", "123456")
    adm_t = login(base, "13800000000", admin_password)
    if not user_t or not mer_t or not adm_t:
        print("[FAIL] 登录失败（检查 --admin-password / CANTEEN_ADMIN_PASSWORD）")
        return False

    if not bootstrap_menu_if_empty(base, user_t, mer_t):
        print("[FAIL] 无法准备今日菜单")
        return False
    time.sleep(0.2)
    mdid = first_menu_dish_id(base, user_t)
    if mdid is None:
        print("[FAIL] 无 menuDishId")
        return False

    _, mid = login_user_id(base, "13800000001", "123456")
    if mid is None:
        print("[FAIL] merchant userId")
        return False

    st, resp = request_json(
        "POST",
        f"{base}/api/pickup/window",
        headers=auth_header(adm_t),
        json_body={
            "name": f"ws-win-{int(time.time())}",
            "location": "ws",
            "merchantId": mid,
            "pickupPrefix": "W",
        },
    )
    if st != 200 or not isinstance(resp, dict) or resp.get("code") != 200:
        print(f"[FAIL] 创建窗口: {resp}")
        return False
    wd = extract_data(resp)
    wid = wd.get("id") if isinstance(wd, dict) else None
    if isinstance(wid, str) and wid.isdigit():
        wid = int(wid)
    if not isinstance(wid, int):
        print("[FAIL] windowId")
        return False

    st, resp = request_json(
        "POST",
        f"{base}/api/order",
        headers=auth_header(user_t),
        json_body={"windowId": wid, "remark": "ws", "items": [{"menuDishId": mdid, "quantity": 1}]},
    )
    if st != 200 or not isinstance(resp, dict) or resp.get("code") != 200:
        print(f"[FAIL] 下单: {resp}")
        return False
    od = extract_data(resp)
    oid = od.get("id") if isinstance(od, dict) else None
    pc = od.get("pickupCode") if isinstance(od, dict) else None
    if isinstance(oid, str) and oid.isdigit():
        oid = int(oid)
    if not isinstance(oid, int) or not isinstance(pc, str):
        print("[FAIL] order id / pickupCode")
        return False

    for act in ["accept", "cook", "ready"]:
        st, resp = request_json("PUT", f"{base}/api/order/{oid}/{act}", headers=auth_header(mer_t))
        if st != 200 or not isinstance(resp, dict) or resp.get("code") != 200:
            print(f"[FAIL] order {act}: {resp}")
            return False
        time.sleep(0.15)

    received: list[str] = []

    async def listen() -> None:
        async with websockets.connect(ws_url, open_timeout=5, close_timeout=2) as ws:

            async def delayed_call() -> None:
                await asyncio.sleep(0.25)
                await asyncio.to_thread(http_call_pickup, base, mer_t, wid)

            call_task = asyncio.create_task(delayed_call())
            deadline = time.monotonic() + 5.0
            try:
                while time.monotonic() < deadline:
                    try:
                        raw = await asyncio.wait_for(ws.recv(), timeout=1.0)
                    except asyncio.TimeoutError:
                        continue
                    received.append(raw if isinstance(raw, str) else str(raw))
            finally:
                call_task.cancel()
                try:
                    await call_task
                except asyncio.CancelledError:
                    pass

    try:
        await listen()
    except Exception as e:
        print(f"[FAIL] WebSocket 或叫号异常: {e}")
        request_json("POST", f"{base}/api/pickup/verify", headers=auth_header(mer_t), json_body={"pickupCode": pc})
        request_json("DELETE", f"{base}/api/pickup/window/{wid}", headers=auth_header(adm_t))
        return False

    ok_call = False
    for raw in received:
        try:
            obj = json.loads(raw)
        except Exception:
            continue
        if isinstance(obj, dict) and obj.get("type") == "CALL" and obj.get("pickupNo"):
            ok_call = True
            print(f"[INFO] 收到 CALL: {raw}")
            break

    request_json("POST", f"{base}/api/pickup/verify", headers=auth_header(mer_t), json_body={"pickupCode": pc})
    time.sleep(0.2)
    request_json("DELETE", f"{base}/api/pickup/window/{wid}", headers=auth_header(adm_t))

    if ok_call:
        print("[PASS] TC-P05a-ws-call-message")
        return True
    print(f"[FAIL] TC-P05a-ws-call-message 未收到 CALL，收到: {received}")
    return False


def main() -> int:
    parser = argparse.ArgumentParser(description="TC-P05a WebSocket CALL 断言")
    parser.add_argument("--base-url", default=BASE_URL_DEFAULT, help="Gateway HTTP base")
    parser.add_argument("--ws-url", default="", help="默认由 HTTP 推导为 ws://host/ws/pickup")
    parser.add_argument(
        "--admin-password",
        default=os.environ.get("CANTEEN_ADMIN_PASSWORD", "admin123"),
        help="管理员密码",
    )
    args = parser.parse_args()
    http_base = args.base_url.rstrip("/")
    if args.ws_url:
        ws_url = args.ws_url
    else:
        if http_base.startswith("https://"):
            ws_url = "wss://" + http_base[len("https://") :] + "/ws/pickup"
        elif http_base.startswith("http://"):
            ws_url = "ws://" + http_base[len("http://") :] + "/ws/pickup"
        else:
            ws_url = "ws://" + http_base + "/ws/pickup"

    try:
        import websockets  # noqa: F401
    except ImportError:
        print("[SKIP] websockets 未安装，退出码 0")
        return 0

    ok = asyncio.run(run_ws_test(http_base, ws_url, args.admin_password))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
