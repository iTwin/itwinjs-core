# @itwin/cesium-renderer

Copyright © Bentley Systems, Incorporated. All rights reserved. See LICENSE.md for license terms and full copyright notice.

## Description

The __@itwin/cesium-renderer__ package provides an alternative CesiumJS-based renderer for iTwin.js.

## Documentation

See the [iTwin.js](https://www.itwinjs.org) and [CesiumJS](https://cesium.com/learn/cesiumjs/ref-doc/) documentation for more information.

## Running the Example

1. Follow the instructions on [how to run display-test-app](https://github.com/iTwin/itwinjs-core/tree/master/test-apps/display-test-app#getting-started)
2. Set the environment variable `IMJS_USE_CESIUM=1`
3. Click the star-shaped icon in the top toolbar of the UI.
4. Observe that the Cesium globe renders. Some test decorations are rendered on top of it.
5. To control the Cesium camera you can use the following keyboard shortcuts:
    1. Press `ctrl` + `w`, `a`, `s`, `d` to move in and out and rotate
    2. Press `ctrl` + arrow keys to pan
6. The default iTwin.js mouse controls (wheel zoom, middle-drag pan, etc.) also drive the Cesium camera.

## Experimental: streaming a 3D Tiles tileset

`attachCesiumTileset(viewport, { url, modelMatrix?, zoomTo? })` adds a 3D Tiles tileset directly to the Cesium scene behind a viewport, bypassing iTwin.js tile trees. `modelMatrix` defaults to identity, since published iModel tilesets are already in ECEF. `zoomTo` zooms the viewport to the tileset (geolocated iModels only). It returns a function that removes the tileset.

In display-test-app, set both `IMJS_USE_CESIUM=1` and `IMJS_FRONTEND_TILES_URL_TEMPLATE` to stream the published mesh export tileset through Cesium instead of `@itwin/frontend-tiles`.
