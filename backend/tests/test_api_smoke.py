"""Regression test for a real startup-loaded historical classifier."""
import json
import unittest
from pathlib import Path

from fastapi.testclient import TestClient
from backend.main import app

ROOT = Path(__file__).resolve().parents[2]

class BackendSmoke(unittest.TestCase):
    def test_health_prediction_and_cors(self):
        demo = json.loads((ROOT / "frontend/public/data/demo_samples.json").read_text())
        self.assertTrue(demo)
        payload = demo[0]["features"]
        origin = "https://haorshield.pages.dev"
        with TestClient(app) as client:
            status = client.get("/health")
            self.assertEqual(status.status_code, 200)
            self.assertTrue(status.json()["model_loaded"])
            result = client.post("/predict", json=payload, headers={"Origin": origin})
            self.assertEqual(result.status_code, 200, result.text)
            self.assertIn("flood_detection_probability", result.json())
            self.assertEqual(result.headers.get("access-control-allow-origin"), origin)
            preflight = client.options("/predict", headers={
                "Origin": origin,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            })
            self.assertEqual(preflight.status_code, 200)
            self.assertEqual(preflight.headers.get("access-control-allow-origin"), origin)

if __name__ == "__main__":
    unittest.main()
