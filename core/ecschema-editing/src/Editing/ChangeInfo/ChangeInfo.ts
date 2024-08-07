import { SchemaItemType } from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "../Editor";
import { ChangeOptionProps, ChangeOptions } from "./ChangeOptions";
import { RenamePropertyChange } from "./RenamePropertyChange";
import { SchemaEditType } from "../SchmaEditType";


export type SchemaChangeRevertCallback = <T extends ISchemaEditChangeInfo>(changeInfo: T) => Promise<void>;
export type BeginSchemaEditCallback= <T extends ISchemaEditChangeInfo>(changeInfo: T) => Promise<boolean>;

export interface ISchemaEditChangeProps {
  readonly changeOptions?: ChangeOptionProps;
  readonly editType?: string;
  readonly schemaItemType?: string;
}

export interface ISchemaEditChangeInfo {
  readonly contextEditor: SchemaContextEditor;
  readonly changeOptions: ChangeOptions;
  readonly editType: SchemaEditType;
  readonly schemaItemType: SchemaItemType;
  set sequence(value: number)
  get sequence(): number;
  revertChange(): Promise<void>;
}

export abstract class SchemaEditChangeBase implements ISchemaEditChangeInfo {
  private _sequence: number = -1;

  public abstract readonly editType: SchemaEditType;
  public readonly contextEditor: SchemaContextEditor;
  public readonly changeOptions: ChangeOptions;
  public readonly schemaItemType: SchemaItemType;
  protected readonly revertCallback?: SchemaChangeRevertCallback;

  constructor(contextEditor: SchemaContextEditor, changeOptions: ChangeOptions, schemaItemType: SchemaItemType, revertCallback?: SchemaChangeRevertCallback) {
    this.contextEditor = contextEditor;
    this.changeOptions = changeOptions;
    this.schemaItemType = schemaItemType;
    this.revertCallback = revertCallback;

    this.contextEditor.addEditInfo(this);
  }

  public get sequence(): number {
    return this._sequence;
  }

  public set sequence(value: number) {
    this._sequence = value;
  }

  public get isLocalChange(): boolean {
    return this.changeOptions.localChange;
  }

  public get changeBase(): boolean {
    return this.changeOptions.changeBase;
  }

  public get changeDerived(): boolean {
    return this.changeOptions.changeDerived;
  }

  public async revertChange(): Promise<void> {
    if (!this.revertCallback)
      return;

    await this.revertCallback(this);
  }

  public toJson() {
    const itemJson: { [value: string]: any } = {};

  }

  public async beginChange(): Promise<boolean> {
    // Edit continues if no callback is available
    if (!this.changeOptions.beginChangeCallback)
      return true;

    const startEdit = await this.changeOptions.beginChangeCallback(this);
    if (!startEdit) {
      this.contextEditor.changeCancelled(this);
    }
    return startEdit;
  }
}

// export class SetBaseClassChangeInfo extends SchemaEditChange {
//   public readonly editType = ECEditingStatus.SetBaseClass;
//   public readonly classKey: SchemaItemKey;
//   public readonly baseClassKey?: SchemaItemKey;
//   public readonly oldBaseClassKey?: SchemaItemKey;
//   public readonly resultantChangeInfo: ISchemaEditChangeInfo[] = [];

//   constructor(contextEditor: SchemaContextEditor, selectedElements: ECElementSelection, classKey: SchemaItemKey, baseClassKey: SchemaItemKey | undefined, oldBaseClassKey: SchemaItemKey | undefined) {
//     super(contextEditor, selectedElements.options);
//     this.classKey = classKey;
//     this.baseClassKey = baseClassKey;
//     this.oldBaseClassKey = oldBaseClassKey;
//   }
// }

// export class SetAbstractConstraintChangeInfo extends SchemaEditChange {
//   public readonly editType = ECEditingStatus.SetAbstractConstraint;
//   public readonly constraintId: RelationshipConstraintId;
//   public readonly abstractConstraintId?: AbstractConstraintId;
//   public readonly oldAbstractConstraintId?: AbstractConstraintId;
//   public readonly resultantChangeInfo: ISchemaEditChangeInfo[] = [];

//   constructor(contextEditor: SchemaContextEditor, selectedElements: ECElementSelection, constraintId: RelationshipConstraintId, abstractConstraintId?: AbstractConstraintId, oldAbstractConstraintId?: AbstractConstraintId) {
//     super(contextEditor, selectedElements.options);
//     this.constraintId = constraintId;
//     this.abstractConstraintId = abstractConstraintId;
//     this.oldAbstractConstraintId = oldAbstractConstraintId;
//   }

//   public async getConstraint(): Promise<RelationshipConstraint> {
//     const relationship = await this.contextEditor.schemaContext.getSchemaItem<RelationshipClass>(this.constraintId.relationshipKey)

//     const constraint = this.constraintId.name === "source" ? relationship?.source : relationship?.target;
//     if (!constraint)
//       throw new Error(`${this.constraintId.name} constraint of RelationshipClass ${relationship?.name} is undefined.`)

//     return constraint;
//   }

//   public getResultantChangeInfo(): ISchemaEditChangeInfo[] {
//     return [];
//   }
// }

// export class SetRelationshipConstraintChangeInfo extends SchemaEditChange {
//   public readonly editType: ECEditingStatus;
//   public readonly relationshipKey: SchemaItemKey;
//   public readonly constraintId: RelationshipConstraintId;
//   public readonly oldConstraintId?: RelationshipConstraintId;
//   public readonly resultantChangeInfo: ISchemaEditChangeInfo[] = [];

//   constructor(contextEditor: SchemaContextEditor, selectedElements: ECElementSelection, relationshipKey: SchemaItemKey, constraintId: RelationshipConstraintId, oldConstraintId?: RelationshipConstraintId) {
//     super(contextEditor, selectedElements.options);
//     this.editType = constraintId.name === "Source" ? ECEditingStatus.SetSourceConstraint : ECEditingStatus.SetTargetConstraint;
//     this.relationshipKey = relationshipKey
//     this.constraintId = constraintId;
//     this.oldConstraintId = oldConstraintId;
//   }

//   public async getConstraint(): Promise<RelationshipConstraint> {
//     const relationship = await this.contextEditor.schemaContext.getSchemaItem<RelationshipClass>(this.constraintId.relationshipKey)

//     const constraint = this.constraintId.name === "Source" ? relationship?.source : relationship?.target;
//     if (!constraint)
//       throw new Error(`${this.constraintId.name} constraint of RelationshipClass ${relationship?.name} is undefined.`)

//     return constraint;
//   }

//   public getResultantChangeInfo(): ISchemaEditChangeInfo[] {
//     return [];
//   }
// }

// export class AddConstraintClassChangeInfo extends ChangeInfoBase {
//   public readonly editType = ECEditingStatus.AddConstraintClass;
//   public readonly constraintId: RelationshipConstraintId;
//   public readonly constraintClassKey: SchemaItemKey;
//   public readonly resultantChangeInfo: ISchemaEditChangeInfo[] = [];

//   constructor(contextEditor: SchemaContextEditor, selectedElements: ECElementSelection, constraintId: RelationshipConstraintId, classKey: SchemaItemKey) {
//     super(contextEditor, selectedElements.options);
//     this.constraintId = constraintId;
//     this.constraintClassKey = classKey;
//   }

//   public async getConstraint(): Promise<RelationshipConstraint> {
//     const relationship = await this.contextEditor.schemaContext.getSchemaItem<RelationshipClass>(this.constraintId.relationshipKey)

//     const constraint = this.constraintId.name === "Source" ? relationship?.source : relationship?.target;
//     if (!constraint)
//       throw new Error(`${this.constraintId.name} constraint of RelationshipClass ${relationship?.name} is undefined.`)

//     return constraint;
//   }

//   public getResultantChangeInfo(): ISchemaEditChangeInfo[] {
//     return [];
//   }
// }

// export class RemoveConstraintClassChangeInfo extends ChangeInfoBase {
//   public readonly editType = ECEditingStatus.RemoveConstraintClass;
//   public readonly constraintId: RelationshipConstraintId;
//   public readonly constraintClassKey: SchemaItemKey;
//   public readonly resultantChangeInfo: ISchemaEditChangeInfo[] = [];

//   constructor(contextEditor: SchemaContextEditor, selectedElements: ECElementSelection, constraintId: RelationshipConstraintId) {
//     super(contextEditor, selectedElements.options);

//     if (!constraintId.constraintClassKey) {
//       throw new Error("The RelationshipConstraintId.constraintClassKey is undefined.")
//     }
//     this.constraintId = constraintId;
//     this.constraintClassKey = constraintId.constraintClassKey;
//   }

//   public async getConstraint(): Promise<RelationshipConstraint> {
//     const relationship = await this.contextEditor.schemaContext.getSchemaItem<RelationshipClass>(this.constraintId.relationshipKey)

//     const constraint = this.constraintId.name === "Source" ? relationship?.source : relationship?.target;
//     if (!constraint)
//       throw new Error(`${this.constraintId.name} constraint of RelationshipClass ${relationship?.name} is undefined.`)

//     return constraint;
//   }

//   public getResultantChangeInfo(): ISchemaEditChangeInfo[] {
//     return [];
//   }
// }

// export class RemoveReferenceChangeInfo extends ChangeInfoBase {
//   public readonly editType = ECEditingStatus.RemoveSchemaReference;
//   public readonly schemaKey: SchemaKey;
//   public readonly reference: Schema;
//   public readonly resultantChangeInfo: ISchemaEditChangeInfo[] = [];

//   constructor(contextEditor: SchemaContextEditor, selectedElements: ECElementSelection, schemaKey: SchemaKey, reference: Schema, _elements: ISchemaTypeIdentifier[]) {
//     super(contextEditor, selectedElements.options);
//     this.schemaKey = schemaKey;
//     this.reference = reference;

//     this.resultantChangeInfo = this.getResultantChangeInfo();
//   }

//   public getResultantChangeInfo(): ISchemaEditChangeInfo[] {
//     const resultantInfo: ISchemaEditChangeInfo[] = [];
//     // for(const item of this.selectedElements!) {
//     //   switch (item.typeIdentifier) {
//     //     case SchemaTypeIdentifiers.BaseClassIdentifier:
//     //       const baseClassId = item as BaseClassId;
//     //       resultantInfo.push(new SetBaseClassChangeInfo(this.contextEditor, baseClassId.schemaItemKey, undefined, baseClassId.baseClass.schemaItemKey));
//     //       break;
//     //     case SchemaTypeIdentifiers.AbstractConstraintIdentifier:
//     //       const abstractId = item as AbstractConstraintId;
//     //       const constraintId = new RelationshipConstraintId(abstractId.name, abstractId.relationshipKey);
//     //       resultantInfo.push(new SetAbstractConstraintChangeInfo(this.contextEditor, constraintId, undefined, abstractId));
//     //     case SchemaTypeIdentifiers.RelationshipConstraintIdentifier:
//     //       const relConstraintId = item as RelationshipConstraintId;
//     //       resultantInfo.push(new RemoveConstraintClassChangeInfo(this.contextEditor, relConstraintId));
//     //   }
//     // }

//     return resultantInfo;
//   }
// }

// export interface IRemoveReferenceChangeOptions {
//   readonly removeBaseClass?: boolean;
//   readonly removeConstraintClass?: boolean;
//   readonly removeAbstractConstraint?: boolean;
//   readonly removeCustomAttribute?: boolean;
// }

// export type RemoveReferenceCallback = (changeInfo: RemoveReferenceChangeInfo) => IRemoveReferenceChangeOptions;

// export interface ISetBaseClassChangeOptions {
//   readonly cancel?: boolean;
// }

// export type SetBaseClassCallback = (changeInfo: SetBaseClassChangeInfo) => ISetBaseClassChangeOptions;