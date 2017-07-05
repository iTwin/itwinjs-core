/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { ColorDef } from "./IModel";
import { Angle } from "../../geometry-core/lib/Geometry";

export enum LightType {
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

/** a light to illuminate the contents of a scene */
export class Light {
  public lightType: LightType;  // the type of light from LightType enum
  public intensity: number;     // intensity of the light
  public color: ColorDef;       // color of the light. ColorDef as integer
  public intensity2?: number;   // for portrait lights, intensity of the "over the left shoulder" light (intensity is the right shoulder light).
  public color2?: ColorDef;     // for left portrait light
  public kelvin: number;        // color temperature, in kelvins. Note that color and kelvins are not independent. Useful for UI, I guess?
  public shadows: number;       // the number of shadow samples
  public bulbs: number;         // number of bulbs
  public lumens: number;

  public isValid(): boolean { return this.lightType !== LightType.Invalid; }
  public isVisible(): boolean { return this.isValid() && this.intensity > 0.0; }
}

/** a light from a single location  */
export class Spot extends Light {
  public inner: Angle;
  public outer: Angle;
}
