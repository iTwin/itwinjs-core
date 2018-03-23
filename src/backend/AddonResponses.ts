/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** @hidden */
export interface NodeKey {
  Type: string;
  PathFromRoot: string[];
  ECClassId: string;
}
/** @hidden */
export interface ECInstanceNodeKey extends NodeKey {
  ECInstanceId: string;
}
/** @hidden */
export interface Node {
  NodeId: string; // TODO: should be hex-string
  ParentNodeId?: string; // TODO: should be hex-string
  Key: NodeKey;
  Label: string;
  Description?: string;
  ImageId?: string;
  ForeColor?: string;
  BackColor?: string;
  FontStyle?: string;
  HasChildren?: boolean;
  IsSelectable?: boolean;
  IsEditable?: boolean;
  IsChecked?: boolean;
  IsCheckboxVisible?: boolean;
  IsCheckboxEnabled?: boolean;
  IsExpanded?: boolean;
}
/** @hidden */
export interface NodesPathElement {
  Node: Node;
  Index: number;
  IsMarked: boolean;
  Children: NodesPathElement[];
}

/** @hidden */
export interface ECInstanceKey {
  ECClassName: string; // WIP: IDs
  ECInstanceId: string;
}
/** @hidden */
export interface ClassInfo {
  Id: string;
  Name: string;
  Label: string;
}
/** @hidden */
export interface RelatedClass {
  SourceClassInfo: ClassInfo;
  TargetClassInfo: ClassInfo;
  RelationshipInfo: ClassInfo;
  IsForwardRelationship: boolean;
  IsPolymorphicRelationship: boolean;
}
/** @hidden */
export type RelatedClassPath = RelatedClass[];
/** @hidden */
export interface Category {
  Name: string;
  DisplayLabel: string;
  Description: string;
  Expand: boolean;
  Priority: number;
}
/** @hidden */
export interface Editor {
  Name: string;
  Params: { [id: string]: any };
}
/** @hidden */
export interface FieldTypeDescription {
  TypeName: string;
  ValueFormat: string;
}
/** @hidden */
export interface FieldArrayTypeDescription extends FieldTypeDescription {
  MemberType: FieldTypeDescription;
}
/** @hidden */
export interface StructMemberDescription {
  Name: string;
  Label: string;
  Type: FieldTypeDescription;
}
/** @hidden */
export interface FieldStructTypeDescription extends FieldTypeDescription {
  Members: StructMemberDescription[];
}
/** @hidden */
export interface Field {
  Category: Category;
  Name: string;
  DisplayLabel: string;
  Type: FieldTypeDescription;
  IsReadOnly: boolean;
  Priority: number;
  Editor?: Editor;
}
/** @hidden */
export interface EnumerationChoice {
  Label: string;
  Value: string;
}
/** @hidden */
export interface KindOfQuantity {
  Name: string;
  DisplayLabel: string;
  PersistenceUnit: string;
  CurrentFusId: string;
}
/** @hidden */
export interface ECProperty {
  BaseClassInfo: ClassInfo;
  ActualClassInfo: ClassInfo;
  Name: string;
  Type: string;
  Choices?: EnumerationChoice[];
  IsStrict?: boolean;
  KindOfQuantity?: KindOfQuantity;
}
/** @hidden */
export interface FieldProperty {
  Property: ECProperty;
  RelatedClassPath: RelatedClassPath;
}
/** @hidden */
export interface ECPropertiesField extends Field {
  Properties: FieldProperty[];
}
/** @hidden */
export interface NestedContentField extends Field {
  ContentClassInfo: ClassInfo;
  PathToPrimary: RelatedClassPath;
  NestedFields: Field[];
}
/** @hidden */
export interface SelectClassInfo {
  SelectClassInfo: ClassInfo;
  IsPolymorphic: boolean;
  PathToPrimaryClass: RelatedClassPath;
  RelatedPropertyPaths: RelatedClassPath[];
}
/** @hidden */
export interface Descriptor {
  PreferredDisplayType: string;
  SelectClasses: SelectClassInfo[];
  Fields: Field[];
  SortingFieldIndex: number;
  SortDirection: number;
  ContentFlags: number;
  FilterExpression: string;
}
/** @hidden */
export interface FieldPropertyKeys {
  PropertyIndex: number;
  Keys: ECInstanceKey[];
}
/** @hidden */
export interface ContentSetItem {
  DisplayLabel?: string;
  ImageId?: string;
  Values?: { [fieldName: string]: any };
  DisplayValues?: { [fieldName: string]: string | null };
  ClassInfo?: ClassInfo;
  PrimaryKeys?: ECInstanceKey[];
  MergedFieldNames?: string[];
  FieldValueKeys?: { [fieldName: string]: FieldPropertyKeys[] };
}
/** @hidden */
export interface Content {
  Descriptor: Descriptor;
  ContentSet: ContentSetItem[];
}
