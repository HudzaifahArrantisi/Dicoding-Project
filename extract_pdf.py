import sys
import zlib
import re

# Simple PDF text extractor for flate-compressed streams
try:
    with open("Use Case UMKM Capstone.pdf", "rb") as f:
        data = f.read()

    # Find all streams
    streams = re.findall(b"stream\r?\n(.*?)\r?\nendstream", data, re.DOTALL)
    print(f"Total streams found: {len(streams)}")

    output = []
    for idx, s in enumerate(streams):
        try:
            decompressed = zlib.decompress(s)
            # Find text inside ( ... ) Tj or [ ... ] TJ
            # or simply decode printable characters
            text_chunks = re.findall(rb"\((.*?)\)", decompressed)
            if text_chunks:
                clean_texts = [c.decode('utf-8', errors='ignore') for c in text_chunks if len(c) > 1]
                if clean_texts:
                    output.append(f"--- STREAM {idx} ---")
                    output.append(" ".join(clean_texts))
        except Exception:
            pass

    with open("extracted_use_cases.txt", "w", encoding="utf-8") as out:
        out.write("\n".join(output))
    print("Done! Extracted text written to extracted_use_cases.txt")
except Exception as e:
    print(f"Error: {e}")
