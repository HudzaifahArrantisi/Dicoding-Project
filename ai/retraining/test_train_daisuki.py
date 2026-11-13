"""Check that manual training reads one complete, verified analysis run."""

import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import train_daisuki


class AnalysisSourceTests(unittest.TestCase):
    def test_verified_four_category_run_is_selected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            run = root / "11111111-1111-4111-8111-111111111111"
            run.mkdir()
            hashes = {}
            for name in train_daisuki.ARTIFACTS:
                data = b"[]" if name.endswith(".json") else b"test"
                (run / name).write_bytes(data)
                hashes[name] = hashlib.sha256(data).hexdigest()
            (run / "manifest.json").write_text(json.dumps({
                "run_id": run.name, "schema_version": 1, "sha256": hashes,
            }), encoding="utf-8")
            with patch.object(train_daisuki, "RUNS", root):
                self.assertEqual(train_daisuki.analysis_source(None), run)
                (run / "category_regions.json").write_text("[1]", encoding="utf-8")
                with self.assertRaises(ValueError):
                    train_daisuki.analysis_source(run.name)


if __name__ == "__main__":
    unittest.main()
