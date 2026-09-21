# City 0.2.1 physical-device testing

[Back to releases](README.md) · [Candidate record](city-0-2-1-candidate.md)

Prepared 2026-09-22. This is an unpublished, frozen working-tree candidate.
Pixel 7 Pro feedback is positive for all cities/both transformation directions
and camera scanning. Full physical-device
qualification and final-commit CI are still pending.

## Open the candidate

Open the links below in Safari on iPhone and Chrome on Android. The public
HTTPS testing preview works over Wi-Fi or mobile data; no development computer
needs to be running. Production and the npm release remain unchanged.

Cloudflare Worker: `design-city-0-2-1-preview`; deployed version:
`6d520ce9-956b-4512-a851-bfad328fb7b2` (2026-09-22).

| City | Editor | Hosted player |
| --- | --- | --- |
| 渋谷 | [Open editor](https://design-city-0-2-1-preview.johnson7543.workers.dev/qr?q=eyJzY2hlbWFWZXJzaW9uIjoxLCJ2YWx1ZSI6Imh0dHBzOi8vZXhhbXBsZS5jb20vc2hpYnV5YSIsImRlc2lnbiI6eyJ0eXBlIjoiY2l0eSJ9LCJ0aGVtZSI6eyJ0eXBlIjoicHJlc2V0IiwicHJlc2V0Ijoic2hpYnV5YSJ9LCJ2aWV3Ijp7ImluaXRpYWwiOiJkZXNpZ24ifSwiZGV0YWlscyI6eyJ0aXRsZSI6IiIsInNob3dWYWx1ZSI6ZmFsc2UsImJvcmRlciI6ZmFsc2V9LCJpbnRlcmFjdGlvbiI6eyJkcmFnVG9Sb3RhdGUiOnRydWUsInRhcFRvVG9nZ2xlVmlldyI6dHJ1ZSwiYXV0b1JvdGF0ZSI6ZmFsc2UsImF1dG9Sb3RhdGVEaXJlY3Rpb24iOiJjbG9ja3dpc2UiLCJ0cmFuc2l0aW9uU3BlZWQiOjEsIm1vdGlvbkJsdXIiOnRydWV9LCJsb2dvIjpmYWxzZX0) | [Open player](https://design-city-0-2-1-preview.johnson7543.workers.dev/qr/embed?config=eyJzY2hlbWFWZXJzaW9uIjoxLCJ2YWx1ZSI6Imh0dHBzOi8vZXhhbXBsZS5jb20vc2hpYnV5YSIsImRlc2lnbiI6eyJ0eXBlIjoiY2l0eSJ9LCJ0aGVtZSI6eyJ0eXBlIjoicHJlc2V0IiwicHJlc2V0Ijoic2hpYnV5YSJ9LCJ2aWV3Ijp7ImluaXRpYWwiOiJkZXNpZ24ifSwiZGV0YWlscyI6eyJ0aXRsZSI6IiIsInNob3dWYWx1ZSI6ZmFsc2UsImJvcmRlciI6ZmFsc2V9LCJpbnRlcmFjdGlvbiI6eyJkcmFnVG9Sb3RhdGUiOnRydWUsInRhcFRvVG9nZ2xlVmlldyI6dHJ1ZSwiYXV0b1JvdGF0ZSI6ZmFsc2UsImF1dG9Sb3RhdGVEaXJlY3Rpb24iOiJjbG9ja3dpc2UiLCJ0cmFuc2l0aW9uU3BlZWQiOjEsIm1vdGlvbkJsdXIiOnRydWV9LCJsb2dvIjpmYWxzZX0&instanceId=device-shibuya) |
| 道頓堀 | [Open editor](https://design-city-0-2-1-preview.johnson7543.workers.dev/qr?q=eyJzY2hlbWFWZXJzaW9uIjoxLCJ2YWx1ZSI6Imh0dHBzOi8vZXhhbXBsZS5jb20vZG90b25ib3JpIiwiZGVzaWduIjp7InR5cGUiOiJjaXR5In0sInRoZW1lIjp7InR5cGUiOiJwcmVzZXQiLCJwcmVzZXQiOiJkb3RvbmJvcmkifSwidmlldyI6eyJpbml0aWFsIjoiZGVzaWduIn0sImRldGFpbHMiOnsidGl0bGUiOiIiLCJzaG93VmFsdWUiOmZhbHNlLCJib3JkZXIiOmZhbHNlfSwiaW50ZXJhY3Rpb24iOnsiZHJhZ1RvUm90YXRlIjp0cnVlLCJ0YXBUb1RvZ2dsZVZpZXciOnRydWUsImF1dG9Sb3RhdGUiOmZhbHNlLCJhdXRvUm90YXRlRGlyZWN0aW9uIjoiY2xvY2t3aXNlIiwidHJhbnNpdGlvblNwZWVkIjoxLCJtb3Rpb25CbHVyIjp0cnVlfSwibG9nbyI6ZmFsc2V9) | [Open player](https://design-city-0-2-1-preview.johnson7543.workers.dev/qr/embed?config=eyJzY2hlbWFWZXJzaW9uIjoxLCJ2YWx1ZSI6Imh0dHBzOi8vZXhhbXBsZS5jb20vZG90b25ib3JpIiwiZGVzaWduIjp7InR5cGUiOiJjaXR5In0sInRoZW1lIjp7InR5cGUiOiJwcmVzZXQiLCJwcmVzZXQiOiJkb3RvbmJvcmkifSwidmlldyI6eyJpbml0aWFsIjoiZGVzaWduIn0sImRldGFpbHMiOnsidGl0bGUiOiIiLCJzaG93VmFsdWUiOmZhbHNlLCJib3JkZXIiOmZhbHNlfSwiaW50ZXJhY3Rpb24iOnsiZHJhZ1RvUm90YXRlIjp0cnVlLCJ0YXBUb1RvZ2dsZVZpZXciOnRydWUsImF1dG9Sb3RhdGUiOmZhbHNlLCJhdXRvUm90YXRlRGlyZWN0aW9uIjoiY2xvY2t3aXNlIiwidHJhbnNpdGlvblNwZWVkIjoxLCJtb3Rpb25CbHVyIjp0cnVlfSwibG9nbyI6ZmFsc2V9&instanceId=device-dotonbori) |
| 東京タワー | [Open editor](https://design-city-0-2-1-preview.johnson7543.workers.dev/qr?q=eyJzY2hlbWFWZXJzaW9uIjoxLCJ2YWx1ZSI6Imh0dHBzOi8vZXhhbXBsZS5jb20vdG9reW8tdG93ZXIiLCJkZXNpZ24iOnsidHlwZSI6ImNpdHkifSwidGhlbWUiOnsidHlwZSI6InByZXNldCIsInByZXNldCI6InRva3lvLXRvd2VyIn0sInZpZXciOnsiaW5pdGlhbCI6ImRlc2lnbiJ9LCJkZXRhaWxzIjp7InRpdGxlIjoiIiwic2hvd1ZhbHVlIjpmYWxzZSwiYm9yZGVyIjpmYWxzZX0sImludGVyYWN0aW9uIjp7ImRyYWdUb1JvdGF0ZSI6dHJ1ZSwidGFwVG9Ub2dnbGVWaWV3Ijp0cnVlLCJhdXRvUm90YXRlIjpmYWxzZSwiYXV0b1JvdGF0ZURpcmVjdGlvbiI6ImNsb2Nrd2lzZSIsInRyYW5zaXRpb25TcGVlZCI6MSwibW90aW9uQmx1ciI6dHJ1ZX0sImxvZ28iOmZhbHNlfQ) | [Open player](https://design-city-0-2-1-preview.johnson7543.workers.dev/qr/embed?config=eyJzY2hlbWFWZXJzaW9uIjoxLCJ2YWx1ZSI6Imh0dHBzOi8vZXhhbXBsZS5jb20vdG9reW8tdG93ZXIiLCJkZXNpZ24iOnsidHlwZSI6ImNpdHkifSwidGhlbWUiOnsidHlwZSI6InByZXNldCIsInByZXNldCI6InRva3lvLXRvd2VyIn0sInZpZXciOnsiaW5pdGlhbCI6ImRlc2lnbiJ9LCJkZXRhaWxzIjp7InRpdGxlIjoiIiwic2hvd1ZhbHVlIjpmYWxzZSwiYm9yZGVyIjpmYWxzZX0sImludGVyYWN0aW9uIjp7ImRyYWdUb1JvdGF0ZSI6dHJ1ZSwidGFwVG9Ub2dnbGVWaWV3Ijp0cnVlLCJhdXRvUm90YXRlIjpmYWxzZSwiYXV0b1JvdGF0ZURpcmVjdGlvbiI6ImNsb2Nrd2lzZSIsInRyYW5zaXRpb25TcGVlZCI6MSwibW90aW9uQmx1ciI6dHJ1ZX0sImxvZ28iOmZhbHNlfQ&instanceId=device-tokyo-tower) |

If a city link does not open, first try [https://design-city-0-2-1-preview.johnson7543.workers.dev/qr](https://design-city-0-2-1-preview.johnson7543.workers.dev/qr).
This is a testing deployment of the frozen candidate, not release acceptance.
HTTPS sharing/clipboard and cross-origin embedding can now be checked here.

## Identify the build

- Web fingerprint: `03dc66d65738ce6cb5394c4d163007da8c9ca3b7f8f8cff781dd6195a3a20c65`.
- npm tarball SHA-256: `55f160c1b079ed48ea4d3fe06e681f36236fd0a9fef6ae351798def7329f9cee`.
- Preserved artifacts: `city-release-0.2.1.local/` at the repository root,
  intentionally Git-ignored. Includes frozen `web/`, tarball, source hash
  manifest, evidence reports, `manifest.json` and `device-results.json`.
- Web fingerprint method: SHA-256 of the compact JSON array of sorted relative
  web file paths, byte lengths and individual SHA-256 hashes in `manifest.json`.
- This directory survives temporary-directory cleanup, but still needs copying
  to the team's durable release storage. It is not a committed-source archive.

For an optional local fallback, start the frozen preview from the repository
root and open `http://localhost:4199/qr` (phones require the host LAN address):

```bash
node node_modules/vite/bin/vite.js preview --host 0.0.0.0 --port 4199 --strictPort --outDir city-release-0.2.1.local/web
```

All six links returned HTTP 200 and reached City assets ready in desktop
Chromium at 390×844, with no page errors or failed HTTP responses. The report
is `city-release-0.2.1.local/evidence/phone-preview-routes.json`. This is a route
check using software WebGL, not physical-device qualification.

The public HTTPS deployment also passed all six editor/player loading checks
with no page errors or failed HTTP responses. All 22 served file hashes match
the frozen build; editor/player embedding headers passed. Reports are
`city-release-0.2.1.local/evidence/public-preview-routes.json` and
`city-release-0.2.1.local/evidence/public-preview-assets.json`. These checks
still do not replace the physical-phone qualification below.

## OS and browser baseline

The maintainer requested “LTS” on 2026-09-22. For this phone matrix, interpret
that as the latest stable supported release available for each test device;
this is a testing baseline, not an assertion of a shared mobile LTS channel.
Do not use beta, developer-preview or Canary builds for release qualification.

- iPhone: latest public iOS update supported by the device, using its bundled
  Safari. [Apple's Safari update instructions](https://support.apple.com/en-us/102665)
  confirm that Safari updates ship with operating-system updates.
- Android: latest stable manufacturer-supported OS/security update for the
  device, with Chrome Stable from Google Play. The
  [Chrome Android Stable release announcement](https://chromereleases.googleblog.com/2026/09/chrome-for-android-update_01970946217.html)
  illustrates the staged rollout; record the version actually installed.

Pixel 7 Pro is confirmed for the Android test. Its installed OS/browser
versions and the iPhone device details remain pending. Capture
those values at test time, since availability depends on hardware and rollout.
The baseline alone does not qualify a device; the Pixel 7 Pro report below
is qualitative feedback covering all three cities and both transformation
directions; editor/player coverage is not specified.

## Run on each phone

Record device model, OS/browser version, test date, network, battery/thermal
state and the web fingerprint. Use the same build on both devices.

1. Open each city's editor and player from a fresh browser session with site
   data cleared. Record cold-load time and first 3D-to-QR transition separately
   from warmed results. Confirm all landmark details finish loading.
2. Run **20 complete 3D → QR → 3D cycles per city in each channel**. Check for
   blank frames, missing façades, delayed Donki elements, crashes or WebGL
   context loss. Record any failure's city, channel and cycle number.
3. Rotate and pinch-zoom, reset the view, switch cities and edit QR content.
   Add a logo, replace it and remove it; check both 3D and QR views. For
   道頓堀, inspect the Asahi sign and confirm all buildings remain present
   across rotations. Use the editor for these editable controls.
4. Scan URL and Japanese-text QR cases with and without a logo, then a dense
   URL and the exported PNG. Use three successful native-camera reads per
   case, per city. Display the code on another device so the phone's camera
   can read it; compare the decoded value exactly, including Japanese text.
5. Enable the phone's reduced-motion setting, reload and verify the controls
   and QR remain usable. Record visible motion behavior and any unexpected
   continuous animation. Restore the setting after the check.
6. Use Safari Web Inspector or Chrome remote debugging, if available, to
   record settled/transition frame pacing, memory and resource trends before
   and after the cycles. Proposed acceptance is at least 30 fps and p95 frame
   time no more than 50 ms after assets load. Do not infer measurements from
   visual smoothness. Mark unavailable counters as **not measured**; JS heap
   alone does not represent total browser/GPU memory.

Suggested payloads:

- URL: the `https://example.com/<city-preset>` value prefilled by each link.
- Japanese: `大阪・道頓堀 / 渋谷 / 東京タワー — QRテスト`.
- Dense URL: `https://example.com/` followed by `tokyo/` repeated 32 times
  (the existing maximum interactive-grid smoke-test payload).

## Report results

Send the device details, city/channel, pass/fail and any reproduction steps.
For measurement evidence, include the profiler capture or counter values with
units and measurement method. A short screen recording is useful for visual
failures. Do not mark an unmeasured performance check as passed.

Use this compact record for each city and channel; repeat rows as needed:

| Device / city / channel | Cold load / first turn | 20 cycles | QR scan cases | Logo / touch / motion | fps / p95 / memory | Result / issue |
| --- | --- | --- | --- | --- | --- | --- |
| Pixel 7 Pro / all three cities / channel unspecified | Not measured | Pending | Camera scans reported good; detailed matrix unconfirmed | Pending | Not measured | Maintainer confirms smooth 3D → QR and QR → 3D in all three cities (2026-09-22); OS/browser versions pending |
| iPhone / pending | Pending | Pending | Pending | Pending | Not measured | Pending |

## CI handoff

GitHub authentication was verified on 2026-09-22. The latest successful
[Verify run](https://github.com/johnson7543/design/actions/runs/34153558576)
and [Publish workflow run](https://github.com/johnson7543/design/actions/runs/34156560357)
refer to `4827458b37d0b34ee8d385cf1814842107f8aef6`, not this uncommitted candidate.
They are historical evidence only. No open release PR was found at this check.

The City changes and required documentation migration have been scoped for
the release commit, excluding the unrelated Playable Refresh proposal. Full
local checks passed on the isolated staged source, and both the built web
files and tested tarball match the frozen preview candidate. Next, run Verify
and the manual, non-publishing Publish workflow on that exact commit. Record the SHA,
run links, elapsed time and matching artifact hashes in the candidate record.
Do not push a `designqr-v*` tag during rehearsal: the tag workflow publishes.
