# nifty-live

Static dashboard (GitHub Pages). Data comes from branch `live` (pushed by gh_live.py), optional tunnel for ~2s ticks.

Files: index.html (markup) · app.css · app.js (dashboard logic) · nl-data.js (data layer + decrypt) · chart.html · host.json

Data on branch `live` is AES-256-GCM encrypted (key derived with PBKDF2 from the `?k=` value in your link).
Open the dashboard with `?k=<your key>`; the browser remembers it (localStorage) on this site. Without the right key the page shows a key error and no data.
Old plain (unencrypted) bundles are still read, so the page works during a switch-over.
