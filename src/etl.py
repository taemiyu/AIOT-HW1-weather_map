"""ETL: real CWA responses → validated → SQLite.

Datasets: O-A0003-001 (observations), O-A0002-001 (rain gauges),
W-C0034-005 (tropical cyclones), O-A0058-003 (radar composite).

Usage: python src/etl.py            # all datasets
       python src/etl.py obs rain   # a subset
"""
import json
import sys
from datetime import datetime

import cwa_api
import database
import radar


def _save_raw(dataset_id: str, data: dict) -> None:
    """Keep the raw response for traceability (data/raw/ is gitignored)."""
    raw_dir = database.PROJECT_ROOT / "data" / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%dT%H%M%S")
    (raw_dir / f"{dataset_id}_{stamp}.json").write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")


def run() -> dict:
    """O-A0003-001 weather observations."""
    data = cwa_api.fetch_observations(cwa_api.load_api_key())
    _save_raw(cwa_api.DATASET_ID, data)
    records = cwa_api.parse_response(data)
    with database.connect() as conn:
        return database.upsert(conn, records, cwa_api.DATASET_ID)


def run_rain() -> dict:
    data = cwa_api.fetch_datastore(cwa_api.RAIN_DATASET_ID, cwa_api.load_api_key())
    _save_raw(cwa_api.RAIN_DATASET_ID, data)
    with database.connect() as conn:
        return database.upsert_rain(conn, cwa_api.parse_rain_response(data), cwa_api.RAIN_DATASET_ID)


def run_typhoon() -> dict:
    data = cwa_api.fetch_datastore(cwa_api.TYPHOON_DATASET_ID, cwa_api.load_api_key())
    _save_raw(cwa_api.TYPHOON_DATASET_ID, data)
    with database.connect() as conn:
        return database.upsert_typhoons(conn, cwa_api.parse_typhoon_response(data), cwa_api.TYPHOON_DATASET_ID)


def run_radar() -> dict:
    frame = cwa_api.fetch_radar(cwa_api.load_api_key())
    image = radar.to_overlay(frame.pop("png"), frame["lat_min"], frame["lat_max"])
    with database.connect() as conn:
        return database.upsert_radar(conn, frame, image, cwa_api.RADAR_DATASET_ID)


JOBS = {"obs": run, "rain": run_rain, "typhoon": run_typhoon, "radar": run_radar}


def run_all(names: list[str] | None = None) -> dict:
    results = {}
    for name in names or JOBS:
        try:
            results[name] = JOBS[name]()
        except Exception as e:  # one dataset failing must not block the others
            results[name] = {"error": str(e)}
    return results


if __name__ == "__main__":
    ok = True
    for name, stats in run_all(sys.argv[1:] or None).items():
        if "error" in stats:
            ok = False
            print(f"[{name}] ERROR {stats['error']}")
            continue
        print(f"[{name}] total={stats['total']} inserted={stats['inserted']} "
              f"updated={stats['updated']} rejected={stats['rejected']}")
        for sid, reason in stats["reasons"]:
            print(f"  rejected {sid}: {reason}")
    sys.exit(0 if ok else 1)
