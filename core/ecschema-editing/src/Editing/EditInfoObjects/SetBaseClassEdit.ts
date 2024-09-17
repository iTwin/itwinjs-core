import { ECClass } from "@itwin/ecschema-metadata";
import { ECElementSelection } from "../ECElementSelection";
import { SchemaEditInfoBase } from "./SchemaEditInfo";
import { ClassId, ECClassSchemaItems } from "../SchemaItemIdentifiers";
import { SchemaEditType } from "../SchemaEditType";


/**
 * ISchemaEditInfo implementation base class edits.
 * @alpha
 */
export class SetBaseClassEdit extends SchemaEditInfoBase {
  /** editType is SchemaEditType.SetPropertyName */
  public readonly editType = SchemaEditType.SetBaseClass;
  /** The ClassId of the EC Class being modified. */
  public readonly modifiedClass: ClassId;
  /** The ClassId of the new base class. */
  public readonly newBaseClass?: ClassId;
  /** The ClassId of the new old class. */
  public readonly oldBaseClass?: ClassId;
  /** A collection of ClassId objects identifying any derived classes affected by this edit. */
  public readonly derivedClasses?: ClassId[];

  /**
   * Initializes a new SetBaseClassChange instance.
   * @param modifiedClass The ECClass holding the property being modified.
   * @param newBaseClass The new base class.
   * @param oldBaseClass The old base class.
   * @param selectedElements The ECElementSelection containing derived classes affected by this edit.
   */
  constructor(modifiedClass: ECClass, newBaseClass: ECClass | undefined, oldBaseClass: ECClass | undefined, selectedElements: ECElementSelection) {
    super(modifiedClass.schemaItemType, selectedElements.options);
    this.modifiedClass = ClassId.fromECClass(modifiedClass);
    this.newBaseClass = newBaseClass ? ClassId.fromECClass(modifiedClass) : undefined;
    this.oldBaseClass = oldBaseClass ? ClassId.fromECClass(oldBaseClass) : undefined;
    this.derivedClasses = this.getClassIds(selectedElements.gatheredDerivedClasses);
  }

  private getClassIds(classes: Map<string, ECClass>) {
    const classIds: ClassId[] = [];
    for (const classEntry of classes) {
      classIds.push(new ClassId(classEntry[1].schemaItemType as ECClassSchemaItems, classEntry[1].key));
    }

    return classIds;
  }
}