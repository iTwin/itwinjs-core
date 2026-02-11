/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RPC
 */

import { assert, DuplicatePolicy, Id64, Id64String, SortedArray } from "@itwin/core-bentley";
import { CategoryDescription } from "./content/Category.js";
import {
  createContentTraverser,
  IContentVisitor,
  ProcessFieldHierarchiesProps,
  ProcessMergedValueProps,
  ProcessPrimitiveValueProps,
  StartArrayProps,
  StartCategoryProps,
  StartContentProps,
  StartFieldProps,
  StartItemProps,
  StartStructProps,
} from "./content/ContentTraverser.js";
import { Descriptor } from "./content/Descriptor.js";
import { Item } from "./content/Item.js";
import { PropertyValueFormat } from "./content/TypeDescription.js";

/**
 * Data structure for storing element properties information in a simplified format.
 * @see [[Content]] for a format that stores all available element property data.
 * @public
 */
export interface ElementProperties {
  /** Label of element's ECClass. */
  class: string;
  /** Element's ID. */
  id: Id64String;
  /** Element's label. */
  label: string;
  /** Container of property values */
  items: { [label: string]: ElementPropertiesItem };
}

/**
 * Base type for all [[ElementPropertiesItem]] types.
 * @public
 */
export interface ElementPropertiesItemBase {
  /** Type of the properties item. */
  type: "category" | ElementPropertiesPropertyValueType;
}

/**
 * Definition for a category. A category can nest other property items, including categories.
 * @public
 */
export interface ElementPropertiesCategoryItem extends ElementPropertiesItemBase {
  /** Type of the properties item. */
  type: "category";
  /** Container of property values */
  items: { [label: string]: ElementPropertiesItem };
}

/**
 * Base type for all [[ElementPropertiesPropertyItem]] types.
 * @public
 */
export interface ElementPropertiesPropertyItemBase extends ElementPropertiesItemBase {
  /** Type of the properties item. */
  type: ElementPropertiesPropertyValueType;
}

/**
 * Definition for a primitive property value.
 * @public
 */
export interface ElementPropertiesPrimitivePropertyItem extends ElementPropertiesPropertyItemBase {
  /** Type of the properties item. */
  type: "primitive";
  /** Display value of the property. */
  value: string;
}

/**
 * Base type for all [[ElementPropertiesArrayPropertyItem]] types.
 * @public
 */
export interface ElementPropertiesArrayPropertyItemBase extends ElementPropertiesPropertyItemBase {
  /** Type of the properties item. */
  type: "array";
  /** Type of values contained in this array. */
  valueType: "primitive" | "struct";
}

/**
 * Definition for a primitives' array property value.
 * @public
 */
export interface ElementPropertiesPrimitiveArrayPropertyItem extends ElementPropertiesArrayPropertyItemBase {
  /** Type of values contained in this array. */
  valueType: "primitive";
  /** Array of display values. */
  values: string[];
}

/**
 * Definition for a structs' array property value.
 * @public
 */
export interface ElementPropertiesStructArrayPropertyItem extends ElementPropertiesArrayPropertyItemBase {
  /** Type of values contained in this array. */
  valueType: "struct";
  /** Array of structs. */
  values: Array<{ [memberLabel: string]: ElementPropertiesPropertyItem }>;
}

/**
 * Definition for an array property value.
 * @public
 */
export type ElementPropertiesArrayPropertyItem = ElementPropertiesPrimitiveArrayPropertyItem | ElementPropertiesStructArrayPropertyItem;

/**
 * Definition for an struct property value.
 * @public
 */
export interface ElementPropertiesStructPropertyItem extends ElementPropertiesPropertyItemBase {
  /** Type of the properties item. */
  type: "struct";
  /** Container of struct members. */
  members: { [memberLabel: string]: ElementPropertiesPropertyItem };
}

/**
 * Available element property types.
 * @public
 */
export type ElementPropertiesPropertyValueType = "primitive" | "array" | "struct";

/**
 * Definition of a property value.
 * @public
 */
export type ElementPropertiesPropertyItem = ElementPropertiesPrimitivePropertyItem | ElementPropertiesArrayPropertyItem | ElementPropertiesStructPropertyItem;

/**
 * Definition of a property item, including a property category.
 * @public
 */
export type ElementPropertiesItem = ElementPropertiesCategoryItem | ElementPropertiesPropertyItem;

/** @internal */
export const createElementPropertiesBuilder = (): ((descriptor: Descriptor, item: Item) => ElementProperties) => {
  const builder = new ElementPropertiesBuilder();
  const traverseContent = createContentTraverser(builder);
  return (descriptor: Descriptor, item: Item) => {
    traverseContent(descriptor, [item]);
    return builder.items[0];
  };
};

interface IPropertiesAppender {
  append(label: string, item: ElementPropertiesItem): void;
  finish(): void;
}

class ElementPropertiesAppender implements IPropertiesAppender {
  private _propertyItems: { [label: string]: ElementPropertiesItem } = {};
  private _categoryItemAppenders: { [categoryName: string]: { category: CategoryDescription; appender: IPropertiesAppender } } = {};
  constructor(
    private _item: Item,
    private _onItemFinished: (item: ElementProperties) => void,
  ) {}

  public append(label: string, item: ElementPropertiesItem): void {
    this._propertyItems[label] = item;
  }

  public finish(): void {
    // create an ordered list of categories/appenders starting with categories that have the most ancestors and finishing with categories
    // that have no ancestors, so that when we call `finish` on appenders, child categories are finished before parent categories, otherwise
    // we may skip parent categories, thinking they have no items
    const categoriesNestedToRoot = new SortedArray<{ category: CategoryDescription; appender: IPropertiesAppender }>(
      (lhs, rhs) => countAncestors(rhs.category) - countAncestors(lhs.category),
      DuplicatePolicy.Allow,
    );
    Object.entries(this._categoryItemAppenders).forEach(([_, { category, appender }]) => {
      categoriesNestedToRoot.insert({ category, appender });
    });
    categoriesNestedToRoot.forEach(({ appender }) => appender.finish());

    this._onItemFinished({
      class: this._item.classInfo?.label ?? "",
      id: this._item.primaryKeys[0]?.id ?? Id64.invalid,
      label: this._item.label.displayValue,
      items: this._propertyItems,
    });
  }

  public getCategoryAppender(parentAppender: IPropertiesAppender, category: CategoryDescription): IPropertiesAppender {
    let entry = this._categoryItemAppenders[category.name];
    if (!entry) {
      entry = { category, appender: new CategoryItemAppender(parentAppender, category) };
      this._categoryItemAppenders[category.name] = entry;
    }
    return entry.appender;
  }
}

class CategoryItemAppender implements IPropertiesAppender {
  private _items: { [label: string]: ElementPropertiesItem } = {};
  constructor(
    private _parentAppender: IPropertiesAppender,
    private _category: CategoryDescription,
  ) {}
  public append(label: string, item: ElementPropertiesItem): void {
    this._items[label] = item;
  }
  public finish(): void {
    if (Object.keys(this._items).length === 0) {
      return;
    }

    this._parentAppender.append(this._category.label, {
      type: "category",
      items: this._items,
    });
  }
}

class ArrayItemAppender implements IPropertiesAppender {
  private _items: ElementPropertiesPropertyItem[] = [];
  constructor(
    private _parentAppender: IPropertiesAppender,
    private _props: StartArrayProps,
  ) {}
  public append(_label: string, item: ElementPropertiesItem): void {
    assert(item.type !== "category");
    this._items.push(item);
  }
  public finish(): void {
    assert(this._props.valueType.valueFormat === PropertyValueFormat.Array);
    if (this._props.valueType.memberType.valueFormat === PropertyValueFormat.Primitive) {
      this._parentAppender.append(this._props.hierarchy.field.label, this.createPrimitivesArray());
    } else {
      this._parentAppender.append(this._props.hierarchy.field.label, this.createStructsArray());
    }
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
  constructor(
    private _parentAppender: IPropertiesAppender,
    private _props: StartStructProps,
  ) {}
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
  private _items: ElementProperties[] = [];
  private _elementPropertiesAppender: ElementPropertiesAppender | undefined;

  public get items(): ElementProperties[] {
    return this._items;
  }

  private get _currentAppender(): IPropertiesAppender {
    const appender = this._appendersStack[this._appendersStack.length - 1];
    assert(appender !== undefined);
    return appender;
  }

  public startContent(_props: StartContentProps): boolean {
    this._appendersStack = [];
    this._items = [];
    this._elementPropertiesAppender = undefined;
    return true;
  }
  public finishContent(): void {}

  public processFieldHierarchies(_props: ProcessFieldHierarchiesProps): void {}

  public startItem(props: StartItemProps): boolean {
    this._elementPropertiesAppender = new ElementPropertiesAppender(props.item, (item) => this._items.push(item));
    this._appendersStack.push(this._elementPropertiesAppender);
    return true;
  }
  public finishItem(): void {
    this._appendersStack.pop();
    assert(this._elementPropertiesAppender !== undefined);
    this._elementPropertiesAppender.finish();
    this._elementPropertiesAppender = undefined;
  }

  public startCategory(props: StartCategoryProps): boolean {
    assert(this._elementPropertiesAppender !== undefined);
    this._appendersStack.push(this._elementPropertiesAppender.getCategoryAppender(this._currentAppender, props.category));
    return true;
  }
  public finishCategory(): void {
    this._appendersStack.pop();
  }

  public startField(_props: StartFieldProps): boolean {
    return true;
  }
  public finishField(): void {}

  public startStruct(props: StartStructProps): boolean {
    this._appendersStack.push(new StructItemAppender(this._currentAppender, props));
    return true;
  }
  public finishStruct(): void {
    this._appendersStack.pop()!.finish();
  }

  public startArray(props: StartArrayProps): boolean {
    this._appendersStack.push(new ArrayItemAppender(this._currentAppender, props));
    return true;
  }
  public finishArray(): void {
    this._appendersStack.pop()!.finish();
  }

  public processMergedValue(props: ProcessMergedValueProps): void {
    this._currentAppender.append(props.mergedField.label, {
      type: "primitive",
      value: "",
    });
  }
  public processPrimitiveValue(props: ProcessPrimitiveValueProps): void {
    this._currentAppender.append(props.field.label, {
      type: "primitive",
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      value: props.displayValue?.toString() ?? "",
    });
  }
}

function countAncestors<T extends { parent?: T }>(child: T): number {
  return child.parent ? 1 + countAncestors(child.parent) : 0;
}
