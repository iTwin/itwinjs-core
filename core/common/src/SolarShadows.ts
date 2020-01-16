/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module DisplayStyles */

import { JsonUtils } from "@bentley/bentleyjs-core";
import {
  ColorByName,
  ColorDef,
  ColorDefProps,
} from "./ColorDef";

/** JSON representation of a solar shadow settings.
 * @beta
 */
export interface SolarShadowProps {
  /** Shadow color */
  color?: ColorDefProps;
  /** Shadow bias - a nonzero bias is required to avoid self-shadowing effects. */
  bias?: number;
}

/** Namespace containing types controlling how solar shadows should be drawn.
 * @beta
 */
export namespace SolarShadows {
  /** JSON representation of a solar shadow settings.
   * @beta
   */
  export interface Props {
    /** Shadow color */
    color?: ColorDefProps;
    /** Shadow bias - a nonzero bias is required to avoid self-shadowing effects. */
    bias?: number;
  }

  /** Solar shadows are imposed as a color scaling on geometry that is occluded from solar lighting.  Shadows are imposed independently
   * of solar lighting and is applied to unlit geometry such as reality models and map tiles.
   * @beta
   */
  export class Settings implements Props {
    private static readonly _defaultBias = .001;
    /** Shadow color */
    public color: ColorDef;
    /** Shadow bias - a nonzero bias is required to avoid self-shadowing effects.
     * @alpha
     */
    public bias: number;

    public constructor(props?: SolarShadowProps) {
      this.bias = props ? JsonUtils.asDouble(props.bias, SolarShadows.Settings._defaultBias) : SolarShadows.Settings._defaultBias;
      this.color = (props !== undefined && props.color !== undefined) ? ColorDef.fromJSON(props.color) : new ColorDef(ColorByName.grey);
    }

    public clone(result?: SolarShadows.Settings): SolarShadows.Settings {
      if (undefined === result)
        return new SolarShadows.Settings(this);

      result.color.setFrom(this.color);
      result.bias = this.bias;
      return result;
    }

    public static fromJSON(props?: Props): Settings { return new Settings(props); }
    public toJSON(): Props {
      return {
        bias: this.bias,
        color: this.color,
      };
    }

    public equals(other: SolarShadows.Settings): boolean {
      if (this === other)
        return true;

      return this.bias === other.bias && this.color.equals(other.color);
    }
  }
}
