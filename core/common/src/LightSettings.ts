/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */

import { JsonUtils } from "@bentley/bentleyjs-core";
import { Vector3d, XYZProps } from "@bentley/geometry-core";
import { RgbColor, RgbColorProps } from "./RgbColor";

function extractIntensity(value: number | undefined, defaultValue: number) {
  const maxIntensity = 5;
  return typeof value === "number" ? Math.max(0, Math.min(maxIntensity, value)) : defaultValue;
}

/** Wire format for the solar directional light associated with a [[LightSettingsProps]].
 * The light is colored white and oriented in any direction in world coordinates.
 * It will cast shadows if it is above the world XY plane and if the shadows view flag is enabled for the view.
 * By default, the solar light is only applied when shadows are enabled, but can be set to be applied unconditionally.
 * @public
 */
export interface SolarLightProps {
  /** Intensity of the light, typically in [0..1] but can range up to 5. Default: 1.0 */
  intensity?: number;
  /** Direction of the light in world coordinates. Defaults to a vector looking down on the scene at a 45 degree angle mostly along the Y axis. */
  direction?: XYZProps;
  /** If true, the light will be applied even when shadows are turned off for the view.
   * If false, a roughly overhead light of the same intensity oriented in view space will be used instead.
   * Default: false.
   */
  alwaysEnabled?: boolean;
  /** If defined, the time in UNIX milliseconds from which [[direction]] was calculated.
   * @see [[DisplayStyleSettings.setSunTime]] to compute the solar direction from a point in time.
   */
  timePoint?: number;
}

const defaultSolarDirection = Vector3d.create(0.272166, 0.680414, 0.680414);

/** Describes the solar directional light associated with a [[LightSettings]].
 * @see [[SolarLightProps]].
 * @public
 */
export class SolarLight {
  /** Direction of the light in world coordinates. Defaults to a vector looking down on the scene at a 45 degree angle mostly along the Y axis. */
  public readonly direction: Readonly<Vector3d>;
  /** Intensity of the light, typically in [0..1] but can range up to 5. Default: 1.0 */
  public readonly intensity: number;
  /** If true, the light will be applied even when shadows are turned off for the view.
   * If false, a roughly overhead light of the same intensity oriented in view space will be used instead.
   * Default: false.
   */
  public readonly alwaysEnabled: boolean;
  /** If defined, the time in UNIX milliseconds from which [[direction]] was calculated.
   * @see [[DisplayStyleSettings.setSunTime]] to compute the solar direction from a point in time.
   */
  public readonly timePoint?: number;

  public constructor(json?: SolarLightProps) {
    json = json || {};
    this.intensity = extractIntensity(json.intensity, 1);
    this.alwaysEnabled = JsonUtils.asBool(json.alwaysEnabled);

    if (json.direction)
      this.direction = Vector3d.fromJSON(json.direction);
    else
      this.direction = defaultSolarDirection.clone();

    if (typeof json.timePoint === "number")
      this.timePoint = json.timePoint;
  }

  public toJSON(): SolarLightProps | undefined {
    const direction = this.direction.isAlmostEqual(defaultSolarDirection) ? undefined : this.direction.toJSON();
    const intensity = this.intensity !== 1 ? this.intensity : undefined;
    const alwaysEnabled = this.alwaysEnabled ? true : undefined;
    const timePoint = this.timePoint;

    if (undefined === direction && undefined === intensity && undefined === alwaysEnabled && undefined === timePoint)
      return undefined;

    const json: SolarLightProps = {};
    if (direction)
      json.direction = direction;

    if (undefined !== intensity)
      json.intensity = intensity;

    if (undefined !== alwaysEnabled)
      json.alwaysEnabled = alwaysEnabled;

    if (undefined !== timePoint)
      json.timePoint = timePoint;

    return json;
  }

  /** Create a copy of this SolarLight, identical except in any properties explicitly specified by `changedProps`, with a possible exception for [[timePoint]].
   * If `this.timePoint` is defined and `changedProps` defines `direction` but **doesn't** define `timePoint`, the time point will only be preserved in the
   * copy if `changesProps.direction` is equal to `this.direction`.
   */
  public clone(changedProps?: SolarLightProps): SolarLight {
    if (!changedProps)
      return this;

    const props = this.toJSON() ?? {};
    if (undefined !== changedProps.direction)
      props.direction = changedProps.direction;

    if (undefined !== changedProps.intensity)
      props.intensity = changedProps.intensity;

    if (undefined !== changedProps.alwaysEnabled)
      props.alwaysEnabled = changedProps.alwaysEnabled;

    if (undefined !== changedProps.timePoint)
      props.timePoint = changedProps.timePoint;

    // If our direction was computed from a time point and the caller only supplies a direction, invalidate the time point unless the input direction matches our direction.
    // If caller explicitly supplied a timePoint, trust it.
    if (undefined !== this.timePoint && undefined === changedProps.timePoint && undefined !== changedProps.direction) {
      const newDirection = Vector3d.fromJSON(changedProps.direction);
      if (!newDirection.isAlmostEqual(this.direction))
        props.timePoint = undefined;
    }

    return new SolarLight(props);
  }

  public equals(rhs: SolarLight): boolean {
    return this.intensity === rhs.intensity && this.alwaysEnabled === rhs.alwaysEnabled && this.direction.isExactEqual(rhs.direction) && this.timePoint === rhs.timePoint;
  }
}

/** Wire format for the ambient light associated with a [[LightSettingsProps]].
 * Ambient light applies equally to all surfaces in the scene.
 * @public
 */
export interface AmbientLightProps {
  /** The color of the light. Black is treated as a special case, indicating that the surface's own diffuse color should be used. */
  color?: RgbColorProps;
  /** The intensity of the light. Default: 0.2. */
  intensity?: number;
}

/** Describes the ambient light associated with a [[LightSettings]].
 * @see [[AmbientLightProps]]
 * @public
 */
export class AmbientLight {
  public readonly color: RgbColor;
  public readonly intensity: number;

  public constructor(json?: AmbientLightProps) {
    json = json || {};
    this.intensity = extractIntensity(json.intensity, 0.2);
    this.color = json.color ? RgbColor.fromJSON(json.color) : new RgbColor(0, 0, 0);
  }

  public toJSON(): AmbientLightProps | undefined {
    const color = this.color.r !== 0 || this.color.g !== 0 || this.color.b !== 0 ? this.color.toJSON() : undefined;
    const intensity = 0.2 !== this.intensity ? this.intensity : undefined;
    if (undefined === color && undefined === intensity)
      return undefined;

    const json: AmbientLightProps = {};
    if (color)
      json.color = color;

    if (undefined !== intensity)
      json.intensity = intensity;

    return json;
  }

  /** Create a copy of this light, identical except for any properties explicitly specified by `changed`. */
  public clone(changed?: AmbientLightProps): AmbientLight {
    if (!changed)
      return this;

    const props = this.toJSON() ?? {};
    if (undefined !== changed.intensity)
      props.intensity = changed.intensity;

    if (undefined !== changed.color)
      props.color = changed.color;

    return new AmbientLight(props);
  }

  public equals(rhs: AmbientLight): boolean {
    return this.intensity === rhs.intensity && this.color.equals(rhs.color);
  }
}

/** Wire format for a pair of hemisphere lights associated with a [[LightSettingsProps]].
 * Hemisphere lights are oriented in opposite directions along the world Z axis. Each has its own color; they share one intensity.
 * They are often used to simulate outdoor reflection of light from the ground and sky, so the colors often match the ground and sky colors
 * of the [[SkyBox]].
 * @public
 */
export interface HemisphereLightsProps {
  /** The color of the downward-facing light. Default: (143, 205, 255). */
  upperColor?: RgbColorProps;
  /** The color of the upward-facing light. Default: (120, 143, 125). */
  lowerColor?: RgbColorProps;
  /** Intensity of the lights. Default: 0. */
  intensity?: number;
}

const defaultUpperHemisphereColor = new RgbColor(143, 205, 255);
const defaultLowerHemisphereColor = new RgbColor(120, 143, 125);

/** Describes a pair of hemisphere lights associated with a [[LightSettings]].
 * @see [[HemisphereLightsProps]]
 * @public
 */
export class HemisphereLights {
  public readonly upperColor: RgbColor;
  public readonly lowerColor: RgbColor;
  public readonly intensity: number;

  public constructor(json?: HemisphereLightsProps) {
    json = json || {};
    this.intensity = extractIntensity(json.intensity, 0);
    this.upperColor = json.upperColor ? RgbColor.fromJSON(json.upperColor) : defaultUpperHemisphereColor;
    this.lowerColor = json.lowerColor ? RgbColor.fromJSON(json.lowerColor) : defaultLowerHemisphereColor;
  }

  public toJSON(): HemisphereLightsProps | undefined {
    const upperColor = this.upperColor.equals(defaultUpperHemisphereColor) ? undefined : this.upperColor.toJSON();
    const lowerColor = this.lowerColor.equals(defaultLowerHemisphereColor) ? undefined : this.lowerColor.toJSON();
    const intensity = 0 === this.intensity ? undefined : this.intensity;

    if (undefined === upperColor && undefined === lowerColor && undefined === intensity)
      return undefined;

    const json: HemisphereLightsProps = {};
    if (upperColor)
      json.upperColor = upperColor;

    if (lowerColor)
      json.lowerColor = lowerColor;

    if (undefined !== intensity)
      json.intensity = intensity;

    return json;
  }

  /** Create a copy of these lights, identical except for any properties explicitly specified by `changed`. */
  public clone(changed?: HemisphereLightsProps): HemisphereLights {
    if (!changed)
      return this;

    const props = this.toJSON() || {};
    if (undefined !== changed.upperColor)
      props.upperColor = changed.upperColor;

    if (undefined !== changed.lowerColor)
      props.lowerColor = changed.lowerColor;

    if (undefined !== changed.intensity)
      props.intensity = changed.intensity;

    return new HemisphereLights(props);
  }

  public equals(rhs: HemisphereLights): boolean {
    return this.intensity === rhs.intensity && this.upperColor.equals(rhs.upperColor) && this.lowerColor.equals(rhs.lowerColor);
  }
}

/** Wire format for a [[LightSettings]] describing lighting for a 3d scene.
 * 3d lighting provides the following lights, all of which are optional:
 *  - A "portrait" light affixed to the camera and pointing directly forward into the scene. Color: white.
 *  - A second directional light. Color: white.
 *    - This can be a solar shadow-casting light, or (when shadows are disabled) a roughly overhead light oriented in view space.
 *  - A pair of hemisphere lights pointing in opposite directions along the world Z axis. Each has its own customizable color.
 *  - An ambient light of any color applied equally to all surfaces.
 * Specular intensity of all lights is controlled separately.
 * Light intensities are typically expressed in [0..1] but can be as large as 5.
 * @see [[DisplayStyle3dSettingsProps]]
 * @public
 */
export interface LightSettingsProps {
  /** A white portrait light affixed to the camera and pointing directly forward into the scene. */
  portrait?: {
    /** Intensity, typically in [0..1], maximum 5. Default: 0.3. */
    intensity?: number;
  };
  /** Solar light settings. */
  solar?: SolarLightProps;
  /** Hemisphere light settings. */
  hemisphere?: HemisphereLightsProps;
  /** Ambient light settings. */
  ambient?: AmbientLightProps;
  /** Specular intensity applied to all lights. */
  specularIntensity?: number;
  /** Applies a [cel-shaded](https://en.wikipedia.org/wiki/Cel_shading) effect. If greater than zero, specifies the number of cels. Continuous lighting intensities
   * are computed, then quantized to the specified number of cels. Values greater than 254 have no visible effect.
   * Typically a value of 2 is appropriate if specular intensity is close to zero; 3 if specular intensity is larger.
   * Cel-shading is often combined with thick, dark visible edges for a cartoon or comic book effect.
   * Default: 0
   */
  numCels?: number;
}

/** Describes the lighting for a 3d scene, associated with a [[DisplayStyle3dSettings]] in turn associated with a [DisplayStyle3d]($backend) or [DisplayStyle3dState]($frontend).
 * @see [[LightSettingsProps]]
 * @public
 */
export class LightSettings {
  public readonly solar: SolarLight;
  public readonly ambient: AmbientLight;
  public readonly hemisphere: HemisphereLights;
  public readonly portraitIntensity: number;
  public readonly specularIntensity: number;
  public readonly numCels: number;

  private constructor(solar: SolarLight, ambient: AmbientLight, hemisphere: HemisphereLights, portraitIntensity: number, specularIntensity: number, numCels: number) {
    this.solar = solar;
    this.ambient = ambient;
    this.hemisphere = hemisphere;
    this.portraitIntensity = portraitIntensity;
    this.specularIntensity = specularIntensity;
    this.numCels = numCels;
  }

  public static fromJSON(props?: LightSettingsProps): LightSettings {
    const solar = new SolarLight(props?.solar);
    const ambient = new AmbientLight(props?.ambient);
    const hemisphere = new HemisphereLights(props?.hemisphere);
    const portraitIntensity = extractIntensity(props?.portrait?.intensity, 0.3);
    const specularIntensity = extractIntensity(props?.specularIntensity, 1.0);
    const numCels = JsonUtils.asInt(props?.numCels, 0);

    return new LightSettings(solar, ambient, hemisphere, portraitIntensity, specularIntensity, numCels);
  }

  public toJSON(): LightSettingsProps | undefined {
    const solar = this.solar.toJSON();
    const ambient = this.ambient.toJSON();
    const hemisphere = this.hemisphere.toJSON();
    const portrait = 0.3 !== this.portraitIntensity ? { intensity: this.portraitIntensity } : undefined;
    const specularIntensity = 1 !== this.specularIntensity ? this.specularIntensity : undefined;
    const numCels = 0 !== this.numCels ? this.numCels : undefined;

    if (!solar && !ambient && !hemisphere && !portrait && undefined === specularIntensity && undefined === numCels)
      return undefined;

    const json: LightSettingsProps = {};
    if (solar)
      json.solar = solar;

    if (ambient)
      json.ambient = ambient;

    if (hemisphere)
      json.hemisphere = hemisphere;

    if (portrait)
      json.portrait = portrait;

    if (undefined !== specularIntensity)
      json.specularIntensity = specularIntensity;

    if (undefined !== numCels)
      json.numCels = numCels;

    return json;
  }

  /** Create a copy of these light settings, identical except for any properties explicitly specified by `changed`.
   * Note that the solar, ambient, and hemisphere lights will also be cloned using their own `clone` methods - so for example, the following:
   * `  clone({ ambient: { intensity: 0.5 } })`
   * will overwrite the ambient light's intensity but preserve its current color, rather than replacing the color with the default color.
   */
  public clone(changed?: LightSettingsProps): LightSettings {
    if (!changed)
      return this;

    const solar = this.solar.clone(changed.solar);
    const ambient = this.ambient.clone(changed.ambient);
    const hemisphere = this.hemisphere.clone(changed.hemisphere);
    const portrait = changed.portrait?.intensity ?? this.portraitIntensity;
    const specular = changed.specularIntensity ?? this.specularIntensity;
    const numCels = changed.numCels ?? this.numCels;

    return new LightSettings(solar, ambient, hemisphere, portrait, specular, numCels);
  }

  public equals(rhs: LightSettings): boolean {
    if (this === rhs)
      return true;

    return this.portraitIntensity === rhs.portraitIntensity && this.specularIntensity === rhs.specularIntensity && this.numCels === rhs.numCels
      && this.ambient.equals(rhs.ambient) && this.solar.equals(rhs.solar) && this.hemisphere.equals(rhs.hemisphere);
  }
}
