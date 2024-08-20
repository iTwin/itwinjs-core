import { ECClass, Property } from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "../Editor";
import { ECElementSelection } from "../ECElementSelection";
import { ISchemaEditChangeProps, SchemaChangeRevertCallback, SchemaEditChangeBase } from "./ChangeInfo";
import { ChangeOptions } from "./ChangeOptions";
import { ClassId, PropertyId } from "../SchemaItemIdentifiers";
import { SchemaEditType } from "../SchemaEditType";

/** Used for JSON serialization/deserialization. Props for [[RenamePropertyChange]]. */
export interface RenamePropertyChangeProps extends ISchemaEditChangeProps {
  readonly newPropertyName: string;
  readonly oldPropertyName: string;
}

/** ISchemaEditChangeInfo implementation for property rename edits. */
export class RenamePropertyChange extends SchemaEditChangeBase {
  /** editType is SchemaEditType.SetPropertyName */
  public readonly editType = SchemaEditType.SetPropertyName;
  /** The ClassId of the EC Class being modified. */
  public readonly modifiedClass: ClassId;
  /** The new Property name. */
  public readonly newPropertyName: string;
  /** The old Property name. */
  public readonly oldPropertyName: string;
  /** PropertyId array identifying base properties affected by this edit. */
  public readonly baseProperties?: PropertyId[];
  /** PropertyId array identifying derived properties affected by this edit. */
  public readonly derivedProperties?: PropertyId[];

  /**
   * Initializes a new RenamePropertyChange instance.
   * @param contextEditor The SchemaContextEditor that wraps a SchemaContext.
   * @param modifiedClass The ECClass holding the property being modified.
   * @param newPropertyName The new property name.
   * @param oldPropertyName The old property name.
   * @param selectedElements The ECElementSelection containing base/derived properties affected by this edit.
   * @param revertCallback The SchemaChangeRevertCallback function to revert the edit.
   */
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