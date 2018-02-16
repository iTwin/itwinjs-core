/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { EntityProps } from "./EntityProps";
import { XYProps } from "@bentley/geometry-core/lib/PointVector";
import { Id64Props } from "@bentley/bentleyjs-core/lib/Id";

export interface ModelProps extends EntityProps {
  modeledElement: Id64Props;
  parentModel?: Id64Props;
  isPrivate?: boolean;
  isTemplate?: boolean;
  jsonProperties?: any;
}

export interface GeometricModel2dProps extends ModelProps {
  globalOrigin?: XYProps;
}
