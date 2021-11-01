/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */

import { Id64String } from "@itwin/core-bentley";
import { ColorDefProps } from "./ColorDef";

/** Enumerates the supported types of [SkyBox]($frontend) images.
 * @public
 */
export enum SkyBoxImageType {
  None,
  /** A single image mapped to the surface of a sphere. @see [SkySphere]($frontend) */
  Spherical,
  /** 6 images mapped to the faces of a cube. @see [SkyCube]($frontend) */
  Cube,
  /** @internal not yet supported */
  Cylindrical,
}

/** JSON representation of a set of images used by a [SkyCube]($frontend). Each property specifies the element ID of a texture associated with one face of the cube.
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

/** JSON representation of an image or images used by a [SkySphere]($frontend) or [SkyCube]($frontend).
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

/** JSON representation of a [SkyBox]($frontend) that can be drawn as the background of a [ViewState3d]($frontend).
 * An object of this type can describe one of several types of sky box:
 *  - A cube with a texture image mapped to each face; or
 *  - A sphere with a single texture image mapped to its surface; or
 *  - A sphere with a two- or four-color vertical [[Gradient]] mapped to its surface.
 *
 * Whether cuboid or spherical, the skybox is drawn as if the viewer and the contents of the view are contained within its interior.
 *
 * For a two-color gradient, the gradient transitions smoothly from the nadir color at the bottom of the sphere to the zenith color at the top of the sphere.
 * The sky and ground colors are unused, as are the sky and ground exponents.
 *
 * For a four-color gradient, a "horizon" is produced on the equator of the sphere, where the ground color and sky color meet. The lower half of the sphere transitions
 * smoothly from the ground color at the equator to the nadir color at the bottom, and the upper half transitions from the sky color at the equator to the zenith color at
 * the top of the sphere.
 *
 * The color and exponent properties are unused if one or more texture images are supplied.
 *
 * @see [[DisplayStyle3dSettings.environment]] to define the skybox for a display style.
 * @public
 */
export interface SkyBoxProps {
  /** Whether or not the skybox should be displayed.
   * Default: false.
   */
  display?: boolean;
  /** For a [SkyGradient]($frontend), if true, a 2-color gradient skybox is used instead of a 4-color.
   * Default: false.
   */
  twoColor?: boolean;
  /** The color of the sky at the horizon. Unused unless this is a four-color [SkyGradient]($frontend).
   * Default: (143, 205, 255).
   */
  skyColor?: ColorDefProps;
  /** The color of the ground at the horizon. Unused unless this is a four-color [SkyGradient]($frontend).
   * Default: (120, 143, 125).
   */
  groundColor?: ColorDefProps;
  /** The color of the top of the sphere.
   * Default: (54, 117, 255).
   */
  zenithColor?: ColorDefProps;
  /** The color of the bottom of the sphere.
   * Default: (40, 15, 0).
   */
  nadirColor?: ColorDefProps;
  /** For a 4-color [SkyGradient]($frontend), controls speed of change from sky color to zenith color; otherwise unused.
   * Default: 4.0.
   */
  skyExponent?: number;
  /** For a 4-color [SkyGradient]($frontend), controls speed of change from ground color to nadir color; otherwise unused.
   * Default: 4.0.
   */
  groundExponent?: number;
  /** The image(s), if any, to be mapped to the surfaces of the sphere or cube. If undefined, the skybox will be displayed as a gradient instead.
   * Default: undefined.
   */
  image?: SkyBoxImageProps;
}
