/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module Core */

import * as React from "react";
import { I18NNamespace } from "@bentley/imodeljs-i18n";
import { Presentation } from "@bentley/presentation-frontend";
import { Descriptor, Field, LabelDefinition, LabelCompositeValue } from "@bentley/presentation-common";
import { FIELD_NAMES_SEPARATOR } from "./ContentBuilder";
import { PropertyRecord, PrimitiveValue, PropertyValueFormat, PropertyDescription, Primitives } from "@bentley/imodeljs-frontend";

/**
 * An interface of something that has a priority.
 * @internal
 */
export interface IPrioritized {
  priority: number;
}

/**
 * An interface of something that has a name.
 * @internal
 */
export interface INamed {
  name: string;
}

/**
 * A sorting algorithm for `Array.sort` that sorts items by priority and name.
 * Higher priority items appear first in the list. If priorities are equal, then
 * name property is used (in ascending order).
 *
 * @internal
 */
export const priorityAndNameSortFunction = (a: IPrioritized & INamed, b: IPrioritized & INamed): number => {
  if (a.priority > b.priority)
    return -1;
  if (a.priority < b.priority)
    return 1;
  return a.name.localeCompare(b.name);
};

let localizationNamespace: I18NNamespace | undefined;
/**
 * Translate a string with the specified id from `PresentationComponents`
 * localization namespace. The `stringId` should not contain namespace - it's
 * prepended automatically.
 *
 * @internal
 */
export const translate = async (stringId: string): Promise<string> => {
  const localizationNamespaceName = "PresentationComponents";
  if (!localizationNamespace) {
    localizationNamespace = Presentation.i18n.registerNamespace(localizationNamespaceName);
  }
  await localizationNamespace.readFinished;
  stringId = `${localizationNamespaceName}:${stringId}`;
  return Presentation.i18n.translate(stringId);
};

/**
 * Creates a display name for the supplied component
 * @internal
 */
export const getDisplayName = <P>(component: React.ComponentType<P>): string => {
  if (component.displayName)
    return component.displayName;
  if (component.name)
    return component.name;
  return "Component";
};

/**
 * Finds a field given the name of property record created from that field.
 * @internal
 */
export const findField = (descriptor: Descriptor, recordPropertyName: string): Field | undefined => {
  let fieldsSource: { getFieldByName: (name: string) => Field | undefined } | undefined = descriptor;
  const fieldNames = recordPropertyName.split(FIELD_NAMES_SEPARATOR);
  while (fieldsSource && fieldNames.length) {
    const field: Field | undefined = fieldsSource.getFieldByName(fieldNames.shift()!);
    fieldsSource = (field && field.isNestedContentField()) ? field : undefined;
    if (!fieldNames.length)
      return field;
  }
  return undefined;
};

/**
 * Creates property record for label using label definition.
 * @internal
 */
export const createLabelRecord = (label: LabelDefinition, name: string): PropertyRecord => {
  const value: PrimitiveValue = {
    displayValue: label.displayValue,
    value: createPrimitiveLabelValue(label),
    valueFormat: PropertyValueFormat.Primitive,
  };
  const property: PropertyDescription = {
    displayLabel: "Label",
    typename: label.typeName,
    name,
  };

  return new PropertyRecord(value, property);
};

const createPrimitiveLabelValue = (label: LabelDefinition) => {
  return LabelDefinition.isCompositeDefinition(label) ? createPrimitiveCompositeValue(label.rawValue) : label.rawValue;
};

const createPrimitiveCompositeValue = (compositeValue: LabelCompositeValue): Primitives.Composite => {
  return {
    separator: compositeValue.separator,
    parts: compositeValue.values.map((part) => ({
      displayValue: part.displayValue,
      typeName: part.typeName,
      rawValue: createPrimitiveLabelValue(part),
    })),
  };
};
