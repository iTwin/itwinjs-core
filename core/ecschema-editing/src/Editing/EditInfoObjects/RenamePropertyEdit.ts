import { ECClass, Property } from "@itwin/ecschema-metadata";
import { ECElementSelection } from "../ECElementSelection";
import { SchemaChangeRevertCallback, SchemaEditInfoBase } from "./SchemaEditInfo";
import { EditOptions } from "./EditOptions";
import { ClassId, PropertyId } from "../SchemaItemIdentifiers";
import { SchemaEditType } from "../SchemaEditType";


/**
 * ISchemaEditInfo implementation for property rename edits.
 * @alpha
 */
export class RenamePropertyEdit extends SchemaEditInfoBase {
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
  constructor (modifiedClass: ECClass, newPropertyName: string, oldPropertyName: string, selectedElements: ECElementSelection, revertCallback?: SchemaChangeRevertCallback) {
    super(modifiedClass.schemaItemType, selectedElements.options, revertCallback);
    this.modifiedClass = ClassId.fromECClass(modifiedClass);
    this.newPropertyName = newPropertyName;
    this.oldPropertyName = oldPropertyName;
    if (!EditOptions.isChangeOptions(selectedElements)) {
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