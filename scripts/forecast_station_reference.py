"""Single source of truth for the 30 virtual gauge stations used across the
whole ingestion/feature-engineering pipeline (ingest_openmeteo_historical.py,
ingest_discharge.py, ingest_gfms.py, build_dataset.py, and every other script
in this folder).

Expanded from an original 6 (Jamuna/Brahmaputra + Surma only) to 25, then to
30, for full-Bangladesh coverage. Sizing rationale: FFWC itself runs
~90-100+ gauges with 54 carrying official danger levels; 25 was chosen as a
practical target that touches every major river system without the
diminishing returns of over-densifying a satellite/reanalysis-based "virtual
gauge" approach, where nearby points on a coarse model grid don't add much
unique signal the way independent physical gauges would. 5 more
(coastal, storm-surge-exposed) were added on top of that to reach 30.

Coordinates are real-town/known-confluence-point approximations, same
caveat as the original 6: "verify against the official FFWC station list"
before treating these as precise gauge locations -- they're accurate enough
for basin-level rainfall/discharge/flood-label extraction, not necessarily
the exact pixel a real gauge sits at.

Previously this station list was duplicated across every ingest_*.py file
(worked around app/'s import not resolving when scripts run directly from
train/, see ingest_discharge.py's old docstring) -- consolidated here once
so adding station #26 later means editing one file, not four.

basin values are used to group stations for two things:
  1. app/data/districts.json-style basin labeling (brahmaputra/ganges/meghna/cht)
  2. which UPSTREAM_BOXES entry build_dataset.py / ingest_openmeteo_historical.py
     use to compute upstream-catchment-mean rainfall for that station
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Station:
    station_id: str
    name: str
    river: str
    lat: float
    lon: float
    basin: str  # "brahmaputra" | "ganges" | "meghna" | "cht"


STATIONS: list[Station] = [
    # --- Jamuna/Brahmaputra mainstem (original 4) ---
    Station("SW90", "Bahadurabad", "Jamuna", 25.1897, 89.6595, "brahmaputra"),
    Station("SW93", "Sariakandi", "Jamuna", 24.8952, 89.5975, "brahmaputra"),
    Station("SW99", "Sirajganj", "Jamuna", 24.4534, 89.7009, "brahmaputra"),
    Station("SW17", "Chilmari", "Brahmaputra", 25.5333, 89.6833, "brahmaputra"),
    # --- Teesta (major northern Brahmaputra tributary, new) ---
    Station("TE01", "Dalia (Teesta Barrage)", "Teesta", 25.9167, 89.2833, "brahmaputra"),
    Station("TE02", "Kaunia", "Teesta", 25.7667, 89.4333, "brahmaputra"),
    # --- Old Brahmaputra + Dharla (new) ---
    Station("OB01", "Mymensingh", "Old Brahmaputra", 24.7471, 90.4203, "brahmaputra"),
    Station("DH01", "Kurigram (Dharla)", "Dharla", 25.8058, 89.6698, "brahmaputra"),
    # --- Ganges/Padma mainstem (new -- previously zero coverage) ---
    Station("GA01", "Hardinge Bridge (Kushtia)", "Ganges", 24.0708, 89.0294, "ganges"),
    Station("GA02", "Goalanda (Jamuna-Ganges confluence)", "Padma", 23.7167, 89.7833, "ganges"),
    Station("GA03", "Mawa", "Padma", 23.4342, 90.2650, "ganges"),
    Station("GA04", "Bhagyakul (Munshiganj)", "Padma", 23.5167, 90.2667, "ganges"),
    # --- Gorai-Madhumati distributary, southwest Bangladesh (new) ---
    Station("GO01", "Kamarkhali (Kushtia)", "Gorai", 23.6333, 89.4500, "ganges"),
    Station("GO02", "Gopalganj", "Madhumati", 23.0167, 89.8265, "ganges"),
    # --- Lower Meghna / Padma-Meghna confluence, covers Dhaka's real
    #     hydrology (new -- this is what was missing for the original
    #     "which station represents Dhaka" question) ---
    Station("ME01", "Chandpur (Padma-Meghna confluence)", "Meghna", 23.2333, 90.6667, "meghna"),
    Station("ME02", "Bhairab Bazar", "Meghna", 24.0500, 90.9833, "meghna"),
    Station("ME03", "Dhaka (Buriganga/Dhaleshwari)", "Dhaleshwari", 23.7000, 90.3667, "meghna"),
    # --- Surma-Kushiyara / upper Meghna, northeast haor basin (2 original + 3 new) ---
    Station("SW267", "Sunamganj", "Surma", 25.0658, 91.3950, "meghna"),
    Station("SW174", "Sylhet", "Surma", 24.8949, 91.8687, "meghna"),
    Station("KU01", "Sherpur (Sylhet)", "Kushiyara", 24.6833, 91.8667, "meghna"),
    Station("KU02", "Amalshid", "Kushiyara", 24.8167, 92.2000, "meghna"),
    Station("NM01", "Durgapur (Netrokona)", "Someshwari", 25.1500, 90.7333, "meghna"),
    # --- Chittagong Hill Tracts: Karnaphuli/Sangu/Halda -- short, flashy,
    #     monsoon-flood-prone rivers, mechanistically different from the
    #     GBM mainstem systems above (new) ---
    Station("CH01", "Rangamati (Karnaphuli)", "Karnaphuli", 22.6333, 92.1833, "cht"),
    Station("CH02", "Bandarban (Sangu)", "Sangu", 22.1953, 92.2183, "cht"),
    Station("CH03", "Chittagong (Halda)", "Halda", 22.5000, 91.8500, "cht"),
    # --- Southern coastal belt (new, 2026-08-07) -- added after research
    # confirmed storm-surge/cyclone flooding is a genuinely distinct 4th
    # flood mechanism in Bangladesh (alongside monsoon river, flash, and
    # local-rainfall flood), concentrated exactly
    # where a lot of brackish-water shrimp/fish aquaculture sits. IMPORTANT
    # CAVEAT, not a full fix: these stations use the SAME feature set as
    # everywhere else (rainfall, soil moisture, GloFAS river discharge, GFMS
    # storage-threshold label) which captures local-rainfall/tidal-river
    # backwater flooding reasonably but does NOT model true storm surge --
    # that needs cyclone track/wind-speed/tide-gauge data this pipeline
    # doesn't have. Real storm-surge prediction is a separate future phase;
    # these 5 give baseline (not complete) coverage for the coastal belt
    # rather than leaving it with zero representation.
    Station("CO01", "Barisal", "Kirtankhola", 22.7010, 90.3535, "ganges"),
    Station("CO02", "Khulna (Rupsha)", "Rupsha", 22.8456, 89.5403, "ganges"),
    Station("CO03", "Bagerhat", "Baleswar", 22.6602, 89.7895, "ganges"),
    Station("CO04", "Patuakhali", "Payra", 22.3596, 90.3296, "ganges"),
    Station("CO05", "Cox's Bazar", "Bakkhali", 21.4272, 92.0058, "cht"),
]

ORIGINAL_6_IDS = {"SW90", "SW93", "SW99", "SW17", "SW267", "SW174"}

# Static per-station terrain features from MERIT Hydro v1.0.1 (Yamazaki et
# al. 2019, via Earth Engine `MERIT/Hydro/v1_0_1`), sampled once at each
# station's lat/lon on 2026-08-09, scale=90m: (elevation_m, hand_m).
# hand_m = "Height Above Nearest Drainage" -- a well-established,
# peer-reviewed flood-susceptibility metric (Nobre et al. 2011): vertical
# distance from a point down to its nearest stream/drainage cell, computed
# via proper hydrological flow-routing by MERIT Hydro's own authors. Chosen
# over manually computing a Topographic Wetness Index (TWI) ourselves --
# TWI needs slope and flow-accumulation area at matching resolutions
# (HydroSHEDS' DEM and flow-accumulation layers are at different native
# resolutions), and getting that resampling subtly wrong would be worse
# than using an already-correct, purpose-built metric for the same idea
# (both aim to capture "how prone is this location to water accumulation,"
# HAND does it more directly for flood risk specifically -- see
#.
#
# MERIT Hydro's `upa` (upstream drainage area) band was ALSO sampled but
# deliberately excluded here: it came back ~0 km2 for most of our stations
# even on major rivers (e.g. SW90/Bahadurabad on the Jamuna) -- our station
# coordinates are real-town approximations, not pixel-exact channel
# centerlines, and `upa` is only meaningful on the exact channel cell,
# unlike `hnd` which stays sensible for a point near-but-not-on the
# channel. Included `elv` (raw elevation) alongside hand_m since it's a
# simple, standard static flood-relevance feature in its own right.
STATIC_TERRAIN: dict[str, tuple[float, float]] = {
    "SW90": (21.2, 3.10), "SW93": (15.4, 2.70), "SW99": (18.1, 1.00), "SW17": (16.4, 1.50),
    "TE01": (35.4, 0.70), "TE02": (31.1, 1.20), "OB01": (18.4, 13.30), "DH01": (23.2, 0.00),
    "GA01": (2.5, 0.00), "GA02": (11.1, 0.50), "GA03": (0.0, 0.00), "GA04": (6.6, 1.00),
    "GO01": (12.3, 12.10), "GO02": (5.2, 0.70), "ME01": (10.5, 0.60), "ME02": (7.7, 0.00),
    "ME03": (4.2, 0.00), "SW267": (12.6, 4.00), "SW174": (19.3, 2.40), "KU01": (9.8, 1.40),
    "KU02": (12.8, 0.00), "NM01": (16.7, 1.80), "CH01": (35.8, 7.80), "CH02": (22.1, 1.40),
    "CH03": (5.0, 0.80), "CO01": (7.3, 0.40), "CO02": (4.8, 0.00), "CO03": (6.7, 0.00),
    "CO04": (4.8, 0.10), "CO05": (10.8, 6.50),
}

# Upstream catchment sample-grid boxes, one per basin (lat_min, lat_max, lon_min, lon_max).
# Coarse, hand-picked engineering approximations (see build_dataset.py's
# module docstring for the same caveat on the original two) -- refined by
# Part 3's travel-time-lag features, not meant to be a precise basin delineation.
UPSTREAM_BOXES: dict[str, tuple[float, float, float, float]] = {
    # Assam valley + Arunachal/China border foothills + Teesta's Sikkim/Bhutan
    # headwaters -- all part of the greater Brahmaputra system upstream of Bangladesh.
    "brahmaputra": (26.0, 29.5, 90.0, 96.0),
    # West Bengal/Bihar, upstream of the Ganges' entry into Bangladesh at Hardinge Bridge.
    "ganges": (24.0, 27.0, 84.0, 89.0),
    # Meghalaya Hills / Barak valley (Cherrapunji/Mawsynram -- among the
    # wettest places on Earth) + Tripura, feeding both Surma/Kushiyara and,
    # further downstream, the lower Meghna near Dhaka/Chandpur.
    "meghna": (24.0, 26.0, 91.5, 93.0),
    # Chittagong Hill Tracts themselves + adjoining Mizoram border hills --
    # short, steep, fast-responding catchments, deliberately a smaller/closer
    # box than the others since travel time here is hours-to-a-day, not days.
    "cht": (21.5, 23.5, 92.0, 93.5),
}


# Upstream INDIA-SIDE discharge reference points -- deliberately a SEPARATE
# list from STATIONS, never merged into it. These are not monitoring points
# of interest in their own right (we have no flood ground truth for India,
# and none of the label sources in this project cover it) -- they exist
# only to supply an upstream discharge FEATURE for specific downstream
# Bangladesh stations. Every loop in this codebase that builds flood labels,
# matches DFO/GFD/GFM events, or serves live predictions iterates STATIONS,
# not this list -- keeping them separate is what prevents an accidental
# flood-label training row for a point where we have no way to know if it
# actually flooded.
#
# Added 2026-08-09 after HaorFloodAlert (github.com/shkoli/HaorFloodAlert,
#) reported ~36h of lead time from monitoring GloFAS
# discharge at Silchar, Assam on the Barak river -- which becomes the
# Surma at Sylhet/Sunamganj and the Kushiyara at Sherpur/Amalshid once it
# crosses into Bangladesh. This is a genuinely different signal from our
# existing rainfall_upstream_mm feature for the same basin (which already
# spatially covers this area via UPSTREAM_BOXES["meghna"], Silchar's
# coordinates fall inside that box) -- discharge integrates the upstream
# catchment's actual hydrological response (routing, infiltration, timing),
# not just raw precipitation, so it is complementary, not redundant.
UPSTREAM_REFERENCE_STATIONS: list[Station] = [
    Station("UP_SILCHAR", "Silchar (India, upstream Barak)", "Barak", 24.8333, 92.7789, "meghna"),
]

# station_id -> (upstream reference station_id, lag_days). Which of our 30
# stations this reference point's discharge is a meaningful leading
# indicator for -- the Surma/Kushiyara stations directly downstream of the
# Barak, plus Bhairab Bazar (ME02) further down the same system. 2-day lag
# is the daily-resolution rounding of HaorFloodAlert's reported ~36h lead
# time (not a hydrologically re-derived travel time of our own -- see
# UPSTREAM_CHAIN in build_features.py for the same caveat on our own
# in-network travel-time lags).
UPSTREAM_REFERENCE_CHAIN: dict[str, tuple[str, int]] = {
    "SW174": ("UP_SILCHAR", 2),  # Sylhet (Surma)
    "SW267": ("UP_SILCHAR", 2),  # Sunamganj (Surma)
    "KU01": ("UP_SILCHAR", 2),   # Sherpur (Kushiyara)
    "KU02": ("UP_SILCHAR", 2),   # Amalshid (Kushiyara) -- closest of the 4 to Silchar, 2-day lag kept for consistency
    "ME02": ("UP_SILCHAR", 3),   # Bhairab Bazar -- one step further downstream than the other 3
}


def upstream_points(basin: str, n: int = 3) -> list[tuple[float, float]]:
    """n x n sample grid across a basin's upstream box, used as a coarse
    area-mean approximation (no true raster/area-integral available from a
    point API) -- see ingest_openmeteo_historical.py."""
    lat_min, lat_max, lon_min, lon_max = UPSTREAM_BOXES[basin]
    lats = [lat_min + i * (lat_max - lat_min) / (n - 1) for i in range(n)]
    lons = [lon_min + j * (lon_max - lon_min) / (n - 1) for j in range(n)]
    return [(lat, lon) for lat in lats for lon in lons]
