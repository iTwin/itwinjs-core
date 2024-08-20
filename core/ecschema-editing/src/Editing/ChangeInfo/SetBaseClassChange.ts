import { ECClass } from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "../Editor";
import { ECElementSelection } from "../ECElementSelection";
import { ISchemaEditChangeInfo, ISchemaEditChangeProps, SchemaEditChangeBase } from "./ChangeInfo";
import { ChangeOptions } from "./ChangeOptions";
import { ClassId, ECClassSchemaItems } from "../SchemaItemIdentifiers";
import { SchemaEditType } from "../SchemaEditType";

export interface SetBaseClassChangeProps extends ISchemaEditChangeProps {
  readonly newBaseClass?: ClassId;
  readonly oldBaseClass?: ClassId;
}

function getChangeOptions(object: ECElementSelection | ChangeOptions) {
  if (ChangeOptions.isChangeOptions(object))
    return object;

  return object.options;
}

export class SetBaseClassChange extends SchemaEditChangeBase {
  public readonly editType = SchemaEditType.SetPropertyName;
  public readonly modifiedClass: ClassId;
  public readonly newBaseClass?: ClassId;
  public readonly oldBaseClass?: ClassId;
  public readonly derivedClasses?: ClassId[];

  constructor(contextEditor: SchemaContextEditor, modifiedClass: ECClass, newBaseClass: ECClass | undefined, oldBaseClass: ECClass | undefined, selectedElements: ECElementSelection) {
    super(contextEditor, modifiedClass.schemaItemType, selectedElements.options);
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