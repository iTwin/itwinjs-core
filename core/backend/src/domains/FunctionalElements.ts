/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { FunctionalElementProps, InformationPartitionElementProps, ModelProps, TypeDefinitionElementProps } from "@bentley/imodeljs-common";
import { InformationPartitionElement, RoleElement, TypeDefinitionElement } from "../Element";
import { IModelDb } from "../IModelDb";
import { RoleModel } from "../Model";

/**
 * A FunctionalPartition element is a key part of the iModel information hierarchy and is always parented
 * to a Subject and broken down by a FunctionalModel.
 */
export class FunctionalPartition extends InformationPartitionElement {
  public constructor(props: InformationPartitionElementProps, iModel: IModelDb) {
    super(props, iModel);
  }
}

/**
 * A container for persisting FunctionalElements.
 */
export class FunctionalModel extends RoleModel {
  public constructor(props: ModelProps, iModel: IModelDb) {
    super(props, iModel);
  }
}

/**
 * A FunctionalElement captures functional requirements that will ultimately be fulfilled by a PhysicalElement.
 */
export abstract class FunctionalElement extends RoleElement implements FunctionalElementProps {
  public constructor(props: FunctionalElementProps, iModel: IModelDb) {
    super(props, iModel);
  }
}

/**
 * A FunctionalBreakdownElement is a *folder* node in the functional hierarchy.
 */
export abstract class FunctionalBreakdownElement extends FunctionalElement {
  public constructor(props: FunctionalElementProps, iModel: IModelDb) {
    super(props, iModel);
  }
}

export class FunctionalComposite extends FunctionalBreakdownElement {
  public constructor(props: FunctionalElementProps, iModel: IModelDb) {
    super(props, iModel);
  }
}

/**
 * A FunctionalComponentElement is a *leaf* node in the functional hierarchy.
 */
export abstract class FunctionalComponentElement extends FunctionalElement {
  public constructor(props: FunctionalElementProps, iModel: IModelDb) {
    super(props, iModel);
  }
}

/**
 * Defines a set of properties (the 'type') that can be associated with a Functional Element.
 */
export abstract class FunctionalType extends TypeDefinitionElement {
  public constructor(props: TypeDefinitionElementProps, iModel: IModelDb) {
    super(props, iModel);
  }
}
