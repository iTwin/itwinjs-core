import { IPropertyValueRenderer } from "../ValueRendererManager";
import { PropertyRecord } from "../Record";
import { PropertyValueFormat, PrimitiveValue } from "../Value";
import { TypeConverterManager } from "../../converters/TypeConverterManager";

/** Default Primitive Property Renderer */
export class PrimitivePropertyValueRenderer implements IPropertyValueRenderer {

  public canRender(record: PropertyRecord) {
    return record.value.valueFormat === PropertyValueFormat.Primitive;
  }

  public async render(record: PropertyRecord) {
    const value = (record.value as PrimitiveValue).value;

    if (value !== undefined)
      return await TypeConverterManager.getConverter(record.property.typename).convertPropertyToString(record.property, value);

    return "";
  }
}
