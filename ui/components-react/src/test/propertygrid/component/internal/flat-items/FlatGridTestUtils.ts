/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { PropertyRecord, PropertyValueFormat } from "@itwin/appui-abstract";
import type { CategorizedPropertyTypes, IMutableCategorizedPropertyItem, IMutableFlatGridItem, IMutableGridCategoryItem } from "../../../../../components-react/propertygrid/internal/flat-items/MutableFlatGridItem";
import { FlatGridItemType } from "../../../../../components-react/propertygrid/internal/flat-items/MutableFlatGridItem";
import type { CategoryRecordsDict} from "../../../../../components-react/propertygrid/internal/flat-items/MutableGridCategory";
import { MutableGridCategory } from "../../../../../components-react/propertygrid/internal/flat-items/MutableGridCategory";
import { AssertionError, expect } from "chai";
import sinon from "sinon";
import { MutableCategorizedPrimitiveProperty } from "../../../../../components-react/propertygrid/internal/flat-items/MutableCategorizedPrimitiveProperty";
import { MutableCategorizedArrayProperty } from "../../../../../components-react/propertygrid/internal/flat-items/MutableCategorizedArrayProperty";
import { MutableCategorizedStructProperty } from "../../../../../components-react/propertygrid/internal/flat-items/MutableCategorizedStructProperty";
import shortid from "shortid";
import type { MutableGridItemFactory } from "../../../../../components-react/propertygrid/internal/flat-items/MutableGridItemFactory";
import type { CategorizedPropertyItem, FlatGridItem, GridCategoryItem } from "../../../../../components-react/propertygrid/internal/flat-items/FlatGridItem";
import type { PropertyCategory, PropertyData } from "../../../../../components-react/propertygrid/PropertyDataProvider";
import * as faker from "faker";
import type { IPropertyGridModel } from "../../../../../components-react/propertygrid/internal/PropertyGridModel";

/** @internal */
export interface GridModelLastItemData {
  [selectionKey: string]: {
    isLastInRootCategory: boolean;
    lastInNumberOfCategories: number;
  };
}

/** @internal */
export interface PropertyGridModelTestData {
  testName: string;
  propertyData: PropertyData;
  expectedLastItemData: GridModelLastItemData;
}

/** @internal */
export interface GridItemToMock {
  type: CategorizedPropertyTypes;
  isVisible: boolean;
}

/** @internal */
export interface FlattenedPropertyBase {
  selectionKey: string;
}

/** @internal */
export interface FlattenedRecord extends FlattenedPropertyBase {
  item: PropertyRecord;
  originalRecord: PropertyRecord;
}

/** @internal */
export interface FlattenedCategory extends FlattenedPropertyBase {
  item: PropertyCategory;
}

/** @internal */
export type FlattenedProperty = (FlattenedRecord | FlattenedCategory);

/** @internal */
export class FlatGridTestUtils {
  public static getSelectionKey(property: PropertyCategory, parentSelectionKey?: string): string;
  public static getSelectionKey(property: PropertyRecord, parentSelectionKey: string): string;
  public static getSelectionKey(property: PropertyCategory | PropertyRecord, parentSelectionKey?: string): string {
    if (property instanceof PropertyRecord)
      return `${parentSelectionKey}_${property.property.name}`;

    return parentSelectionKey ? `${parentSelectionKey}_${property.name}` : property.name;
  }

  public static flattenPropertyRecords(propertyRecords: PropertyRecord[], parentSelectionKey: string, considerExpand: boolean = false, isParentArray: boolean = false) {
    const results: FlattenedRecord[] = [];

    propertyRecords.forEach((record, index) => {
      const itemToSave: FlattenedRecord = { item: record, selectionKey: this.getSelectionKey(record, parentSelectionKey), originalRecord: record };
      if (isParentArray) {
        const name = `${record.property.name}_${index}`;
        const displayLabel = `[${index + 1}]`;

        itemToSave.item = this.overridePropertyDescription(record, name, displayLabel);
        itemToSave.selectionKey = this.getSelectionKey(itemToSave.item, parentSelectionKey);
      }

      results.push(itemToSave);

      if (!considerExpand || record.autoExpand)
        results.push(...this.flattenPropertyRecords(record.getChildrenRecords(), itemToSave.selectionKey, considerExpand, record.value.valueFormat === PropertyValueFormat.Array));
    });

    return results;
  }

  public static flattenPropertyCategories(propertyCategories: PropertyCategory[], records: CategoryRecordsDict, considerExpand: boolean = false, parentSelectionKey?: string) {
    const results: FlattenedProperty[] = [];
    propertyCategories.forEach((category) => {
      const selectionKey = this.getSelectionKey(category, parentSelectionKey);
      results.push({ item: category, selectionKey });

      if (!considerExpand || category.expand) {
        const categoryRecords = records[category.name] ?? [];
        results.push(...this.flattenPropertyRecords(categoryRecords, selectionKey, considerExpand));

        results.push(...this.flattenPropertyCategories(category.childCategories ?? [], records, considerExpand, selectionKey));
      }
    });

    return results;
  }

  public static overridePropertyDescription(propertyRecord: PropertyRecord, name?: string, displayLabel?: string) {
    name = name ?? propertyRecord.property.name;
    displayLabel = displayLabel ?? propertyRecord.property.displayLabel;
    const propertyDescription = { ...propertyRecord.property, name, displayLabel };

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { value, property, ...others } = propertyRecord;
    propertyRecord = new PropertyRecord(value, propertyDescription);

    Object.assign(propertyRecord, others);

    return propertyRecord;
  }

  public static filterCategories(gridItems: IMutableFlatGridItem[]) {
    return gridItems
      .filter((item) => item.type === FlatGridItemType.Category)
      .map((item) => item as IMutableGridCategoryItem);
  }

  public static filterProperties(gridItems: IMutableFlatGridItem[]) {
    return gridItems
      .filter((item) => item.type !== FlatGridItemType.Category)
      .map((item) => item as IMutableCategorizedPropertyItem);
  }

  public static constructCategoryRecordsDict(categories: PropertyCategory[], recordsDict?: CategoryRecordsDict) {
    recordsDict = recordsDict ?? {};

    for (const category of categories) {
      recordsDict[category.name] = [];
      this.constructCategoryRecordsDict(category.childCategories ?? [], recordsDict);
    }

    return recordsDict;
  }

  public static valueTypeToFlatGridType(valueType: PropertyValueFormat) {
    switch (valueType) {
      case PropertyValueFormat.Primitive:
        return FlatGridItemType.Primitive;
      case PropertyValueFormat.Array:
        return FlatGridItemType.Array;
      case PropertyValueFormat.Struct:
        return FlatGridItemType.Struct;
      /* istanbul ignore next */
      default:
        const unhandledType: never = valueType;
        throw Error(`Property Value Format not handled: ${unhandledType}`);
    }
  }

  public static callPropertyAndGridItemAssert(
    gridItem: IMutableFlatGridItem,
    record: PropertyCategory | PropertyRecord,
    categoryAssert: (item: IMutableGridCategoryItem, record: PropertyCategory) => void,
    categorizedPropertyAssert: (item: IMutableCategorizedPropertyItem, record: PropertyRecord) => void,
  ) {
    if (gridItem.type === FlatGridItemType.Category) {
      categoryAssert(gridItem, record as PropertyCategory);
      return;
    }

    categorizedPropertyAssert(gridItem, record as PropertyRecord);
  }

  public static callPropertyAndGridItemAsserts(
    gridItems: IMutableFlatGridItem[],
    records: Array<PropertyCategory | PropertyRecord>,
    categoryAssert: (item: IMutableGridCategoryItem, record: PropertyCategory) => void,
    categorizedPropertyAssert: (item: IMutableCategorizedPropertyItem, record: PropertyRecord) => void,
  ) {
    expect(gridItems.length).to.be.equal(records.length);
    gridItems.forEach((item, index) => FlatGridTestUtils.callPropertyAndGridItemAssert(item, records[index], categoryAssert, categorizedPropertyAssert));
  }

  private static replaceMockGridItemProperties(mockItem: IMutableFlatGridItem, type: FlatGridItemType, selectionKey: string, isExpanded?: boolean) {
    Object.assign(mockItem, { key: shortid.generate() });
    sinon.replaceGetter(mockItem, "type", () => type);
    if (isExpanded !== undefined)
      sinon.replaceGetter(mockItem, "isExpanded", () => isExpanded);

    sinon.replaceGetter(mockItem, "selectionKey", () => selectionKey);

    const getChildrenStub = sinon.stub().returns([]);
    sinon.replace(mockItem, "getChildren", getChildrenStub);
  }

  public static createMockGridCategory(name: string, isExpanded?: boolean) {
    const gridCategory = sinon.createStubInstance(MutableGridCategory);
    sinon.replaceGetter(gridCategory, "name", () => name);

    this.replaceMockGridItemProperties(gridCategory, FlatGridItemType.Category, name, isExpanded);
    return gridCategory;
  }

  public static createMockCategorizedPrimitive(selectionKey: string) {
    const primitive = sinon.createStubInstance(MutableCategorizedPrimitiveProperty);
    this.replaceMockGridItemProperties(primitive, FlatGridItemType.Primitive, selectionKey, false);

    return primitive;
  }

  public static createMockCategorizedArray(selectionKey: string, isExpanded?: boolean) {
    const array = sinon.createStubInstance(MutableCategorizedArrayProperty);
    this.replaceMockGridItemProperties(array, FlatGridItemType.Array, selectionKey, isExpanded);

    return array;
  }

  public static createMockCategorizedStruct(selectionKey: string, isExpanded?: boolean) {
    const struct = sinon.createStubInstance(MutableCategorizedStructProperty);
    this.replaceMockGridItemProperties(struct, FlatGridItemType.Struct, selectionKey, isExpanded);

    return struct;
  }

  public static createMockCategorizedProperty(selectionKey: string, type: CategorizedPropertyTypes, isExpanded?: boolean) {
    switch (type) {
      case FlatGridItemType.Primitive:
        return this.createMockCategorizedPrimitive(selectionKey);
      case FlatGridItemType.Array:
        return this.createMockCategorizedArray(selectionKey, isExpanded);
      case FlatGridItemType.Struct:
        return this.createMockCategorizedStruct(selectionKey, isExpanded);
      /* istanbul ignore next */
      default:
        const unhandledType: never = type;
        throw new Error(`Unhandled FlatGridItemType: ${unhandledType}`);
    }
  }

  public static createCategorizedPropertyStub(records: PropertyRecord[], factoryStub: sinon.SinonStubbedInstance<MutableGridItemFactory>) {
    const expectedMockChildren: Array<sinon.SinonStubbedInstance<IMutableCategorizedPropertyItem>> = [];
    records.forEach((child, index) => {
      const gridType = this.valueTypeToFlatGridType(child.value.valueFormat);
      const mock = this.createMockCategorizedProperty(faker.random.words(), gridType);

      expectedMockChildren.push(mock);
      factoryStub.createCategorizedProperty.onCall(index).returns(mock);
    });

    factoryStub.createCategorizedProperty.onCall(records.length).throws(new AssertionError("Factory called more times than there are children"));
    return expectedMockChildren;
  }

  public static createGridCategoryStub(category: PropertyCategory, factoryStub: sinon.SinonStubbedInstance<MutableGridItemFactory>) {
    const children = category.childCategories ?? [];
    const expectedMockChildren: Array<sinon.SinonStubbedInstance<IMutableGridCategoryItem>> = [];

    children.forEach((child, index) => {
      const mock = FlatGridTestUtils.createMockGridCategory(child.name);
      expectedMockChildren.push(mock);
      factoryStub.createGridCategory.onCall(index).returns(mock);
    });

    factoryStub.createGridCategory.onCall(children.length).throws(new AssertionError("Factory called more times than there are category children"));
    return expectedMockChildren;
  }

  public static getLast<T>(arr: T[]) {
    if (arr.length === 0)
      return undefined;

    return arr[arr.length - 1];
  }

  private static mockGetVisibleDescendants(property: IMutableFlatGridItem, descendantsToMock: GridItemToMock[]) {
    const visibleDescendants = descendantsToMock
      .filter((value) => value.isVisible)
      .map((value) => FlatGridTestUtils.createMockCategorizedProperty(faker.random.words(), value.type, false));

    const visibleDescendantsAndSelf = [property, ...visibleDescendants];
    sinon.replace(property, "getVisibleDescendantsAndSelf", () => visibleDescendantsAndSelf);

    return visibleDescendantsAndSelf;
  }

  private static mockGetDescendants(property: IMutableFlatGridItem, descendantsToMock: GridItemToMock[], visibleDescendantsAndSelf: IMutableFlatGridItem[]) {
    const nonVisibleDescendants = descendantsToMock
      .filter((value) => !value.isVisible)
      .map((value) => FlatGridTestUtils.createMockCategorizedProperty(faker.random.words(), value.type, false));

    const descendantsAndSelf = [...visibleDescendantsAndSelf, ...nonVisibleDescendants];
    sinon.replace(property, "getDescendantsAndSelf", () => descendantsAndSelf);

    return descendantsAndSelf;
  }

  public static setupExpectedDescendants(
    mockChildren: IMutableFlatGridItem[],
    descendantsToMock: GridItemToMock[],
  ) {
    const expectedVisibleDescendants: IMutableFlatGridItem[] = [];
    const expectedDescendants: IMutableFlatGridItem[] = [];
    let expectedLastVisibleDescendant: IMutableFlatGridItem | undefined;

    mockChildren.forEach((child) => {
      const visibleDescendantsAndSelf = FlatGridTestUtils.mockGetVisibleDescendants(child, descendantsToMock);
      expectedVisibleDescendants.push(...visibleDescendantsAndSelf);

      expectedLastVisibleDescendant = FlatGridTestUtils.getLast(visibleDescendantsAndSelf);
      sinon.replace(child, "getLastVisibleDescendantOrSelf", () => expectedLastVisibleDescendant!);

      const descendantsAndSelf = FlatGridTestUtils.mockGetDescendants(child, descendantsToMock, visibleDescendantsAndSelf);
      expectedDescendants.push(...descendantsAndSelf);
    });

    return { expectedVisibleDescendants, expectedDescendants, expectedLastVisibleDescendant };
  }

  public static assertPropertyEquals(gridItem: IMutableCategorizedPropertyItem, expectedRecord: PropertyRecord, overrideName?: string, overrideLabel?: string) {
    expectedRecord = FlatGridTestUtils.overridePropertyDescription(expectedRecord, overrideName, overrideLabel);

    const expectedType = FlatGridTestUtils.valueTypeToFlatGridType(expectedRecord.value.valueFormat);
    expect(gridItem.type).to.be.equal(expectedType);

    expect(gridItem.label).to.be.equal(expectedRecord.property.displayLabel);
    expect(gridItem.derivedRecord).to.deep.equal(expectedRecord);

    expect(gridItem.selectionKey).to.be.equal(FlatGridTestUtils.getSelectionKey(expectedRecord, gridItem.parentSelectionKey));
  }

  public static assertCategoryEquals(gridCategory: GridCategoryItem, propertyCategory: PropertyCategory) {
    expect(gridCategory.type).to.be.equal(FlatGridItemType.Category);
    expect(gridCategory.name).to.be.equal(propertyCategory.name);
    expect(gridCategory.label).to.be.equal(propertyCategory.label);

    expect(gridCategory.derivedCategory.name).to.be.equal(propertyCategory.name);
    expect(gridCategory.derivedCategory.label).to.be.equal(propertyCategory.label);

    expect(gridCategory.selectionKey).to.be.equal(FlatGridTestUtils.getSelectionKey(propertyCategory, gridCategory.parentCategorySelectionKey));
  }

  public static getFlattenedPropertyData(propertyData: PropertyData, considerExpand: boolean = false) {
    return FlatGridTestUtils.flattenPropertyCategories(propertyData.categories, propertyData.records, considerExpand);
  }

  public static assertGridModel(gridModel: IPropertyGridModel, expectedFlatGrid: FlattenedProperty[], lastItemData?: GridModelLastItemData) {
    expectedFlatGrid.forEach((expectedProperty) => {
      const gridItem = gridModel.getItem(expectedProperty.selectionKey);
      this.assertGridItem(gridItem, expectedProperty);

      if (lastItemData) {
        const expectedLastItemData = lastItemData[gridItem.selectionKey] ?? { isLastInRootCategory: false, lastInNumberOfCategories: 0 };

        expect(gridItem.lastInNumberOfCategories).to.be.equal(expectedLastItemData.lastInNumberOfCategories, `lastInNumberOfCategories does not match: ${gridItem.selectionKey}`);
        expect(gridItem.isLastInRootCategory).to.be.equal(expectedLastItemData.isLastInRootCategory, `isLastInRootCategory does not match: ${gridItem.selectionKey}`);
      }
    });
  }

  public static assertGridItem(gridItem: FlatGridItem, expectedProperty: FlattenedProperty) {
    expect(gridItem.selectionKey).to.be.equal(expectedProperty.selectionKey, "Selection keys do not match");

    if (expectedProperty.item instanceof PropertyRecord) {
      const expectedType = FlatGridTestUtils.valueTypeToFlatGridType(expectedProperty.item.value.valueFormat);

      expect(gridItem.type).to.be.equal(expectedType);

      const property = gridItem as CategorizedPropertyItem;
      expect(property.derivedRecord).to.deep.equal(expectedProperty.item, `Derived record and expected record do not match`);
    } else {
      expect(gridItem.type).to.be.equal(FlatGridItemType.Category);

      const category = gridItem as GridCategoryItem;
      const expectedCategory = { name: expectedProperty.item.name, label: expectedProperty.item.label, expand: expectedProperty.item.expand };
      expect(category.derivedCategory).to.deep.equal(expectedCategory, "Derived category and expected category do not match");
    }
  }
}
