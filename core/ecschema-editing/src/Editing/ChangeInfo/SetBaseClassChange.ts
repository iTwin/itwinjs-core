import { ECClass } from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "../Editor";
import { ECElementSelection } from "../ECElementSelection";
import { ISchemaEditChangeInfo, ISchemaEditChangeProps, SchemaEditChangeBase } from "./ChangeInfo";
import { ChangeOptions } from "./ChangeOptions";
import { ClassId, ECClassSchemaItems } from "../SchemaItemIdentifiers";
import { SchemaEditType } from "../SchmaEditType";

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
  public readonly resultantChangeInfo: ISchemaEditChangeInfo[] = [];
  public readonly derivedClasses?: ClassId[];

  constructor(contextEditor: SchemaContextEditor, selectedElements: ECElementSelection, modifiedClass: ClassId, newBaseClass: ClassId | undefined, oldBaseClass: ClassId | undefined);
  constructor(contextEditor: SchemaContextEditor, changeOptions: ChangeOptions, modifiedClass: ClassId, newBaseClass: ClassId, oldBaseClass: ClassId | undefined);
  constructor(contextEditor: SchemaContextEditor, selectedElementsOrOptions: ECElementSelection | ChangeOptions, modifiedClass: ClassId, newBaseClass: ClassId, oldBaseClass: ClassId | undefined) {
    super(contextEditor, getChangeOptions(selectedElementsOrOptions), modifiedClass.schemaItemType);
    this.modifiedClass = modifiedClass;
    this.newBaseClass = newBaseClass;
    this.oldBaseClass = oldBaseClass;
    if (!ChangeOptions.isChangeOptions(selectedElementsOrOptions)) {
      this.derivedClasses = this.getClassIds(selectedElementsOrOptions.gatheredDerivedClasses);
    }
  }

  private getClassIds(classes: Map<string, ECClass>) {
    const classIds: ClassId[] = [];
    for (const classEntry of classes) {
      classIds.push(new ClassId(classEntry[1].schemaItemType as ECClassSchemaItems, classEntry[1].key));
    }

    return classIds;
  }
}