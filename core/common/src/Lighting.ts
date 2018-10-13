/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Views */

import { JsonUtils } from "@bentley/bentleyjs-core";
import { ColorDef, ColorDefProps } from "./ColorDef";
import { Angle, AngleProps } from "@bentley/geometry-core";

/** The type of a [[Light]]
 * @hidden
 */
export const enum LightType {
  Invalid = 0,
  Solar = 1,     // Sunlight
  Ambient = 2,   // ambient light
  Flash = 3,     // flash bulb at camera
  Portrait = 4,  // over the shoulder (left and right)
  Point = 5,     // non directional point light source
  Spot = 6,
  Area = 7,
  Distant = 8,
  SkyOpening = 9,
}

/** Parameters to create a [[Light]]
 * @hidden
 */
export interface LightProps {
  lightType?: LightType;  // the type of light from LightType enum
  intensity?: number;     // intensity of the light
  color?: ColorDefProps;  // color of the light. ColorDef as integer
  intensity2?: number;    // for portrait lights, intensity of the "over the left shoulder" light (intensity is the right shoulder light).
  color2?: ColorDefProps; // for left portrait light
  kelvin?: number;        // color temperature, in kelvins. Note that color and kelvins are not independent. Useful for UI, I guess?
  shadows?: number;       // the number of shadow samples
  bulbs?: number;         // number of bulbs
  lumens?: number;
}

/** A light to illuminate the contents of a scene.
 * @hidden
 */
export class Light {
  public lightType: LightType;
  public intensity: number;
  public color: ColorDef;
  public intensity2?: number;
  public color2?: ColorDef;
  public kelvin: number;
  public shadows: number;
  public bulbs: number;
  public lumens: number;

  constructor(opts?: LightProps) {
    opts = opts ? opts : {};
    this.lightType = JsonUtils.asInt(opts.lightType);
    this.intensity = JsonUtils.asDouble(opts.intensity);
    this.kelvin = JsonUtils.asDouble(opts.kelvin);
    this.shadows = JsonUtils.asDouble(opts.shadows);
    this.bulbs = JsonUtils.asInt(opts.bulbs);
    this.lumens = JsonUtils.asDouble(opts.lumens);
    this.color = ColorDef.fromJSON(opts.color);
    if (opts.intensity2)
      this.intensity2 = JsonUtils.asDouble(opts.intensity2);
    if (opts.color2)
      this.color2 = ColorDef.fromJSON(opts.color2);
  }

  public get isValid(): boolean { return this.lightType !== LightType.Invalid; }
  public get isVisible(): boolean { return this.isValid && this.intensity > 0.0; }
}

/** Properties of a [[LightType.Spot]] light.
 * @hidden
 */
export interface SpotProps extends LightProps {
  inner?: AngleProps;
  outer?: AngleProps;
}

/** A light from a single location.
 * @hidden
 */
export class Spot extends Light {
  public inner: Angle;
  public outer: Angle;

  constructor(opts?: SpotProps) {
    opts = opts ? opts : {};
    super(opts);
    this.lightType = LightType.Spot;
    this.inner = Angle.fromJSON(opts.inner);
    this.outer = Angle.fromJSON(opts.outer);
  }
}
