"""Gate 2 — SQLite schema, validation, and upsert for CWA O-A0003-001 observations.

Duplicate strategy: one observation row per (station_id, obs_time). Re-fetching
the same observation hour updates that row instead of inserting a duplicate.
Station metadata lives in its own table and is upserted by station_id.
"""
import os
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DB_PATH = Path(os.environ.get("WEATHER_DB_PATH", PROJECT_ROOT / "data" / "weather.db"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS stations (
    station_id   TEXT PRIMARY KEY,
    station_name TEXT NOT NULL,
    county       TEXT NOT NULL,
    town         TEXT,
    lat          REAL NOT NULL,
    lon          REAL NOT NULL,
    altitude     REAL,
    updated_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS observations (
    station_id     TEXT NOT NULL REFERENCES stations(station_id),
    obs_time       TEXT NOT NULL,
    weather        TEXT,
    temperature    REAL,
    min_t          REAL,
    min_t_time     TEXT,
    max_t          REAL,
    max_t_time     TEXT,
    humidity       REAL,
    wind_speed     REAL,
    wind_direction REAL,
    pressure       REAL,
    precipitation  REAL,
    uv_index       REAL,
    fetched_at     TEXT NOT NULL,
    PRIMARY KEY (station_id, obs_time)
);

CREATE INDEX IF NOT EXISTS idx_obs_time ON observations(obs_time);
CREATE INDEX IF NOT EXISTS idx_station_county ON stations(county);

CREATE TABLE IF NOT EXISTS fetch_log (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    fetched_at    TEXT NOT NULL,
    dataset       TEXT NOT NULL,
    total         INTEGER NOT NULL,
    inserted      INTEGER NOT NULL,
    updated       INTEGER NOT NULL,
    rejected      INTEGER NOT NULL
);

-- O-A0002-001 rain gauges: a separate, denser station network.
CREATE TABLE IF NOT EXISTS rain_stations (
    station_id   TEXT PRIMARY KEY,
    station_name TEXT NOT NULL,
    county       TEXT NOT NULL,
    town         TEXT,
    lat          REAL NOT NULL,
    lon          REAL NOT NULL,
    altitude     REAL,
    updated_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rain_observations (
    station_id  TEXT NOT NULL REFERENCES rain_stations(station_id),
    obs_time    TEXT NOT NULL,
    rain_now    REAL,
    rain_10min  REAL,
    rain_1hr    REAL,
    rain_3hr    REAL,
    rain_24hr   REAL,
    fetched_at  TEXT NOT NULL,
    PRIMARY KEY (station_id, obs_time)
);

CREATE VIEW IF NOT EXISTS latest_rain AS
SELECT s.*, r.obs_time, r.rain_now, r.rain_10min, r.rain_1hr, r.rain_3hr, r.rain_24hr
FROM rain_stations s
JOIN rain_observations r ON r.station_id = s.station_id
WHERE r.obs_time = (SELECT MAX(obs_time) FROM rain_observations WHERE station_id = s.station_id);

-- W-C0034-005 tropical cyclones. Forecast points are replaced on each fetch
-- (only the newest forecast issuance matters); analysis fixes are upserted.
CREATE TABLE IF NOT EXISTS typhoons (
    typhoon_key TEXT PRIMARY KEY,
    year        TEXT,
    name_zh     TEXT,
    name_en     TEXT,
    td_no       TEXT,
    ty_no       TEXT,
    active      INTEGER NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS typhoon_points (
    typhoon_key   TEXT NOT NULL REFERENCES typhoons(typhoon_key),
    kind          TEXT NOT NULL CHECK (kind IN ('analysis', 'forecast')),
    time          TEXT NOT NULL,
    forecast_hour INTEGER NOT NULL DEFAULT 0,
    lat           REAL NOT NULL,
    lon           REAL NOT NULL,
    max_wind      REAL,
    max_gust      REAL,
    pressure      REAL,
    moving_speed  REAL,
    moving_dir    TEXT,
    r15           REAL,
    r25           REAL,
    r70           REAL,
    PRIMARY KEY (typhoon_key, kind, time, forecast_hour)
);

-- O-A0058-003 radar frames, stored as processed transparent PNG overlays.
CREATE TABLE IF NOT EXISTS radar_frames (
    obs_time   TEXT PRIMARY KEY,
    lat_min    REAL NOT NULL,
    lat_max    REAL NOT NULL,
    lon_min    REAL NOT NULL,
    lon_max    REAL NOT NULL,
    source_url TEXT NOT NULL,
    image      BLOB NOT NULL,
    fetched_at TEXT NOT NULL
);

-- Latest observation per station: what the GIS layer reads.
CREATE VIEW IF NOT EXISTS latest_observations AS
SELECT s.*, o.obs_time, o.weather, o.temperature, o.min_t, o.max_t,
       o.humidity, o.wind_speed, o.wind_direction, o.pressure,
       o.precipitation, o.uv_index
FROM stations s
JOIN observations o ON o.station_id = s.station_id
WHERE o.obs_time = (
    SELECT MAX(obs_time) FROM observations WHERE station_id = s.station_id
);
"""

# Bounding box covering Taiwan main island, Penghu, Kinmen, Matsu, and the
# CWA stations on Dongsha (東沙, ~20.7N 116.7E) and Taiping Island (南沙, ~10.4N 114.4E).
LAT_RANGE = (10.0, 26.5)
LON_RANGE = (114.0, 122.1)

# Plausible physical ranges; values outside are treated as invalid (set NULL).
VALUE_RANGES = {
    "temperature": (-20, 45),
    "min_t": (-20, 45),
    "max_t": (-20, 45),
    "humidity": (0, 100),
    "wind_speed": (0, 90),
    "wind_direction": (0, 360),
    "pressure": (500, 1100),
    "precipitation": (0, 1000),
    "uv_index": (0, 20),
}


def connect(path: Path = DB_PATH) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript(SCHEMA)
    return conn


def validate(rec: dict) -> tuple[dict | None, str | None]:
    """Return (cleaned record, None) or (None, rejection reason)."""
    for field in ("station_id", "station_name", "county", "obs_time"):
        if not rec.get(field):
            return None, f"missing {field}"
    try:
        datetime.fromisoformat(rec["obs_time"])
    except ValueError:
        return None, f"bad obs_time {rec['obs_time']!r}"
    lat, lon = rec.get("lat"), rec.get("lon")
    if lat is None or lon is None:
        return None, "missing coordinates"
    if not (LAT_RANGE[0] <= lat <= LAT_RANGE[1] and LON_RANGE[0] <= lon <= LON_RANGE[1]):
        return None, f"coordinates outside Taiwan ({lat}, {lon})"

    cleaned = dict(rec)
    for field, (lo, hi) in VALUE_RANGES.items():
        v = cleaned.get(field)
        if v is not None and not (lo <= v <= hi):
            cleaned[field] = None
    return cleaned, None


def upsert(conn: sqlite3.Connection, records: list[dict], dataset: str) -> dict:
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    stats = {"total": len(records), "inserted": 0, "updated": 0, "rejected": 0, "reasons": []}

    with conn:
        for rec in records:
            clean, reason = validate(rec)
            if clean is None:
                stats["rejected"] += 1
                stats["reasons"].append((rec.get("station_id"), reason))
                continue

            conn.execute(
                """INSERT INTO stations (station_id, station_name, county, town, lat, lon, altitude, updated_at)
                   VALUES (:station_id, :station_name, :county, :town, :lat, :lon, :altitude, :now)
                   ON CONFLICT(station_id) DO UPDATE SET
                     station_name=excluded.station_name, county=excluded.county, town=excluded.town,
                     lat=excluded.lat, lon=excluded.lon, altitude=excluded.altitude,
                     updated_at=excluded.updated_at""",
                {**clean, "now": now},
            )

            exists = conn.execute(
                "SELECT 1 FROM observations WHERE station_id=? AND obs_time=?",
                (clean["station_id"], clean["obs_time"]),
            ).fetchone()
            conn.execute(
                """INSERT INTO observations (station_id, obs_time, weather, temperature, min_t, min_t_time,
                     max_t, max_t_time, humidity, wind_speed, wind_direction, pressure, precipitation,
                     uv_index, fetched_at)
                   VALUES (:station_id, :obs_time, :weather, :temperature, :min_t, :min_t_time,
                     :max_t, :max_t_time, :humidity, :wind_speed, :wind_direction, :pressure,
                     :precipitation, :uv_index, :now)
                   ON CONFLICT(station_id, obs_time) DO UPDATE SET
                     weather=excluded.weather, temperature=excluded.temperature,
                     min_t=excluded.min_t, min_t_time=excluded.min_t_time,
                     max_t=excluded.max_t, max_t_time=excluded.max_t_time,
                     humidity=excluded.humidity, wind_speed=excluded.wind_speed,
                     wind_direction=excluded.wind_direction, pressure=excluded.pressure,
                     precipitation=excluded.precipitation, uv_index=excluded.uv_index,
                     fetched_at=excluded.fetched_at""",
                {**clean, "now": now},
            )
            stats["updated" if exists else "inserted"] += 1

        _log(conn, now, dataset, stats)
    return stats


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _log(conn: sqlite3.Connection, now: str, dataset: str, stats: dict) -> None:
    conn.execute(
        "INSERT INTO fetch_log (fetched_at, dataset, total, inserted, updated, rejected) VALUES (?,?,?,?,?,?)",
        (now, dataset, stats["total"], stats["inserted"], stats["updated"], stats["rejected"]),
    )


def _validate_station(rec: dict) -> str | None:
    for field in ("station_id", "station_name", "county", "obs_time"):
        if not rec.get(field):
            return f"missing {field}"
    try:
        datetime.fromisoformat(rec["obs_time"])
    except ValueError:
        return f"bad obs_time {rec['obs_time']!r}"
    lat, lon = rec.get("lat"), rec.get("lon")
    if lat is None or lon is None:
        return "missing coordinates"
    if not (LAT_RANGE[0] <= lat <= LAT_RANGE[1] and LON_RANGE[0] <= lon <= LON_RANGE[1]):
        return f"coordinates outside Taiwan ({lat}, {lon})"
    return None


RAIN_FIELDS = ("rain_now", "rain_10min", "rain_1hr", "rain_3hr", "rain_24hr")


def upsert_rain(conn: sqlite3.Connection, records: list[dict], dataset: str) -> dict:
    now = _now()
    stats = {"total": len(records), "inserted": 0, "updated": 0, "rejected": 0, "reasons": []}
    with conn:
        for rec in records:
            reason = _validate_station(rec)
            if reason:
                stats["rejected"] += 1
                stats["reasons"].append((rec.get("station_id"), reason))
                continue
            clean = dict(rec)
            for f in RAIN_FIELDS:  # negative / absurd totals are instrument codes, not rain
                if clean[f] is not None and not (0 <= clean[f] <= 3000):
                    clean[f] = None
            conn.execute(
                """INSERT INTO rain_stations (station_id, station_name, county, town, lat, lon, altitude, updated_at)
                   VALUES (:station_id, :station_name, :county, :town, :lat, :lon, :altitude, :now)
                   ON CONFLICT(station_id) DO UPDATE SET
                     station_name=excluded.station_name, county=excluded.county, town=excluded.town,
                     lat=excluded.lat, lon=excluded.lon, altitude=excluded.altitude,
                     updated_at=excluded.updated_at""",
                {**clean, "now": now},
            )
            exists = conn.execute(
                "SELECT 1 FROM rain_observations WHERE station_id=? AND obs_time=?",
                (clean["station_id"], clean["obs_time"]),
            ).fetchone()
            conn.execute(
                """INSERT INTO rain_observations (station_id, obs_time, rain_now, rain_10min, rain_1hr,
                     rain_3hr, rain_24hr, fetched_at)
                   VALUES (:station_id, :obs_time, :rain_now, :rain_10min, :rain_1hr, :rain_3hr,
                     :rain_24hr, :now)
                   ON CONFLICT(station_id, obs_time) DO UPDATE SET
                     rain_now=excluded.rain_now, rain_10min=excluded.rain_10min,
                     rain_1hr=excluded.rain_1hr, rain_3hr=excluded.rain_3hr,
                     rain_24hr=excluded.rain_24hr, fetched_at=excluded.fetched_at""",
                {**clean, "now": now},
            )
            stats["updated" if exists else "inserted"] += 1
        _log(conn, now, dataset, stats)
    return stats


def upsert_typhoons(conn: sqlite3.Connection, cyclones: list[dict], dataset: str) -> dict:
    now = _now()
    stats = {"total": 0, "inserted": 0, "updated": 0, "rejected": 0, "reasons": []}
    with conn:
        # Anything not in this response is no longer active.
        conn.execute("UPDATE typhoons SET active = 0")
        for c in cyclones:
            conn.execute(
                """INSERT INTO typhoons (typhoon_key, year, name_zh, name_en, td_no, ty_no, active, updated_at)
                   VALUES (:typhoon_key, :year, :name_zh, :name_en, :td_no, :ty_no, 1, :now)
                   ON CONFLICT(typhoon_key) DO UPDATE SET
                     name_zh=excluded.name_zh, name_en=excluded.name_en, ty_no=excluded.ty_no,
                     active=1, updated_at=excluded.updated_at""",
                {**c, "now": now},
            )
            conn.execute("DELETE FROM typhoon_points WHERE typhoon_key=? AND kind='forecast'",
                         (c["typhoon_key"],))
            for p in c["points"]:
                stats["total"] += 1
                if p["lat"] is None or p["lon"] is None or not p["time"]:
                    stats["rejected"] += 1
                    stats["reasons"].append((c["typhoon_key"], "point missing time/coordinates"))
                    continue
                exists = conn.execute(
                    """SELECT 1 FROM typhoon_points
                       WHERE typhoon_key=? AND kind=? AND time=? AND forecast_hour=?""",
                    (c["typhoon_key"], p["kind"], p["time"], p["forecast_hour"]),
                ).fetchone()
                conn.execute(
                    """INSERT OR REPLACE INTO typhoon_points (typhoon_key, kind, time, forecast_hour, lat, lon,
                         max_wind, max_gust, pressure, moving_speed, moving_dir, r15, r25, r70)
                       VALUES (:typhoon_key, :kind, :time, :forecast_hour, :lat, :lon, :max_wind,
                         :max_gust, :pressure, :moving_speed, :moving_dir, :r15, :r25, :r70)""",
                    {**p, "typhoon_key": c["typhoon_key"]},
                )
                stats["updated" if exists else "inserted"] += 1
        _log(conn, now, dataset, stats)
    return stats


RADAR_KEEP_FRAMES = 12


def upsert_radar(conn: sqlite3.Connection, frame: dict, image: bytes, dataset: str) -> dict:
    now = _now()
    datetime.fromisoformat(frame["obs_time"])  # validate timestamp
    with conn:
        exists = conn.execute("SELECT 1 FROM radar_frames WHERE obs_time=?", (frame["obs_time"],)).fetchone()
        conn.execute(
            """INSERT OR REPLACE INTO radar_frames
                 (obs_time, lat_min, lat_max, lon_min, lon_max, source_url, image, fetched_at)
               VALUES (:obs_time, :lat_min, :lat_max, :lon_min, :lon_max, :source_url, :image, :now)""",
            {**frame, "image": image, "now": now},
        )
        # Keep only the newest frames so the DB stays small.
        conn.execute(
            """DELETE FROM radar_frames WHERE obs_time NOT IN
                 (SELECT obs_time FROM radar_frames ORDER BY obs_time DESC LIMIT ?)""",
            (RADAR_KEEP_FRAMES,),
        )
        stats = {"total": 1, "inserted": 0 if exists else 1, "updated": 1 if exists else 0,
                 "rejected": 0, "reasons": []}
        _log(conn, now, dataset, stats)
    return stats


def prune(conn: sqlite3.Connection, keep_hours: int = 24) -> dict:
    """Drop observations older than keep_hours before the newest one, and stale typhoons.

    Keeps the database small enough to publish on every ETL run.
    """
    removed = {}
    with conn:
        for table in ("observations", "rain_observations"):
            newest = conn.execute(f"SELECT MAX(obs_time) FROM {table}").fetchone()[0]
            if not newest:
                continue
            cutoff = (datetime.fromisoformat(newest) - timedelta(hours=keep_hours)).isoformat()
            removed[table] = conn.execute(f"DELETE FROM {table} WHERE obs_time < ?", (cutoff,)).rowcount
        week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat(timespec="seconds")
        stale = [r[0] for r in conn.execute(
            "SELECT typhoon_key FROM typhoons WHERE active = 0 AND updated_at < ?", (week_ago,))]
        for key in stale:
            conn.execute("DELETE FROM typhoon_points WHERE typhoon_key = ?", (key,))
            conn.execute("DELETE FROM typhoons WHERE typhoon_key = ?", (key,))
        removed["typhoons"] = len(stale)
        conn.execute("DELETE FROM fetch_log WHERE id NOT IN (SELECT id FROM fetch_log ORDER BY id DESC LIMIT 500)")
    conn.execute("VACUUM")
    return removed
