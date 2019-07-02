/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ElementAspects */

import { DbResult, Id64, Id64String } from "@bentley/bentleyjs-core";
import { ElementAspectProps, ExternalSourceAspectProps, RelatedElement } from "@bentley/imodeljs-common";
import { ECSqlStatement } from "./ECSqlStatement";
import { Element } from "./Element";
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

  /** Create an ExternalSourceAspectProps in a standard way for an Element in an iModel --> iModel transformation.
   * @param sourceElement The new ExternalSourceAspectProps will be tracking this Element from the source iModel.
   * @param targetScopeElementId The Id of an Element in the target iModel that provides a scope for source Ids.
   * @param targetElementId The optional Id of the Element that will own the ExternalSourceAspect. If not provided, it will be set to Id64.invalid.
   * @alpha
   */
  public static initPropsForElement(sourceElement: Element, targetScopeElementId: Id64String, targetElementId: Id64String = Id64.invalid): ExternalSourceAspectProps {
    const sourceElementHash: string = sourceElement.computeHash();
    const aspectProps: ExternalSourceAspectProps = {
      classFullName: this.classFullName,
      element: { id: targetElementId },
      scope: { id: targetScopeElementId },
      identifier: sourceElement.id,
      kind: ExternalSourceAspect.Kind.Element,
      checksum: sourceElementHash,
      version: sourceElement.iModel.elements.queryLastModifiedTime(sourceElement.id),
    };
    return aspectProps;
  }

  /** Delete matching ExternalSourceAspects. Must match Kind, Scope, and owning ElementId.
   * @param targetDb The IModelDb
   * @param targetScopeElementId Only consider ExternalSourceAspects from a particular source (scoped by this Element in the target IModelDb).
   * @param targetElementId Only consider ExternalSourceAspects owned by this Element.
   * @alpha
   */
  public static deleteForElement(targetDb: IModelDb, targetScopeElementId: Id64String, targetElementId: Id64String): void {
    const sql = `SELECT ECInstanceId FROM ${this.classFullName} aspect WHERE aspect.Element.Id=:elementId AND aspect.Scope.Id=:scopeId AND aspect.Kind='${ExternalSourceAspect.Kind.Element}'`;
    targetDb.withPreparedStatement(sql, (statement: ECSqlStatement) => {
      statement.bindId("elementId", targetElementId);
      statement.bindId("scopeId", targetScopeElementId);
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        targetDb.elements.deleteAspect(statement.getValue(0).getId());
      }
    });
  }
}

/** @public */
export namespace ExternalSourceAspect {
  /** Standard values for the `Kind` property of `ExternalSourceAspect`.
   * @public
   */
  export enum Kind {
    Element = "Element",
  }
}
