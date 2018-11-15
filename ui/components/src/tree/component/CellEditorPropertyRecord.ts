/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { PropertyRecord, PropertyValueFormat, PrimitiveValue, PropertyDescription } from "../../properties";

/** @hidden */
export class CellEditorPropertyRecord extends PropertyRecord {
  constructor(value: any, typename: string = "string", editor?: string) {
    const name = "cell-editor";
    const v: PrimitiveValue = {
      valueFormat: PropertyValueFormat.Primitive,
      value,
      displayValue: value.toString(),
    };
    const p: PropertyDescription = {
      name,
      displayLabel: "Cell Editor",
      typename,
    };
    if (editor)
      p.editor = { name: editor, params: [] };
    super(v, p);

    this.description = "";
    this.isReadonly = false;
  }
}
