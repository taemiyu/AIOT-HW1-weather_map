"""Gate 3 verification: the GIS API serves exactly what is in SQLite (no mock data).

Uses Flask's test client, so no server needs to be running.
"""
import io
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "src"))

from PIL import Image  # noqa: E402

import database  # noqa: E402
from app import app  # noqa: E402


def check(label: str, ok: bool) -> bool:
    print(f"[{'PASS' if ok else 'FAIL'}] {label}")
    return ok


def main() -> int:
    client = app.test_client()
    conn = database.connect()
    q = lambda sql, *a: conn.execute(sql, a).fetchall()
    results = []

    # 3A — map page and Leaflet assets
    r = client.get("/")
    html = r.get_data(as_text=True)
    results.append(check("3A index.html served with Leaflet", r.status_code == 200 and "leaflet" in html))
    for asset in ("/static/app.js", "/static/i18n.js", "/static/style.css"):
        results.append(check(f"3A asset {asset}", client.get(asset).status_code == 200))

    # 3B/3C — one marker + popup data: 臺中 station, API value == DB value
    obs = client.get("/api/observations").get_json()
    api_tc = next(s for s in obs["stations"] if s["station_id"] == "467490")
    db_tc = dict(q("SELECT * FROM latest_observations WHERE station_id = '467490'")[0])
    same = all(api_tc[k] == db_tc[k] for k in ("temperature", "min_t", "max_t", "weather", "obs_time", "lat", "lon"))
    results.append(check(f"3B/3C 臺中 marker data matches DB (T={api_tc['temperature']} {api_tc['weather']} "
                         f"@ {api_tc['obs_time']})", same))

    # 3D — all Taiwan locations
    n_db = q("SELECT COUNT(*) FROM latest_observations")[0][0]
    counties = {s["county"] for s in obs["stations"]}
    results.append(check(f"3D all stations served ({obs['count']} API / {n_db} DB)", obs["count"] == n_db == 363))
    results.append(check(f"3D all 22 counties represented ({len(counties)})", len(counties) == 22))

    # 3E — Database → GIS for every layer
    rain = client.get("/api/rain").get_json()
    results.append(check(f"3E rain layer from DB ({rain['count']} gauges)",
                         rain["count"] == q("SELECT COUNT(*) FROM latest_rain")[0][0] > 0))
    ty = client.get("/api/typhoons").get_json()
    n_ty = q("SELECT COUNT(*) FROM typhoons WHERE active = 1")[0][0]
    results.append(check(f"3E typhoon layer from DB ({ty['count']} active: "
                         f"{', '.join(t['name_zh'] + '/' + t['name_en'] for t in ty['typhoons']) or 'none'})",
                         ty["count"] == n_ty and all(t["points"] for t in ty["typhoons"])))
    radar = client.get("/api/radar").get_json()
    results.append(check(f"3E radar frames from DB ({radar['count']})",
                         radar["count"] == q("SELECT COUNT(*) FROM radar_frames")[0][0] > 0))
    img = client.get(radar["frames"][-1]["image_url"])
    im = Image.open(io.BytesIO(img.data))
    alpha = im.getchannel("A")
    results.append(check(f"3E radar overlay is transparent PNG {im.size} {im.mode}",
                         img.status_code == 200 and im.mode == "RGBA" and alpha.getextrema()[0] == 0))

    # 3F — Taiwan GeoJSON
    gj = json.loads(client.get("/static/data/taiwan_counties.geojson").get_data(as_text=True))
    gj_names = {f["properties"]["name"] for f in gj["features"]}
    db_names = {r[0] for r in q("SELECT DISTINCT county FROM stations")}
    results.append(check(f"3F GeoJSON has 22 counties matching DB names", len(gj_names) == 22 and gj_names == db_names))

    # 3G — dashboard features present
    js = client.get("/static/app.js").get_data(as_text=True)
    i18n = client.get("/static/i18n.js").get_data(as_text=True)
    for feature, needle in [("layer switcher (7 layers)", 'id: "weather"'), ("3 basemaps", "dark: ["),
                            ("geolocation", "map.locate"), ("county filter", "setCounty"),
                            ("station search", "searchResults"), ("refresh via ETL", "/api/refresh")]:
        results.append(check(f"3G {feature}", needle in js))
    results.append(check("3G languages zh-TW/en/ja/ko", all(f'"{k}"' in i18n or f"{k}:" in i18n
                                                             for k in ("zh-TW", "en", "ja", "ko"))))

    ok = all(results)
    print(f"\nGATE 3 = {'PASS' if ok else 'FAIL'}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
