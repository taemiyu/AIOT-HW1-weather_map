"""Convert taiwan-atlas county TopoJSON (MIT, Daniel Kao) into static GeoJSON.

Usage: python tools/build_geojson.py <counties-10t.json> static/data/taiwan_counties.geojson
Source: https://cdn.jsdelivr.net/npm/taiwan-atlas@2021.9.20/counties-10t.json
"""
import json
import sys


def decode_arcs(topo: dict) -> list[list[list[float]]]:
    sx, sy = topo["transform"]["scale"]
    tx, ty = topo["transform"]["translate"]
    arcs = []
    for arc in topo["arcs"]:
        x = y = 0
        pts = []
        for dx, dy in arc:  # delta-encoded quantized coordinates
            x += dx
            y += dy
            pts.append([round(x * sx + tx, 6), round(y * sy + ty, 6)])
        arcs.append(pts)
    return arcs


def ring(arcs: list, indexes: list[int]) -> list[list[float]]:
    out = []
    for i in indexes:
        pts = arcs[i] if i >= 0 else arcs[~i][::-1]
        out.extend(pts if not out else pts[1:])
    return out


def main(src: str, dst: str) -> None:
    topo = json.load(open(src, encoding="utf-8"))
    arcs = decode_arcs(topo)
    features = []
    for g in topo["objects"]["counties"]["geometries"]:
        if g["type"] == "Polygon":
            geom = {"type": "Polygon", "coordinates": [ring(arcs, r) for r in g["arcs"]]}
        else:
            geom = {"type": "MultiPolygon",
                    "coordinates": [[ring(arcs, r) for r in poly] for poly in g["arcs"]]}
        p = g["properties"]
        features.append({"type": "Feature",
                         # CWA spells counties with 臺; normalize so names join with the DB.
                         "properties": {"name": p["COUNTYNAME"].replace("台", "臺"),
                                        "name_en": p["COUNTYENG"],
                                        "code": p["COUNTYCODE"]},
                         "geometry": geom})
    fc = {"type": "FeatureCollection",
          "source": "taiwan-atlas@2021.9.20 counties-10t (MIT License, Daniel Kao)",
          "features": features}
    with open(dst, "w", encoding="utf-8") as f:
        json.dump(fc, f, ensure_ascii=False, separators=(",", ":"))
    print(f"wrote {len(features)} counties → {dst}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
