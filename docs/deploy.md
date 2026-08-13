# Deploying to GitHub Pages

The prototype is static files with **no build step**, so hosting is trivial.

## One-time setup

1. Create a GitHub repository and push this folder to the `main` branch:
   ```bash
   git remote add origin git@github.com:<you>/forte-pos.git
   git push -u origin main
   ```
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment**, set:
   - **Source:** *Deploy from a branch*
   - **Branch:** `main` · **Folder:** `/ (root)`
4. Save. Pages will publish at `https://<you>.github.io/forte-pos/`.

## Why it "just works"

- [`.nojekyll`](../.nojekyll) disables Jekyll so every file (including the
  `assets/` and `data/` folders) is served verbatim.
- All asset and data paths in `index.html` / `data.js` are **relative**
  (`assets/...`, `data/...`), so the app works whether it is served from a
  domain root or from a `/<repo>/` subpath.
- No bundler, transpiler, or CI build is required. The optional
  [`ci.yml`](../.github/workflows/ci.yml) only runs the tests.

## Deep links

Roles are addressable via the URL hash, so you can share a specific surface:

- `…/forte-pos/#waiter`
- `…/forte-pos/#chef`
- `…/forte-pos/#manager`

## Local preview

```bash
npm run serve          # http://localhost:8080
# or
python3 -m http.server 8080
```

Open the app over **HTTP**, not by double-clicking `index.html` — browsers block
`fetch()` of local files under the `file://` scheme, which the data loader needs.
