"""Check that manual training reads one complete, verified analysis run."""

import hashlib
import json
import tempfile
import unittest
import sys
from pathlib import Path
from unittest.mock import patch

import train
from knowledge_index import build_raw_reference_index, list_raw_references


class AnalysisSourceTests(unittest.TestCase):
    def test_verified_four_category_run_is_selected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            run = root / "11111111-1111-4111-8111-111111111111"
            run.mkdir()
            hashes = {}
            for name in train.ARTIFACTS:
                data = b"[]" if name.endswith(".json") else b"test"
                (run / name).write_bytes(data)
                hashes[name] = hashlib.sha256(data).hexdigest()
            (run / "manifest.json").write_text(json.dumps({
                "run_id": run.name, "schema_version": 1, "sha256": hashes,
            }), encoding="utf-8")
            with patch.object(train, "RUNS", root):
                self.assertEqual(train.analysis_source(None), run)
                (run / "category_regions.json").write_text("[1]", encoding="utf-8")
                with self.assertRaises(ValueError):
                    train.analysis_source(run.name)


class TrainingCommandTests(unittest.TestCase):
    def test_manual_and_weekly_use_the_same_entrypoint(self):
        with patch.object(train, "run_id", return_value=None), \
             patch.object(train, "train_manual") as manual, \
             patch.object(train, "run_retraining_loop", return_value=True) as weekly:
            with patch.object(sys, "argv", ["train.py", "--mode", "2"]):
                train.main()
            manual.assert_called_once_with(2, None, [], None)
            weekly.assert_not_called()
            manual.reset_mock()
            with patch.object(sys, "argv", ["train.py", "--mode", "3", "--file", "artikel.txt"]):
                train.main()
            manual.assert_called_once_with(3, None, [], "artikel.txt")
            manual.reset_mock()
            with patch.object(sys, "argv", ["train.py"]), patch("builtins.input", side_effect=["3", "artikel.txt"]):
                train.main()
            manual.assert_called_once_with(3, None, [], "artikel.txt")
            with patch.object(sys, "argv", ["train.py", "--weekly"]):
                with self.assertRaises(SystemExit) as exit_result:
                    train.main()
            self.assertEqual(exit_result.exception.code, 0)
            weekly.assert_called_once()

    def test_all_sources_and_single_named_source_are_distinct(self):
        with tempfile.TemporaryDirectory() as directory:
            raw = Path(directory)
            (raw / "pdf").mkdir()
            (raw / "docs").mkdir()
            (raw / "csv").mkdir()
            first = raw / "docs" / "artikel.txt"
            first.write_text("Artikel tentang kecerdasan buatan untuk analisis inventaris dan prediksi stok.", encoding="utf-8")
            second = raw / "csv" / "catatan.csv"
            second.write_text("kategori,uraian\nstok,Laporan kegiatan mitra selama satu minggu terakhir\n", encoding="utf-8")
            (raw / "pdf" / "README.md").write_text("Petunjuk folder, bukan data training", encoding="utf-8")
            paths = list_raw_references(raw)
            self.assertEqual(paths, [second, first])
            self.assertEqual(len({item["source"] for item in build_raw_reference_index(paths, raw)["documents"]}), 2)
            selected = train.select_raw_reference("artikel.txt", paths)
            self.assertEqual({item["source"] for item in build_raw_reference_index([selected], raw)["documents"]}, {"docs/artikel.txt"})
            with self.assertRaises(ValueError):
                train.select_raw_reference("../artikel.txt", paths)


if __name__ == "__main__":
    unittest.main()
