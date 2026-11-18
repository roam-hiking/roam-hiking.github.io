"""Local preview server with HTTP Range support, so videos can seek (python -m http.server cannot).

    python3 serve.py [port]

It also adds a review mode that the published site does not have: the page gets a "Comment"
button, and comments are stored in review-comments.json next to this file.
"""
import json
import os
import re
import sys
import threading
import time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


ROOT = os.path.dirname(os.path.abspath(__file__))
COMMENTS = os.path.join(ROOT, "review-comments.json")
LOCK = threading.Lock()


def load_comments():
    try:
        with open(COMMENTS) as f:
            return json.load(f)
    except (OSError, ValueError):
        return []


class RangeHandler(SimpleHTTPRequestHandler):
    def send_bytes(self, body, ctype, code=200):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.split("?")[0].split("#")[0]
        if path == "/__comments":
            return self.send_bytes(json.dumps(load_comments()).encode(), "application/json")
        if path in ("/", "/index.html", "/expeditions.html"):  # review mode is injected here, so the pages themselves stay clean
            with open(os.path.join(ROOT, "expeditions.html" if path == "/expeditions.html" else "index.html"), "rb") as f:
                html = f.read()
            html = html.replace(b"</body>", b'<script src="review/review.js"></script>\n</body>', 1)
            return self.send_bytes(html, "text/html; charset=utf-8")
        return super().do_GET()

    def do_POST(self):
        if self.path not in ("/__comments", "/__comments/delete", "/__comments/done"):
            return self.send_error(404)
        try:
            n = int(self.headers.get("Content-Length") or 0)
            if n > 20000:
                return self.send_error(413)
            data = json.loads(self.rfile.read(n))
        except ValueError:
            return self.send_error(400)
        with LOCK:
            items = load_comments()
            if self.path == "/__comments":
                keys = ("text", "selector", "section", "snippet", "width", "name")
                c = {k: str(data.get(k, ""))[:4000] for k in keys}
                c["id"] = max([i["id"] for i in items], default=0) + 1
                c["time"] = time.strftime("%Y-%m-%d %H:%M")
                c["done"] = False
                items.append(c)
            elif self.path == "/__comments/delete":
                items = [i for i in items if i["id"] != data.get("id")]
            else:
                for i in items:
                    if i["id"] == data.get("id"):
                        i["done"] = bool(data.get("done"))
            with open(COMMENTS, "w") as f:
                json.dump(items, f, indent=1, ensure_ascii=False)
        self.send_bytes(json.dumps(items).encode(), "application/json")

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")  # always revalidate, so edits show up on reload
        super().end_headers()

    def send_head(self):
        rng = self.headers.get("Range")
        path = self.translate_path(self.path)
        m = re.match(r"bytes=(\d*)-(\d*)$", rng or "")
        if not m or not os.path.isfile(path):
            return super().send_head()
        size = os.path.getsize(path)
        start = int(m.group(1)) if m.group(1) else max(0, size - int(m.group(2)))
        end = int(m.group(2)) if m.group(1) and m.group(2) else size - 1
        end = min(end, size - 1)
        if start > end:
            self.send_error(416)
            return None
        f = open(path, "rb")
        f.seek(start)
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(end - start + 1))
        self.send_header("Accept-Ranges", "bytes")
        self.end_headers()
        self._remaining = end - start + 1
        return f

    def copyfile(self, source, outputfile):
        remaining = getattr(self, "_remaining", None)
        if remaining is None:
            return super().copyfile(source, outputfile)
        while remaining > 0:
            chunk = source.read(min(65536, remaining))
            if not chunk:
                break
            outputfile.write(chunk)
            remaining -= len(chunk)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8790
    root = os.path.dirname(os.path.abspath(__file__))
    ThreadingHTTPServer(("127.0.0.1", port), partial(RangeHandler, directory=root)).serve_forever()
