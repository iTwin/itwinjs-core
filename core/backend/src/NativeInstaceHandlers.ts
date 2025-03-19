/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelDb, UpdateModelOptions } from "./IModelDb";
import { Element } from "./Element";
import { ElementAspectProps, ElementProps, ModelProps } from "@itwin/core-common";
import { Id64String } from "@itwin/core-bentley";
import { _nativeDb } from "./internal/Symbols";
import { Model } from "./Model";
import { ElementAspect } from "./ElementAspect";

/**
 * Function inserts an element into an iModel and calls the pre-insert and post-insert domain handlers.
 * @param iModel The iModel to insert the element into.
 * @param elProps The properties of the element to insert.
 * @param options Insert options.
 * @returns The Id of the inserted element.
 * @internal
 */
export function insertElementWithHandlers(iModel: IModelDb, elProps: ElementProps): Id64String {
  // Default insert options
  const insertOptions = { useJsNames: true };

  // TODO: Check if the element args are valid?

  // Get the Element Class Definition and check if its valid
  const classDef = iModel.getJsClass<typeof Element>(elProps.classFullName);
  const model = iModel.models.tryGetModelProps(elProps.model);
  const modelClassDef = model ? iModel.getJsClass<typeof Model>(model.classFullName) : undefined;
  const parentElement = elProps.parent ? iModel.elements.getElement(elProps.parent.id) : undefined;
  const parentClassDef = parentElement ? iModel.getJsClass<typeof Element>(parentElement.classFullName) : undefined;

  // Call pre-insert Domain Handlers
  classDef.onInsert({ iModel, props: elProps });
  if (modelClassDef !== undefined) {
    modelClassDef.onInsertElement({ iModel, elementProps: elProps, id: elProps.model });
  }
  if (parentClassDef !== undefined && elProps.parent) {
    parentClassDef.onChildInsert({ iModel, childProps: elProps, parentId: elProps.parent.id });
  }

  // Perform Insert
  elProps.id = iModel[_nativeDb].insertInstance(elProps, insertOptions);

  // Call post-insert Domain Handlers
  if (elProps.federationGuid !== undefined) {
    classDef.onInserted({ iModel, id: elProps.id, federationGuid: elProps.federationGuid, model: elProps.model });
  }
  if (modelClassDef !== undefined) {
    modelClassDef.onInsertedElement({ iModel, elementId: elProps.id, id: elProps.model });
  }
  if (parentClassDef !== undefined && elProps.parent) {
    parentClassDef.onChildInserted({ iModel, childId: elProps.id, parentId: elProps.parent.id });
  }

  return elProps.id;
}

/**
 * Function inserts a Model into an iModel and calls the pre-insert and post-insert domain handlers.
 * @param iModel The iModel to insert the model into.
 * @param modelProps The properties of the model to insert.
 * @param options Insert options.
 * @returns The Id of the inserted model.
 * @internal
 */
export function insertModelWithHandlers(iModel: IModelDb, modelProps: ModelProps): Id64String {
  // Default insert options
  const insertOptions = { useJsNames: true };

  // TODO: Check if the element args are valid?

  // Get the Element Class Definition and check if its valid
  const classDef = iModel.getJsClass<typeof Model>(modelProps.classFullName);

  // Call pre-insert Domain Handlers
  classDef.onInsert({ iModel, props: modelProps });

  // Perform Insert
  modelProps.id = iModel[_nativeDb].insertInstance(modelProps, insertOptions);

  // Call post-insert Domain Handlers
  classDef.onInserted({ iModel, id: modelProps.id });

  return modelProps.id;
}

/**
 * Function inserts an elementAspect into an iModel and calls the pre-insert and post-insert domain handlers.
 * @param iModel The iModel to insert the elementAspect into.
 * @param aspectProps The properties of the elementAspect to insert.
 * @param options Insert options.
 * @returns The Id of the inserted aspect.
 * @internal
 */
export function insertAspectWithHandlers(iModel: IModelDb, aspectProps: ElementAspectProps): Id64String {
    // Default insert options
    const insertOptions = { useJsNames: true };

  // Get Relevant Element
  // TODO: Cache the Element, so that if multiple aspects are being inserted, we don't have to fetch the model each time.
  const element = iModel.elements.getElement(aspectProps.element.id); // Will throw if not found

  // TODO: Check if the element args are valid? Do this on Native?

  // Get the AspectElement Class Definition and check if its valid
  const classDef = iModel.getJsClass<typeof ElementAspect>(aspectProps.classFullName);

  // Call pre-insert Domain Handlers
  classDef.onInsert({ iModel, props: aspectProps, model: element.model });

  // Perform Insert
  aspectProps.id = iModel[_nativeDb].insertInstance(aspectProps, insertOptions);

  // Call post-insert Domain Handlers
  classDef.onInserted({ iModel, props: aspectProps, model: element.model });

  // Call empty update on element and model to update lastMod
  element.update();
  iModel.models.getModel(element.model).update();

  return aspectProps.id;
}

// TODO: Could potentially be used to enforce that the id is required in the ElementProps, Do we want to do this?
// export type ElementPropsWithId = Partial<ElementProps> & Required<Pick<ElementProps, "id">>;

/**
 * Function updates an element in an iModel and calls the pre-update and post-update domain handlers.
 * @param iModel The iModel that containers the element to update.
 * @param elProps The properties of the element to update.
 * @param options Update options.
 * @internal
 */
export function updateElementWithHandlers<T extends ElementProps>(iModel: IModelDb, elProps: Partial<T>): void {
  // Update options
  const updateOptions = { useJsNames: true };

  // TODO: Check if the element args are valid?
  if (elProps.id === undefined) {
    throw new Error("Element Id is required to update a Element");
  }

  // Get the Element Class Definition and check if its valid
  const element = iModel.elements.getElementProps(elProps.id); // Will Throw is Element Doesn't Exist
  const classDef = iModel.getJsClass<typeof Element>(element.classFullName);
  const model = iModel.models.tryGetModelProps(element.model);
  const modelClassDef = model ? iModel.getJsClass<typeof Model>(model.classFullName) : undefined;
  const parent = element.parent?.id ? iModel.elements.tryGetElementProps(element.parent.id) : undefined;
  const parentClassDef = parent ? iModel.getJsClass<typeof Element>(parent.classFullName) : undefined;

  // Call pre-update Domain Handlers
  classDef.onUpdate({ iModel, props: element });
  if (modelClassDef !== undefined && model?.id) {
    modelClassDef.onUpdateElement({ iModel, elementProps: element, id: model.id });
  }
  if (parentClassDef !== undefined && parent?.id) {
    parentClassDef.onChildUpdate({ iModel, childProps: element, parentId: parent.id });
  }

  // Perform update
  const updateResult = iModel[_nativeDb].updateInstance(elProps, updateOptions);
  if (!updateResult) {
    throw new Error(`Failed to update element with id: ${elProps.id}`);
  }

  // Call post-update Domain Handlers
  if (element.federationGuid !== undefined) {
    classDef.onUpdated({ iModel, id: elProps.id, federationGuid: element.federationGuid, model: element.model });
  }
  if (modelClassDef !== undefined && model?.id) {
    modelClassDef.onUpdatedElement({ iModel, elementId: elProps.id, id: model?.id });
  }
  if (parentClassDef !== undefined && parent?.id) {
    parentClassDef.onChildUpdated({ iModel, childId: elProps.id, parentId: parent?.id });
  }
}

/**
 * Function updates a model in an iModel and calls the pre-update and post-update domain handlers.
 * @param iModel The iModel containing the model to update.
 * @param modelProps The properties of the model to update.
 * @internal
 */
export function updateModelWithHandlers(iModel: IModelDb, modelProps: UpdateModelOptions): void {
  // Update options
  const updateOptions = { useJsNames: true };

  // TODO: Check if the element args are valid?
  if (modelProps.id === undefined) {
    throw new Error("Model Id is required to update a model");
  }

  // Get the Model Class Definition and check if its valid
  const classDef = iModel.getJsClass<typeof Model>(modelProps.classFullName);

  // Call pre-update Domain Handlers
  classDef.onUpdate({ iModel, props: modelProps });

  // Perform update
  const updateResult = iModel[_nativeDb].updateInstance(modelProps, updateOptions);
  if (!updateResult) {
    throw new Error(`Failed to update model with id: ${modelProps.id}`);
  }

  // Call post-update Domain Handlers
  classDef.onUpdated({ iModel, id: modelProps.id });
}

/**
 * Function updates an aspect in an iModel and calls the pre-update and post-update domain handlers.
 * @param iModel The iModel containing the aspect to update.
 * @param aspectProps The properties of the aspect to update.
 * @internal
 */
export function updateAspectWithHandlers(iModel: IModelDb, aspectProps: ElementAspectProps): void {
  // Update options
  const updateOptions = { useJsNames: true };

  // TODO: Check if the element args are valid?

  // Get the Model Class Definition and check if its valid
  const element = iModel.elements.getElementProps(aspectProps.element); // Will Throw is Element Doesn't Exist
  const classDef = iModel.getJsClass<typeof ElementAspect>(aspectProps.classFullName);

  // Call pre-update Domain Handlers
  classDef.onUpdate({ iModel, props: aspectProps, model: element.model});

  // Perform update
  const updateResult = iModel[_nativeDb].updateInstance(aspectProps, updateOptions);
  if (!updateResult) {
    throw new Error(`Failed to update aspect with id: ${aspectProps.id}`);
  }

  // Call post-update Domain Handlers
  classDef.onUpdated({ iModel, props: aspectProps, model: element.model});
}