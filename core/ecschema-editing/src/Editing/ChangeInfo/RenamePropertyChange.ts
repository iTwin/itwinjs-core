import { ECClass, Property } from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "../Editor";
import { ECElementSelection } from "../ECElementSelection";
import { ISchemaEditChangeInfo, ISchemaEditChangeProps, SchemaChangeRevertCallback, SchemaEditChangeBase } from "./ChangeInfo";
import { ChangeOptions } from "./ChangeOptions";
import { ClassId, PropertyId } from "../SchemaItemIdentifiers";
import { SchemaEditType } from "../SchemaEditType";

export interface RenamePropertyChangeProps extends ISchemaEditChangeProps {
  readonly newPropertyName: string;
  readonly oldPropertyName: string;
}

function getChangeOptions(object: ECElementSelection | ChangeOptions) {
  if (ChangeOptions.isChangeOptions(object))
    return object;

  return object.options;
}

export class RenamePropertyChange extends SchemaEditChangeBase {
  public readonly editType = SchemaEditType.SetPropertyName;
  public readonly modifiedClass: ClassId;
  public readonly newPropertyName: string;
  public readonly oldPropertyName: string;
  public readonly resultantChangeInfo: ISchemaEditChangeInfo[] = [];
  public readonly baseProperties?: PropertyId[];
  public readonly derivedProperties?: PropertyId[];

  constructor(contextEditor: SchemaContextEditor, modifiedClass: ECClass, newPropertyName: string, oldPropertyName: string, selectedElements: ECElementSelection, revertCallback?: SchemaChangeRevertCallback) {
    super(contextEditor, modifiedClass.schemaItemType, selectedElements.options, revertCallback);
    this.modifiedClass = ClassId.fromECClass(modifiedClass);
    this.newPropertyName = newPropertyName;
    this.oldPropertyName = oldPropertyName;
    if (!ChangeOptions.isChangeOptions(selectedElements)) {
      this.baseProperties = this.getPropertyIds(selectedElements.gatheredBaseProperties);
      this.derivedProperties = this.getPropertyIds(selectedElements.gatheredDerivedProperties);
    }
  }

  private getPropertyIds(properties: Property[]) {
    const propertyIds: PropertyId[] = [];
    for (const property of properties) {
      propertyIds.push(new PropertyId(property.class.schemaItemType, property.class.key, property));
    }

    return propertyIds;
  }
}