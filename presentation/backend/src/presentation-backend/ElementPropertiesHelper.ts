/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { ECSqlStatement, IModelDb } from "@itwin/core-backend";
import { assert, DbResult, Id64 } from "@itwin/core-bentley";
import {
  CategoryDescription, Content, ElementProperties, ElementPropertiesItem, ElementPropertiesPrimitiveArrayPropertyItem, ElementPropertiesPropertyItem,
  ElementPropertiesStructArrayPropertyItem, IContentVisitor, Item, PageOptions, ProcessFieldHierarchiesProps, ProcessMergedValueProps,
  ProcessPrimitiveValueProps, PropertyValueFormat, StartArrayProps, StartCategoryProps, StartContentProps, StartFieldProps, StartItemProps,
  StartStructProps, traverseContent,
} from "@itwin/presentation-common";

/** @internal */
export const buildElementsProperties = (content: Content | undefined): ElementProperties[] => {
  if (!content || content.contentSet.length === 0)
    return [];

  const builder = new ElementPropertiesBuilder();
  traverseContent(builder, content);
  return builder.items;
};

/** @internal */
export function getElementsCount(db: IModelDb, classNames?: string[]) {
  const { whereClause, bindings } = createElementsFilterClauseAndBindings("e", classNames);
  const query = `
    SELECT COUNT(e.ECInstanceId)
    FROM bis.Element e
    ${whereClause}
  `;

  return db.withPreparedStatement(query, (stmt: ECSqlStatement) => {
    stmt.bindValues(bindings);
    return stmt.step() === DbResult.BE_SQLITE_ROW ? stmt.getValue(0).getInteger() : 0;
  });
}

/** @internal */
export function getElementIdsByClass(db: IModelDb, classNames?: string[], pageOptions?: PageOptions) {
  const { whereClause, bindings } = createElementsFilterClauseAndBindings("e", classNames);
  const query = `
    SELECT e.ECInstanceId elId, eSchemaDef.Name || ':' || eClassDef.Name elClassName
    FROM bis.Element e
    LEFT JOIN meta.ECClassDef eClassDef ON eClassDef.ECInstanceId = e.ECClassId
    LEFT JOIN meta.ECSchemaDef eSchemaDef ON eSchemaDef.ECInstanceId = eClassDef.Schema.Id
    ${whereClause}
    ORDER BY e.ECClassId, e.ECInstanceId
    ${createElementsLimitClause(pageOptions)}
  `;

  return db.withPreparedStatement(query, (stmt: ECSqlStatement) => {
    stmt.bindValues(bindings);
    const ids = new Map<string, string[]>();
    let currentClassName = "";
    let currentIds: string[] = [];
    while (stmt.step() === DbResult.BE_SQLITE_ROW) {
      const row = stmt.getRow();
      if (!row.elId || !row.elClassName)
        continue;

      if (currentClassName !== row.elClassName) {
        currentClassName = row.elClassName;
        const existingIds = ids.get(row.elClassName);
        if (!existingIds) {
          currentIds = [];
          ids.set(row.elClassName, currentIds);
        } else {
          currentIds = existingIds;
        }
      }
      currentIds.push(row.elId);
    }
    return ids;
  });
}

function createElementsLimitClause(pageOptions?: PageOptions) {
  if (pageOptions === undefined || (pageOptions.size === undefined && pageOptions.start === undefined))
    return "";

  return `LIMIT ${pageOptions.size ?? -1} OFFSET ${pageOptions.start ?? 0}`;
}

function createElementsFilterClauseAndBindings(elementAlias: string, classNames?: string[]) {
  if (classNames === undefined || classNames.length === 0)
    return { whereClause: "", bindings: [] };

  return {
    whereClause: `WHERE ${elementAlias}.ECClassId IS (${Array(classNames.length).fill("?").join(",")})`,
    bindings: classNames,
  };
}

interface IPropertiesAppender {
  append(label: string, item: ElementPropertiesItem): void;
  finish(): void;
}

class ElementPropertiesAppender implements IPropertiesAppender {
  private _propertyItems: { [label: string]: ElementPropertiesItem } = {};
  private _categoryItemAppenders: { [categoryName: string]: IPropertiesAppender } = {};
  constructor(private _item: Item, private _onItemFinished: (item: ElementProperties) => void) { }

  public append(label: string, item: ElementPropertiesItem): void {
    this._propertyItems[label] = item;
  }

  public finish(): void {
    // eslint-disable-next-line guard-for-in
    for (const categoryName in this._categoryItemAppenders) {
      const appender = this._categoryItemAppenders[categoryName];
      appender.finish();
    }

    this._onItemFinished({
      class: this._item.classInfo?.label ?? "",
      id: this._item.primaryKeys[0]?.id ?? Id64.invalid,
      label: this._item.label.displayValue,
      items: this._propertyItems,
    });
  }

  public getCategoryAppender(parentAppender: IPropertiesAppender, category: CategoryDescription): IPropertiesAppender {
    let appender = this._categoryItemAppenders[category.name];
    if (!appender) {
      appender = new CategoryItemAppender(parentAppender, category);
      this._categoryItemAppenders[category.name] = appender;
    }
    return appender;
  }
}

class CategoryItemAppender implements IPropertiesAppender {
  private _items: { [label: string]: ElementPropertiesItem } = {};
  constructor(private _parentAppender: IPropertiesAppender, private _category: CategoryDescription) { }
  public append(label: string, item: ElementPropertiesItem): void {
    this._items[label] = item;
  }
  public finish(): void {
    if (Object.keys(this._items).length === 0)
      return;

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

  public startContent(_props: StartContentProps): boolean { return true; }
  public finishContent(): void { }

  public processFieldHierarchies(_props: ProcessFieldHierarchiesProps): void { }

  public startItem(props: StartItemProps): boolean {
    this._elementPropertiesAppender = new ElementPropertiesAppender(props.item, (item) => { this._items.push(item); });
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
