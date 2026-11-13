import json
import pickle
import tempfile
import unittest
from pathlib import Path

from knowledge_index import build_knowledge_index, search_knowledge


class KnowledgeIndexTest(unittest.TestCase):
    def test_roundtrip_keeps_public_sources_and_supports_typos(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            corporate = root / "mainbrain/corporate_knowledge"
            documents = root / "mainbrain/context_embeddings"
            corporate.mkdir(parents=True)
            documents.mkdir()
            policy = {"version": "test", "approved_sources": ["stock.public.md", "secret.md", "contact.public.md"],
                      "max_documents": 20, "max_chars_per_document": 20000, "max_excerpts": 3,
                      "blocked_content_patterns": ["PRIVATE_CONTACT"]}
            (corporate / "rag_policy.json").write_text(json.dumps(policy))
            (documents / "stock.public.md").write_text("Laporan stok fisik harian mencatat sisa barang di gudang cabang saya melalui menu Laporan Harian.")
            (documents / "secret.md").write_text("Dokumen internal cabang lain tidak boleh masuk retrieval.")
            (documents / "contact.public.md").write_text("PRIVATE_CONTACT harus disaring walau sumber terdaftar sebagai publik.")
            index = pickle.loads(pickle.dumps(build_knowledge_index(root)))
            results = search_knowledge(index, "laporan stokk fisik gudng cabang")
            self.assertTrue(results)
            self.assertTrue(all(item["source"] == "stock.public.md" for item in results))
            self.assertEqual(search_knowledge(index, "zxqvbnm"), [])


if __name__ == "__main__":
    unittest.main()
