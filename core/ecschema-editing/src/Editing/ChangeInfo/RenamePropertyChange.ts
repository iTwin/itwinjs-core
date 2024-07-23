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
  protected override revertCallback?: (changeInfo: ISchemaEditChangeInfo) => Promise<void>;

  constructor(contextEditor: SchemaContextEditor, selectedElementsOrOptions: ECElementSelection | ChangeOptions, modifiedClass: ClassId, newPropertyName: string, oldPropertyName: string, revertCallback?: SchemaChangeRevertCallback) {
    super(contextEditor, getChangeOptions(selectedElementsOrOptions), modifiedClass.schemaItemType);
    this.modifiedClass = modifiedClass;
    this.newPropertyName = newPropertyName;
    this.oldPropertyName = oldPropertyName;
    if (!ChangeOptions.isChangeOptions(selectedElementsOrOptions)) {
      this.baseProperties = this.getPropertyIds(selectedElementsOrOptions.gatheredBaseProperties);
      this.derivedProperties = this.getPropertyIds(selectedElementsOrOptions.gatheredDerivedProperties);
    }
    this.revertCallback = revertCallback;
  }

  public async revertChange(): Promise<void> {
    if (!this.revertCallback)
      return;

    await this.revertCallback(this);
  }

  private getPropertyIds(properties: Property[]) {
    const propertyIds: PropertyId[] = [];
    for (const property of properties) {
      propertyIds.push(new PropertyId(property.class.schemaItemType, property.class.key, property));
    }

    return propertyIds;
  }
}