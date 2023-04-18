/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */

import { NonFunctionPropertiesOf } from "@itwin/core-bentley";
import { Atmosphere } from "./Atmosphere";
import { GroundPlane, GroundPlaneProps } from "./GroundPlane";
import { SkyBox, SkyBoxProps } from "./SkyBox";

/** JSON representation of an [[Environment]].
 * @see [[DisplayStyle3dSettingsProps.environment]].
 * @public
 * @extensions
 */
export interface EnvironmentProps {
  /** See [[Environment.ground]] and [[Environment.displayGround]]. */
  ground?: GroundPlaneProps;
  /** See [[Environment.sky]] and [[Environment.displaySky]]. */
  sky?: SkyBoxProps;
  /** @beta See [[Environment.atmosphere]] and [[Environment.displayAtmosphere]]. */
  atmosphere?: Atmosphere.Props;
}

/** A type containing all of the properties of [[Environment]] with none of the methods and with the `readonly` modifiers removed.
 * @see [[Environment.create]] and [[Environment.clone]].
 * @public
 */
export type EnvironmentProperties = NonFunctionPropertiesOf<Environment>;

/** As part of a [[DisplayStyle3dSettings]], controls the display of a [[SkyBox]] and [[GroundPlane]] to simulate the
 * outdoor environment.
 * @see [[DisplayStyle3dSettings.environment]].
 * @public
 */
export class Environment {
  /** If true, the sky box will be displayed.
   * Default: false.
   * @see [[withDisplay]] or [[DisplayStyle3dSettings.toggleSkyBox]] to change this.
   */
  public readonly displaySky: boolean;
  /** If true, the ground plane will be displayed.
   * Default: false.
   * @see [[withDisplay]] or [[DisplayStyle3dSettings.toggleGroundPlane]] to change this.
   */
  public readonly displayGround: boolean;
  /**
   * @beta
   * If true, the atmosphere will be displayed. Enabling this will override any color information provided to the sky box.
   * Default: false.
   * @see [[withDisplay]] or [[DisplayStyle3dSettings.toggleAtmosphere]] to change this.
   */
  public readonly displayAtmosphere: boolean;

  /** Describes how the sky box should be drawn. */
  public readonly sky: SkyBox;
  /** Describes how the ground plane should be drawn. */
  public readonly ground: GroundPlane;
  /** @beta Describes how the atmosphere should be drawn */
  public readonly atmosphere: Atmosphere.Settings;

  protected constructor(props?: Partial<EnvironmentProperties>) {
    this.displaySky = props?.displaySky ?? false;
    this.displayGround = props?.displayGround ?? false;
    this.displayAtmosphere = props?.displayAtmosphere ?? false;
    this.sky = props?.sky ?? SkyBox.defaults;
    this.ground = props?.ground ?? GroundPlane.defaults;
    this.atmosphere = props?.atmosphere ?? Atmosphere.Settings.defaults;
  }

  /** Default settings without a ground plane, sky box, or atmosphere displayed. */
  public static readonly defaults = new Environment();

  /** Create a new Environment. Any properties not specified by `props` will be initialized to their default values. */
  public static create(props?: Partial<EnvironmentProperties>): Environment {
    return props ? new this(props) : this.defaults;
  }

  /** Create a copy of this environment, changing the `displayGround`, `displaySky` and/or `displayAtmosphere` flags. */
  public withDisplay(display: { sky?: boolean, ground?: boolean, atmosphere?: boolean }): Environment {
    const displaySky = display.sky ?? this.displaySky;
    const displayGround = display.ground ?? this.displayGround;
    const displayAtmosphere = display.atmosphere ?? this.displayAtmosphere;
    if (displaySky === this.displaySky && displayGround === this.displayGround && displayAtmosphere === this.displayAtmosphere)
      return this;

    return Environment.create({
      ...this,
      displaySky: displaySky ?? this.displaySky,
      displayGround: displayGround ?? this.displayGround,
      displayAtmosphere: displayAtmosphere ?? this.displayAtmosphere,
    });
  }

  /** Convert to JSON representation. */
  public toJSON(): EnvironmentProps {
    return {
      sky: this.sky.toJSON(this.displaySky),
      ground: this.ground.toJSON(this.displayGround),
      atmosphere: this.atmosphere.toJSON(this.displayAtmosphere),
    };
  }

  /** Create from JSON representation. */
  public static fromJSON(props?: EnvironmentProps): Environment {
    if (!props)
      return this.defaults;

    return new this({
      displaySky: props?.sky?.display,
      displayGround: props?.ground?.display,
      displayAtmosphere: props?.atmosphere?.display,
      sky: props?.sky ? SkyBox.fromJSON(props.sky) : undefined,
      ground: props?.ground ? GroundPlane.fromJSON(props.ground) : undefined,
      atmosphere: props?.atmosphere ? Atmosphere.Settings.fromJSON(props.atmosphere) : undefined,
    });
  }

  /** Create a copy of this environment, identical except for any properties specified by `changedProps`.
   * Any properties of `changedProps` explicitly set to `undefined` will be reset to their default values.
   */
  public clone(changedProps?: Partial<EnvironmentProperties>): Environment {
    if (!changedProps)
      return this;

    return Environment.create({ ...this, ...changedProps });
  }
}
