/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { EntityProps, EntityQueryParams } from "./EntityProps";
import { XYProps } from "@bentley/geometry-core";
import { Id64Props } from "@bentley/bentleyjs-core";

export interface ModelProps extends EntityProps {
  modeledElement: Id64Props;
  name?: string;
  parentModel?: Id64Props;
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
