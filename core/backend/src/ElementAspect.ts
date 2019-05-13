/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ElementAspects */

import { ElementAspectProps, RelatedElement } from "@bentley/imodeljs-common";
import { Entity } from "./Entity";
import { IModelDb } from "./IModelDb";

/** An Element Aspect is a class that defines a set of properties that are related to (and owned by) a single element.
 * Semantically, an ElementAspect can be considered part of the Element. Thus, an ElementAspect is deleted if its owning Element is deleted.
 * BIS Guideline: Subclass ElementUniqueAspect or ElementMultiAspect rather than subclassing ElementAspect directly.
 * @public
 */
export class ElementAspect extends Entity implements ElementAspectProps {
  /** @internal */
  public static get className(): string { return "ElementAspect"; }
  public element: RelatedElement;

  /** @internal */
  constructor(props: ElementAspectProps, iModel: IModelDb) {
    super(props, iModel);
    this.element = RelatedElement.fromJSON(props.element)!;
  }

  /** @internal */
  public toJSON(): ElementAspectProps {
    const val = super.toJSON() as ElementAspectProps;
    val.element = this.element;
    return val;
  }
}

/** An Element Unique Aspect is an ElementAspect where there can be only zero or one instance of the Element Aspect class per Element.
 * @public
 */
export class ElementUniqueAspect extends ElementAspect {
  /** @internal */
  public static get className(): string { return "ElementUniqueAspect"; }
}

/** An Element Multi-Aspect is an ElementAspect where there can be **n** instances of the Element Aspect class per Element.
 * @public
 */
export class ElementMultiAspect extends ElementAspect {
  /** @internal */
  public static get className(): string { return "ElementMultiAspect"; }
}
