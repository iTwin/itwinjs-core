/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module ElementAspects */

import { Id64 } from "@bentley/bentleyjs-core";
import { Entity } from "./Entity";
import { IModelDb } from "./IModelDb";
import { ElementAspectProps } from "@bentley/imodeljs-common";

/** An Element Aspect is a class that defines a set of properties that are related to (and owned by) a single element.
 * Semantically, an ElementAspect can be considered part of the Element. Thus, an ElementAspect is deleted if its owning Element is deleted.
 * BIS Guideline: Subclass ElementUniqueAspect or ElementMultiAspect rather than subclassing ElementAspect directly.
 */
export class ElementAspect extends Entity implements ElementAspectProps {
  public element: Id64;

  constructor(props: ElementAspectProps, iModel: IModelDb) {
    super(props, iModel);
    this.element = Id64.fromJSON(props.element);
  }
}

/** An Element Unique Aspect is an ElementAspect where there can be only zero or one instance of the Element Aspect class per Element. See [[IModelDb.Elements.getUniqueAspect]] */
export class ElementUniqueAspect extends ElementAspect {
}

/** An Element Multi-Aspect is an ElementAspect where there can be **n** instances of the Element Aspect class per Element. See [[IModelDb.Elements.getMultiAspects]] */
export class ElementMultiAspect extends ElementAspect {
}
