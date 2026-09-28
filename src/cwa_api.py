"""Gate 1 — CWA Open Data API client for O-A0003-001 (現在天氣觀測報告).

Fetches real observation data, validates the HTTP response, and parses the
station records according to the actual response schema.
"""
import json
import os
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

DATASET_ID = "O-A0003-001"
ENDPOINT = f"https://opendata.cwa.gov.tw/api/v1/rest/datastore/{DATASET_ID}"
PROJECT_ROOT = Path(__file__).resolve().parent.parent

# CWA uses these sentinel values for "no data / instrument fault".
MISSING_VALUES = {"-99", "-99.0", "-999", "-999.0", "-9999", "", None}

# All 22 Taiwan counties/cities, used to confirm national coverage.
TAIWAN_COUNTIES = [
    "基隆市", "臺北市", "新北市", "桃園市", "新竹市", "新竹縣", "苗栗縣",
    "臺中市", "彰化縣", "南投縣", "雲林縣", "嘉義市", "嘉義縣", "臺南市",
    "高雄市", "屏東縣", "宜蘭縣", "花蓮縣", "臺東縣", "澎湖縣", "金門縣", "連江縣",
]


def make_ssl_context() -> ssl.SSLContext:
    """Verified TLS context for opendata.cwa.gov.tw.

    Chain and hostname are still fully verified. Python 3.13+ enables
    VERIFY_X509_STRICT by default, which rejects the CWA certificate because it
    lacks a Subject Key Identifier, so only that strict flag is cleared.
    """
    try:
        import certifi
        ctx = ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        ctx = ssl.create_default_context()
    ctx.verify_flags &= ~getattr(ssl, "VERIFY_X509_STRICT", 0)
    return ctx


def load_api_key() -> str:
    """Read CWA_API_KEY from the environment or the project's .env file."""
    key = os.environ.get("CWA_API_KEY")
    env_file = PROJECT_ROOT / ".env"
    if not key and env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            name, _, value = line.strip().partition("=")
            if name == "CWA_API_KEY":
                key = value.strip().strip('"').strip("'")
    if not key:
        raise RuntimeError("CWA_API_KEY not found in environment or .env")
    return key


def mask_key(key: str) -> str:
    return f"****{key[-4:]}"


def http_get(url: str, timeout: int = 30) -> bytes:
    """GET a URL (redirects followed); raise on non-200 without leaking the query string."""
    req = urllib.request.Request(url, headers={"Accept": "*/*"})
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=make_ssl_context()) as resp:
            if resp.status != 200:
                raise RuntimeError(f"HTTP {resp.status} from {urllib.parse.urlsplit(url).path}")
            return resp.read()
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"HTTP {e.code} from {urllib.parse.urlsplit(url).path}") from None


def fetch_datastore(dataset_id: str, api_key: str, timeout: int = 30) -> dict:
    """Fetch a /datastore dataset as JSON and check the API success flag."""
    query = urllib.parse.urlencode({"Authorization": api_key, "format": "JSON"})
    url = f"https://opendata.cwa.gov.tw/api/v1/rest/datastore/{dataset_id}?{query}"
    data = json.loads(http_get(url, timeout))
    if str(data.get("success")).lower() != "true":
        raise RuntimeError(f"CWA API {dataset_id} returned success={data.get('success')}")
    return data


def fetch_observations(api_key: str, timeout: int = 30) -> dict:
    """Send the real HTTP request; raise on non-200 status or API failure."""
    return fetch_datastore(DATASET_ID, api_key, timeout)


# ---- O-A0002-001 自動雨量站 --------------------------------------------------

RAIN_DATASET_ID = "O-A0002-001"


def parse_rain_response(data: dict) -> list[dict]:
    out = []
    for s in data["records"]["Station"]:
        geo = s.get("GeoInfo", {})
        wgs84 = next((c for c in geo.get("Coordinates", []) if c.get("CoordinateName") == "WGS84"), {})
        rain = s.get("RainfallElement", {})
        p = lambda k: _num(rain.get(k, {}).get("Precipitation"))
        out.append({
            "station_id": s.get("StationId"),
            "station_name": s.get("StationName"),
            "county": geo.get("CountyName"),
            "town": geo.get("TownName"),
            "lat": _num(wgs84.get("StationLatitude")),
            "lon": _num(wgs84.get("StationLongitude")),
            "altitude": _num(geo.get("StationAltitude")),
            "obs_time": s.get("ObsTime", {}).get("DateTime"),
            "rain_now": p("Now"),
            "rain_10min": p("Past10Min"),
            "rain_1hr": p("Past1hr"),
            "rain_3hr": p("Past3hr"),
            "rain_24hr": p("Past24hr"),
        })
    return out


# ---- W-C0034-005 熱帶氣旋路徑 ------------------------------------------------

TYPHOON_DATASET_ID = "W-C0034-005"


def parse_typhoon_response(data: dict) -> list[dict]:
    """One dict per cyclone, each with analysis ('past') and forecast points."""
    cyclones = (data["records"].get("TropicalCyclones") or {}).get("TropicalCyclone") or []
    if isinstance(cyclones, dict):
        cyclones = [cyclones]
    out = []
    for c in cyclones:
        key = f"{c.get('Year')}-{c.get('CwaTdNo')}"
        points = []
        for kind, block in (("analysis", "AnalysisData"), ("forecast", "ForecastData")):
            fixes = (c.get(block) or {}).get("Fix") or []
            if isinstance(fixes, dict):
                fixes = [fixes]
            for f in fixes:
                hour = _num(f.get("ForecastHour"))
                base = f.get("DateTime") or f.get("InitialTime")
                points.append({
                    "kind": kind,
                    "time": base,
                    "forecast_hour": int(hour) if hour is not None else 0,
                    "lat": _num(f.get("CoordinateLatitude")),
                    "lon": _num(f.get("CoordinateLongitude")),
                    "max_wind": _num(f.get("MaxWindSpeed")),
                    "max_gust": _num(f.get("MaxGustSpeed")),
                    "pressure": _num(f.get("Pressure")),
                    "moving_speed": _num(f.get("MovingSpeed")),
                    "moving_dir": _text(f.get("MovingDirection")),
                    "r15": _num((f.get("Circle15ms") or {}).get("Radius")),
                    "r25": _num((f.get("Circle25ms") or {}).get("Radius")),
                    "r70": _num(f.get("Radius70PercentProbability")),
                })
        out.append({
            "typhoon_key": key,
            "year": c.get("Year"),
            "name_zh": c.get("CwaTyphoonName"),
            "name_en": c.get("TyphoonName"),
            "td_no": c.get("CwaTdNo"),
            "ty_no": c.get("CwaTyNo"),
            "points": points,
        })
    return out


# ---- O-A0058-003 雷達整合回波圖 ----------------------------------------------

RADAR_DATASET_ID = "O-A0058-003"


def fetch_radar(api_key: str, timeout: int = 60) -> dict:
    """Radar metadata from the file API plus the raw PNG bytes it points to."""
    query = urllib.parse.urlencode({"Authorization": api_key, "downloadType": "WEB", "format": "JSON"})
    meta = json.loads(http_get(
        f"https://opendata.cwa.gov.tw/fileapi/v1/opendataapi/{RADAR_DATASET_ID}?{query}", timeout))
    ds = meta["cwaopendata"]["dataset"]
    params = ds["datasetInfo"]["parameterSet"]
    lon0, lon1 = (float(v) for v in params["LongitudeRange"].split("-"))
    lat0, lat1 = (float(v) for v in params["LatitudeRange"].split("-"))
    url = ds["resource"]["ProductURL"]
    return {
        "obs_time": ds["DateTime"],
        "lat_min": lat0, "lat_max": lat1, "lon_min": lon0, "lon_max": lon1,
        "source_url": url,
        "png": http_get(url, timeout),
    }


def _num(value):
    if value in MISSING_VALUES:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _text(value):
    return None if value in MISSING_VALUES else value


def parse_station(station: dict) -> dict:
    """Flatten one Station record using the real O-A0003-001 structure."""
    geo = station.get("GeoInfo", {})
    wgs84 = next(
        (c for c in geo.get("Coordinates", []) if c.get("CoordinateName") == "WGS84"), {}
    )
    we = station.get("WeatherElement", {})
    extreme = we.get("DailyExtreme", {})
    high = extreme.get("DailyHigh", {}).get("TemperatureInfo", {})
    low = extreme.get("DailyLow", {}).get("TemperatureInfo", {})
    return {
        "station_id": station.get("StationId"),
        "station_name": station.get("StationName"),
        "county": geo.get("CountyName"),
        "town": geo.get("TownName"),
        "lat": _num(wgs84.get("StationLatitude")),
        "lon": _num(wgs84.get("StationLongitude")),
        "altitude": _num(geo.get("StationAltitude")),
        "obs_time": station.get("ObsTime", {}).get("DateTime"),
        "weather": _text(we.get("Weather")),
        "temperature": _num(we.get("AirTemperature")),
        "max_t": _num(high.get("AirTemperature")),
        "max_t_time": high.get("Occurred_at", {}).get("DateTime"),
        "min_t": _num(low.get("AirTemperature")),
        "min_t_time": low.get("Occurred_at", {}).get("DateTime"),
        "humidity": _num(we.get("RelativeHumidity")),
        "wind_speed": _num(we.get("WindSpeed")),
        "wind_direction": _num(we.get("WindDirection")),
        "pressure": _num(we.get("AirPressure")),
        "precipitation": _num(we.get("Now", {}).get("Precipitation")),
        "uv_index": _num(we.get("UVIndex")),
    }


def parse_response(data: dict) -> list[dict]:
    return [parse_station(s) for s in data["records"]["Station"]]


def main() -> int:
    key = load_api_key()
    print(f"Dataset : {DATASET_ID} (現在天氣觀測報告)")
    print(f"Endpoint: {ENDPOINT}")
    print(f"API key : {mask_key(key)}")

    data = fetch_observations(key)
    print("HTTP    : 200 OK, success=true")

    stations = parse_response(data)
    print(f"Stations: {len(stations)}\n")

    # Step 6/7 — verify one region first: 臺中市
    target = "臺中市"
    taichung = [s for s in stations if s["county"] == target]
    if not taichung:
        print(f"FAIL: no stations for {target}")
        return 1
    print(f"== {target}: {len(taichung)} stations ==")
    print(f"{'Location':<14}{'ObsTime':<27}{'Weather':<10}{'Temp':>6}{'MinT':>6}{'MaxT':>6}")
    for s in taichung:
        loc = f"{s['station_name']}({s['town']})"
        fmt = lambda v: "-" if v is None else f"{v:.1f}"
        print(f"{loc:<14}{s['obs_time']:<27}{s['weather'] or '-':<10}"
              f"{fmt(s['temperature']):>6}{fmt(s['min_t']):>6}{fmt(s['max_t']):>6}")
    print("PoP     : not provided by O-A0003-001 (observation dataset) — skipped\n")

    # Step 8 — confirm other Taiwan regions exist
    counts = {c: sum(1 for s in stations if s["county"] == c) for c in TAIWAN_COUNTIES}
    missing = [c for c, n in counts.items() if n == 0]
    print("== County coverage ==")
    for c, n in counts.items():
        print(f"  {c}: {n}")
    if missing:
        print(f"FAIL: missing counties {missing}")
        return 1

    with_coords = sum(1 for s in stations if s["lat"] is not None and s["lon"] is not None)
    print(f"\nStations with WGS84 coords: {with_coords}/{len(stations)}")
    print("\nGATE 1 = PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
