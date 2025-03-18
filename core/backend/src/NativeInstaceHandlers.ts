/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelDb, InsertInstanceOptions } from "./IModelDb";
import { Element } from "./Element";
import { ElementAspectProps, ElementProps, ModelProps, RelatedElementProps } from "@itwin/core-common";
import { Id64String } from "@itwin/core-bentley";
import { _nativeDb } from "./internal/Symbols";
import { Model } from "./Model";
import { ClassRegistry } from "./ClassRegistry";
import { ElementAspect } from "./ElementAspect";

/**
 * Function inserts an element into an iModel and calls the pre-insert and post-insert domain handlers.
 * @param iModel The iModel to insert the element into.
 * @param elProps The properties of the element to insert.
 * @param options Insert options.
 * @returns The Id of the inserted element.
 * @internal
 */
export function insertElementWithHandlers(iModel: IModelDb, elProps: ElementProps, options?: InsertInstanceOptions): Id64String {
  // Default insert options
  const insertOptions = options ?? { useJsNames: true };

  // TODO: Check if the element args are valid?

  // Get the Element Class Definition and check if its valid
  const classDef = iModel.getJsClass<typeof Element>(elProps.classFullName);
  let modelClassDef: typeof Model | undefined;
  let parentClassDef: typeof Element | undefined;
  try {
    modelClassDef = iModel.getJsClass<typeof Model>(iModel.models.getModel(nativeElementProps.model.id).classFullName);
  } catch (error) {
    // TODO: Handle no model element found
    modelClassDef = undefined;
  }
  try {
    parentClassDef = nativeElementProps.parent ? iModel.getJsClass<typeof Element>(iModel.elements.getElement(nativeElementProps.parent.id).classFullName) : undefined;
  } catch (error) {
    // TODO: Handle no parent element found
    parentClassDef = undefined;
  }

  // Call pre-insert Domain Handlers
  classDef.onInsert({ iModel, props: elProps });
  if (modelClassDef !== undefined) {
    modelClassDef.onInsertElement({ iModel, elementProps: elProps, id: elProps.model });
  }
  if (parentClassDef !== undefined && nativeElementProps.parent?.id) {
    parentClassDef.onChildInsert({ iModel, childProps: elProps, parentId: nativeElementProps.parent?.id });
  }

  // Perform Insert
  // TODO: change to elProps and don't cast insertOptions
  elProps.id = iModel[_nativeDb].insertInstance(nativeElementProps, insertOptions);

  // Call post-insert Domain Handlers
  if (elProps.federationGuid !== undefined) {
    classDef.onInserted({ iModel, id: elProps.id, federationGuid: elProps.federationGuid, model: elProps.model });
  }
  if (modelClassDef !== undefined) {
    modelClassDef.onInsertedElement({ iModel, elementId: elProps.id, id: elProps.model });
  }
  if (parentClassDef !== undefined && nativeElementProps.parent?.id) {
    parentClassDef.onChildInserted({ iModel, childId: elProps.id, parentId: nativeElementProps.parent?.id });
  }

  return elProps.id;
}


/**
 * Function inserts an element into an iModel and calls the pre-insert and post-insert domain handlers.
 * @param iModel The iModel to insert the element into.
 * @param elProps The properties of the element to insert.
 * @param options Insert options.
 * @returns The Id of the inserted element.
 * @internal
 */
export function insertModelWithHandlers(iModel: IModelDb, modelProps: ModelProps, options?: InsertInstanceOptions): Id64String {
  // Convert the ElementProps to NativeElementProps
  // const nativeElementProps = mapNativeElementProps(iModel, elProps);

  // Default insert options
  const insertOptions = options ?? { useJsNames: true };

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
 * @returns The Id of the inserted element.
 * @internal
 */
export function insertAspectWithHandlers(iModel: IModelDb, aspectProps: ElementAspectProps, options?: InsertInstanceOptions): Id64String {
  // Get Relevant Element
  // TODO: Cache the Element, so that if multiple aspects are being inserted, we don't have to fetch the model each time.
  const element = iModel.elements.getElement(aspectProps.element.id);

  // Default insert options
  const insertOptions = options ?? { useJsNames: true };

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