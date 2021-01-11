/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import * as React from "react";
import { Descriptor, Field, LabelCompositeValue, LabelDefinition } from "@bentley/presentation-common";
import { Presentation } from "@bentley/presentation-frontend";
import { Primitives, PrimitiveValue, PropertyDescription, PropertyRecord, PropertyValueFormat } from "@bentley/ui-abstract";
import { IPropertyValueRenderer, PropertyValueRendererManager } from "@bentley/ui-components";
import { InstanceKeyValueRenderer } from "../properties/InstanceKeyValueRenderer";
import { FIELD_NAMES_SEPARATOR } from "./ContentBuilder";

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

const localizationNamespaceName = "PresentationComponents";

/**
 * Registers 'PresentationComponents' localization namespace and returns callback
 * to unregister it.
 * @internal
 */
export const initializeLocalization = async () => {
  await Presentation.i18n.registerNamespace(localizationNamespaceName).readFinished;
  return () => Presentation.i18n.unregisterNamespace(localizationNamespaceName);
};

/**
 * Registers custom property value renderers and returns cleanup callback that unregisters them.
 * @internal
 */
export const initializePropertyValueRenderers = async () => {
  const customRenderers: Array<{ name: string, renderer: IPropertyValueRenderer }> = [
    { name: "SelectableInstance", renderer: new InstanceKeyValueRenderer() },
  ];

  for (const { name, renderer } of customRenderers) {
    PropertyValueRendererManager.defaultManager.registerRenderer(name, renderer);
  }

  return () => {
    for (const { name } of customRenderers) {
      PropertyValueRendererManager.defaultManager.unregisterRenderer(name);
    }
  };
};

/**
 * Translate a string with the specified id from `PresentationComponents`
 * localization namespace. The `stringId` should not contain namespace - it's
 * prepended automatically.
 *
 * @internal
 */
export const translate = (stringId: string): string => {
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
