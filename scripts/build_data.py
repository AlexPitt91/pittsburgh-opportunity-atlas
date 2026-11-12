"""Build a static atlas snapshot from the official report and City GeoJSON."""
import json
import math
from pathlib import Path
import re
import subprocess
from tempfile import TemporaryDirectory
from urllib.request import urlretrieve

REPORT = "https://www.ucsur.pitt.edu/sites/default/files/Census%20Reports/UCSUR_Profiles_of_Change_20142024_March2026.pdf"
BOUNDARIES = "https://data.wprdc.org/dataset/e672f13d-71c4-4a66-8f38-710e75ed80a4/resource/4af8e160-57e9-4ebf-a501-76ca1b42fc99/download/neighborhoods.geojson"
ROWS = {
    "poverty": "Under 100% of Poverty Threshold",
    "transit": "Public Transportation",
    "renters": "Renter-Occupied",
    "education": "Bachelor's Degree or Higher",
}
GROUPS = [
    ["Allegheny Center", "Allegheny West"],
    ["Arlington", "Arlington Heights", "Mt. Oliver", "St. Clair"],
    ["Beltzhoover", "Bon Air"],
    ["Central Business District", "Crawford-Roberts"],
    ["East Allegheny", "North Shore"],
    ["East Carnegie", "Oakwood"],
    ["Esplen", "Sheraden", "Chartiers City", "Windgap", "Fairywood"],
    ["Hazelwood", "Glen Hazel", "New Homestead", "Hays"],
    ["Homewood North", "Homewood West"],
    ["Manchester", "California-Kirkbride"],
    ["Northview Heights", "Summer Hill"],
    ["Point Breeze", "Regent Square"],
    ["Terrace Village", "West Oakland"],
    ["Troy Hill", "Spring Garden"],
    ["West End", "Elliott"],
    ["Westwood", "Ridgemont"],
]
NO_PROFILE = {"Chateau", "South Shore"}


def profile(page):
    result = {}
    for metric, label in ROWS.items():
        row, = re.findall(r"^\s*" + re.escape(label) + r"\s{2,}(.+)$", page, re.M)
        older, latest, *_ = re.findall(r"[+-]?\d+(?:\.\d+)?%", row)
        result[metric] = [float(older[:-1]), float(latest[:-1])]
        if not all(0 <= value <= 100 for value in result[metric]):
            raise ValueError((metric, row))
    return result


def map_path(geometry):
    polygons = geometry["coordinates"]
    if geometry["type"] == "Polygon":
        polygons = [polygons]
    elif geometry["type"] != "MultiPolygon":
        raise ValueError(geometry["type"])
    parts = []
    for polygon in polygons:
        for ring in polygon:
            points = [(round((lon + 80.11) * 5600 * math.cos(math.radians(40.44)), 1),
                       round((40.51 - lat) * 5600, 1)) for lon, lat in ring]
            parts.append("M" + "L".join(f"{x},{y}" for x, y in points) + "Z")
    return "".join(parts)


def build(pdf, geojson):
    pages = subprocess.check_output(["pdftotext", "-layout", str(pdf), "-"], text=True).split("\f")
    features = json.loads(Path(geojson).read_text())["features"]
    names = {feature["properties"]["hood"] for feature in features}
    grouped = {name for group in GROUPS for name in group}
    groups = GROUPS + [[name] for name in sorted(names - grouped - NO_PROFILE)]
    lookup = {}
    profiles = {}
    for page in pages:
        if "Under 100% of Poverty Threshold" not in page:
            continue
        header = page.split("Occupancy Status", 1)[0]
        if re.search(r"^\s*City of Pittsburgh\s{2,}", header, re.M):
            profiles["city"] = profile(page)
            continue
        match = [group for group in groups if re.search(r"^\s*" + re.escape(group[0]) +
                 r"(?=\s{2,}|\s*[-–]|\s*$)", header, re.M)]
        if not match:
            continue
        group, = match
        key = group[0]
        if key in profiles:
            raise ValueError(f"Duplicate profile for {key}")
        profiles[key] = profile(page)
        lookup.update(dict.fromkeys(group, key))
    if set(lookup) != names - NO_PROFILE or len(profiles) != len(groups) + 1:
        raise ValueError(f"Incomplete coverage: {sorted(names - NO_PROFILE - lookup.keys())}")
    return {
        "city": profiles.pop("city"),
        "areas": [{"id": group[0], "names": group, "values": profiles[group[0]]} for group in groups],
        "shapes": [{"name": feature["properties"]["hood"], "area": lookup.get(feature["properties"]["hood"]),
                    "path": map_path(feature["geometry"])} for feature in features],
    }


if __name__ == "__main__":
    with TemporaryDirectory() as directory:
        pdf = Path(directory) / "profiles.pdf"
        geojson = Path(directory) / "neighborhoods.geojson"
        urlretrieve(REPORT, pdf)
        urlretrieve(BOUNDARIES, geojson)
        output = build(pdf, geojson)
        target = Path(__file__).resolve().parents[1] / "dist" / "atlas.json"
        target.write_text(json.dumps(output, separators=(",", ":"), ensure_ascii=False) + "\n")
