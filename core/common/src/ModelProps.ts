/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Entities
 */

import type { GuidString, Id64String } from "@itwin/core-bentley";
import type { XYProps } from "@itwin/core-geometry";
import type { CodeProps } from "./Code";
import type { RelatedElementProps } from "./ElementProps";
import type { EntityProps, EntityQueryParams } from "./EntityProps";

/** Properties that define a [Model]($docs/bis/intro/model-fundamentals)
 * @public
 */
export interface ModelProps extends EntityProps {
  modeledElement: RelatedElementProps;
  name?: string;
  parentModel?: Id64String; // NB! Must always match the model of the modeledElement!
  isPrivate?: boolean;
  isTemplate?: boolean;
  jsonProperties?: any;
}

/** Properties that specify what model should be loaded.
 * @public
 */
export interface ModelLoadProps {
  id?: Id64String;
  code?: CodeProps;
}

/** Parameters for performing a query on [Model]($backend) classes.
 * @public
 */
export interface ModelQueryParams extends EntityQueryParams {
  wantTemplate?: boolean;
  wantPrivate?: boolean;
}

/** Properties that describe a [GeometricModel]($backend)
 * @public
 */
export interface GeometricModelProps extends ModelProps {
  /** A unique identifier that is updated each time a change affecting the appearance of a geometric element within this model
   * is committed to the iModel. In other words, between versions of the iModel, if this value is the same you can
   * assume the appearance of all of the geometry in the model is the same (Note: other properties of elements may have changed.)
   * If undefined, the state of the geometry is unknown.
   */
  geometryGuid?: GuidString;
}

/** Properties that define a [GeometricModel2d]($backend)
 * @public
 */
export interface GeometricModel2dProps extends GeometricModelProps {
  /** The actual coordinates of (0,0) in modeling coordinates. An offset applied to all modeling coordinates. */
  globalOrigin?: XYProps;
}

/** Properties that define a [GeometricModel3d]($backend)
 * @public
 */
export interface GeometricModel3dProps extends GeometricModelProps {
  /** If true, then the elements in this GeometricModel3d are not in real-world coordinates and will not be in the spatial index. */
  isNotSpatiallyLocated?: boolean;
  /** If true, then the elements in this GeometricModel3d are expected to be in an XY plane. */
  isPlanProjection?: boolean;
}
