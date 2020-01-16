/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module DisplayStyles */

import { Id64String } from "@bentley/bentleyjs-core";
import { ColorDefProps } from "./ColorDef";

/** Enumerates the supported types of [SkyBox]($frontend) images.
 * @public
 */
export enum SkyBoxImageType {
  None,
  /** A single image mapped to the surface of a sphere. @see [[SkySphere]] */
  Spherical,
  /** 6 images mapped to the faces of a cube. @see [[SkyCube]] */
  Cube,
  /** @internal not yet supported */
  Cylindrical,
}

/** JSON representation of a set of images used by a [[SkyCube]]. Each property specifies the element ID of a texture associated with one face of the cube.
 * @public
 */
export interface SkyCubeProps {
  /** Id of a persistent texture element stored in the iModel to use for the front side of the skybox cube. */
  front?: Id64String;
  /** Id of a persistent texture element stored in the iModel to use for the back side of the skybox cube. */
  back?: Id64String;
  /** Id of a persistent texture element stored in the iModel to use for the top of the skybox cube. */
  top?: Id64String;
  /** Id of a persistent texture element stored in the iModel to use for the bottom of the skybox cube. */
  bottom?: Id64String;
  /** Id of a persistent texture element stored in the iModel to use for the right side of the skybox cube. */
  right?: Id64String;
  /** Id of a persistent texture element stored in the iModel to use for the left side of the skybox cube. */
  left?: Id64String;
}

/** JSON representation of an image or images used by a [[SkySphere]] or [[SkyCube]].
 * @public
 */
export interface SkyBoxImageProps {
  /** The type of skybox image. */
  type?: SkyBoxImageType;
  /** For [[SkyBoxImageType.Spherical]], the Id of a persistent texture element stored in the iModel to be drawn as the "sky". */
  texture?: Id64String;
  /** For [[SkyBoxImageType.Cube]], the Ids of persistent texture elements stored in the iModel drawn on each face of the cube. */
  textures?: SkyCubeProps;
}

/** JSON representation of a [SkyBox]($frontend).
 * @public
 */
export interface SkyBoxProps {
  /** Whether or not the skybox should be displayed. Defaults to false. */
  display?: boolean;
  /** For a [[SkyGradient]], if true, a 2-color gradient skybox is used instead of a 4-color. Defaults to false. */
  twoColor?: boolean;
  /** For a 4-color [[SkyGradient]], the color of the sky at the horizon. */
  skyColor?: ColorDefProps;
  /** For a 4-color [[SkyGradient]], the color of the ground at the horizon. */
  groundColor?: ColorDefProps;
  /** For a 4-color [[SkyGradient]], the color of the sky when looking straight up. For a 2-color [[SkyGradient]], the color of the sky. */
  zenithColor?: ColorDefProps;
  /** For a 4-color [[SkyGradient]], the color of the ground when looking straight down. For a 2-color [[SkyGradient]], the color of the ground. */
  nadirColor?: ColorDefProps;
  /** For a 4-color [[SkyGradient]], controls speed of change from sky color to zenith color. */
  skyExponent?: number;
  /** For a 4-color [[SkyGradient]], controls speed of change from ground color to nadir color. */
  groundExponent?: number;
  /** For a [[SkySphere]] or [[SkyCube]], the skybox image(s). */
  image?: SkyBoxImageProps;
}
