/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "@bentley/bentleyjs-core/lib/Assert";
import { ECClassId, ECInstanceKey } from "./EC";

/** Describes one step of property accessor path. */
export interface PropertyAccessor {
  propertyName: string;
  arrayIndex?: number;
}

/** Describes path to a property. */
export type PropertyAccessorPath = PropertyAccessor[];

/** Displayed content types. Affects how the content is formatted, e.g.
 * the @ref ContentFlags
 */
export class DefaultContentDisplayTypes {
  /** Unknown content type. */
  public static undefined = "Undefined";

  /** Grid or table view content type. By default adds @ref ShowLabels flag. */
  public static grid = "Grid";

  /** Property pane content type. By default adds @ref MergeResults flag. */
  public static propertyPane = "PropertyPane";

  /** List content type. By default adds @ref NoFields @ref ShowLabels flags */
  public static list = "List";

  /** Property comparison pane content type. */
  public static propertyComparisonPane = "PropertyComparisonPane";
}

/** A struct that describes a @ref Field category. */
export class CategoryDescription {
  private _name: string;
  private _label: string;
  private _description: string;
  private _priority: number;
  private _expand: boolean;

  /** Constructor.
   * @param[in] name Name of the category.
   * @param[in] label Label of the category.
   * @param[in] description Description of the category.
   * @param[in] priority Priority of the category.
   * @param[in] expand Should this category be auto-expanded.
   */
  constructor(name: string, label: string, description: string, priority: number, expand: boolean) {
    this._name = name;
    this._label = label;
    this._priority = priority;
    this._description = description;
    this._expand = expand;
  }

  /** Get the name of the category. */
  public get name(): string { return this._name; }

  /** Get the label of the category. */
  public get label(): string { return this._label; }

  /** Get the description of the category. */
  public get description(): string { return this._description; }

  /** Get the priority of the category. */
  public get priority(): number { return this._priority; }

  /** Should this category be automatically expanded. */
  public get expand(): boolean { return this._expand; }
}

/** Information about an ECClass. */
export interface ECClassInfo {
  /** Get the ECClass ID. */
  id: ECClassId;

  /** Get the ECClass name. */
  name: string;

  /** Get the ECClass display label. */
  displayLabel: string;
}

/** Information about an ECProperty. */
export interface ECPropertyInfo {
  /** Get information about ECClass that the ECProperty belongs to. */
  classInfo: ECClassInfo;

  /** Get name of the ECProperty. */
  name: string;

  /** Get the type name of the ECProperty. */
  type: string;

  /** In case this is an enumeration property, get choices of enumeration property. TODO: */
  // Choices?: ui.EnumerationChoices;

  /** In case this is an enumeration property, get flag whether enumeration is strict or not. */
  isStrict?: boolean;

  /** In case this property has KindOfQuantity, get the KindOfQuantity. TODO: */
  // KindOfQuantity?: ui.IECKindOfQuantityInfo;
}

/** A structure that describes a related class and the properties of that relationship. */
export interface RelatedClassInfo {
  /** Information about the source ECClass */
  sourceClassInfo: ECClassInfo;

  /** Information about the target ECClass */
  targetClassInfo: ECClassInfo;

  /** Information about the relationship ECClass */
  relationshipInfo: ECClassInfo;

  /** Should the relationship be followed in a forward direction to access the related class. */
  isForwardRelationship: boolean;
}

/** A structure that describes a related class path. */
export type RelationshipPathInfo = RelatedClassInfo[];

/** Data structure that describes an ECClass in ContentDescriptor. In addition to the class
 * itself the structure holds its relationship path to the primary ECClass and paths
 * to related property classes.
 */
export class SelectClassInfo {
  private _selectClassInfo: ECClassInfo;
  private _isSelectPolymorphic: boolean;
  private _pathToPrimaryClass: RelationshipPathInfo;
  private _relatedPropertyPaths: RelationshipPathInfo[];

  constructor(classInfo: ECClassInfo, isPolymorphic: boolean, pathToPrimaryClass: RelationshipPathInfo) {
    this._selectClassInfo = classInfo;
    this._isSelectPolymorphic = isPolymorphic;
    this._pathToPrimaryClass = pathToPrimaryClass;
    this._relatedPropertyPaths = new Array<RelationshipPathInfo>();
  }

  public get selectClassInfo(): ECClassInfo { return this._selectClassInfo; }
  public get isSelectPolymorphic(): boolean { return this._isSelectPolymorphic; }
  public get pathToPrimaryClass(): RelationshipPathInfo { return this._pathToPrimaryClass; }
  public get relatedPropertyPaths(): RelationshipPathInfo[] { return this._relatedPropertyPaths; }
}

export enum PropertyValueFormat {
  Primitive,
  Array,
  Struct,
}

/** Base class for content field type descriptions. */
export abstract class TypeDescription {
  private _valueFormat: PropertyValueFormat;
  private _typeName: string;

  constructor(valueFormat: PropertyValueFormat, typeName: string) {
    this._valueFormat = valueFormat;
    this._typeName = typeName;
  }
  public get valueFormat(): PropertyValueFormat { return this._valueFormat; }
  public get typeName(): string { return this._typeName; }

  public asPrimitiveDescription(): PrimitiveTypeDescription | null { return null; }
  public get isPrimitiveDescription(): boolean { return null != this.asPrimitiveDescription(); }

  public asArrayDescription(): ArrayTypeDescription | null { return null; }
  public get isArrayDescription(): boolean { return null != this.asArrayDescription(); }

  public asStructDescription(): StructTypeDescription | null { return null; }
  public get isStructDescription(): boolean { return null != this.asStructDescription(); }
}

/** Type description for primitive properties */
export class PrimitiveTypeDescription extends TypeDescription {
  constructor(typeName: string) {
    super(PropertyValueFormat.Primitive, typeName);
  }
  public asPrimitiveDescription(): PrimitiveTypeDescription { return this; }
}

/** Type description for array properties. */
export class ArrayTypeDescription extends TypeDescription {
  private _memberType: TypeDescription;
  constructor(typeName: string, memberType: TypeDescription) {
    super(PropertyValueFormat.Array, typeName);
    this._memberType = memberType;
  }
  public asArrayDescription(): ArrayTypeDescription { return this; }
  public get memberType(): TypeDescription { return this._memberType; }
}

/** An interface for struct member type description. */
export interface StructFieldMemberDescription {
  name: string;
  label: string;
  type: TypeDescription;
}

/** Type description for struct properties. */
export class StructTypeDescription extends TypeDescription {
  private _members: StructFieldMemberDescription[];
  constructor(typeName: string) {
    super(PropertyValueFormat.Struct, typeName);
    this._members = new Array<StructFieldMemberDescription>();
  }
  public asStructDescription(): StructTypeDescription { return this; }
  public get members(): StructFieldMemberDescription[] { return this._members; }
}

/** A class which describes editor used for a content field. */
export class EditorDescription {
  private _name: string;
  // private _params: ui.IPropertyEditorParams; todo:

  constructor(name: string) {
    this._name = name;
    // this._params = {};
  }

  public get name(): string { return this._name; }
  // public get params(): ui.IPropertyEditorParams { return this._params; }
}

/** Describes a single ECProperty that's included in a @ref ContentField. */
export class Property {
  private _property: ECPropertyInfo;
  private _relatedClassPath: RelationshipPathInfo;

  /** Constructor.
   * @param[in] property Information about the property that this field property is based on.
   */
  constructor(property: ECPropertyInfo) {
    this._property = property;
    this._relatedClassPath = new Array<RelatedClassInfo>();
  }

  /** Get the property. */
  public get property(): ECPropertyInfo { return this._property; }

  /** In case this is a related property, relationship path from the actual instance to this property. */
  public get relatedClassPath(): RelationshipPathInfo { return this._relatedClassPath; }
}

/** Describes a single content field. A field is usually represented as a grid column
 * or a property pane row.
 */
export class Field {
  private _category: CategoryDescription;
  private _name: string;
  private _label: string;
  private _description: TypeDescription;
  private _editor: EditorDescription | null;
  private _isReadOnly: boolean;
  private _priority: number;
  private _parent: NestedContentField | null;

  /** Constructor.
   * @param[in] category The category of this field.
   * @param[in] name The per-descriptor unique name of this field.
   * @param[in] label The label of this field.
   * @param[in] description The type description of this field.
   * @param[in] isReadOnly Are the values in this field read-only.
   * @param[in] priority Priority of this field.
   * @param[in] editor Custom editor of this field.
   * @param[in] parentField Parent field (in case this field is nested)
   */
  constructor(category: CategoryDescription, name: string, label: string, description: TypeDescription,
    isReadOnly: boolean, priority: number, editor: EditorDescription | null,
    parentField: NestedContentField | null) {
    this._category = category;
    this._name = name;
    this._label = label;
    this._description = description;
    this._isReadOnly = isReadOnly;
    this._priority = priority;
    this._editor = editor;
    this._parent = parentField;
  }

  /** Get this fiels as properties field. */
  public asPropertiesField(): PropertiesField | null { return null; }
  /** Is this a properties field. */
  public get isPropertiesField(): boolean { return null != this.asPropertiesField(); }

  /** Get this field as nested content field. */
  public asNestedContentField(): NestedContentField | null { return null; }
  /** Is this field a nested content field. */
  public get isNestedContentField(): boolean { return null != this.asNestedContentField(); }

  /** Get the category of this field. */
  public get category(): CategoryDescription { return this._category; }

  /** Get the per-descriptor unique name of this field. */
  public get name(): string { return this._name; }

  /** Get the label of this field. */
  public get label(): string { return this._label; }

  /** Get the type description of this field. */
  public get description(): TypeDescription { return this._description; }

  /** Get the editor name for this field. */
  public get editor(): EditorDescription | null { return this._editor; }

  /** Are the values in this field read-only. */
  public get isReadOnly(): boolean { return this._isReadOnly; }

  /** Get the priority of this field. */
  public get priority(): number { return this._priority; }

  /** Get parent field. */
  public get parentField(): NestedContentField | null { return this._parent; }
}

/** Describes a single content field that's based on one or more EC properties. */
export class PropertiesField extends Field {
  private _properties: Property[];

  /** Constructor.
   * @param[in] category The category of this field.
   * @param[in] name The per-descriptor unique name of this field.
   * @param[in] label The label of this field.
   * @param[in] type The type description of this field.
   * @param[in] isReadOnly Are the values in this field read-only.
   * @param[in] priority Priority of this field.
   * @param[in] editor Custom editor of this field.
   * @param[in] parentField Parent field (in case this field is nested)
   */
  constructor(category: CategoryDescription, name: string, label: string, type: TypeDescription,
    isReadOnly: boolean, priority: number, editor: EditorDescription | null,
    parentField: NestedContentField | null) {
    super(category, name, label, type, isReadOnly, priority, editor, parentField);
    this._properties = new Array<Property>();
  }

  public asPropertiesField(): PropertiesField { return this; }

  /** Get the list of properties which is field is based on. */
  public get properties(): Property[] { return this._properties; }
}

/** Describes a single content field that contains nested content. */
export class NestedContentField extends Field {
  private _contentClassInfo: ECClassInfo;
  private _pathToPrimaryClass: RelationshipPathInfo;
  private _nestedFields: Field[];

  /** Constructor.
   * @param[in] category The category of this field.
   * @param[in] name The per-descriptor unique name of this field.
   * @param[in] label The label of this field.
   * @param[in] type The description of this nested content field.
   * @param[in] contentClassInfo Information about the class whose content is contained in this field.
   * @param[in] pathToPrimaryClass Relationship path from content class to primary instance class.
   * @param[in] isReadOnly Are the values in this field read-only.
   * @param[in] priority Priority of this field.
   * @param[in] editor Custom editor of this field.
   * @param[in] parentField Parent field (in case this field is nested)
   */
  constructor(category: CategoryDescription, name: string, label: string, type: StructTypeDescription,
    contentClassInfo: ECClassInfo, pathToPrimaryClass: RelationshipPathInfo,
    isReadOnly: boolean, priority: number, editor: EditorDescription | null,
    parentField: NestedContentField | null) {
    super(category, name, label, type, isReadOnly, priority, editor, parentField);
    this._contentClassInfo = contentClassInfo;
    this._pathToPrimaryClass = pathToPrimaryClass;
    this._nestedFields = new Array<Field>();
  }

  public asNestedContentField(): NestedContentField { return this; }

  /** Get information about the class whose content is contained in this field. */
  public get contentClass(): ECClassInfo { return this._contentClassInfo; }

  /** Get relationship path from content class to primary instance class. */
  public get pathToPrimaryInstanceClass(): RelationshipPathInfo { return this._pathToPrimaryClass; }

  /** Get nested content fields. */
  public get nestedFields(): Field[] { return this._nestedFields; }
}

/** Flags that control content format. */
export enum ContentFlags {
  /** Each content record has only ECInstanceKey and no data */
  KeysOnly = 1 << 0,

  /** Each content record additionally has an image id */
  ShowImages = 1 << 1,

  /** Each content record additionally has a label */
  ShowLabels = 1 << 2,

  /** All content records are merged into a single record */
  MergeResults = 1 << 3,

  /** Content has only distinct values */
  DistinctValues = 1 << 4,

  /** Doesnt create property or calculated fields. Can be used in conjunction with @e ShowLabels. */
  NoFields = 1 << 5,
}

export enum SortDirection {
  Ascending,
  Descending,
}

export class SelectionInfo {
}

/** Describes the content: fields, sorting, filtering, format. Users may change
 * @ref Descriptor to control what content they get and how they get it.
 */
export class Descriptor {
  private _preferredDisplayType: string;
  private _selectClasses: SelectClassInfo[];
  private _originalFields: Field[];
  private _actualFields: Field[];
  private _sortingField: Field | null;
  private _sortDirection: SortDirection;
  private _contentFlags: number;
  private _filterExpression: string;

  /** Constructor.
   * @param[in] preferredDisplayType The display type to create the descriptor for.
   * @param[in] selectClasses ECClasses selected by the descriptor.
   * @param[in] fields The fields in this descriptor.
   * @param[in] contentFlags The @ref ContentFlags
   */
  constructor(preferredDisplayType: string, selectClasses: SelectClassInfo[], fields: Field[], contentFlags: number) {
    this._preferredDisplayType = preferredDisplayType;
    this._selectClasses = selectClasses;
    this._originalFields = fields;
    this._actualFields = fields.slice();
    this._sortingField = null;
    this._sortDirection = SortDirection.Ascending;
    this._contentFlags = contentFlags;
  }

  /** Get the preferred display type which this descriptor is created for. */
  public get preferredDisplayType(): string { return this._preferredDisplayType; }

  /** Get ECClasses selected by the descriptor. */
  public get selectClasses(): SelectClassInfo[] { return this._selectClasses; }

  /** Get the original fields in this descriptor. */
  public get originalFields(): Field[] { return this._originalFields; }

  /** Get the fields in this descriptor. */
  public get fields(): Field[] { return this._actualFields; }

  /** Get the sorting field used to sort content. */
  public get sortingField(): Field | null { return this._sortingField; }
  /** Set the sorting field used to sort content. */
  public set sortingField(field: Field | null) { this._sortingField = field; }

  /** Get sorting direction. */
  public get sortDirection(): SortDirection { return this._sortDirection; }
  /** Set sorting direction. */
  public set sortDirection(value: SortDirection) { this._sortDirection = value; }

  /** Get filtering ECExpression. */
  public get filterExpression(): string { return this._filterExpression; }
  /** Set filtering ECExpression. */
  public set filterExpression(filter: string) { this._filterExpression = filter; }

  /** Get the content flags.
   * @see ContentFlags
   */
  public get contentFlags(): number { return this._contentFlags; }
  /** Set the content flags.
   * @see ContentFlags
   */
  public set contentFlags(flags: number) { this._contentFlags = flags; }

  /** Get field by its index. */
  public getFieldByIndex(index: number): Field | null {
    if (index < 0 || index >= this.fields.length)
      return null;
    return this.fields[index];
  }

  /** Get field by its name. */
  public getFieldByName(name: string): Field | null {
    for (const field of this.fields) {
      if (field.name === name)
        return field;
    }
    return null;
  }

  /** Get field index. -1 if the field doesn't exist in this descriptor. */
  public getFieldIndex(field: Field): number { return this.fields.indexOf(field); }

  /** Get indexes of fields that were removed from the descriptor. */
  public getHiddenFieldIndexes(): number[] {
    if (this._actualFields.length >= this._originalFields.length)
      return [];

    const indexes: number[] = [];
    for (let originalFieldIndex = 0; originalFieldIndex < this._originalFields.length; ++originalFieldIndex) {
      const originalField = this._originalFields[originalFieldIndex];
      let contains = false;
      for (const actualField of this._actualFields) {
        if (actualField.name === originalField.name && actualField.description === originalField.description) {
          contains = true;
          break;
        }
      }
      if (!contains)
        indexes.push(originalFieldIndex);
    }
    return indexes;
  }
}

export class PropertyValueKeys {
  private _field: Field;
  private _property: Property;
  private _keys: ECInstanceKey[];

  constructor(field: Field, fieldProperty: Property, keys: ECInstanceKey[]) {
    this._field = field;
    this._property = fieldProperty;
    this._keys = keys;
  }

  public get field(): Field { return this._field; }
  public get property(): Property { return this._property; }
  public get keys(): ECInstanceKey[] { return this._keys; }
}

interface NestedContent {
  primaryKeys: ECInstanceKey[];
  values: any;
  displayValues: any;
}

export interface FieldPropertyValueKeys {
  [fieldName: string]: PropertyValueKeys[];
}

export interface ValuesDictionary {
  key: any;
}

/** A struct that represents a single content record. */
export class ContentSetItem {
  private _primaryKeys: ECInstanceKey[];
  private _displayLabel: string;
  private _imageId: string;
  private _classInfo: ECClassInfo | null;
  private _values: ValuesDictionary;
  private _displayValues: ValuesDictionary;
  private _mergedFieldNames: string[];
  private _fieldPropertyValueKeys: FieldPropertyValueKeys;

  /** Constructor.
   * @param[in] primaryKeys Array of keys which describe whose values this item contains.
   * @param[in] displayLabel The label of this content item.
   * @param[in] imageId The image ID for this item.
   * @param[in] classInfo Information about the class which the item belongs to
   * @param[in] values The values map.
   * @param[in] displayValues The display values map.
   * @param[in] mergedFieldNames Names of fields whose values are merged in this record.
   * @param[in] fieldPropertyValueKeys ECInstanceKeys of related instances for each field in this record.
   */
  constructor(primaryKeys: ECInstanceKey[], displayLabel: string, imageId: string, classInfo: ECClassInfo | null,
    values: ValuesDictionary, displayValues: ValuesDictionary, mergedFieldNames: string[],
    fieldPropertyValueKeys: FieldPropertyValueKeys) {
    this._primaryKeys = primaryKeys;
    this._displayLabel = displayLabel;
    this._imageId = imageId;
    this._classInfo = classInfo;
    this._values = values;
    this._displayValues = displayValues;
    this._mergedFieldNames = mergedFieldNames;
    this._fieldPropertyValueKeys = fieldPropertyValueKeys;
  }

  /** The information about the ECClass of this item. */
  public get classInfo(): ECClassInfo | null { return this._classInfo; }

  /** Array of keys which describe whose values this item contains. */
  public get primaryKeys(): ECInstanceKey[] { return this._primaryKeys; }

  /** The display label of this content item. */
  public get displayLabel(): string { return this._displayLabel; }

  /** The image ID for this item. */
  public get imageId(): string { return this._imageId; }

  /** The values map. */
  public get values(): ValuesDictionary { return this._values; }

  /** The display values map. */
  public get displayValues(): ValuesDictionary { return this._displayValues; }

  /** Is value of field with the specified name merged in this record. */
  public isMerged(fieldName: string): boolean { return -1 !== this._mergedFieldNames.indexOf(fieldName); }

  /** Get the ECInstanceKeys of instances whose values are contained in the field
   * with the specified name.
   */
  public getFieldPropertyValueKeys(fieldName: string): PropertyValueKeys[] {
    if (this._fieldPropertyValueKeys.hasOwnProperty(fieldName))
      return this._fieldPropertyValueKeys[fieldName];
    return [];
  }

  /** Get keys of nested instances accessible using supplied accessor. */
  public getNestedInstanceKeys(accessor: PropertyAccessorPath): ECInstanceKey[] {
    assert(accessor.length >= 2, "For nested fields the accessor length is expected to be at least 2");
    let values: any = this.values;
    for (let i = 0; i < accessor.length && values; ++i) {
      values = values[accessor[i].propertyName];
      if (null !== accessor[i].arrayIndex && undefined !== accessor[i].arrayIndex)
        values = values[accessor[i].arrayIndex!];
      else if (Array.isArray(values))
        values = values[0];
      const nestedValues: NestedContent = values;
      values = nestedValues.values;
      if (i === accessor.length - 2)
        return nestedValues.primaryKeys;
    }
    return [];
  }
}

/** A struct that contains the @ref Descriptor and a list of @ref ContentSetItem
 * objects which are based on that descriptor.
 */
export class Content {
  private _descriptor: Descriptor;
  private _contentSet: ContentSetItem[];

  /** Constructor.
   * @param[in] descriptor The descriptor used to create this content.
   */
  constructor(descriptor: Descriptor) {
    this._descriptor = descriptor;
    this._contentSet = new Array<ContentSetItem>();
  }

  /** The descriptor used to create this content. */
  public get descriptor(): Descriptor { return this._descriptor; }

  /** The actual content. */
  public get contentSet(): ContentSetItem[] { return this._contentSet; }
}
