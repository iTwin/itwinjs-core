import { SchemaContextEditor } from "../Editor";
import { PropertyId } from "../SchemaItemIdentifiers";
import { SchemaEditType } from "../SchemaEditType";
import { SchemaEditChangeBase } from "./ChangeInfo";
import { Property } from "@itwin/ecschema-metadata";

/** ISchemaEditChangeInfo implementation for property attribute values of type number. */
export class NumberAttributeChangeInfo extends SchemaEditChangeBase {
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
   * @param contextEditor The SchemaContextEditor that wraps a SchemaContext.
   * @param editType The SchemaEditType for this edit operation.
   * @param newValue The new attribute value.
   * @param oldValue The old attribute value.
   * @param property The EC Property whose attribute is being modified.
   */
  constructor(contextEditor: SchemaContextEditor, editType: SchemaEditType, newValue: number, oldValue: number, property: Property) {
    super(contextEditor, property.class.schemaItemType);
    this.editType = editType;
    this.propertyId = PropertyId.fromProperty(property);
    this.newValue = newValue;
    this.oldValue = oldValue;
  }
}