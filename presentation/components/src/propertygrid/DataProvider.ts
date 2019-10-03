/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module PropertyGrid */

import * as _ from "lodash";
import {
  PropertyData, PropertyDataChangeEvent, PropertyCategory, IPropertyDataProvider,
} from "@bentley/ui-components";
import { IModelConnection, PropertyRecord, PropertyValueFormat, PropertyValue } from "@bentley/imodeljs-frontend";
import {
  CategoryDescription, Descriptor, DescriptorOverrides,
  Field, NestedContentField, DefaultContentDisplayTypes, Item,
  PresentationError, PresentationStatus, ContentFlags, Value,
} from "@bentley/presentation-common";
import { Presentation } from "@bentley/presentation-frontend";
import { ContentDataProvider, IContentDataProvider, CacheInvalidationProps } from "../common/ContentDataProvider";
import { ContentBuilder, filterMatchingFieldPaths } from "../common/ContentBuilder";
import { prioritySortFunction, translate } from "../common/Utils";

const favoritesCategoryName = "Favorite";
let favoritesCategoryPromise: Promise<CategoryDescription> | undefined;
const getFavoritesCategory = async (): Promise<CategoryDescription> => {
  if (!favoritesCategoryPromise) {
    favoritesCategoryPromise = Promise.all([
      translate("categories.favorite.label"),
      translate("categories.favorite.description"),
    ]).then(([label, description]): CategoryDescription => ({
      name: favoritesCategoryName,
      label,
      description,
      priority: Number.MAX_VALUE,
      expand: true,
    }));
  }
  return favoritesCategoryPromise;
};

interface PropertyPaneCallbacks {
  isFavorite(field: Field): boolean;
  isHidden(field: Field): boolean;
  sortCategories(categories: CategoryDescription[]): void;
  sortFields(category: CategoryDescription, fields: Field[]): void;
}

interface CategorizedFields {
  categories: CategoryDescription[];
  fields: { [categoryName: string]: Field[] };
  hiddenFieldPaths: Field[][];
  hiddenAncestorsFieldPaths: Field[][];
}

interface CategorizedRecords {
  categories: PropertyCategory[];
  records: { [categoryName: string]: PropertyRecord[] };
}

const isValueEmpty = (v: PropertyValue): boolean => {
  switch (v.valueFormat) {
    case PropertyValueFormat.Primitive:
      return (null === v.value || undefined === v.value || "" === v.value);
    case PropertyValueFormat.Array:
      return 0 === v.items.length;
    case PropertyValueFormat.Struct:
      return 0 === Object.keys(v.members).length;
  }
  /* istanbul ignore next */
  throw new PresentationError(PresentationStatus.InvalidArgument, "Unknown property value format");
};

class PropertyDataBuilder {
  private _descriptor: Descriptor;
  private _contentItem: Item;
  private _includeWithNoValues: boolean;
  private _callbacks: PropertyPaneCallbacks;

  constructor(descriptor: Descriptor, item: Item, includeWithNoValues: boolean, callbacks: PropertyPaneCallbacks) {
    this._descriptor = descriptor;
    this._contentItem = item;
    this._callbacks = callbacks;
    this._includeWithNoValues = includeWithNoValues;
  }

  private async createCategorizedFields(): Promise<CategorizedFields> {
    const favoritesCategory = await getFavoritesCategory();
    const categories = new Array<CategoryDescription>();
    const categoryFields: { [categoryName: string]: Field[] } = {};
    const hiddenFieldPaths = new Array<Field[]>();
    const hiddenAncestorsFieldPaths = new Array<Field[]>();
    const includeField = (category: CategoryDescription, field: Field) => {
      if (!categoryFields.hasOwnProperty(category.name)) {
        categories.push(category);
        categoryFields[category.name] = new Array<Field>();
      }
      categoryFields[category.name].push(field);
    };
    const visitField = (category: CategoryDescription, field: Field, isNested: boolean) => {
      if (field.isNestedContentField()) {
        // visit all nested fields
        visitFields(field.nestedFields, true);
      }
      if (isNested) {
        if (field.category.name === "") {
          // don't include nested fields which have no category - they
          // will be included as part of the nesting field
          return;
        }
        // if we're including a nested field as a top-level field, we have to exclude
        // it from it's nesting field
        const path = createFieldPath(field);
        hiddenFieldPaths.push(path);
        hiddenAncestorsFieldPaths.push(path);
      }
      includeField(category, field);
    };
    const visitFields = (fields: Field[], isNested: boolean) => {
      fields.forEach((field) => {
        if (favoritesCategoryName !== field.category.name && this._callbacks.isFavorite(field)) {
          // if the field is not already in favorites group and we want to make it favorite, visit it
          // with the favorites category as a top level (isNested = false) field
          visitField(favoritesCategory, field, false);
          hiddenAncestorsFieldPaths.push(createFieldPath(field));
        }
        // show field as a top-level field even if it's nested if it has a valid category
        visitField(field.category, field, isNested);
      });
    };
    visitFields(this._descriptor.fields, false);

    // sort categories
    this._callbacks.sortCategories(categories);

    // sort fields
    for (const category of categories)
      this._callbacks.sortFields(category, categoryFields[category.name]);

    return {
      categories,
      fields: categoryFields,
      hiddenFieldPaths,
      hiddenAncestorsFieldPaths,
    };
  }

  private createRecord(field: Field, createStruct: boolean, hiddenFieldPaths: Field[][]): PropertyRecord {
    const pathToRootField = createFieldPath(field);

    if (createStruct) {
      const rootField = pathToRootField[0];
      const pathToFieldFromRoot = pathToRootField.slice(1);
      return ContentBuilder.createPropertyRecord(rootField, this._contentItem, {
        exclusiveIncludePath: pathToFieldFromRoot,
        hiddenFieldPaths: filterMatchingFieldPaths(hiddenFieldPaths, rootField),
      });
    }

    let item = this._contentItem;
    // need to remove the last element because the Field information is in `field`
    const pathUpToField = pathToRootField.slice(undefined, -1);
    for (const parentField of pathUpToField) {
      if (item.isFieldMerged(parentField.name))
        return this.createRecord(field, true, hiddenFieldPaths);

      const nestedContentValues = item.values[parentField.name];
      if (!Value.isNestedContent(nestedContentValues))
        throw new PresentationError(PresentationStatus.Error, "value should be nested content");

      if (nestedContentValues.length !== 1)
        throw new PresentationError(PresentationStatus.Error, "nested content should have a single element");
      const nestedContentValue = nestedContentValues[0];

      item = new Item(nestedContentValue.primaryKeys, "", "", undefined, nestedContentValue.values,
        nestedContentValue.displayValues, nestedContentValue.mergedFieldNames);
    }
    return ContentBuilder.createPropertyRecord(field, item, undefined);
  }

  private createCategorizedRecords(fields: CategorizedFields): CategorizedRecords {
    const result: CategorizedRecords = {
      categories: [],
      records: {},
    };
    for (const category of fields.categories) {
      const records = new Array<PropertyRecord>();
      const addRecord = (field: Field, record: PropertyRecord) => {
        if (category.name !== favoritesCategoryName) {
          // note: favorite fields should be displayed even if they're hidden
          if (this._callbacks.isHidden(field))
            return;
          if (!this._includeWithNoValues && !record.isMerged && isValueEmpty(record.value))
            return;
        }
        if (records.some((r) => r.property.name === record.property.name))
          return;
        records.push(record);
      };
      const handleNestedContentRecord = (field: NestedContentField, record: PropertyRecord) => {
        if (1 === fields.fields[category.name].length) {
          // note: special handling if this is the only field in the category
          if (record.value.valueFormat === PropertyValueFormat.Array && 0 === record.value.items.length) {
            // don't include empty arrays at all
            return;
          }
          if (record.value.valueFormat === PropertyValueFormat.Struct) {
            // for structs just include all their members
            for (const nestedField of field.nestedFields) {
              if (!record.value.members[nestedField.name]) {
                // it is possible that struct specifies a property and record doesn't have this member
                // due to that property being in `hiddenFieldPaths` when creating the record
                continue;
              }
              addRecord(nestedField, record.value.members[nestedField.name]);
            }
            return;
          }
        }
        if (record.value.valueFormat === PropertyValueFormat.Struct && Object.keys(record.value.members).length === 0) {
          // don't include struct properties with no members
          return;
        }
        addRecord(field, record);
      };

      // create/add records for each field
      for (const field of fields.fields[category.name]) {
        const shouldCreateAncestorsStructure = !containsFieldPath(fields.hiddenAncestorsFieldPaths, createFieldPath(field));
        const record = this.createRecord(field, shouldCreateAncestorsStructure, fields.hiddenFieldPaths);
        if (field.isNestedContentField())
          handleNestedContentRecord(field, record);
        else
          addRecord(field, record);
      }

      if (records.length === 0) {
        // don't create the category if it has no records
        continue;
      }

      result.categories.push({
        name: category.name,
        label: category.label,
        expand: category.expand,
      });
      result.records[category.name] = records;
    }
    return result;
  }

  public async buildPropertyData(): Promise<PropertyData> {
    const fields = await this.createCategorizedFields();
    const records = this.createCategorizedRecords(fields);
    return {
      ...records,
      label: this._contentItem.label,
      description: this._contentItem.classInfo ? this._contentItem.classInfo.label : undefined,
    } as PropertyData;
  }
}

/**
 * Interface for presentation rules-driven property data provider.
 * @public
 */
export type IPresentationPropertyDataProvider = IPropertyDataProvider & IContentDataProvider;

/**
 * Presentation Rules-driven property data provider implementation.
 * @public
 */
export class PresentationPropertyDataProvider extends ContentDataProvider implements IPresentationPropertyDataProvider {
  public onDataChanged = new PropertyDataChangeEvent();
  private _includeFieldsWithNoValues: boolean;
  private _onFavoritesChangedRemoveListener: () => void;

  /** Constructor. */
  constructor(imodel: IModelConnection, rulesetId: string) {
    super(imodel, rulesetId, DefaultContentDisplayTypes.PropertyPane);
    this._includeFieldsWithNoValues = true;
    this._onFavoritesChangedRemoveListener = Presentation.favoriteProperties.onFavoritesChanged.addListener(() => this.invalidateCache({}));
  }

  /**
   * Dispose the presentation property data provider.
   */
  public dispose() {
    super.dispose();
    this._onFavoritesChangedRemoveListener();
  }

  /**
   * Invalidates cached content and clears categorized data.
   */
  protected invalidateCache(props: CacheInvalidationProps): void {
    super.invalidateCache(props);
    if (this.getMemoizedData)
      this.getMemoizedData.cache.clear!();
    if (this.onDataChanged)
      this.onDataChanged.raiseEvent();
  }

  /**
   * Tells the data provider to _not_ request descriptor and instead configure
   * content using `getDescriptorOverrides()` call
   */
  protected shouldConfigureContentDescriptor(): boolean { return false; }

  /**
   * Provides content configuration for the property grid
   */
  protected getDescriptorOverrides(): DescriptorOverrides {
    return {
      ...super.getDescriptorOverrides(),
      contentFlags: ContentFlags.ShowLabels | ContentFlags.MergeResults,
    };
  }

  /**
   * Hides the computed display label field from the list of properties
   */
  protected isFieldHidden(field: Field) {
    return field.name === "/DisplayLabel/";
  }

  /**
   * Should fields with no values be included in the property list. No value means:
   * - For *primitive* fields: null, undefined, "" (empty string)
   * - For *array* fields: [] (empty array)
   * - For *struct* fields: {} (object with no members)
   */
  public get includeFieldsWithNoValues(): boolean { return this._includeFieldsWithNoValues; }
  public set includeFieldsWithNoValues(value: boolean) {
    if (this._includeFieldsWithNoValues === value)
      return;
    this._includeFieldsWithNoValues = value;
    this.invalidateCache({ content: true });
  }

  /** Should the specified field be included in the favorites category. */
  protected isFieldFavorite(field: Field): boolean {
    return Presentation.favoriteProperties.has(field);
  }

  /**
   * Sorts the specified list of categories by priority. May be overriden
   * to supply a different sorting algorithm.
   */
  protected sortCategories(categories: CategoryDescription[]): void {
    categories.sort(prioritySortFunction);
  }

  /**
   * Sorts the specified list of fields by priority. May be overriden
   * to supply a different sorting algorithm.
   */
  protected sortFields(_category: CategoryDescription, fields: Field[]): void {
    fields.sort(prioritySortFunction);
  }

  /**
   * Returns property data.
   */
  // tslint:disable-next-line:naming-convention
  protected getMemoizedData = _.memoize(async (): Promise<PropertyData> => {
    const content = await this.getContent();
    if (!content || 0 === content.contentSet.length)
      return createDefaultPropertyData();

    const contentItem = content.contentSet[0];
    const callbacks: PropertyPaneCallbacks = {
      isFavorite: this.isFieldFavorite,
      isHidden: this.isFieldHidden,
      sortCategories: this.sortCategories,
      sortFields: this.sortFields,
    };
    const builder = new PropertyDataBuilder(content.descriptor, contentItem,
      this.includeFieldsWithNoValues, callbacks);
    return builder.buildPropertyData();
  });

  /**
   * Returns property data.
   */
  public async getData(): Promise<PropertyData> {
    return this.getMemoizedData();
  }
}

const createDefaultPropertyData = (): PropertyData => ({
  label: "",
  categories: [],
  records: {},
});

const createFieldPath = (field: Field): Field[] => {
  const path = [field];
  let currField = field;
  while (currField.parent) {
    currField = currField.parent;
    path.push(currField);
  }
  path.reverse();
  return path;
};

const fieldPathsMatch = (lhs: Field[], rhs: Field[]): boolean => {
  if (lhs.length !== rhs.length)
    return false;
  for (let i = 0; i < lhs.length; ++i) {
    if (lhs[i] !== rhs[i])
      return false;
  }
  return true;
};

const containsFieldPath = (container: Field[][], path: Field[]): boolean => {
  return container.some((candidate) => fieldPathsMatch(candidate, path));
};
