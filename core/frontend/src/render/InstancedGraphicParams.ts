/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { Point3d } from "@bentley/geometry-core";

/** Parameters for creating a [[RenderGraphic]] representing a collection of instances of shared geometry.
 * Each instance is drawn using the same graphics, but with its own transform and (optionally) [[Feature]] Id.
 * @internal
 */
export interface InstancedGraphicParams {
  /** The number of instances.
   * Must be greater than zero.
   * Must be equal to (transforms.length / 12)
   * If featureIds is defined, must be equal to (featureIds.length / 3)
   * If symbologyOverrides is defined, must be equal to (symbologyOverrides.length / 8)
   */
  readonly count: number;

  /** An array of instance-to-model transforms.
   * Each transform consists of 3 rows of 4 columns where the 4th column holds the translation.
   * The translations are relative to the `transformCenter` property.
   */
  readonly transforms: Float32Array;

  /** A point roughly in the center of the range of all of the instances, to which each instance's translation is relative.
   * This is used to reduce precision errors when transforming the instances in shader code.
   */
  readonly transformCenter: Point3d;

  /** If defined, an array of little-endian 24-bit unsigned integers containing the feature ID of each instance. */
  readonly featureIds?: Uint8Array;

  /** If defined, as array of bytes (8 per instance) encoding the symbology overrides for each instance.
   * The encoding matches that used by FeatureOverrides, though only the RGB, alpha, line weight, and line code are used.
   */
  readonly symbologyOverrides?: Uint8Array;
}
