/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */

import { NonFunctionPropertiesOf } from "@itwin/core-bentley";
import { GroundPlane, GroundPlaneProps } from "./GroundPlane";
import { SkyBox, SkyBoxProps } from "./SkyBox";

/** JSON representation of an [[Environment]].
 * @public
 */
export interface EnvironmentProps {
  ground?: GroundPlaneProps;
  sky?: SkyBoxProps;
}

export type EnvironmentProperties = NonFunctionPropertiesOf<Environment>;

export class Environment {
  public readonly displaySky: boolean;
  public readonly displayGround: boolean;
  public readonly sky: SkyBox;
  public readonly ground: GroundPlane;

  protected constructor(props?: Partial<EnvironmentProperties>) {
    this.displaySky = props?.displaySky ?? false;
    this.displayGround = props?.displayGround ?? false;
    this.sky = props?.sky ?? SkyBox.defaults;
    this.ground = props?.ground ?? GroundPlane.defaults;
  }

  public static readonly defaults = new Environment();

  public static create(props?: Partial<EnvironmentProperties>): Environment {
    return props ? new this(props) : this.defaults;
  }

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

  public toJSON(): EnvironmentProps {
    return {
      sky: this.sky.toJSON(this.displaySky),
      ground: this.ground.toJSON(this.displayGround),
    };
  }

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
}
