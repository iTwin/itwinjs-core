import { SchemaContextEditor } from "../Editor";
import { ClassId, PropertyId } from "../SchemaItemIdentifiers";
import { SchemaEditType } from "../SchemaEditType";
import { ISchemaEditChangeInfo, SchemaEditChangeBase } from "./ChangeInfo";
import { Property } from "@itwin/ecschema-metadata";

export class NumberAttributeChangeInfo extends SchemaEditChangeBase {
  public readonly editType: SchemaEditType;
  public readonly propertyId: PropertyId;
  public readonly newValue?: number;
  public readonly oldValue?: number;
  public readonly resultantChangeInfo: ISchemaEditChangeInfo[] = [];
  public readonly derivedClasses?: ClassId[];

  constructor(contextEditor: SchemaContextEditor, editType: SchemaEditType, newValue: number, oldValue: number, property: Property) {
    super(contextEditor, property.class.schemaItemType);
    this.editType = editType;
    this.propertyId = PropertyId.fromProperty(property);
    this.newValue = newValue;
    this.oldValue = oldValue;
  }
}