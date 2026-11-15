"""Check that manual training reads one complete, verified analysis run."""

import hashlib
import json
import tempfile
import unittest
import sys
from pathlib import Path
from unittest.mock import patch

import train
from knowledge_index import build_knowledge_index, build_raw_reference_index, list_raw_references, search_knowledge, search_raw_reference


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
    def test_summary_access_is_data_from_training_not_a_hardcoded_name(self):
        with tempfile.TemporaryDirectory() as directory:
            raw = Path(directory)
            (raw / "pdf").mkdir()
            file = raw / "pdf" / "CV Contoh.pdf"
            file.write_bytes(b"fixture")
            with patch.object(train, "RAW_DIR", raw):
                result = train.select_shared_summaries([], [
                    "CV Contoh.pdf=Contoh adalah mahasiswa aktif yang menyukai teknologi dan organisasi."
                ], [file])
            self.assertEqual(result[0]["raw_source"], "pdf/CV Contoh.pdf")
            self.assertIn("contoh", result[0]["aliases"])
            with patch.object(train, "RAW_DIR", raw):
                self.assertEqual(train.select_shared_summaries(result, [], [file]), result)
                self.assertEqual(train.select_shared_summaries(result, [], [file], ["CV Contoh.pdf"]), [])
            self.assertEqual(train.select_shared_summaries(result, [], []), [])

    def test_approved_summary_enters_binary_without_public_markdown(self):
        with tempfile.TemporaryDirectory() as directory:
            data = Path(directory)
            policy_dir = data / "mainbrain" / "corporate_knowledge"
            policy_dir.mkdir(parents=True)
            raw = data / "raw_references" / "pdf"
            raw.mkdir(parents=True)
            (raw / "CV Contoh.pdf").write_bytes(b"fixture")
            summary = "Contoh adalah mahasiswi aktif yang tertarik pada teknologi dan organisasi."
            (policy_dir / "rag_policy.json").write_text(json.dumps({
                "version": "test", "approved_sources": [], "max_documents": 0,
                "blocked_content_patterns": [], "max_excerpts": 4,
            }), encoding="utf-8")
            index = build_knowledge_index(data, [{"raw_source": "pdf/CV Contoh.pdf", "source_sha256": hashlib.sha256(b"fixture").hexdigest(), "excerpt": summary, "aliases": ["contoh"]}])
            self.assertEqual(index["documents"][0]["source"], "pdf/CV Contoh.pdf")
            self.assertEqual(index["documents"][0]["visibility"], "mitra")
            self.assertEqual(search_knowledge(index, "siapa itu contoh??")[0]["source"], "pdf/CV Contoh.pdf")

    def test_manual_and_weekly_use_the_same_entrypoint(self):
        with patch.object(train, "run_id", return_value=None), \
             patch.object(train, "train_manual") as manual, \
             patch.object(train, "run_retraining_loop", return_value=True) as weekly:
            with patch.object(sys, "argv", ["train.py", "--mode", "2"]):
                train.main()
            manual.assert_called_once_with(2, None, [], None, [], [])
            weekly.assert_not_called()
            manual.reset_mock()
            with patch.object(sys, "argv", ["train.py", "--mode", "3", "--file", "artikel.txt"]):
                train.main()
            manual.assert_called_once_with(3, None, [], "artikel.txt", [], [])
            manual.reset_mock()
            with patch.object(sys, "argv", ["train.py"]), patch("builtins.input", side_effect=["3", "artikel.txt", ""]):
                train.main()
            manual.assert_called_once_with(3, None, [], "artikel.txt", [], [])
            manual.reset_mock()
            with patch.object(sys, "argv", ["train.py"]), patch("builtins.input", side_effect=[
                "3", "artikel.txt", "t", "Artikel ini menjelaskan konteks yang aman untuk semua mitra.", "",
            ]):
                train.main()
            manual.assert_called_once_with(3, None, [], "artikel.txt", [
                "artikel.txt=Artikel ini menjelaskan konteks yang aman untuk semua mitra."
            ], [])
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

    def test_private_reference_can_be_found_by_person_name_in_filename(self):
        with tempfile.TemporaryDirectory() as directory:
            raw = Path(directory)
            (raw / "pdf").mkdir()
            (raw / "docs").mkdir()
            cv = raw / "pdf" / "CV Contoh.txt"
            cv.write_text("Mahasiswi aktif di bidang teknologi, organisasi, dan kerja tim.", encoding="utf-8")
            other = raw / "docs" / "artikel.txt"
            other.write_text("Artikel umum tentang persediaan dan analisis penjualan toko.", encoding="utf-8")
            index = build_raw_reference_index([cv, other], raw)
            matches = search_raw_reference(index, "siapa itu contoh")
            self.assertTrue(matches)
            self.assertEqual(matches[0]["source"], "pdf/CV Contoh.txt")


if __name__ == "__main__":
    unittest.main()
