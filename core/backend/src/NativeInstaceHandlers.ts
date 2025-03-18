/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelDb, InsertInstanceOptions, UpdateInstanceOptions, UpdateModelOptions } from "./IModelDb";
import { Element } from "./Element";
import { ElementAspectProps, ElementProps, ModelProps, RelatedElementProps } from "@itwin/core-common";
import { Id64String } from "@itwin/core-bentley";
import { _nativeDb } from "./internal/Symbols";
import { Model } from "./Model";
import { ElementAspect } from "./ElementAspect";

type NativeElementProps = Omit<ElementProps, "model" | "code" | "classFullName" | "jsonProperties" | "isInstanceOfEntity"> & {
  model: RelatedElementProps;
  className: string;
  codeValue?: string;
  codeSpec: RelatedElementProps;
  codeScope: RelatedElementProps;
  jsonProperties?: string;
  lastMod?: string;
};

/** Function to map ElementProps native Bis.Element properties.
* @param iModel The iModel to map the element properties to.
* @param elProps The properties of the element to map.
* @returns NativeElementProps
* @internal
*/
function mapNativeElementProps(iModel: IModelDb, elProps: ElementProps): NativeElementProps {
  const element: NativeElementProps = {
    className: elProps.classFullName,
    codeSpec: { id: elProps.code.spec },
    codeScope: { id: elProps.code.scope },
    codeValue: elProps.code.value,
    parent: elProps.parent ?? undefined,
    // lastMod: iModel.models.queryLastModifiedTime(elProps.model),
    model: {
      id: elProps.model,
      relClassName: iModel.models.getModel(elProps.model).classFullName ?? undefined,
    },
  };
  return element;
}

/**
 * Function inserts an element into an iModel and calls the pre-insert and post-insert domain handlers.
 * @param iModel The iModel to insert the element into.
 * @param elProps The properties of the element to insert.
 * @param options Insert options.
 * @returns The Id of the inserted element.
 * @internal
 */
export function insertElementWithHandlers(iModel: IModelDb, elProps: ElementProps, options?: InsertInstanceOptions): Id64String {
  // Convert the ElementProps to NativeElementProps
  const nativeElementProps = mapNativeElementProps(iModel, elProps);

  // Default insert options
  const insertOptions = options ?? { useJsNames: true };

  // TODO: Check if the element args are valid?

  // Get the Element Class Definition and check if its valid
  const classDef = iModel.getJsClass<typeof Element>(elProps.classFullName);
  let modelClassDef: typeof Model | undefined;
  let parentClassDef: typeof Element | undefined;
  try {
    modelClassDef = iModel.getJsClass<typeof Model>(iModel.models.tryGetModel(nativeElementProps.model.id).classFullName);
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

// TODO: Could potentially be used to enforce that the id is required in the ElementProps, Do we want to do this?
// export type ElementPropsWithId = Partial<ElementProps> & Required<Pick<ElementProps, "id">>;

/**
 * Function updates an element in an iModel and calls the pre-update and post-update domain handlers.
 * @param iModel The iModel that containers the element to update.
 * @param elProps The properties of the element to update.
 * @param options Update options.
 * @internal
 */
export function updateElementWithHandlers<T extends ElementProps>(iModel: IModelDb, elProps: Partial<T>, options?: UpdateInstanceOptions): void {
  // Default update options
  const updateOptions = options ?? { useJsNames: true };

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

  // Call pre-insert Domain Handlers
  classDef.onUpdate({ iModel, props: element });
  if (modelClassDef !== undefined && model?.id) {
    modelClassDef.onUpdateElement({ iModel, elementProps: element, id: model.id });
  }
  if (parentClassDef !== undefined && parent?.id) {
    parentClassDef.onChildUpdate({ iModel, childProps: element, parentId: parent.id });
  }

  // Perform Insert
  // TODO: change to elProps and don't cast insertOptions
  const updateSuccess = iModel[_nativeDb].updateInstance(elProps, updateOptions);
  if (!updateSuccess) {
    throw new Error(`Failed to update element with id: ${elProps.id}`);
  }

  // Call post-insert Domain Handlers
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
 * @param options Update options.
 * @internal
 */
export function updateModelWithHandlers(iModel: IModelDb, modelProps: UpdateModelOptions, options?: UpdateInstanceOptions): void {
  // Default update options
  const updateOptions = options ?? { useJsNames: true };

  // TODO: Check if the element args are valid?
  if (modelProps.id === undefined) {
    throw new Error("Model Id is required to update a model");
  }

  // Get the Model Class Definition and check if its valid
  const classDef = iModel.getJsClass<typeof Model>(modelProps.classFullName);

  // Call pre-insert Domain Handlers
  classDef.onUpdate({ iModel, props: modelProps });

  // Perform Insert
  iModel[_nativeDb].insertInstance(modelProps, updateOptions);

  // Call post-insert Domain Handlers
  classDef.onUpdated({ iModel, id: modelProps.id });
}

/**
 * Function updates an aspect in an iModel and calls the pre-update and post-update domain handlers.
 * @param iModel The iModel containing the aspect to update.
 * @param aspectProps The properties of the aspect to update.
 * @param options Update options.
 * @internal
 */
export function updateAspectWithHandlers(iModel: IModelDb, aspectProps: ElementAspectProps, options?: UpdateInstanceOptions): void {
  // Default update options
  const updateOptions = options ?? { useJsNames: true };

  // TODO: Check if the element args are valid?

  // Get the Model Class Definition and check if its valid
  const element = iModel.elements.getElementProps(aspectProps.element); // Will Throw is Element Doesn't Exist
  const classDef = iModel.getJsClass<typeof ElementAspect>(aspectProps.classFullName);

  // Call pre-insert Domain Handlers
  classDef.onUpdate({ iModel, props: aspectProps, model: element.model});

  // Perform Insert
  iModel[_nativeDb].insertInstance(aspectProps, updateOptions);

  // Call post-insert Domain Handlers
  classDef.onUpdated({ iModel, props: aspectProps, model: element.model});
}