"""
TC-O05：订单超时自动取消（OrderTimeoutScheduler，约 30s 周期）。

需将 PLACED 订单的 pay_deadline / accept_deadline 改为过去，仅靠等待无法触发。
本脚本通过环境变量 CANTEEN_MYSQL 调用本地 mysql 客户端执行 UPDATE（不写死库名）。

与仓库根目录 docker-compose.yml 一致时（root/root，宿主机端口 3320，订单库见 order-service 配置）:

  PowerShell:
    $env:CANTEEN_MYSQL = "mysql -h127.0.0.1 -P3320 -uroot -proot canteen_order"
    python tests/run_backend_api_order_timeout_test.py --admin-password 123456

  前提：docker compose 中 mysql 容器已启动；本机已安装 mysql 客户端；order-service 连的正是该库。

未设置 CANTEEN_MYSQL 时：打印 [SKIP] 并以退出码 0 结束。

用法:
  python tests/run_backend_api_order_timeout_test.py [--base-url URL] [--wait-seconds 35] [--admin-password ...]
"""
from __future__ import annotations

import argparse
import datetime
import json
import os
import shlex
import subprocess
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
    d = extract_data(resp)
    if isinstance(d, dict):
        t = d.get("accessToken")
        if isinstance(t, str) and t.strip():
            return t
    return None


def login(base: str, phone: str, password: str) -> Optional[str]:
    _, resp = request_json("POST", f"{base}/api/user/login", json_body={"phone": phone, "password": password})
    return extract_token(resp)


def login_user_id(base: str, phone: str, password: str) -> Tuple[Optional[str], Optional[int]]:
    _, resp = request_json("POST", f"{base}/api/user/login", json_body={"phone": phone, "password": password})
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
    _, resp = request_json("GET", f"{base}/api/menu/today", headers=auth_header(user_tok))
    if isinstance(resp, dict) and isinstance(resp.get("data"), list) and resp["data"]:
        return True
    today = datetime.date.today().isoformat()
    now = datetime.datetime.now()
    st1, r1 = request_json(
        "POST",
        f"{base}/api/dish",
        headers=auth_header(merchant_tok),
        json_body={
            "name": "TO测试菜A",
            "description": "to",
            "price": 1.0,
            "category": "主食",
            "image": "https://example.com/to-a.jpg",
        },
    )
    st2, r2 = request_json(
        "POST",
        f"{base}/api/dish",
        headers=auth_header(merchant_tok),
        json_body={
            "name": "TO测试菜B",
            "description": "to",
            "price": 2.0,
            "category": "主食",
            "image": "https://example.com/to-b.jpg",
        },
    )
    if st1 != 200 or not isinstance(r1, dict) or r1.get("code") != 200:
        return False
    if st2 != 200 or not isinstance(r2, dict) or r2.get("code") != 200:
        return False
    d1 = extract_data(r1)
    d2 = extract_data(r2)
    id1 = d1.get("id") if isinstance(d1, dict) else None
    id2 = d2.get("id") if isinstance(d2, dict) else None
    if not id1 or not id2:
        return False
    start = (now - datetime.timedelta(hours=1)).time().replace(microsecond=0).isoformat()
    end = (now + datetime.timedelta(hours=2)).time().replace(microsecond=0).isoformat()
    st3, r3 = request_json(
        "POST",
        f"{base}/api/menu",
        headers=auth_header(merchant_tok),
        json_body={
            "name": "TO今日菜单",
            "saleDate": today,
            "startTime": start,
            "endTime": end,
            "items": [
                {"dishId": id1, "salePrice": 1.0, "stock": 50},
                {"dishId": id2, "salePrice": 2.0, "stock": 50},
            ],
        },
    )
    return st3 == 200 and isinstance(r3, dict) and r3.get("code") == 200


def first_menu_dish_id(base: str, user_tok: str) -> Optional[int]:
    _, resp = request_json("GET", f"{base}/api/menu/today", headers=auth_header(user_tok))
    if not isinstance(resp, dict):
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


def run_mysql(mysql_prefix: str, sql: str, *, batch_no_column_names: bool = False) -> subprocess.CompletedProcess[str]:
    parts = shlex.split(mysql_prefix, posix=os.name != "nt")
    extra: list[str] = []
    if batch_no_column_names:
        extra = ["-B", "-N"]
    return subprocess.run([*parts, *extra, "-e", sql], capture_output=True, text=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="TC-O05 订单超时调度测试（需 CANTEEN_MYSQL）")
    parser.add_argument("--base-url", default=BASE_URL_DEFAULT)
    parser.add_argument("--wait-seconds", type=int, default=35, help="UPDATE 后等待秒数（应 > 调度周期 30）")
    parser.add_argument(
        "--admin-password",
        default=os.environ.get("CANTEEN_ADMIN_PASSWORD", "admin123"),
    )
    args = parser.parse_args()
    base = args.base_url.rstrip("/")
    mysql_prefix = os.environ.get("CANTEEN_MYSQL", "").strip()

    if not mysql_prefix:
        print(
            "[SKIP] TC-O05：未设置 CANTEEN_MYSQL。docker-compose 示例: "
            "mysql -h127.0.0.1 -P3320 -uroot -proot canteen_order"
        )
        return 0

    user_t = login(base, "13800000002", "user123")
    mer_t = login(base, "13800000001", "123456")
    adm_t = login(base, "13800000000", args.admin_password)
    if not user_t or not mer_t or not adm_t:
        print("[FAIL] 登录失败")
        return 1

    if not bootstrap_menu_if_empty(base, user_t, mer_t):
        print("[FAIL] 准备菜单失败")
        return 1
    time.sleep(0.2)
    mdid = first_menu_dish_id(base, user_t)
    if mdid is None:
        print("[FAIL] 无 menuDishId")
        return 1

    _, mid = login_user_id(base, "13800000001", "123456")
    if mid is None:
        print("[FAIL] merchant userId")
        return 1

    st, resp = request_json(
        "POST",
        f"{base}/api/pickup/window",
        headers=auth_header(adm_t),
        json_body={
            "name": f"to-win-{int(time.time())}",
            "location": "to",
            "merchantId": mid,
            "pickupPrefix": "T",
        },
    )
    if st != 200 or not isinstance(resp, dict) or resp.get("code") != 200:
        print(f"[FAIL] 创建窗口: {resp}")
        return 1
    wd = extract_data(resp)
    wid = wd.get("id") if isinstance(wd, dict) else None
    if isinstance(wid, str) and wid.isdigit():
        wid = int(wid)
    if not isinstance(wid, int):
        print("[FAIL] windowId")
        return 1

    st, resp = request_json(
        "POST",
        f"{base}/api/order",
        headers=auth_header(user_t),
        json_body={"windowId": wid, "remark": "timeout-test", "items": [{"menuDishId": mdid, "quantity": 1}]},
    )
    if st != 200 or not isinstance(resp, dict) or resp.get("code") != 200:
        print(f"[FAIL] 下单: {resp}")
        return 1
    od = extract_data(resp)
    oid = od.get("id") if isinstance(od, dict) else None
    if isinstance(oid, str) and oid.isdigit():
        oid = int(oid)
    if not isinstance(oid, int):
        print("[FAIL] order id")
        return 1

    sql_update = (
        f"UPDATE orders SET pay_deadline = DATE_SUB(NOW(), INTERVAL 2 MINUTE), "
        f"accept_deadline = DATE_SUB(NOW(), INTERVAL 2 MINUTE) WHERE id = {oid} AND status = 0"
    )
    print(f"[INFO] mysql: {sql_update}")
    pr = run_mysql(mysql_prefix, sql_update)
    if pr.returncode != 0:
        print(f"[FAIL] mysql UPDATE: stderr={pr.stderr!r} stdout={pr.stdout!r}")
        return 1

    print(f"[INFO] 等待 {args.wait_seconds}s 以供 OrderTimeoutScheduler 扫描…")
    time.sleep(args.wait_seconds)

    st, resp = request_json("GET", f"{base}/api/order/{oid}", headers=auth_header(user_t))
    if st != 200 or not isinstance(resp, dict):
        print(f"[FAIL] 查询订单: {resp}")
        return 1
    d = extract_data(resp)
    status_val = d.get("status") if isinstance(d, dict) else None
    if status_val != 5:
        print(f"[FAIL] 订单未取消，status={status_val} body={resp}")
        return 1
    print("[PASS] TC-O05-order-timeout-cancelled status=5")

    pr2 = run_mysql(
        mysql_prefix,
        f"SELECT cancel_type FROM orders WHERE id = {oid} LIMIT 1",
        batch_no_column_names=True,
    )
    if pr2.returncode == 0 and pr2.stdout.strip():
        ct = pr2.stdout.strip().split()[-1]
        if ct == "2":
            print("[PASS] TC-O05-cancel-type-2 (mysql)")
        else:
            print(f"[WARN] cancel_type 期望 2，mysql 输出: {pr2.stdout!r}")
    else:
        print(f"[WARN] 未验证 cancel_type: {pr2.stderr!r}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
