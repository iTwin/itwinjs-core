# Google Photorealistic 3D Tiles in iTwin.js

iTwin.js supports displaying Google Photorealistic 3D Tiles via the class [Google3dTilesProvider]($frontend). This provider handles authentication, tile loading, and attribution display.

Here is an example of how to use the new provider by supplying an API key:

```ts
[[include:GooglePhotorealistic3dTiles_providerApiKey]]
```

Instead of an API key, you can also supply a `getAuthToken` function:

```ts
[[include:GooglePhotorealistic3dTiles_providerGetAuthToken]]
```

You can also use the [Google3dTilesProviderOptions]($frontend) `showCreditsOnScreen` flag to control the display of the data attributions on-screen. It is set to `true` by default.

![Google Photorealistic 3D Tiles - Exton](./google-photorealistic-3d-tiles-1.jpg "Google Photorealistic 3D Tiles - Exton")

![Google Photorealistic 3D Tiles - Philadelphia](./google-photorealistic-3d-tiles-2.jpg "Google Photorealistic 3D Tiles - Philadelphia")
