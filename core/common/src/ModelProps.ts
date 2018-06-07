/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WireFormats */

import { EntityProps, EntityQueryParams } from "./EntityProps";
import { XYProps } from "@bentley/geometry-core";
import { Id64Props } from "@bentley/bentleyjs-core";
import { RelatedElementProps } from "./ElementProps";

export interface ModelProps extends EntityProps {
  modeledElement: RelatedElementProps;
  name?: string;
  parentModel?: Id64Props; // NB! Must always match the model of the modeledElement!
  isPrivate?: boolean;
  isTemplate?: boolean;
  jsonProperties?: any;
}

export interface ModelQueryParams extends EntityQueryParams {
  wantTemplate?: boolean;
  wantPrivate?: boolean;
}

export interface GeometricModel2dProps extends ModelProps {
  globalOrigin?: XYProps;
}
