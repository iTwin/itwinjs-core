/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { ElementAspectProps } from "./ElementAspectProps";
import { Entity } from "./Entity";

/** ElementAspect */
export class ElementAspect extends Entity implements ElementAspectProps {
  public element: Id64;

  constructor(props: ElementAspectProps) {
    super(props);
    this.element = new Id64(props.element);
  }
}

/** ElementUniqueAspect */
export class ElementUniqueAspect extends ElementAspect {
}

/** ElementMultiAspect */
export class ElementMultiAspect extends ElementAspect {
}
