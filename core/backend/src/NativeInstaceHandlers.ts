/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelDb, InsertInstanceOptions } from "./IModelDb";
import { Element } from "./Element";
import { ElementProps, RelatedElementProps } from "@itwin/core-common";
import { Id64String } from "@itwin/core-bentley";
import { _nativeDb } from "./internal/Symbols";
import { Model } from "./Model";

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
  const parentClassDef = nativeElementProps.parent?.relClassName ? iModel.getJsClass<typeof Element>(nativeElementProps.parent.relClassName) : undefined;

  // Call pre-insert Domain Handlers
  classDef.onInsert({ iModel, props: elProps });
  if (modelClassDef !== undefined) {
    modelClassDef.onInsertElement({ iModel, elementProps: elProps, id: elProps.model });
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