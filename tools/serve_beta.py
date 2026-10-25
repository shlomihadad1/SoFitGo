#!/usr/bin/env python3
"""SoFitGo beta — local test server (no deploy, no cloud, nothing leaves your network).

Serves the unzipped beta folder to phones on the same Wi-Fi.

  python3 serve_beta.py                 # HTTP on port 8080 (workout + storage work; no offline mode, no screen wake lock)
  python3 serve_beta.py --https CERT KEY  # HTTPS on port 8443 with a certificate the phone trusts (e.g. made with mkcert):
                                          # offline mode, install to home screen and screen wake lock work

Run it inside the unzipped folder (the one with index.html), or pass --dir PATH.
Stop with Ctrl+C. Only devices on your local network can reach it; it serves files read-only.
"""
import argparse, functools, http.server, os, socket, ssl, sys


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      '.js': 'text/javascript', '.webmanifest': 'application/manifest+json', '.webp': 'image/webp',
                      '.mp4': 'video/mp4', '.json': 'application/json', '.svg': 'image/svg+xml'}

    def end_headers(self):
        # the service worker and the page must never be served stale while testing a new build
        if self.path.split('?')[0] in ('/', '/index.html', '/sw.js'):
            self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def do_POST(self):  # read-only server
        self.send_error(405)
    do_PUT = do_DELETE = do_PATCH = do_POST


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('10.255.255.255', 1))  # no packet is sent; picks the interface used for the local network
        return s.getsockname()[0]
    except OSError:
        return '127.0.0.1'
    finally:
        s.close()


def main():
    a = argparse.ArgumentParser(description='SoFitGo beta local test server')
    a.add_argument('--dir', default='.', help='folder with index.html (default: current folder)')
    a.add_argument('--port', type=int, default=None)
    a.add_argument('--https', nargs=2, metavar=('CERT', 'KEY'), help='certificate and key files (PEM)')
    o = a.parse_args()
    root = os.path.abspath(o.dir)
    if not os.path.isfile(os.path.join(root, 'index.html')):
        sys.exit('index.html not found in ' + root + ' — run this inside the unzipped beta folder or pass --dir')
    port = o.port or (8443 if o.https else 8080)
    srv = http.server.ThreadingHTTPServer(('0.0.0.0', port), functools.partial(Handler, directory=root))
    scheme = 'http'
    if o.https:
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.load_cert_chain(o.https[0], o.https[1])
        srv.socket = ctx.wrap_socket(srv.socket, server_side=True)
        scheme = 'https'
    build = ''
    try:
        with open(os.path.join(root, 'sw.js'), encoding='utf-8') as f:
            import re
            m = re.search(r"[0-9a-f]{10}", f.read())
            build = m.group(0) if m else ''
    except OSError:
        pass
    print('SoFitGo beta' + (' build ' + build if build else '') + ' — serving ' + root)
    print('On the phone (same Wi-Fi) open:  ' + scheme + '://' + lan_ip() + ':' + str(port) + '/')
    if scheme == 'http':
        print('Plain HTTP: workouts and saving work; offline mode, install and screen wake lock need HTTPS (see README).')
    print('Ctrl+C to stop.')
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
