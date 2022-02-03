/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */
import { assert } from "@itwin/core-bentley";
import type { EditorDescription, EnumerationInfo, Field, FieldHierarchy, IContentVisitor, Item,
  ProcessFieldHierarchiesProps, ProcessMergedValueProps, ProcessPrimitiveValueProps, RendererDescription, StartArrayProps,
  StartCategoryProps, StartContentProps, StartFieldProps, StartItemProps, StartStructProps, TypeDescription} from "@itwin/presentation-common";
import {
  applyOptionalPrefix, PropertyValueFormat as PresentationPropertyValueFormat,
} from "@itwin/presentation-common";
import type {
  ArrayValue, PrimitiveValue, PropertyDescription, PropertyEditorInfo, StructValue} from "@itwin/appui-abstract";
import { PropertyRecord, PropertyValueFormat as UiPropertyValueFormat,
} from "@itwin/appui-abstract";

/** @internal */
export interface FieldRecord {
  record: PropertyRecord;
  field: Field;
}

/** @internal */
export interface FieldInfo {
  type: TypeDescription;
  name: string;
  label: string;
  renderer?: RendererDescription;
  editor?: EditorDescription;
  enum?: EnumerationInfo;
  isReadonly?: boolean;
}

/** @internal */
export function createFieldInfo(field: Field, namePrefix?: string) {
  return {
    type: field.isNestedContentField() ? field.type : { ...field.type, typeName: field.type.typeName.toLowerCase() },
    name: applyOptionalPrefix(field.name, namePrefix),
    label: field.label,
    editor: field.editor,
    renderer: field.renderer,
    enum: field.isPropertiesField() ? field.properties[0].property.enumerationInfo : undefined,
  };
}

/** @internal */
export function createPropertyDescriptionFromFieldInfo(info: FieldInfo) {
  const descr: PropertyDescription = {
    typename: info.type.typeName,
    name: info.name,
    displayLabel: info.label,
  };

  if (info.renderer) {
    descr.renderer = { name: info.renderer.name };
  }

  if (info.editor) {
    descr.editor = { name: info.editor.name } as PropertyEditorInfo;
  }

  if (info.type.valueFormat === PresentationPropertyValueFormat.Primitive && info.enum) {
    descr.enum = {
      choices: info.enum.choices,
      isStrict: info.enum.isStrict,
    };
  }
  return descr;
}

/** @internal */
export interface FieldHierarchyRecord {
  record: PropertyRecord;
  fieldHierarchy: FieldHierarchy;
}

/** @internal */
export interface IPropertiesAppender {
  item?: Item;
  append(record: FieldHierarchyRecord): void;
}
interface INestedPropertiesAppender extends IPropertiesAppender {
  finish(): void;
}
namespace IPropertiesAppender {
  export function isNested(appender: IPropertiesAppender): appender is INestedPropertiesAppender {
    return (appender as INestedPropertiesAppender).finish !== undefined;
  }
}
class StructMembersAppender implements INestedPropertiesAppender {
  private _members: { [name: string]: PropertyRecord } = {};
  constructor(private _parentAppender: IPropertiesAppender, private _fieldHierarchy: FieldHierarchy, private _fieldInfo: FieldInfo) { }
  public append(record: FieldHierarchyRecord): void {
    this._members[record.fieldHierarchy.field.name] = record.record;
  }
  public finish(): void {
    const value: StructValue = {
      valueFormat: UiPropertyValueFormat.Struct,
      members: this._members,
    };
    const record = new PropertyRecord(value, createPropertyDescriptionFromFieldInfo(this._fieldInfo));
    applyPropertyRecordAttributes(record, this._fieldHierarchy.field, undefined, this._parentAppender.item?.extendedData);
    this._parentAppender.append({ record, fieldHierarchy: this._fieldHierarchy });
  }
}
class ArrayItemsAppender implements INestedPropertiesAppender {
  private _items: PropertyRecord[] = [];
  constructor(private _parentAppender: IPropertiesAppender, private _fieldHierarchy: FieldHierarchy, private _fieldInfo: FieldInfo) { }
  public append(record: FieldHierarchyRecord): void {
    this._items.push(record.record);
  }
  public finish(): void {
    assert(this._fieldHierarchy.field.type.valueFormat === PresentationPropertyValueFormat.Array);
    const value: ArrayValue = {
      valueFormat: UiPropertyValueFormat.Array,
      itemsTypeName: this._fieldHierarchy.field.type.memberType.typeName,
      items: this._items,
    };
    const record = new PropertyRecord(value, createPropertyDescriptionFromFieldInfo(this._fieldInfo));
    applyPropertyRecordAttributes(record, this._fieldHierarchy.field, undefined, this._parentAppender.item?.extendedData);
    this._parentAppender.append({ record, fieldHierarchy: this._fieldHierarchy });
  }
}

/** @internal */
export abstract class PropertyRecordsBuilder implements IContentVisitor {
  private _appendersStack: Array<IPropertiesAppender> = [];

  protected abstract createRootPropertiesAppender(): IPropertiesAppender;
  protected get currentPropertiesAppender(): IPropertiesAppender {
    const appender = this._appendersStack[this._appendersStack.length - 1];
    assert(appender !== undefined);
    return appender;
  }

  public startContent(_props: StartContentProps): boolean { return true; }
  public finishContent(): void { }

  public startItem(props: StartItemProps): boolean {
    const appender = this.createRootPropertiesAppender();
    appender.item = props.item;
    this._appendersStack.push(appender);
    return true;
  }
  public finishItem(): void { }

  public processFieldHierarchies(_props: ProcessFieldHierarchiesProps): void { }

  public startCategory(_props: StartCategoryProps): boolean { return true; }
  public finishCategory(): void { }

  public startField(_props: StartFieldProps): boolean { return true; }
  public finishField(): void { }

  public startStruct(props: StartStructProps): boolean {
    this._appendersStack.push(new StructMembersAppender(
      this.currentPropertiesAppender,
      props.hierarchy,
      { ...createFieldInfo(props.hierarchy.field, props.namePrefix), type: props.valueType },
    ));
    return true;
  }
  public finishStruct(): void {
    const appender = this._appendersStack.pop();
    assert(!!appender && IPropertiesAppender.isNested(appender));
    appender.finish();
  }

  public startArray(props: StartArrayProps): boolean {
    this._appendersStack.push(new ArrayItemsAppender(
      this.currentPropertiesAppender,
      props.hierarchy,
      { ...createFieldInfo(props.hierarchy.field, props.namePrefix), type: props.valueType },
    ));
    return true;
  }
  public finishArray(): void {
    const appender = this._appendersStack.pop();
    assert(!!appender && IPropertiesAppender.isNested(appender));
    appender.finish();
  }

  public processMergedValue(props: ProcessMergedValueProps): void {
    const value: PrimitiveValue = {
      valueFormat: UiPropertyValueFormat.Primitive,
    };
    const record = new PropertyRecord(
      value,
      createPropertyDescriptionFromFieldInfo(createFieldInfo(props.mergedField, props.namePrefix)),
    );
    record.isMerged = true;
    record.isReadonly = true;
    record.autoExpand = props.mergedField.isNestedContentField() && props.mergedField.autoExpand;
    this.currentPropertiesAppender.append({ record, fieldHierarchy: { field: props.mergedField, childFields: [] } });
  }

  public processPrimitiveValue(props: ProcessPrimitiveValueProps): void {
    const appender = this.currentPropertiesAppender;
    const value: PrimitiveValue = {
      valueFormat: UiPropertyValueFormat.Primitive,
      value: props.rawValue,
      displayValue: props.displayValue?.toString() ?? "",
    };
    const record = new PropertyRecord(
      value,
      createPropertyDescriptionFromFieldInfo({ ...createFieldInfo(props.field, props.namePrefix), type: props.valueType }),
    );
    applyPropertyRecordAttributes(record, props.field, props.displayValue?.toString(), appender.item?.extendedData);
    appender.append({ record, fieldHierarchy: { field: props.field, childFields: [] } });
  }
}

function applyPropertyRecordAttributes(record: PropertyRecord, field: Field, displayValue: string | undefined, extendedData: typeof Item.prototype.extendedData | undefined) {
  if (displayValue)
    record.description = displayValue.toString();
  if (field.isReadonly || (field.isNestedContentField() && record.value.valueFormat === UiPropertyValueFormat.Array))
    record.isReadonly = true;
  if (field.isNestedContentField() && field.autoExpand)
    record.autoExpand = true;
  if (extendedData)
    record.extendedData = extendedData;
}
