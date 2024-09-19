import { PropertyId } from "../SchemaItemIdentifiers";
import { SchemaEditType } from "../SchemaEditType";
import { SchemaEditInfoBase } from "./SchemaEditInfo";
import { Property } from "@itwin/ecschema-metadata";

/**
 * ISchemaEditInfo implementation for property attribute values of type number.
 * @alpha
 */
export class NumberAttributeEdit extends SchemaEditInfoBase {
  /** Identifies the unique edit operation using the SchemaEditType enumeration. */
  public readonly editType: SchemaEditType;
  /** The PropertyId identifying the EC Property in the schema. */
  public readonly propertyId: PropertyId;
  /** The new number value. */
  public readonly newValue?: number;
  /** The old number value. */
  public readonly oldValue?: number;

  /**
   * Initializes a new NumberAttributeChangeInfo instance.
   * @param editType The SchemaEditType for this edit operation.
   * @param newValue The new attribute value.
   * @param oldValue The old attribute value.
   * @param property The EC Property whose attribute is being modified.
   */
  constructor(editType: SchemaEditType, newValue: number, oldValue: number, property: Property) {
    super(property.class.schemaItemType);
    this.editType = editType;
    this.propertyId = PropertyId.fromProperty(property);
    this.newValue = newValue;
    this.oldValue = oldValue;
  }
}