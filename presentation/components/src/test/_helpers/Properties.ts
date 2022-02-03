/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type {
  ArrayValue, PrimitiveValue, PropertyDescription, PropertyEditorInfo, StructValue} from "@itwin/appui-abstract";
import { PropertyRecord, PropertyValueFormat, StandardTypeNames,
} from "@itwin/appui-abstract";

/**
 * @internal Used for testing only.
 */
export function createPrimitiveStringProperty(
  name: string,
  rawValue: string,
  displayValue: string = rawValue.toString(),
  editorInfo?: PropertyEditorInfo,
  autoExpand?: boolean,
): PropertyRecord {
  const value: PrimitiveValue = {
    displayValue,
    value: rawValue,
    valueFormat: PropertyValueFormat.Primitive,
  };

  const description: PropertyDescription = {
    displayLabel: name,
    name,
    typename: StandardTypeNames.String,
  };

  if (editorInfo)
    description.editor = editorInfo;

  const property = new PropertyRecord(value, description);
  property.isReadonly = false;
  property.autoExpand = autoExpand;
  if (property.autoExpand === undefined)
    delete property.autoExpand;

  return property;
}

/**
 * @internal Used for testing only.
 */
export function createArrayProperty(name: string, items?: PropertyRecord[], autoExpand?: boolean): PropertyRecord {
  if (!items)
    items = [];

  const value: ArrayValue = {
    items,
    valueFormat: PropertyValueFormat.Array,
    itemsTypeName: items.length !== 0 ? items[0].property.typename : "string",
  };

  const description: PropertyDescription = {
    displayLabel: name,
    name,
    typename: StandardTypeNames.Array,
  };
  const property = new PropertyRecord(value, description);
  property.isReadonly = false;
  property.autoExpand = autoExpand;
  return property;
}

/**
 * @internal Used for testing only.
 */
export function createStructProperty(
  name: string,
  members?: {
    [name: string]: PropertyRecord;
  },
  autoExpand?: boolean,
): PropertyRecord {
  if (!members)
    members = {};

  const value: StructValue = {
    members,
    valueFormat: PropertyValueFormat.Struct,
  };

  const description: PropertyDescription = {
    displayLabel: name,
    name,
    typename: StandardTypeNames.Struct,
  };
  const property = new PropertyRecord(value, description);
  property.isReadonly = false;
  property.autoExpand = autoExpand;
  return property;
}
