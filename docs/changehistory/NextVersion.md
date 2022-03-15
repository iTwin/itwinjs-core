---
publish: false
---
# NextVersion

<<<<<<< HEAD
## White-on-white reversal for non-white backgrounds

White-on-white reversal causes pure white geometry to be displayed as black when drawn onto a pure white background, where it would otherwise be invisible. However, on light-colored (but not pure white) backgrounds, white geometry can be very difficult to discern. [DisplayStyleSettings.whiteOnWhiteReversal]($common) now provides an option to draw white geometry as black regardless of the background color. The following code demonstrates how to enable this behavior for a [DisplayStyleState]($frontend):

```ts
  // Specify that white-on-white reversal should apply regardless of background color.
  displayStyle.settings.whiteOnWhiteReversal = WhiteOnWhiteReversal.fromJSON({ ignoreBackgroundColor: true });
  // Ensure white-on-white reversal is enabled.
  displayStyle.viewFlags = displayStyle.viewFlags.with("whiteOnWhiteReversal", true);
```
=======
### Detecting integrated graphics

Many computers - especially laptops - contain two graphics processing units: a low-powered "integrated" GPU such as those manufactured by Intel, and a more powerful "discrete" GPU typically manufactured by NVidia or AMD. Operating systems and web browsers often default to using the integrated GPU to reduce power consumption, but this can produce poor performance in graphics-heavy applications like those built with iTwin.js.  We recommend that users adjust their settings to use the discrete GPU if one is available.

iTwin.js applications can now check [WebGLRenderCompatibilityInfo.usingIntegratedGraphics]($webgl-compatibility) to see if the user might experience degraded performance due to the use of integrated graphics. Because WebGL does not provide access to information about specific graphics hardware, this property is only a heuristic. But it will accurately identify integrated Intel chips manufactured within the past 10 years or so, and allow the application to suggest that the user verify whether a discrete GPU is available to use instead. As a simple example:

```ts
  const compatibility = IModelApp.queryRenderCompatibility();
  if (compatibility.usingIntegratedGraphics)
    alert("Integrated graphics are in use. If a discrete GPU is available, consider switching your device or browser to use it.");
```

## ColorDef validation

[ColorDef.fromString]($common) returns [ColorDef.black]($common) if the input is not a valid color string. [ColorDef.create]($common) coerces the input numeric representation into a 32-bit unsigned integer. In either case, this occurs silently. Now, you can use [ColorDef.isValidColor]($common) to determine if your input is valid.

## ColorByName is an object, not an enum

Enums in TypeScript have some shortcomings, one of which resulted in a bug that caused [ColorDef.fromString]($common) to return [ColorDef.black]($common) for some valid color strings like "aqua". This is due to several standard color names ("aqua" and "cyan", "magenta" and "fuschia", and several "grey" vs "gray" variations) having the same numeric values. To address this, [ColorByName]($common) has been converted from an `enum` to a `namespace`. Code that accesses `ColorByName` members by name will continue to compile with no change.
>>>>>>> 84290b9c58 (ColorDef validation and ColorByName fix (#3360))
