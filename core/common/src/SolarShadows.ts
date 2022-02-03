/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */

import { JsonUtils } from "@itwin/core-bentley";
import { ColorByName } from "./ColorByName";
import type { ColorDefProps } from "./ColorDef";
import { ColorDef } from "./ColorDef";
import { RgbColor } from "./RgbColor";

/** JSON representation of [[SolarShadowSettings]].
 * @public
 */
export interface SolarShadowSettingsProps {
  /** Shadow color. Default: [[ColorByName.grey]]. */
  color?: ColorDefProps;
  /** @internal */
  bias?: number;
}

const defaultColor = RgbColor.fromColorDef(ColorDef.fromTbgr(ColorByName.grey));

/** Settings controlling display of solar shadows for a [[DisplayStyle3dSettings]].
 * Solar shadows are imposed as a color scaling on geometry occluded from solar lighting.
 * @public
 */
export class SolarShadowSettings {
  /** Shadow color. */
  public readonly color: RgbColor;
  /** @internal */
  public readonly bias: number;

  private constructor(props: SolarShadowSettingsProps) {
    this.bias = JsonUtils.asDouble(props.bias, 0.001);
    if (undefined === props.color || null === props.color)
      this.color = defaultColor;
    else
      this.color = RgbColor.fromColorDef(ColorDef.fromJSON(props.color));
  }

  public static defaults = new SolarShadowSettings({});

  public static fromJSON(props?: SolarShadowSettingsProps): SolarShadowSettings {
    return props ? new SolarShadowSettings(props) : this.defaults;
  }

  public toJSON(): SolarShadowSettingsProps | undefined {
    const defaults = SolarShadowSettings.defaults;
    if (this.equals(defaults))
      return undefined;

    const props: SolarShadowSettingsProps = {};
    if (!this.color.equals(defaults.color))
      props.color = this.color.toColorDef().toJSON();

    if (this.bias !== defaults.bias)
      props.bias = this.bias;

    return props;
  }

  public equals(rhs: SolarShadowSettings): boolean {
    return this.bias === rhs.bias && this.color.equals(rhs.color);
  }

  /** Create a copy of these settings.
   * @param changedProps Any property explicitly defined will be overridden in the copy.
   * @returns A settings object equivalent to this one except for any properties explicitly overridden by `changedProps`.
   */
  public clone(changedProps?: SolarShadowSettingsProps): SolarShadowSettings {
    if (!changedProps)
      return this;

    const props = this.toJSON() ?? {};
    if (changedProps.color)
      props.color = changedProps.color;

    if (undefined !== changedProps.bias)
      props.bias = changedProps.bias;

    return SolarShadowSettings.fromJSON(props);
  }
}
