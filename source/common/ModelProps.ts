/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { EntityProps } from "./EntityProps";
import { Range2d } from "@bentley/geometry-core/lib/PointVector";

export interface ModelProps extends EntityProps {
  id: Id64 | string;
  modeledElement: Id64;
  parentModel?: Id64;
  isPrivate?: boolean;
  isTemplate?: boolean;
  jsonProperties?: any;
}

export interface Model2dProps extends ModelProps {
  extents: Range2d | string;
}
