# Cloudflare Pages and installed apps

Build with `npm run build` and publish `dist`. The generated `_headers` file
sets browser revalidation and disables caching for update metadata and the worker.

Each build generates `version.json` and a service worker cache key from the
contents of the deployed assets. No manual cache-name bump or API is needed.
The complete app assets are downloaded and checked against build-generated
SHA-256 integrity hashes before a new worker becomes ready. Failed downloads,
HTML fallbacks for missing assets, and mixed deployment versions leave the
current worker available. The incomplete new cache is removed for a clean retry.

The app document is cached from `/`, rather than `/index.html`, because Cloudflare
Pages redirects HTML filenames to canonical paths. Cached responses are rebuilt
without redirect history, which avoids iOS rejecting redirected navigation
responses. Cache-read failures fall back to the network. If both storage and the
network are unavailable, navigation shows an offline retry page rather than a
rejected service-worker response.

Installed apps check at launch, once per minute while visible, on returning to
the foreground, and on reconnecting. Failed registration is retried, and missing
update metadata does not stop worker checks. A new build shows an update button
at the bottom right, including in simple mode and the sketchpad. Applying it
reloads the app; drawings and the current balloon scene are held in memory and
are discarded by reload. Ordinary updates wait for that explicit action.
If another tab applies an update, other open tabs offer a reload rather than
immediately discarding their drawings.

For an urgent deployment, set the Cloudflare Pages build environment variable
`FORCE_APP_UPDATE=true` and rebuild. Online clients on this update system will
activate and reload when that build is ready, discarding any in-memory scene or
drawing. Remove that environment variable for subsequent normal deployments.
Offline or suspended clients cannot be remotely refreshed; they check on resume
and reconnection.

For migration from the redirected-document cache, a fully downloaded fixed worker
may activate immediately when it detects the old broken cache. Reopen or reload
the installed app after deploying this repair; uninstalling it or deleting site
data is not part of the update flow. A failed page may still need all app windows
closed and reopened so the browser checks the new `/sw.js`. Already-installed
worker code cannot be repaired before the browser downloads the replacement.

Publish the complete `dist` directory in one Pages deployment. `/sw.js` must be
served directly as JavaScript on the installed app's origin, without a redirect
or an HTML fallback. Do not apply CDN caching overrides to the worker or
`version.json`. Disable HTML/JavaScript rewriting or analytics injection on the
offline app assets: response bodies must match the files in `dist` for integrity
verification. Deploy on the canonical origin used by the manifest.

The existing opaque 180px Apple icon is now served at a fresh URL, with a root
`apple-touch-icon.png` fallback. Existing iOS home-screen entries may retain
their old icon: remove and add the shortcut again after this deployment.
The manifest also provides 192px, 512px, and maskable icons.

Smoke test on the deployed HTTPS origin: install and open the app, load a second
deployment, wait for the update button, apply it, then enable airplane mode and
reopen. Verify the sketchpad, object picker, sounds, and textures remain usable.
Also check `/index.html` redirect handling on iOS, updating with two open tabs,
and an interrupted download: the old release should remain usable until the
replacement is fully installed. Settings in localStorage are never cleared by
the update or recovery code.
