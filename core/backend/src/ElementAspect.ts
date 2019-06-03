/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ElementAspects */

import { ElementAspectProps, ExternalSourceAspectProps, RelatedElement } from "@bentley/imodeljs-common";
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

/** An ElementMultiAspect that stores synchronization information for an Element originating from an external source.
 * @public
 */
export class ExternalSourceAspect extends ElementMultiAspect implements ExternalSourceAspectProps {
  /** @internal */
  public static get className(): string { return "ExternalSourceAspect"; }

  /** An element that scopes the combination of `kind` and `identifier` to uniquely identify the object from the external source. */
  public scope: RelatedElement;
  /** The identifier of the object in the source repository. */
  public identifier: string;
  /** The kind of object within the source repository. */
  public kind: string;
  /** The cryptographic hash (any algorithm) of the source object's content. It must be guaranteed to change when the source object's content changes. */
  public checksum: string;
  /** An optional value that is typically a version number or a psuedo version number like last modified time.
   * It will be used by the synchronization process to detect that a source object is unchanged so that computing a cryptographic hash can be avoided.
   * If present, this value must be guaranteed to change when any of the source object's content changes.
   */
  public version?: string;
  /** A place where additional JSON properties can be stored. For example, provenance information or properties relating to the synchronization process. */
  public jsonProperties: { [key: string]: any };

  /** @internal */
  constructor(props: ExternalSourceAspectProps, iModel: IModelDb) {
    super(props, iModel);
    this.scope = RelatedElement.fromJSON(props.scope)!;
    this.identifier = props.identifier;
    this.kind = props.kind;
    this.checksum = props.checksum;
    this.version = props.version;
    this.jsonProperties = Object.assign({}, props.jsonProperties); // make sure we have our own copy
  }

  /** @internal */
  public toJSON(): ExternalSourceAspectProps {
    const val = super.toJSON() as ExternalSourceAspectProps;
    val.scope = this.scope;
    val.identifier = this.identifier;
    val.kind = this.kind;
    val.checksum = this.checksum;
    if (this.version)
      val.version = this.version;
    if (Object.keys(this.jsonProperties).length > 0)
      val.jsonProperties = this.jsonProperties;
    return val;
  }
}
