# nifty-live

Static dashboard (GitHub Pages). Data comes from branch `live` (pushed by gh_live.py).

**Private page** (encrypted): open [the root dashboard](https://shiv0626.github.io/nifty-live/) once with `?k=<your key>`; the browser remembers it on this site. Without the right key the page shows a key error and no data. Bundles on branch `live` (`latest.json`, `f/`, `s/`) are AES-256-GCM encrypted (key derived with PBKDF2 from the `?k=` value).

**Public page** (keyless): [nifty-live/public](https://shiv0626.github.io/nifty-live/public/) — same layout as the private dashboard, loaded from a filtered plaintext feed (`public.json` and `p/` on branch `live`). No key required. Open or unrealised P&L, keys, tunnel links, broker/account info, and logs are not included. Paper/demo trading only, not advice.

Files: index.html (private markup) · app.css · app.js · nl-data.js (data layer + decrypt) · chart.html · host.json · public/ (keyless page)
