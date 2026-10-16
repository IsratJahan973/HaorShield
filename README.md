# HaorShield V2

**Experimental flood-concern and agricultural preparedness platform for northeastern Bangladesh.**

**Live website:** https://haorshield.pages.dev  
**Source code:** https://github.com/IsratJahan973/HaorShield

## What a farmer can do

1. Select a supported district or location and check the available 24-, 48- and 72-hour outlooks.
2. See current weather, forecast rainfall amounts and a plain-language **experimental flood-concern screening**.
3. View district maps and, where the current screening indicates increased concern, geographic cells suggested for closer monitoring.
4. Get practical crop-preparedness guidance for Boro, Aman and Aus rice, vegetables and fish ponds, considering the crop stage and observed field conditions.
5. Consult official flood information for safety-critical decisions.

**Supported districts:** Brahmanbaria, Habiganj, Kishoreganj, Moulvibazar, Netrakona, Sunamganj and Sylhet.

## What the system uses

- React, Vite, Tailwind and Leaflet on the frontend; Python/FastAPI backend.
- Open-Meteo weather forecasts and modeled Copernicus GloFAS river-discharge information via Open-Meteo Flood API.
- Experimental geographic screening across 306 cells and ESA WorldCover cropland context.
- GitHub Actions for regenerating/publishing dated forecast and screening files, with freshness checks on the website.

## Important scientific boundary

HaorShield **does not currently provide an independently validated prediction that a specific field will flood**, a calibrated probability of flood occurrence, an official warning, or a modeled flood-depth/inundation footprint. The 24/48/72-hour results are **experimental flood-concern screening** using available forecast information. Nearest modeled river cells may not represent the selected location's river.

The map's blue shading shows mapped areas without a current flagged target under the screening rules; it is **not a guarantee of safety**. Orange shading, when displayed, marks geographic **monitoring candidates**, not land known or certain to flood. The map uses a separate research indicator; its cells and crop-area figures must not be represented as predicted inundation or crop loss. Official FFWC/BWDB guidance takes precedence.

Research-only Random Forest model performance against proxy labels is not valid evidence of public flood-occurrence forecasting accuracy. The independent observational labels and probability calibration necessary for verified FR-06/FR-07 claims remain unavailable. See `docs/COMPETITION_MODEL_RESEARCH_2026-10-16.md` for details.

## Project sections

- **Flood Check:** 24/48/72-hour experimental concern and matching geographic monitoring view.
- **Weather:** current conditions and rainfall outlook.
- **Rain Map:** mapped rainfall information.
- **Crop Advice:** short practical agricultural preparations tailored to crop and field condition.

## Run checks and build locally

From the repository root with a supported Node.js version:

```bash
node --test
cd frontend
npm ci
npm run build
```

Frontend local development:

```bash
cd frontend
npm ci
npm run dev
```

Backend setup (see `backend/requirements.txt`, `render.yaml`):

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

## Deployment

Frontend: Cloudflare Pages (`frontend`, `npm run build`, output `dist`).  
Backend: Render deployment from `render.yaml`.  
Dated spatial data: inspect GitHub Actions results and ensure that the paired spatial map and metadata are published together. A successful job by itself does not establish scientific forecast validation.

## Competition demonstration

See [`docs/COMPETITION_SUBMISSION_2026-10-17.md`](docs/COMPETITION_SUBMISSION_2026-10-17.md) for the suggested demo, tested milestones, limitations and final handover checklist.
