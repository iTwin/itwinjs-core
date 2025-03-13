/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelDb, InsertInstanceOptions } from "./IModelDb";
import { Element } from "./Element";
import { ElementAspectProps, ElementProps, RelatedElementProps } from "@itwin/core-common";
import { Id64String } from "@itwin/core-bentley";
import { _nativeDb } from "./internal/Symbols";
import { Model } from "./Model";
import { ClassRegistry } from "./ClassRegistry";
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
    // lastMod: iModel.models.queryLastModifiedTime(elProps.id),
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

  // TODO: if no options are provided, use the default options
  // TODO: Check if the element args are valid?

  // Get the Element Class Definition and check if its valid
  const classDef = iModel.getJsClass<typeof Element>(elProps.classFullName);
  const modelClassDef = nativeElementProps.model.relClassName ? iModel.getJsClass<typeof Model>(nativeElementProps.model.relClassName) : undefined;
  let parentClassDef: typeof Element | undefined;
  try {
    parentClassDef = nativeElementProps.parent?.relClassName ? iModel.getJsClass<typeof Element>(nativeElementProps.parent.relClassName) : undefined;
  } catch (error) {
    if (!ClassRegistry.isNotFoundError(error)) {
      // throw error;
    }
    parentClassDef = undefined;
  }

  // Call pre-insert Domain Handlers
  classDef.onInsert({ iModel, props: elProps });
  if (modelClassDef !== undefined) {
    // eslint-disable-next-line @typescript-eslint/dot-notation
    modelClassDef["onInsertElement"]({ iModel, elementProps: elProps, id: elProps.model });
  }
  if (parentClassDef !== undefined && nativeElementProps.parent?.id) {
    parentClassDef.onChildInsert({ iModel, childProps: elProps, parentId: nativeElementProps.parent?.id });
  }

  // Perform Insert
  elProps.id = iModel[_nativeDb].insertInstance(nativeElementProps, {...options});

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
export function insertModelWithHandlers(iModel: IModelDb, elProps: ElementProps, options?: InsertInstanceOptions): Id64String {
  // Convert the ElementProps to NativeElementProps
  const nativeElementProps = mapNativeElementProps(iModel, elProps);

  // Default insert options
  const insertOptions = options ?? { useJsNames: true };

  // TODO: Check if the element args are valid?

  // Get the Element Class Definition and check if its valid
  const classDef = iModel.getJsClass<typeof Element>(elProps.classFullName);
  const modelClassDef = nativeElementProps.model.relClassName ? iModel.getJsClass<typeof Model>(nativeElementProps.model.relClassName) : undefined;
  let parentClassDef: typeof Element | undefined;
  try {
    parentClassDef = nativeElementProps.parent?.relClassName ? iModel.getJsClass<typeof Element>(nativeElementProps.parent.relClassName) : undefined;
  } catch (error) {
    if (!ClassRegistry.isNotFoundError(error)) {
      // throw error;
    }
    parentClassDef = undefined;
  }

  // Call pre-insert Domain Handlers
  classDef.onInsert({ iModel, props: elProps });
  if (modelClassDef !== undefined) {
    // eslint-disable-next-line @typescript-eslint/dot-notation
    modelClassDef["onInsertElement"]({ iModel, elementProps: elProps, id: elProps.model });
  }
  if (parentClassDef !== undefined && nativeElementProps.parent?.id) {
    parentClassDef.onChildInsert({ iModel, childProps: elProps, parentId: nativeElementProps.parent?.id });
  }

  // Perform Insert
  elProps.id = iModel[_nativeDb].insertInstance(nativeElementProps, {...insertOptions});

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
 * Function inserts an elementAspect into an iModel and calls the pre-insert and post-insert domain handlers.
 * @param iModel The iModel to insert the elementAspect into.
 * @param aspectProps The properties of the elementAspect to insert.
 * @param options Insert options.
 * @returns The Id of the inserted element.
 * @internal
 */
export function insertAspectWithHandlers(iModel: IModelDb, aspectProps: ElementAspectProps, options?: InsertInstanceOptions): Id64String {
  // Get Relevant Model
  const model = iModel.elements.getElement(aspectProps.element.id).model;

  // Default insert options
  const insertOptions = options ?? { useJsNames: true };

  // TODO: Check if the element args are valid?

  // Get the AspectElement Class Definition and check if its valid
  const classDef = iModel.getJsClass<typeof ElementAspect>(aspectProps.classFullName);

  // Call pre-insert Domain Handlers
  classDef.onInsert({ iModel, props: aspectProps, model });

  // Perform Insert
  aspectProps.id = iModel[_nativeDb].insertInstance(aspectProps, {...insertOptions});

  // Call post-insert Domain Handlers
  classDef.onInserted({ iModel, props: aspectProps, model });

  return aspectProps.id;
}