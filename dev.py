"""Lokaler Entwicklungsserver für lizzy.study.

Liefert die Dateien ohne Cache aus und stellt /__version bereit, damit sich
die Seite bei jeder Änderung automatisch neu lädt.
"""
import http.server
import os
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))


def latest_mtime():
    newest = 0.0
    for folder, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if not d.startswith(".")]
        for name in files:
            newest = max(newest, os.path.getmtime(os.path.join(folder, name)))
    return newest


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        if self.path == "/__version":
            body = str(latest_mtime()).encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
    print(f"lizzy.study läuft auf http://localhost:{port}")
    http.server.ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
