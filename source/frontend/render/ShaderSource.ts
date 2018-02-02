/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
export namespace ShaderSource {
  export const enum FeatureSymbologyOptions {
    None = 0,
    Weight = 1 << 0,
    LineCode = 1 << 1,
    HasOverrides = 1 << 2,
    Color = 1 << 3,

    // Normal feature shaders
    Surface = HasOverrides | Color,
    Linear = HasOverrides | Color | Weight | LineCode,
    Point = HasOverrides | Color | Weight,
  }
}
