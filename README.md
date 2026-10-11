# HaorShield

Historical flood classification and agricultural exposure
dashboard for northeastern Bangladesh.

## Components

- React + Vite + Tailwind frontend
- Leaflet historical flood map
- FastAPI classification backend
- Pretrained Random Forest model
- MODIS GFD historical flood overlays
- ESA WorldCover 2021 cropland exposure estimates

## Local development

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:8000
```

## Deploy backend on Render

1. Upload this repository to GitHub.
2. Create a Render Blueprint from `render.yaml`.
3. Wait for deployment.
4. Test `https://YOUR-API.onrender.com/health`.

## Deploy frontend on Cloudflare Pages

1. Connect the GitHub repository.
2. Select the `frontend` root directory.
3. Build command: `npm run build`.
4. Output directory: `dist`.
5. Set environment variable `VITE_API_URL` to the
   deployed Render API URL.
6. Deploy and test the website.

## Scientific limitations

HaorShield performs retrospective flood classification,
not advance forecasting.

Negative classifications mean MODIS flood was not detected,
not that the location was confirmed dry.

Agricultural exposure is estimated using 2021 cropland
distribution and historical MODIS flood detections.
It does not establish crop damage.

The final exported model has no independent held-out
test evaluation.
