/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */

import { NonFunctionPropertiesOf } from "@itwin/core-bentley";
import { GroundPlane } from "./GroundPlane";
import { SkyBox } from "./SkyBox";

export type EnvironmentProperties = NonFunctionPropertiesOf<Environment>;

export class Environment {
  public readonly displaySky: boolean;
  public readonly displayGround: boolean;
  public readonly sky: SkyBox;
  public readonly ground: GroundPlane;

  public constructor(props?: Partial<EnvironmentProperties>) {
    this.displaySky = props?.displaySky ?? false;
    this.displayGround = props?.displayGround ?? false;
    this.sky = props?.sky ?? SkyBox.defaults;
    this.ground = props?.ground ?? GroundPlane.defaults;
  }
}
