import { PropertyRecord, PropertyValueFormat, PrimitiveValue, PropertyDescription } from "../../src/properties";

export class SamplePropertyRecord extends PropertyRecord {
  constructor(name: string, index: number, value: any, typename: string = "string", editor?: string) {
    const v: PrimitiveValue = {
      valueFormat: PropertyValueFormat.Primitive,
      value,
      displayValue: value.toString(),
    };
    const p: PropertyDescription = {
      name: name + index,
      displayLabel: name,
      typename,
    };
    if (editor)
      p.editor = { name: editor, params: [] };
    super(v, p);

    this.description = `${name} - description`;
    this.isReadonly = false;
  }
}