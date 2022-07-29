/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */

import { NonFunctionPropertiesOf } from "@itwin/core-bentley";
import { AtmosphericSky, AtmosphericSkyProps } from "./AtmosphericScattering";
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
  atmosphericSky?: AtmosphericSkyProps;
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
  public readonly displayAtmosphericSky: boolean;
  /** Describes how the sky box should be drawn. */
  public readonly sky: SkyBox;
  /** Describes how the ground plane should be drawn. */
  public readonly ground: GroundPlane;

  public readonly atmosphericSky: AtmosphericSky;

  protected constructor(props?: Partial<EnvironmentProperties>) {
    this.displaySky = props?.displaySky ?? false;
    this.displayGround = props?.displayGround ?? false;
    this.displayAtmosphericSky = props?.displayAtmosphericSky ?? false;
    this.sky = props?.sky ?? SkyBox.defaults;
    this.ground = props?.ground ?? GroundPlane.defaults;
    this.atmosphericSky = props?.atmosphericSky ?? AtmosphericSky.defaults;
  }

  /** Default settings with neither ground plane nor sky box displayed. */
  public static readonly defaults = new Environment();

  /** Create a new Environment. Any properties not specified by `props` will be initialized to their default values. */
  public static create(props?: Partial<EnvironmentProperties>): Environment {
    return props ? new this(props) : this.defaults;
  }

  /** Create a copy of this environment, changing the `displayGround` and/or `displaySky` flags. */
  public withDisplay(display: { sky?: boolean, ground?: boolean, atmosphericSky?: boolean }): Environment {
    const displaySky = display.sky ?? this.displaySky;
    const displayGround = display.ground ?? this.displayGround;
    const displayAtmosphericSky = display.atmosphericSky ?? this.displayAtmosphericSky;
    if (displaySky === this.displaySky && displayGround === this.displayGround && displayAtmosphericSky === this.displayAtmosphericSky)
      return this;

    return Environment.create({
      ...this,
      displaySky: displaySky ?? this.displaySky,
      displayGround: displayGround ?? this.displayGround,
      displayAtmosphericSky: displayAtmosphericSky ?? this.displayAtmosphericSky,
    });
  }

  /** Convert to JSON representation. */
  public toJSON(): EnvironmentProps {
    return {
      sky: this.sky.toJSON(this.displaySky),
      ground: this.ground.toJSON(this.displayGround),
      atmosphericSky: this.atmosphericSky.toJSON(this.displayAtmosphericSky),
    };
  }

  /** Create from JSON representation. */
  public static fromJSON(props?: EnvironmentProps): Environment {
    if (!props)
      return this.defaults;

    return new this({
      displaySky: props?.sky?.display,
      displayGround: props?.ground?.display,
      displayAtmosphericSky: props?.atmosphericSky?.display,
      sky: props?.sky ? SkyBox.fromJSON(props.sky) : undefined,
      ground: props?.ground ? GroundPlane.fromJSON(props.ground) : undefined,
      atmosphericSky: props?.atmosphericSky ? AtmosphericSky.fromJSON(props.atmosphericSky) : undefined,
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
