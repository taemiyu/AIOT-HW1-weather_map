"""Gate 3 — Taiwan Weather GIS web app.

Serves the Leaflet frontend and a JSON API. Every weather value served here is
read from the SQLite database populated by src/etl.py — never from the CWA API
directly and never mocked.

Run: python app.py  →  http://127.0.0.1:5001
"""
import os
import sys
from pathlib import Path

from flask import Flask, Response, abort, jsonify, send_from_directory

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "src"))
import database  # noqa: E402
import etl  # noqa: E402

app = Flask(__name__, static_folder=str(ROOT / "static"), static_url_path="/static")
app.json.ensure_ascii = False


def rows(sql: str, *args) -> list[dict]:
    with database.connect() as conn:
        return [dict(r) for r in conn.execute(sql, args).fetchall()]


@app.get("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.get("/api/observations")
def observations():
    data = rows("""SELECT station_id, station_name, county, town, lat, lon, altitude, obs_time,
                          weather, temperature, min_t, max_t, humidity, wind_speed, wind_direction,
                          pressure, precipitation, uv_index
                   FROM latest_observations ORDER BY county, station_name""")
    return jsonify({"dataset": "O-A0003-001", "count": len(data),
                    "obs_time": max((r["obs_time"] for r in data), default=None), "stations": data})


@app.get("/api/rain")
def rain():
    data = rows("""SELECT station_id, station_name, county, town, lat, lon, obs_time,
                          rain_now, rain_10min, rain_1hr, rain_3hr, rain_24hr
                   FROM latest_rain ORDER BY county, station_name""")
    return jsonify({"dataset": "O-A0002-001", "count": len(data),
                    "obs_time": max((r["obs_time"] for r in data), default=None), "stations": data})


@app.get("/api/typhoons")
def typhoons():
    storms = rows("SELECT * FROM typhoons WHERE active = 1 ORDER BY typhoon_key")
    for s in storms:
        s["points"] = rows("""SELECT kind, time, forecast_hour, lat, lon, max_wind, max_gust, pressure,
                                     moving_speed, moving_dir, r15, r25, r70
                              FROM typhoon_points WHERE typhoon_key = ?
                              ORDER BY kind, time, forecast_hour""", s["typhoon_key"])
    return jsonify({"dataset": "W-C0034-005", "count": len(storms), "typhoons": storms})


@app.get("/api/radar")
def radar_frames():
    frames = rows("""SELECT obs_time, lat_min, lat_max, lon_min, lon_max
                     FROM radar_frames ORDER BY obs_time""")
    for f in frames:
        f["image_url"] = f"/api/radar/{f['obs_time']}.png"
    return jsonify({"dataset": "O-A0058-003", "count": len(frames), "frames": frames})


@app.get("/api/radar/<obs_time>.png")
def radar_image(obs_time: str):
    found = rows("SELECT image FROM radar_frames WHERE obs_time = ?", obs_time)
    if not found:
        abort(404)
    return Response(found[0]["image"], mimetype="image/png",
                    headers={"Cache-Control": "public, max-age=86400"})


@app.get("/api/meta")
def meta():
    last = rows("""SELECT dataset, MAX(fetched_at) AS fetched_at FROM fetch_log GROUP BY dataset""")
    return jsonify({"last_fetch": {r["dataset"]: r["fetched_at"] for r in last},
                    "refresh_enabled": refresh_enabled()})


def refresh_enabled() -> bool:
    return os.environ.get("ALLOW_REFRESH", "1") == "1"


@app.post("/api/refresh")
def refresh():
    """Run the ETL (CWA → DB). The map then re-reads from the DB."""
    if not refresh_enabled():
        abort(403)
    results = etl.run_all()
    return jsonify({k: {x: v for x, v in r.items() if x != "reasons"} for k, r in results.items()})


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.environ.get("PORT", 5001)), debug=False)
