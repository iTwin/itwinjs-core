/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Elements
 */

import { Id64String } from "@itwin/core-bentley";
import {
  FunctionalElementProps, IModel, InformationPartitionElementProps, ModelProps, RelatedElement, TypeDefinitionElementProps,
} from "@itwin/core-common";
import { InformationPartitionElement, RoleElement, TypeDefinitionElement } from "../Element";
import { IModelDb } from "../IModelDb";
import { RoleModel } from "../Model";
import { SubjectOwnsPartitionElements } from "../NavigationRelationship";
import { DrawingGraphicRepresentsElement, ElementRefersToElements } from "../Relationship";
import { EditTxn } from "../EditTxn";
import { _implicitTxn } from "../internal/Symbols";

/** A FunctionalPartition element is a key part of the iModel information hierarchy and is always parented
 * to a Subject and broken down by a FunctionalModel.
 * @public
 */
export class FunctionalPartition extends InformationPartitionElement {
  public static override get className(): string { return "FunctionalPartition"; }

  protected constructor(props: InformationPartitionElementProps, iModel: IModelDb) {
    super(props, iModel);
  }
}

/** A container for persisting FunctionalElements.
 * @public
 */
export class FunctionalModel extends RoleModel {
  public static override get className(): string { return "FunctionalModel"; }

  public constructor(props: ModelProps, iModel: IModelDb) {
    super(props, iModel);
  }

  /** Insert a FunctionalPartition and a FunctionalModel that breaks it down using an explicit transaction.
  * @param txn The EditTxn used to perform inserts.
   * @param parentSubjectId The FunctionalPartition will be inserted as a child of this Subject element.
   * @param name The name of the FunctionalPartition that the new FunctionalModel will break down.
   * @returns The Id of the newly inserted FunctionalPartition and FunctionalModel (same value).
   * @throws [[IModelError]] if there is an insert problem.
   * @beta
   */
  public static insert(txn: EditTxn, parentSubjectId: Id64String, name: string): Id64String;
  /** @deprecated Use FunctionalModel.insert(txn, ...) instead, within an explicit EditTxn scope (or via withEditTxn). See EditTxn documentation for migration help. */
  public static insert(iModelDb: IModelDb, parentSubjectId: Id64String, name: string): Id64String;
  public static insert(txnOrDb: EditTxn | IModelDb, parentSubjectId: Id64String, name: string): Id64String {
    const txn = txnOrDb instanceof EditTxn ? txnOrDb : txnOrDb[_implicitTxn];
    const partitionId = txn.insertElement({
      classFullName: FunctionalPartition.classFullName,
      model: IModel.repositoryModelId,
      parent: new SubjectOwnsPartitionElements(parentSubjectId),
      code: FunctionalPartition.createCode(txn.iModel, parentSubjectId, name),
    });
    return txn.insertModel({
      classFullName: this.classFullName,
      modeledElement: { id: partitionId },
    });
  }
}

/** A FunctionalElement captures functional requirements that will ultimately be fulfilled by a PhysicalElement.
 * @public
 */
export abstract class FunctionalElement extends RoleElement {
  public static override get className(): string { return "FunctionalElement"; }

  protected constructor(props: FunctionalElementProps, iModel: IModelDb) {
    super(props, iModel);
  }
}

/** A FunctionalBreakdownElement is a *folder* node in the functional hierarchy.
 * @public
 */
export abstract class FunctionalBreakdownElement extends FunctionalElement {
  public static override get className(): string { return "FunctionalBreakdownElement"; }

  protected constructor(props: FunctionalElementProps, iModel: IModelDb) {
    super(props, iModel);
  }
}

/** @public */
export class FunctionalComposite extends FunctionalBreakdownElement {
  public static override get className(): string { return "FunctionalComposite"; }

  protected constructor(props: FunctionalElementProps, iModel: IModelDb) {
    super(props, iModel);
  }
}

/** A FunctionalComponentElement is a *leaf* node in the functional hierarchy.
 * @public
 */
export abstract class FunctionalComponentElement extends FunctionalElement {
  public static override get className(): string { return "FunctionalComponentElement"; }

  protected constructor(props: FunctionalElementProps, iModel: IModelDb) {
    super(props, iModel);
  }
}

/** Defines a set of properties (the 'type') that can be associated with a Functional Element.
 * @public
 */
export abstract class FunctionalType extends TypeDefinitionElement {
  public static override get className(): string { return "FunctionalType"; }

  protected constructor(props: TypeDefinitionElementProps, iModel: IModelDb) {
    super(props, iModel);
  }
}

/** Relates a [[FunctionalElement]] to its [[FunctionalType]]
 * @public
 */
export class FunctionalElementIsOfType extends RelatedElement {
  public static get className(): string { return "FunctionalElementIsOfType"; }
  public static classFullName = "Functional:FunctionalElementIsOfType";
  public constructor(id: Id64String, relClassName: string = FunctionalElementIsOfType.classFullName) {
    super({ id, relClassName });
  }
}

/** Relates a [[PhysicalElement]] to the [[FunctionalElement]] elements that it fulfills.
 * @public
 */
export class PhysicalElementFulfillsFunction extends ElementRefersToElements {
  public static override get className(): string { return "PhysicalElementFulfillsFunction"; }
}

/** Relates a [[DrawingGraphic]] to the [[FunctionalElement]] that it represents
 * @public
 */
export class DrawingGraphicRepresentsFunctionalElement extends DrawingGraphicRepresentsElement {
  public static override get className(): string { return "DrawingGraphicRepresentsFunctionalElement"; }
}
