/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */

import type { NonFunctionPropertiesOf } from "@itwin/core-bentley";
import type { GroundPlaneProps } from "./GroundPlane";
import { GroundPlane } from "./GroundPlane";
import type { SkyBoxProps } from "./SkyBox";
import { SkyBox } from "./SkyBox";

/** JSON representation of an [[Environment]].
 * @see [[DisplayStyle3dSettingsProps.environment]].
 * @public
 */
export interface EnvironmentProps {
  /** @see [[Environment.ground]] and [[Environment.displayGround]]. */
  ground?: GroundPlaneProps;
  /** @see [[Environment.sky]] and [[Environment.displaySky]]. */
  sky?: SkyBoxProps;
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
  /** Describes how the sky box should be drawn. */
  public readonly sky: SkyBox;
  /** Describes how the ground plane should be drawn. */
  public readonly ground: GroundPlane;

  protected constructor(props?: Partial<EnvironmentProperties>) {
    this.displaySky = props?.displaySky ?? false;
    this.displayGround = props?.displayGround ?? false;
    this.sky = props?.sky ?? SkyBox.defaults;
    this.ground = props?.ground ?? GroundPlane.defaults;
  }

  /** Default settings with neither ground plane nor sky box displayed. */
  public static readonly defaults = new Environment();

  /** Create a new Environment. Any properties not specified by `props` will be initialized to their default values. */
  public static create(props?: Partial<EnvironmentProperties>): Environment {
    return props ? new this(props) : this.defaults;
  }

  /** Create a copy of this environment, changing the `displayGround` and/or `displaySky` flags. */
  public withDisplay(display: { sky?: boolean, ground?: boolean }): Environment {
    const displaySky = display.sky ?? this.displaySky;
    const displayGround = display.ground ?? this.displayGround;
    if (displaySky === this.displaySky && displayGround === this.displayGround)
      return this;

    return Environment.create({
      ...this,
      displaySky: displaySky ?? this.displaySky,
      displayGround: displayGround ?? this.displayGround,
    });
  }

  /** Convert to JSON representation. */
  public toJSON(): EnvironmentProps {
    return {
      sky: this.sky.toJSON(this.displaySky),
      ground: this.ground.toJSON(this.displayGround),
    };
  }

  /** Create from JSON representation. */
  public static fromJSON(props?: EnvironmentProps): Environment {
    if (!props)
      return this.defaults;

    return new this({
      displaySky: props?.sky?.display,
      displayGround: props?.ground?.display,
      sky: props?.sky ? SkyBox.fromJSON(props.sky) : undefined,
      ground: props?.ground ? GroundPlane.fromJSON(props.ground) : undefined,
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
