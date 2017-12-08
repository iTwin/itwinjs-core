/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { EntityProps } from "./EntityProps";
import { Range2d } from "@bentley/geometry-core/lib/PointVector";
import { RelatedElementProps } from "./ElementProps";

export interface ModelProps extends EntityProps {
  modeledElement: RelatedElementProps;
  parentModel?: RelatedElementProps;
  isPrivate?: boolean;
  isTemplate?: boolean;
  jsonProperties?: any;
}

export interface Model2dProps extends ModelProps {
  extents: Range2d | string;
}
