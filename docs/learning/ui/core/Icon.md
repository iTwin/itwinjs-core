# Icon

The [Icon]($ui-core:Icon) category in the `@bentley/ui-core` package includes components that render icons when given an icon name or SVG source or path.

The [Icon]($ui-core) React component displays an icon based on an IconSpec.
An [IconSpec]($ui-core:Icon) can be a string, ReactNode or
[ConditionalStringValue]($ui-abstract).
When the IconSpec is a string, the value is either a Webfont name or a formatted string that includes an imported SVG.
When using an SVG, it must be imported using the webpack loader `svg-sprite-loader`.
The formatted string begins with "svg:".
The `IconSpecUtilities.createSvgIconSpec` can be used to format the SVG string. See example usage below.

The [SvgSprite]($ui-core) React component displays an icon using `<svg>` and `<use>` elements to reference an imported SVG file. The SVG file must be imported using the webpack loader `svg-sprite-loader`.

The [SvgSprite]($ui-core) React component displays an icon using an `<svg>` element and an array of SVG paths.

## Examples

We will demonstrate four different ways to display an icon.

### Icon and Webfont name

```tsx
<Icon iconSpec="icon-placeholder" />
```

### Icon and SVG from @bentley/icons-generic

This example shows how to use an SVG from `@bentley/icons-generic`.

```tsx
import { IconSpecUtilities } from "@bentley/ui-abstract";
import { Icon } from "@bentley/ui-core";

import placeholderSvg from "@bentley/icons-generic/icons/placeholder.svg?sprite";
. . .
const iconSpec = IconSpecUtilities.createSvgIconSpec(placeholderSvg);
. . .
<Icon iconSpec={iconSpec} />
```

### Icon and SVG File

This example shows how to use an SVG from within the application.

```tsx
import rotateSvg from "../icons/rotate.svg?sprite";
. . .
const iconSpec = IconSpecUtilities.createSvgIconSpec(rotateSvg);
. . .
<Icon iconSpec={iconSpec} />
```

### SvgSprite and SVG File

Rather then using the Icon component with SVG files, the SvgSprite component can be used.

```tsx
import { Icon } from "@bentley/ui-core";
import rotateSvg from "../icons/rotate.svg?sprite";
. . .
<SvgSprite src={rotateSvg} />
```

### SvgPath

When you have SVG path statements instead of SVG files, the SvgPath component can be used.

```tsx
import { SvgPath } from "@bentley/ui-core";
. . .
      <SvgPath viewBoxWidth={91} viewBoxHeight={91} paths={[
        "M86.734,49.492c-4.305,0.01-17.991,1.527-20.508,1.943c-1.589,0.261-3.454,0.267-4.732,1.335   c-1.173,0.98-0.649,2.788,0.453,3.52c1.182,0.78,17.18,0.641,19.686,0.645c-0.216,0.404-4.764,8.202-7.226,11.423   c-4.994,6.53-12.322,11.926-20.213,14.39c-9.906,3.093-21.47,0.982-30.055-4.716c-4.252-2.82-7.595-6.813-10.364-11.047   c-2.37-3.625-4.53-8.918-8.038-11.526c-0.238-0.18-0.687-0.002-0.732,0.298c-0.548,3.663,1.414,7.707,2.843,10.992   c1.7,3.904,4.146,7.539,6.933,10.755c5.891,6.799,14.97,10.758,23.738,12.057c15.313,2.272,30.362-4.708,39.961-16.643   c2.182-2.715,4.058-5.652,5.88-8.618c-0.04,4.63-0.08,9.262-0.109,13.891c-0.026,4.004,6.195,4.008,6.222,0   c0.054-8.303,0.122-16.604,0.122-24.907C90.594,51.061,87.978,49.49,86.734,49.492z",
        "M17.98,20.688c5.096-5.933,12.107-11.209,19.818-13.11c10.523-2.591,23.726,1.216,31.448,8.788   c3.523,3.45,6.227,7.538,8.734,11.751c2.084,3.496,4.084,8.505,7.364,11.009c0.244,0.187,0.678-0.004,0.731-0.296   c0.637-3.572-1.238-7.563-2.511-10.82c-1.516-3.889-3.713-7.637-6.163-11.013C72.166,9.786,64.534,5.113,56.037,2.605   C39.996-2.125,24.416,4.048,13.693,16.4c-2.328,2.684-4.36,5.616-6.345,8.567c0.256-3.586,0.517-7.172,0.765-10.759   c0.278-3.995-5.944-3.977-6.221,0c-0.492,7.064-1.519,21.896-1.484,22.229c0.013,0.612-0.002,3.301,2.793,3.301   c3.233,0.002,10.855-0.29,14.028-0.466c2.881-0.16,5.805-0.179,8.675-0.475c1.158-0.121,3.727-0.079,3.836-1.451   c0.175-2.197-3.893-3.01-4.988-3.118c-3.061-0.304-13.198-1.281-15.208-1.447c0.288-0.488,0.571-0.964,0.853-1.389   C12.798,27.753,15.135,24.001,17.98,20.688z",
      ]} />

```

## SVG Support Setup

A few entries are required in the package,.json and tsconfig.json to support SVG files.

In package.json, add a dependency on `svg-sprite-loader` to load the SVG files:

```json
"dependencies": {
. . .
    "svg-sprite-loader": "^3.8.0"
```

In package.json, add a `sourceResources` entry in the `iModelJS.buildModule` section
to copy SVG files to the `lib` directory:

```json
  "iModelJs": {
    "buildModule": {
      "type": "application",
      "sourceResources": [
. . .
        {
          "source": "./src/**/*.svg",
          "dest": "./lib"
        },
```

In tsconfig.json, add a `types` entry for `@bentley/webpack-tools` in the `compilerOptions` section to support SVG files:

```json
"compilerOptions": {
. . .
    "types": [
      "@bentley/webpack-tools"
    ]
```

## API Reference

- [Icon]($ui-core:Icon)
