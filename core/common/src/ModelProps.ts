/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WireFormats */

import { EntityProps, EntityQueryParams } from "./EntityProps";
import { XYProps } from "@bentley/geometry-core";
import { Id64String } from "@bentley/bentleyjs-core";
import { RelatedElementProps } from "./ElementProps";

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

/** Parameters for performing a query on [Model]($backend) classes.
 * @public
 */
export interface ModelQueryParams extends EntityQueryParams {
  wantTemplate?: boolean;
  wantPrivate?: boolean;
}

export interface GeometricModelProps extends ModelProps {
  /** A Guid that changes whenever the geometry of any element in this model changes. As changesets are created or applied, this
   * value will always and only change if the geometry of any element in the model changes. In other words, between versions
   * of the iModel, if this value is the same, you can assume all of the geometry in the model is the same (Note: other properties of elements
   * may have changed.) If undefined, the state of the geometry is unknown.
   */
  geometryGuid?: string;
}

/** Properties that define a [GeometricModel2d]($backend)
 * @public
 */
export interface GeometricModel2dProps extends GeometricModelProps {
  globalOrigin?: XYProps;
}
