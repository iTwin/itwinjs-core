---
publish: false
---
# NextVersion

## @itwin/webgl-compatibility changes

### Detecting integrated graphics

Many computers - especially laptops - contain two graphics processing units: a low-powered "integrated" GPU such as those manufactured by Intel, and a more powerful "discrete" GPU typically manufactured by NVidia or AMD. Operating systems and web browsers often default to using the integrated GPU to reduce power consumption, but this can produce poor performance in graphics-heavy applications like those built with iTwin.js.  We recommend that users adjust their settings to use the discrete GPU if one is available.

iTwin.js applications can now check [WebGLRenderCompatibilityInfo.usingIntegratedGraphics]($webgl-compatibility) to see if the user might experience degraded performance due to the use of integrated graphics. Because WebGL does not provide access to information about specific graphics hardware, this property is only a heuristic. But it will accurately identify integrated Intel chips manufactured within the past 10 years or so, and allow the application to suggest that the user verify whether a discrete GPU is available to use instead. As a simple example:

```ts
  const compatibility = IModelApp.queryRenderCompatibility();
  if (compatibility.usingIntegratedGraphics)
    alert("Integrated graphics are in use. If a discrete GPU is available, consider switching your device or browser to use it.");
```
