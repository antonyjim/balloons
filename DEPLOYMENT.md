# Cloudflare Pages and installed apps

Build with `npm run build` and publish `dist`. The generated `_headers` file
sets browser revalidation and disables caching for update metadata and the worker.

Each build generates `version.json` and a service worker cache key from the
contents of the deployed assets. No manual cache-name bump or API is needed.
The complete app assets are downloaded before a new worker becomes ready, so
offline launches use the HTML, script, sounds, and textures from one build.
Failed downloads leave the current worker available.

Installed apps check at launch, once per minute while visible, on returning to
the foreground, and on reconnecting. A new build shows an update button. Applying
it reloads the app; drawings and the current balloon scene are held in memory.

For an urgent deployment, set the Cloudflare Pages build environment variable
`FORCE_APP_UPDATE=true` and rebuild. Online clients on this update system will
activate and reload when that build is ready, discarding any in-memory scene or
drawing. Remove that environment variable for subsequent normal deployments.
Offline or suspended clients cannot be remotely refreshed; they check on resume
and reconnection.

Clients installed before this update system may need to fully close all windows
of the old app and reopen once for the waiting worker to activate. Thereafter,
the update button and periodic checks handle releases.

The existing opaque 180px Apple icon is now served at a fresh URL, with a root
`apple-touch-icon.png` fallback. Existing iOS home-screen entries may retain
their old icon: remove and add the shortcut again after this deployment.
The manifest also provides 192px, 512px, and maskable icons.

Smoke test on the deployed HTTPS origin: install and open the app, load a second
deployment, wait for the update button, apply it, then enable airplane mode and
reopen. Verify the sketchpad, object picker, sounds, and textures remain usable.
