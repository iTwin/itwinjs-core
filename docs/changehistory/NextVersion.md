---
publish: false
---

# NextVersion

Table of contents:

- [Electron 36 support](#electron-36-support)
- [Google Photorealistic 3D Tiles support](#google-photorealistic-3d-tiles-support)
- [API deprecations](#api-deprecations)
  - [@itwin/presentation-backend](#itwinpresentation-backend)
  - [@itwin/presentation-frontend](#itwinpresentation-frontend)

## Electron 36 support

In addition to [already supported Electron versions](../learning/SupportedPlatforms.md#electron), iTwin.js now supports [Electron 36](https://www.electronjs.org/blog/electron-36-0).

## Google Photorealistic 3D Tiles support

iTwin.js now supports displaying Google Photorealistic 3D Tiles (GP3DT) via the new `RealityDataSourceGP3DTProvider`. This provider handles authentication, tile loading, and attribution display for GP3DT.

Here is an example of how to use the new provider by supplying an API key:

```ts
const provider = new RealityDataSourceGP3DTProvider({ apiKey: process.env.IMJS_GP3DT_KEY });
await provider.initialize();
IModelApp.realityDataSourceProviders.register("GP3DT", provider);

view.displayStyle.attachRealityModel({
  tilesetUrl: getGooglePhotorealistic3DTilesURL(),
  name: "googleMap3dTiles",
  rdSourceKey: {
    provider: "GP3DT",
    format: "ThreeDTile",
    id: getGooglePhotorealistic3DTilesURL(),
  },
});
```

Instead of an API key, you can also supply a `getAuthToken` function:

```ts
const fetchToken = async () => {
  const apiUrl = "https://my-api.com/";
  const response = await fetch(apiUrl);
  const data = await response.json();
  return data.accessToken;
}
const provider = new RealityDataSourceGP3DTProvider({ getAuthToken: fetchToken });
```

You can also use the `showCreditsOnScreen` flag in the provider options to control the display of the data attributions on-screen. It is set to `true` by default.

![Google Photorealistic 3D Tiles - Exton](./assets/google-photorealistic-3d-tiles-1.jpg "Google Photorealistic 3D Tiles - Exton")

![Google Photorealistic 3D Tiles - Philadelphia](./assets/google-photorealistic-3d-tiles-2.jpg "Google Photorealistic 3D Tiles - Philadelphia")

## API deprecations

### @itwin/presentation-backend

- The `PresentationManagerProps.schemaContextProvider` property has been deprecated. Starting with `5.0` release, `SchemaContext` is always available on [IModelDb]($core-backend), so this prop is no longer needed. If supplied, it will still be preferred over the iModel's schema context, until the property is removed completely in a future release.

### @itwin/presentation-frontend

- The `PresentationManagerProps.schemaContextProvider` property has been deprecated. Starting with `5.0` release, `SchemaContext` is always available on [IModelConnection]($core-frontend), so this prop is no longer needed. If supplied, it will still be preferred over the iModel's schema context, until the property is removed completely in a future release.
