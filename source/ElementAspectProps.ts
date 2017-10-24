/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { EntityProps } from "./EntityProps";

/** ElementAspectProps */
export interface ElementAspectProps extends EntityProps {
  id: Id64 | string;
  element: Id64 | string;
}
