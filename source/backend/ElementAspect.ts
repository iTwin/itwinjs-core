/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Id64 } from "@bentley/bentleyjs-core";
import { Entity } from "./Entity";
import { IModelDb } from "./IModelDb";
import { ElementAspectProps } from "@bentley/imodeljs-common";

/** ElementAspect */
export class ElementAspect extends Entity implements ElementAspectProps {
  public element: Id64;

  constructor(props: ElementAspectProps, iModel: IModelDb) {
    super(props, iModel);
    this.element = Id64.fromJSON(props.element);
  }
}

/** ElementUniqueAspect */
export class ElementUniqueAspect extends ElementAspect {
}

/** ElementMultiAspect */
export class ElementMultiAspect extends ElementAspect {
}
