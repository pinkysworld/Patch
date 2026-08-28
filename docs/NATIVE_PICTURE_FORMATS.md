# Native Picture formats

`native-picture-formats/1.0` is the versioned Native Ready Picture decode policy. It is **not** a Native GUI IR, payload or runtime bump. Native GUI IR 1.4 / payload v14 / runtime v1.5 still transport PictureBox `text` + `source` only.

`src/native-picture-format-policy.js` is the authoritative module. Product sealing goes through `src/native-picture-resources.js`, which applies this policy to both project resources and non-resource Picture sources.

## Surfaces

| Surface | Formats |
|---|---|
| Studio Resource Manager / project bundle v4 | PNG, JPEG, WebP, SVG |
| Standalone Web / browser preview | PNG, JPEG, WebP, SVG |
| Native Ready Picture (`native-picture-formats/1.0`) | PNG, JPEG |
| Native deferred | WebP, SVG |
| Native unsupported | any other `data:image/*`, malformed data URIs |

Ready decoding is the intersection of Win32/WIC, AppKit/NSImage and GTK/GdkPixbuf that Patch currently guarantees. Host-specific extra decoders are not inherited.

## Fail-closed sources

Native sealing inspects Picture `source` values:

- `patch-resource:<id>` — look up the project resource and assert its media type.
- `data:<media-type>...` — classify the media type. PNG/JPEG Ready; WebP/SVG deferred; anything else unsupported.
- paths ending `.webp` / `.svg` — deferred.
- opaque paths such as `images/photo.png` — unchanged; native backends decode bytes.

Empty sources remain legal. Missing project resources still fail as `NATIVE_PICTURE_RESOURCE_MISSING`.

Deferred and unsupported sources fail closed with a diagnostic that names `native-picture-formats/1.0`. They must not become empty PictureBoxes at runtime.

## Why this is not an IR bump

Native GUI IR 1.4 already carries Picture `source`. Broadening decode would change Windows, macOS and Linux runtime behavior without a shared contract. A later WebP/SVG expansion must:

1. version a new format policy (or a later native IR if PictureBox fields also change);
2. add Win32, AppKit and GTK decode coverage together;
3. keep Studio/Web four-format authoring unless that inventory also changes;
4. regenerate docs, smokes and the public site/PWA graph.

Until that happens, Studio may store WebP/SVG for Web targets. Native Ready Window builds must keep failing closed.

## Related contracts

- Picture display properties (`fit`, `center`, `opacity`) are a separate native fail-closed gate on IR 1.4. Accessible `description` maps onto existing PictureBox `text`.
- `currentNativeContract()` stays `{ id, guiIr, payload, runtime, runtimeTags }`. Format policy is not a field on that facade.
