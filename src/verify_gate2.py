"""Gate 2 verification: ETL twice (duplicate strategy), validation, SQL SELECT checks."""
import sys

import database
import etl


def check(label: str, ok: bool) -> bool:
    print(f"[{'PASS' if ok else 'FAIL'}] {label}")
    return ok


def main() -> int:
    results = []

    print("== Run 1: ETL ==")
    s1 = etl.run()
    print(f"  total={s1['total']} inserted={s1['inserted']} updated={s1['updated']} rejected={s1['rejected']}")
    print("== Run 2: ETL again (same observation hour) ==")
    s2 = etl.run()
    print(f"  total={s2['total']} inserted={s2['inserted']} updated={s2['updated']} rejected={s2['rejected']}\n")

    conn = database.connect()
    q = lambda sql, *a: conn.execute(sql, a).fetchall()

    # Validation unit checks on synthetic *invalid* input (not weather data; tests rejection only).
    base = {"station_id": "X", "station_name": "X", "county": "臺中市", "obs_time": "2026-09-28T21:00:00+08:00",
            "lat": 24.1, "lon": 120.6, "temperature": 99.0}
    results.append(check("validate: out-of-range temperature → NULL",
                         database.validate(base)[0]["temperature"] is None))
    results.append(check("validate: coordinates outside Taiwan rejected",
                         database.validate({**base, "lat": 35.0})[0] is None))
    results.append(check("validate: missing obs_time rejected",
                         database.validate({**base, "obs_time": None})[0] is None))

    n_st = q("SELECT COUNT(*) FROM stations")[0][0]
    n_latest = q("SELECT COUNT(*) FROM latest_observations")[0][0]
    results.append(check(f"stations stored = {n_st} (API returned {s1['total']}, rejected {s1['rejected']})",
                         n_st == s1["total"] - s1["rejected"] and n_st > 0))
    results.append(check(f"latest_observations view covers every station ({n_latest})", n_latest == n_st))

    dups = q("SELECT station_id, obs_time, COUNT(*) c FROM observations GROUP BY 1,2 HAVING c > 1")
    results.append(check(f"no duplicate (station_id, obs_time) rows ({len(dups)} found)", not dups))
    # A re-run either updates the same hour or, if CWA published a new hour in between, inserts it.
    results.append(check("re-run produced no duplicates (updated or new hour only)",
                         s2["updated"] + s2["inserted"] == s2["total"] - s2["rejected"]))

    print("\n== SQL: 臺中市 (specified region) ==")
    rows = q("""SELECT station_name, town, obs_time, weather, temperature, min_t, max_t, humidity
                FROM latest_observations WHERE county = '臺中市' ORDER BY station_name LIMIT 8""")
    for r in rows:
        print(f"  {r['station_name']:<10}{r['town']:<6}{r['obs_time']}  {r['weather'] or '-':<4}"
              f" T={r['temperature']}  Min={r['min_t']}  Max={r['max_t']}  RH={r['humidity']}")
    results.append(check(f"臺中市 rows present ({len(rows)} shown)", len(rows) > 0))

    print("\n== SQL: multi-region summary ==")
    rows = q("""SELECT county, COUNT(*) n, ROUND(AVG(temperature),1) avg_t,
                       MIN(min_t) low, MAX(max_t) high, MAX(obs_time) latest
                FROM latest_observations GROUP BY county ORDER BY n DESC""")
    for r in rows:
        print(f"  {r['county']:<5} n={r['n']:<3} avgT={r['avg_t']}  low={r['low']}  high={r['high']}  {r['latest']}")
    results.append(check(f"all 22 counties present in DB ({len(rows)})", len(rows) == 22))

    print("\n== SQL: fetch_log ==")
    for r in q("SELECT * FROM fetch_log ORDER BY id DESC LIMIT 3"):
        print(f"  {dict(r)}")

    ok = all(results)
    print(f"\nGATE 2 = {'PASS' if ok else 'FAIL'}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
