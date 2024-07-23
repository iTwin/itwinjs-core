import { Property } from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "../Editor";
import { ECElementSelection } from "../ECElementSelection";
import { ISchemaEditChangeInfo, ISchemaEditChangeProps, SchemaChangeRevertCallback, SchemaEditChangeBase } from "./ChangeInfo";
import { ChangeOptions } from "./ChangeOptions";
import { ClassId, PropertyId } from "../SchemaItemIdentifiers";
import { SchemaEditType } from "../SchmaEditType";

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

  constructor(contextEditor: SchemaContextEditor, selectedElements: ECElementSelection, modifiedClass: ClassId, newPropertyName: string, oldPropertyName: string, revertCallback?: SchemaChangeRevertCallback);
  constructor(contextEditor: SchemaContextEditor, changeOptions: ChangeOptions, modifiedClass: ClassId, newPropertyName: string, oldPropertyName: string, revertCallback?: SchemaChangeRevertCallback);
  constructor(contextEditor: SchemaContextEditor, selectedElementsOrOptions: ECElementSelection | ChangeOptions, modifiedClass: ClassId, newPropertyName: string, oldPropertyName: string, revertCallback?: SchemaChangeRevertCallback) {
    super(contextEditor, getChangeOptions(selectedElementsOrOptions), modifiedClass.schemaItemType, revertCallback);
    this.modifiedClass = modifiedClass;
    this.newPropertyName = newPropertyName;
    this.oldPropertyName = oldPropertyName;
    if (!ChangeOptions.isChangeOptions(selectedElementsOrOptions)) {
      this.baseProperties = this.getPropertyIds(selectedElementsOrOptions.gatheredBaseProperties);
      this.derivedProperties = this.getPropertyIds(selectedElementsOrOptions.gatheredDerivedProperties);
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