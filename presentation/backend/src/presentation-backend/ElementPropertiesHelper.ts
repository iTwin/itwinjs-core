/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { assert, Id64 } from "@bentley/bentleyjs-core";
import {
  CategoryDescription, Content, ElementProperties, ElementPropertiesItem, ElementPropertiesPrimitiveArrayPropertyItem, ElementPropertiesPropertyItem,
  ElementPropertiesStructArrayPropertyItem, IContentVisitor, ProcessFieldHierarchiesProps, ProcessMergedValueProps, ProcessPrimitiveValueProps,
  PropertyValueFormat, StartArrayProps, StartCategoryProps, StartContentProps, StartFieldProps, StartItemProps, StartStructProps, traverseContentItem,
} from "@bentley/presentation-common";

/** @internal */
export const buildElementProperties = (content: Content | undefined): ElementProperties | undefined => {
  if (!content || !content.contentSet.length)
    return undefined;

  const descriptor = content.descriptor;
  const item = content.contentSet[0];
  const builder = new ElementPropertiesBuilder();
  traverseContentItem(builder, descriptor, item);
  return {
    class: item.classInfo?.label ?? "",
    id: item.primaryKeys[0]?.id ?? Id64.invalid,
    label: item.label.displayValue,
    items: builder.rootItems,
  };
};

interface IPropertiesAppender {
  append(label: string, item: ElementPropertiesItem): void;
  finish(): void;
}

class CategoryItemAppender implements IPropertiesAppender {
  private _items: { [label: string]: ElementPropertiesItem } = {};
  constructor(private _parentAppender: IPropertiesAppender, private _category: CategoryDescription) { }
  public append(label: string, item: ElementPropertiesItem): void {
    this._items[label] = item;
  }
  public finish(): void {
    this._parentAppender.append(this._category.label, {
      type: "category",
      items: this._items,
    });
  }
}

class ArrayItemAppender implements IPropertiesAppender {
  private _items: ElementPropertiesPropertyItem[] = [];
  constructor(private _parentAppender: IPropertiesAppender, private _props: StartArrayProps) { }
  public append(_label: string, item: ElementPropertiesItem): void {
    assert(item.type !== "category");
    this._items.push(item);
  }
  public finish(): void {
    assert(this._props.valueType.valueFormat === PropertyValueFormat.Array);
    if (this._props.valueType.memberType.valueFormat === PropertyValueFormat.Primitive)
      this._parentAppender.append(this._props.hierarchy.field.label, this.createPrimitivesArray());
    else
      this._parentAppender.append(this._props.hierarchy.field.label, this.createStructsArray());
  }
  private createPrimitivesArray(): ElementPropertiesPrimitiveArrayPropertyItem {
    return {
      type: "array",
      valueType: "primitive",
      values: this._items.map((item) => {
        assert(item.type === "primitive");
        return item.value;
      }),
    };
  }
  private createStructsArray(): ElementPropertiesStructArrayPropertyItem {
    return {
      type: "array",
      valueType: "struct",
      values: this._items.map((item) => {
        assert(item.type === "struct");
        return item.members;
      }),
    };
  }
}

class StructItemAppender implements IPropertiesAppender {
  private _members: { [label: string]: ElementPropertiesPropertyItem } = {};
  constructor(private _parentAppender: IPropertiesAppender, private _props: StartStructProps) { }
  public append(label: string, item: ElementPropertiesItem): void {
    assert(item.type !== "category");
    this._members[label] = item;
  }
  public finish(): void {
    assert(this._props.valueType.valueFormat === PropertyValueFormat.Struct);
    this._parentAppender.append(this._props.hierarchy.field.label, {
      type: "struct",
      members: this._members,
    });
  }
}

class ElementPropertiesBuilder implements IContentVisitor {
  private _appendersStack: IPropertiesAppender[] = [];
  private _categoryItemAppenders: { [categoryName: string]: IPropertiesAppender } = {};
  private _rootItems: { [label: string]: ElementPropertiesItem } = {};

  public get rootItems(): { [label: string]: ElementPropertiesItem } {
    return this._rootItems;
  }

  private get _currentAppender(): IPropertiesAppender {
    const appender = this._appendersStack[this._appendersStack.length - 1];
    assert(appender !== undefined);
    return appender;
  }

  public startContent(_props: StartContentProps): boolean { return true; }
  public finishContent(): void { }

  public processFieldHierarchies(_props: ProcessFieldHierarchiesProps): void { }

  public startItem(_props: StartItemProps): boolean {
    this._appendersStack.push({
      append: (label, item) => {
        this._rootItems[label] = item;
      },
      finish: /* istanbul ignore next */ () => { },
    });
    return true;
  }
  public finishItem(): void {
    // eslint-disable-next-line guard-for-in
    for (const categoryName in this._categoryItemAppenders) {
      const appender = this._categoryItemAppenders[categoryName];
      appender.finish();
    }
    this._categoryItemAppenders = {};
  }

  public startCategory(props: StartCategoryProps): boolean {
    let appender = this._categoryItemAppenders[props.category.name];
    if (!appender) {
      appender = new CategoryItemAppender(this._currentAppender, props.category);
      this._categoryItemAppenders[props.category.name] = appender;
    }
    this._appendersStack.push(appender);
    return true;
  }
  public finishCategory(): void {
    this._appendersStack.pop();
  }

  public startField(_props: StartFieldProps): boolean { return true; }
  public finishField(): void { }

  public startStruct(props: StartStructProps): boolean {
    this._appendersStack.push(new StructItemAppender(this._currentAppender, props));
    return true;
  }
  public finishStruct(): void { this._appendersStack.pop()!.finish(); }

  public startArray(props: StartArrayProps): boolean {
    this._appendersStack.push(new ArrayItemAppender(this._currentAppender, props));
    return true;
  }
  public finishArray(): void { this._appendersStack.pop()!.finish(); }

  public processMergedValue(props: ProcessMergedValueProps): void {
    this._currentAppender.append(props.mergedField.label, {
      type: "primitive",
      value: "",
    });
  }
  public processPrimitiveValue(props: ProcessPrimitiveValueProps): void {
    this._currentAppender.append(props.field.label, {
      type: "primitive",
      value: props.displayValue?.toString() ?? "",
    });
  }
}
