/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WireFormats */

import { EntityProps, EntityQueryParams } from "./EntityProps";
import { XYProps } from "@bentley/geometry-core";
import { Id64String } from "@bentley/bentleyjs-core";
import { RelatedElementProps } from "./ElementProps";

/** Properties that define a [Model]($docs/bis/intro/model-fundamentals) */
export interface ModelProps extends EntityProps {
  modeledElement: RelatedElementProps;
  name?: string;
  parentModel?: Id64String; // NB! Must always match the model of the modeledElement!
  isPrivate?: boolean;
  isTemplate?: boolean;
  jsonProperties?: any;
}

/** Interface for querying a set of [Model]($backend)s. */
export interface ModelQueryParams extends EntityQueryParams {
  wantTemplate?: boolean;
  wantPrivate?: boolean;
}

/** Properties that define a [GeometricModel2d]($backend) */
export interface GeometricModel2dProps extends ModelProps {
  globalOrigin?: XYProps;
}
