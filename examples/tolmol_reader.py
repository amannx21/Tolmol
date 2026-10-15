#!/usr/bin/env python3
"""Read Tolmol evidence straight from Arkiv, written only from arkiv/schema.md (no Tolmol code, Python standard library only).

    python examples/tolmol_reader.py SYN-BR-0042          # one outlet: shortfall, reports, confirmations, answers
    python examples/tolmol_reader.py --outlets            # every ration shop, school and panchayat in the registry
    python examples/tolmol_reader.py SYN-BR-5001 --rpc https://another-arkiv-endpoint

It applies the schema's trust rules itself: outlets only from the registry wallet, one report per device and outlet,
month and item (the earliest), withdrawals only from the report's own device, confirmations only from other devices,
answers only from that outlet's verified operator. All data in the public demo is SYNTHETIC.
"""
import argparse
import json
import urllib.request

RPC = "https://rpc.tiramisu.db-chain.testnet.arkiv.network"
REGISTRY = "0x6DBf6A36E27d814c58A05312913DCEEfc0dAe221"
SELECT = {"key": True, "owner": True, "creator": True, "createdAt": True, "expiresAt": True, "attributes": True, "payload": False}
UNIT = {"rice": "g", "wheat": "g", "millet": "g", "total": "g", "meal_days": "days", "wage_inr": "INR"}
SCHEME_OF = {"rice": "pds", "wheat": "pds", "millet": "pds", "total": "pds", "meal_days": "mdm", "wage_inr": "nrega"}


def query(rpc, q, payload=False):
    """Every page of one arkiv_query, pinned to the block of the first page (as the schema's queries are)."""
    out, cursor, block = [], None, None
    while True:
        opts = {"select": dict(SELECT, payload=payload), "limit": "0xc8"}
        if block is not None:
            opts["atBlock"] = block
        if cursor:
            opts["cursor"] = cursor
        body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": "arkiv_query", "params": [q, opts]}).encode()
        req = urllib.request.Request(rpc, body, {"content-type": "application/json", "user-agent": "tolmol-reader-py"})
        res = json.load(urllib.request.urlopen(req, timeout=30))
        if "error" in res:
            raise SystemExit(f"Arkiv error: {res['error']}")
        r = res["result"]
        block = r["blockNumber"]
        out += r["data"]
        cursor = r.get("cursor")
        if not cursor:
            return out, int(block, 16) if isinstance(block, str) else block


def attrs(e):
    """[{name, type, value}] -> {name: value}, integers as int."""
    a = {}
    for x in e.get("attributes") or []:
        v = x["value"]
        if x["type"] in ("i32", "u64", "u256") and isinstance(v, str):
            v = int(v, 16) if v.startswith("0x") else int(v)
        a[x["name"]] = v
    return a


def num(v):
    return int(v, 16) if isinstance(v, str) and v.startswith("0x") else int(v)


def base(t):
    return f"project = str('tolmol') AND type = str('{t}')"


def fmt(item, n):
    u = UNIT.get(item, "")
    return f"{n / 1000:g} kg" if u == "g" else f"{n} days" if u == "days" else f"Rs {n:,}"


def outlets(rpc):
    rows, _ = query(rpc, f"project = str('tolmol') AND (type = str('tolmol.shop') OR type = str('tolmol.outlet')) AND $creator = addr({REGISTRY})")
    return {a["shop_id"]: a for a in map(attrs, rows)}


def outlet_report(rpc, shop_id):
    shops = outlets(rpc)
    shop = shops.get(shop_id)
    if not shop:
        raise SystemExit(f"{shop_id} is not in the registry (only outlets created by {REGISTRY} count)")
    scheme = shop.get("scheme", "pds")
    where = f"shop_id = str('{shop_id}')"
    reports, block = query(rpc, f"{base('tolmol.report')} AND {where}")
    witnesses, _ = query(rpc, f"{base('tolmol.witness')} AND {where}")
    corrections, _ = query(rpc, f"{base('tolmol.correction')} AND {where}")
    responses, _ = query(rpc, f"{base('tolmol.response')} AND {where}")

    # Withdrawals count only from the report's own creator.
    creator_of = {r["key"].lower(): r["creator"].lower() for r in reports}
    withdrawn = {attrs(c)["report_key"].lower() for c in corrections if creator_of.get(attrs(c)["report_key"].lower()) == c["creator"].lower()}
    # One report per (creator, month, item), the earliest; only this outlet's scheme; derived fields recomputed.
    best = {}
    for r in sorted(reports, key=lambda r: (num(r["createdAt"]), r["key"].lower())):
        a = attrs(r)
        if r["key"].lower() in withdrawn or SCHEME_OF.get(a.get("item")) != scheme or a.get("scheme", "pds") != scheme:
            continue
        e, got = a["entitled_g"], a["received_g"]
        if not (0 < e and 0 <= got <= e) or a["shortfall_g"] != e - got or a["shortfall_bp"] != (e - got) * 10000 // e:
            continue
        best.setdefault((r["creator"].lower(), a["month"], a["item"]), (r, a))
    counted = list(best.values())
    # Confirmations: from a different device than the reporter, one per device.
    conf = {}
    for w in witnesses:
        k = attrs(w)["report_key"].lower()
        if creator_of.get(k) and creator_of[k] != w["creator"].lower():
            conf.setdefault(k, set()).add(w["creator"].lower())

    e = sum(a["entitled_g"] for _, a in counted)
    s = sum(a["shortfall_g"] for _, a in counted)
    item = counted[0][1]["item"] if counted else "rice"
    print(f"{shop_id} ({scheme}) {shop['district']}, {shop['state']}: read at block {block}")
    if counted:
        print(f"  shortfall {s * 100 / e:.1f}% ({fmt(item, s)} of {fmt(item, e)}) over {len(counted)} reports from {len({c for c, _, _ in best})} devices")
    for r, a in sorted(counted, key=lambda x: x[1]["month"]):
        print(f"  {a['month']} {a['item']:9} got {fmt(a['item'], a['received_g']):>10} of {fmt(a['item'], a['entitled_g']):>10}"
              f"  confirmations {len(conf.get(r['key'].lower(), ())):2}  by {r['creator']}")
    print(f"  {len(responses)} answer entities on Arkiv; count only those whose $creator holds a dealer attestation for {shop_id} (see schema.md)")


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("shop_id", nargs="?", help="SYN-XX-NNNN")
    p.add_argument("--outlets", action="store_true", help="list every outlet in the registry")
    p.add_argument("--rpc", default=RPC)
    a = p.parse_args()
    if a.outlets or not a.shop_id:
        for sid, s in sorted(outlets(a.rpc).items()):
            print(f"{sid}  {s.get('scheme', 'pds'):5}  {s['state']}  {s['district']}")
    else:
        outlet_report(a.rpc, a.shop_id)
