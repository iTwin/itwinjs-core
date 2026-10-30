# Gaussian splats preview

The native iTwin.js WebGL2 renderer can display Gaussian splat reality models through the existing 3D Tiles pipeline.

A Gaussian splat capture represents a scene as millions of soft, colored 3D blobs that blend together on screen. Captured from photos or video, splats show detail that meshes handle poorly, such as foliage, glass, and thin structures, but they have no surfaces. Use them as visual context alongside an iModel: picking, snapping, measurement geometry and section cuts are not supported.

This alpha preview is disabled by default.

## Enable the preview

Enable Gaussian splats when the application starts:

```ts
await IModelApp.startup({
  renderSys: { enableGaussianSplats: true },
});
```

Attach a compatible 3D Tiles tileset through the existing reality-model API:

```ts
viewport.displayStyle.attachRealityModel({
  tilesetUrl: "https://example.com/splats/tileset.json",
  name: "Gaussian capture",
});
viewport.invalidateScene();
```

For Cesium ion assets, configure a [CesiumAccessClient]($frontend) or set `TileAdmin.Props.cesiumIonKey`, and identify the asset with a Cesium ion reality data source key. Tile content and external glTF buffers load through the existing reality-data transport.

## Supported content

| Content                                            | Preview support                                                                                                                                                             |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3D Tiles                                           | Explicit tile trees with one GLB/glTF per tile, including nested external tilesets, whose tileset declares `KHR_gaussian_splatting` in its `3DTILES_content_gltf` extension |
| `KHR_gaussian_splatting`                           | Ellipse kernel, linear scales, normalized opacity, xyzw rotation, and complete spherical harmonics through degree 3                                                         |
| Trained color spaces                               | `srgb_rec709_display` and `lin_rec709_display`                                                                                                                              |
| `KHR_gaussian_splatting_compression_spz_2` (draft) | SPZ version 2 payloads, decoded to glTF LUF coordinates as the draft requires                                                                                               |
| Cesium ion's draft content                         | SPZ version 3 payloads in the draft layout (`COLOR_0` placeholders, no `kernel`, `colorSpace` or degree-zero spherical harmonics), with stored coordinates preserved        |
| Views                                              | Perspective and orthographic 3D views                                                                                                                                       |
| Scene integration                                  | View and branch clipping, opaque BIM depth (also in views with MSAA), and uniform color/transparency overrides                                                              |

`KHR_gaussian_splatting` is ratified. `KHR_gaussian_splatting_compression_spz_2` is a draft (Khronos glTF pull request 2531), so its metadata and payload conventions can change.

Cesium ion serves content that predates the draft. Its payloads are SPZ version 3, stored without the LUF conversion that the draft requires, and CesiumJS 1.146 decodes them as stored. iTwin.js decodes SPZ 3 payloads in the draft layout the same way. It decodes an SPZ 2 payload in LUF coordinates even in the draft layout, so that content written to the draft text is not mistaken for ion content. This adapter will be removed when Cesium ion serves content that follows the extensions, or when CesiumJS decodes that content in LUF.

Splats are drawn as the forward pass of the 3D Gaussian Splatting paper draws them, as `KHR_gaussian_splatting` asks: the projected covariance is widened by 0.3 square pixels and cut off at three sigma. CesiumJS 1.146 widens it by only 0.01875 square pixels and cuts off at 2.83 sigma. (Its stored covariance is four times the true one, and its focal length is twice the pixel focal length, so its 0.3 amounts to 0.3/16 square pixels.) Thin and distant splats therefore look slightly wider, softer and more opaque than in CesiumJS. Over a dark background, the field looks a little brighter. As in CesiumJS, the projected semi-axes of a splat are capped at 512 pixels at three sigma. The cap is in CSS pixels, so very near splats cover the same part of the view on high-DPI displays as on other displays.

A tileset that does not declare `KHR_gaussian_splatting` is drawn as an ordinary reality model. Its splat primitives are drawn as colored points, the fallback that the extension provides for loaders without splat support. Splats must be declared because their tiles are selected differently: a tile is replaced only when all its children are ready. Splats cannot be clipped to the region of a tile, so a tile drawn together with its children would show both. Splats in a glTF asset that [readGltf]($frontend) reads, for example for a decoration, are drawn as splats.

The original `KHR_spz_gaussian_splats_compression` extension is not supported. Retile that content with the current Cesium ion pipeline.

The preview does not support:

- Implicit tiling or multiple contents per tile.
- Standalone PLY or SPZ files.
- Reconstruction, upload, export, or tiling.

## Rendering and interaction limits

Splats blend in one viewport pass, sorted together across all tiles, after opaque geometry and before ordinary translucent geometry. Opaque BIM geometry can occlude splats.

The renderer composes colors in the trained color space that the content declares, before it converts them for display:

- Splats trained in display space (`srgb_rec709_display`, nearly all content) blend directly into the view: premultiplied, back to front, at the view's 8 bits per channel.
- Splats trained in linear space (`lin_rec709_display`) must blend in linear space. They blend into a separate color field, which is then converted and composited into the view. The field uses half floats where the device can render floating-point colors. Otherwise it uses 8 bits, which loses precision.

Splats are not multisampled. In a view with MSAA, they are drawn into the resolved single-sample image and tested against the resolved depth, so their edges against BIM geometry are not antialiased. Blending every splat into each sample would cost several times as much.

The preview does not support:

- Interleaving fields trained in different color spaces.
- Volume or planar classification, and planar clip masks: a reality model's planar clip mask does not clip its splats.
- Thematic display or selection highlighting.

During tile refinement, the renderer keeps a completed field until its replacement has ready coverage and a completed sort. Initial content appears after its first sort and can load progressively. Detail changes do not crossfade.

Because the sort runs on a worker, splats appear one or more frames after their tiles are ready. An image rendered in a single frame therefore includes no splats. Examples are an image that an [OffScreenViewport]($frontend) renders for [Viewport.readImageBuffer]($frontend), and a thumbnail.

## Limitations

Splats write no depth, so passes drawn after them see only opaque geometry.

Translucent BIM geometry is depth-tested against opaque geometry only. Translucent BIM behind splats is therefore drawn over them, as if it were in front. In this image, a translucent blue slab lies beneath the ground of the scan. It shows through the trees and through the building that stands on it:

![Translucent BIM behind splats drawn over them](./assets/gaussian-splats-translucent-bim.jpg)

Ambient occlusion is computed from opaque geometry before splats are drawn, and then darkens every pixel. The occlusion of BIM behind splats therefore darkens the splats in front of it. In this image, ambient occlusion is off on the left and on on the right. In addition to the shading at the edges of the BIM boxes, the occlusion of the slab beneath the scan darkens the splats above it:

![Ambient occlusion off and on](./assets/gaussian-splats-ambient-occlusion.jpg)

## Picking and navigation

Native Gaussian splats do not write model IDs or depth into the picking buffers. You cannot select, locate or snap to them, and they supply no measurement points or semantic object properties. Ordinary BIM picking and snapping stay available, also for BIM behind visible splats: splats do not occlude pick results.

View tools keep their existing behavior. When a view that shows only splats supplies no geometry hit, navigation uses the existing reference plane or view-target fallback. Rotation and zoom therefore do not anchor to the visible splat surface. No shared tool event handling is changed.

Approximate splat picking is deferred until a real interaction requirement defines its scope and the accuracy it needs.

## Deployment

The splat renderer loads on demand, through a dynamic `import()`. A render system created with `enableGaussianSplats` starts to load it immediately, so it is usually ready before the first splat tile arrives. A tile that arrives first waits for it. Applications that leave the option off never load it. Bundlers that split dynamic imports, such as Vite, Rollup, webpack and esbuild, put the renderer in its own chunk. Deploy that chunk with the application's other chunks.

Deploy the frontend package's public assets with the application, including `scripts/gaussian-splats-worker.js`. Use the same [IModelApp.publicPath]($frontend) configuration as for other frontend workers. Keep the frontend package's `ThirdPartyNotices.md` in your application's third-party notices: the worker's SPZ decoder follows Niantic's MIT-licensed reference implementation.

SPZ decoding and sorting run in a browser worker, in JavaScript. The Content Security Policy must allow the worker. It does not need to allow WebAssembly.

For a public path on another origin, support the existing blob/importScripts worker pattern and supply the correct CORS headers.

## Memory and detail

Splat tiles count toward [TileAdmin.gpuMemoryLimit]($frontend), like all tile content. There is no separate splat budget.

A splat takes 32 bytes, plus 16, 32 or 48 bytes for spherical harmonic degrees 1, 2 or 3. A tile's memory is this packed data on the CPU, plus the same data in a GPU texture atlas that all viewports share. The GPU copy exists only while a viewport displays the tile. For example, at full detail the Redmond campus capture (Cesium ion asset 4547222) selects 65 tiles and 1.85 million splats in a 1440 by 900 view.

When the tiles in use exceed the limit, splat models, and other reality models that select tiles by geometric error, switch to coarser tiles, as in CesiumJS. Detail returns gradually when the tiles use less memory again. iModel tiles cannot be coarsened, so these models always keep at least half of the limit. A static view settles at one level of detail. It does not switch back and forth.

The GPU also limits the size of the atlas, through its maximum number of texture array layers. On many GPUs, this is about 33 million splats at degree 0, and fewer at higher degrees. When the splats of a view do not fit, the viewport keeps showing its previous splats, and the models switch to coarser tiles.

Memory statistics also report the sorting worker of each viewport and the shared decoding worker. Their memory does not count toward the limit.

### Tile limits

A tile can hold at most 2,097,152 splats, and decoding it can use at most 512 MiB. At higher spherical harmonic degrees, the memory limit allows fewer splats:

| Degree | SPZ | Float attributes |
| --- | --- | --- |
| 0 and 1 | 2,097,152 | 2,097,152 |
| 2 | About 2.06 million | About 1.46 million |
| 3 | About 1.41 million | About 0.97 million |

A tile that exceeds a limit is rejected before its data is copied or decompressed. Producers must split larger tiles.

### Color precision

Colors are stored with a precision set for display (sRGB) values, which is finer than SPZ's own 8-bit color. Content trained in linear space (`lin_rec709_display`) can show banding in very dark gradients. Train or export content with deep shadows in `srgb_rec709_display`.

### Decoder failures

The decoding worker decodes one tile at a time. If its script fails to load, or a decode takes more than 30 seconds, the worker is replaced and the tile is requested again. After three consecutive failures, a tile that fails is left empty. Tiles therefore do not retry forever when the decoder cannot run at all, for example when the worker script is not deployed (see [Deployment](#deployment)).
