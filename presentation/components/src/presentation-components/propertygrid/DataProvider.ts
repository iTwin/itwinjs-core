/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PropertyGrid
 */

import { once } from "lodash";
import memoize from "micro-memoize";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import {
  CategoryDescription, ContentFlags, DefaultContentDisplayTypes, Descriptor, DescriptorOverrides, DisplayValue, Field, InstanceKey, Item,
  NestedContentField, PresentationError, PropertyValueFormat as PresentationPropertyValueFormat, PresentationStatus, Ruleset, Value,
} from "@bentley/presentation-common";
import { FavoritePropertiesScope, Presentation } from "@bentley/presentation-frontend";
import { PropertyRecord, PropertyValue, PropertyValueFormat } from "@bentley/ui-abstract";
import { IPropertyDataProvider, PropertyCategory, PropertyData, PropertyDataChangeEvent } from "@bentley/ui-components";
import { applyOptionalPrefix, ContentBuilder, filterMatchingFieldPaths } from "../common/ContentBuilder";
import { CacheInvalidationProps, ContentDataProvider, IContentDataProvider } from "../common/ContentDataProvider";
import { createLabelRecord, priorityAndNameSortFunction } from "../common/Utils";
import { FAVORITES_CATEGORY_NAME, getFavoritesCategory } from "../favorite-properties/DataProvider";

/**
 * Default presentation ruleset used by [[PresentationPropertyDataProvider]]. The ruleset just gets properties
 * of the selected elements.
 *
 * @beta
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
export const DEFAULT_PROPERTY_GRID_RULESET: Ruleset = require("./DefaultPropertyGridRules.json");

/** The function registers DEFAULT_PROPERTY_GRID_RULESET the first time it's called and does nothing on other calls */
const registerDefaultRuleset = once(async () => Presentation.presentation.rulesets().add(DEFAULT_PROPERTY_GRID_RULESET));

/**
 * Interface for presentation rules-driven property data provider.
 * @public
 */
export type IPresentationPropertyDataProvider = IPropertyDataProvider & IContentDataProvider;

/**
 * Properties for creating a `LabelsProvider` instance.
 * @public
 */
export interface PresentationPropertyDataProviderProps {
  /** IModelConnection to use for requesting property data. */
  imodel: IModelConnection;

  /**
   * Id of the ruleset to use when requesting properties or a ruleset itself. If not
   * set, default presentation rules are used which return content for the selected elements.
   */
  ruleset?: string | Ruleset;
  /**
   * Auto-update property data when ruleset, ruleset variables or data in the iModel changes.
   * @alpha
   */
  enableContentAutoUpdate?: boolean;
  /**
   * If true, additional 'favorites' category is not created.
   * @alpha
   */
  disableFavoritesCategory?: boolean;
}

/**
 * Presentation Rules-driven property data provider implementation.
 * @public
 */
export class PresentationPropertyDataProvider extends ContentDataProvider implements IPresentationPropertyDataProvider {
  public onDataChanged = new PropertyDataChangeEvent();
  private _useDefaultRuleset: boolean;
  private _includeFieldsWithNoValues: boolean;
  private _includeFieldsWithCompositeValues: boolean;
  private _isNestedPropertyCategoryGroupingEnabled: boolean;
  private _onFavoritesChangedRemoveListener: () => void;
  private _shouldCreateFavoritesCategory: boolean;

  /**
   * Constructor
   */
  constructor(props: PresentationPropertyDataProviderProps) {
    super({
      imodel: props.imodel,
      ruleset: props.ruleset ? props.ruleset : DEFAULT_PROPERTY_GRID_RULESET.id,
      displayType: DefaultContentDisplayTypes.PropertyPane,
      enableContentAutoUpdate: props.enableContentAutoUpdate,
    });
    this._useDefaultRuleset = !props.ruleset;
    this._includeFieldsWithNoValues = true;
    this._includeFieldsWithCompositeValues = true;
    this._isNestedPropertyCategoryGroupingEnabled = false;
    this._onFavoritesChangedRemoveListener = Presentation.favoriteProperties.onFavoritesChanged.addListener(() => this.invalidateCache({}));
    this._shouldCreateFavoritesCategory = !props.disableFavoritesCategory;
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
    if (this.getMemoizedData) {
      this.getMemoizedData.cache.keys.length = 0;
      this.getMemoizedData.cache.values.length = 0;
    }
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

  /**
   * Should fields with composite values be included in the property list.
   * Fields with composite values:
   * - *array* fields.
   * - *struct* fields.
   */
  public get includeFieldsWithCompositeValues(): boolean { return this._includeFieldsWithCompositeValues; }
  public set includeFieldsWithCompositeValues(value: boolean) {
    if (this._includeFieldsWithCompositeValues === value)
      return;
    this._includeFieldsWithCompositeValues = value;
    this.invalidateCache({ content: true });
  }

  /**
   * Is nested property categories enabled
   * @beta
   */
  public get isNestedPropertyCategoryGroupingEnabled(): boolean { return this._isNestedPropertyCategoryGroupingEnabled; }
  public set isNestedPropertyCategoryGroupingEnabled(value: boolean) {
    if (this._isNestedPropertyCategoryGroupingEnabled === value)
      return;
    this._isNestedPropertyCategoryGroupingEnabled = value;
    this.invalidateCache({ content: true });
  }

  /** Should the specified field be included in the favorites category. */
  // eslint-disable-next-line @typescript-eslint/naming-convention
  protected isFieldFavorite = (field: Field): boolean => (this._shouldCreateFavoritesCategory && Presentation.favoriteProperties.has(field, this.imodel, FavoritePropertiesScope.IModel));

  /**
   * Sorts the specified list of categories by priority. May be overriden
   * to supply a different sorting algorithm.
   */
  protected sortCategories(categories: CategoryDescription[]): void {
    categories.sort(priorityAndNameSortFunction);
  }

  /**
   * Sorts the specified list of fields by priority. May be overriden
   * to supply a different sorting algorithm.
   */
  // eslint-disable-next-line @typescript-eslint/naming-convention
  protected sortFields = (category: CategoryDescription, fields: Field[]) => {
    if (category.name === FAVORITES_CATEGORY_NAME)
      Presentation.favoriteProperties.sortFields(this.imodel, fields);
    else
      fields.sort(priorityAndNameSortFunction);
  };

  /**
   * Returns property data.
   */
  // eslint-disable-next-line @typescript-eslint/naming-convention
  protected getMemoizedData = memoize(async (): Promise<PropertyData> => {
    if (this._useDefaultRuleset)
      await registerDefaultRuleset();

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
    const builder = new PropertyDataBuilder({
      descriptor: content.descriptor,
      item: contentItem,
      includeWithNoValues: this.includeFieldsWithNoValues,
      includeWithCompositeValues: this.includeFieldsWithCompositeValues,
      wantNestedCategories: this._isNestedPropertyCategoryGroupingEnabled,
      callbacks,
    });
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
  label: PropertyRecord.fromString("", "label"),
  categories: [],
  records: {},
});

interface PropertyPaneCallbacks {
  isFavorite(field: Field): boolean;
  isHidden(field: Field): boolean;
  sortCategories(categories: CategoryDescription[]): void;
  sortFields: (category: CategoryDescription, fields: Field[]) => void;
}

interface CategorizedFields {
  categories: CategoryDescription[];
  fields: {
    [categoryName: string]: Field[];
  };
  hiddenFieldPaths: Field[][];
  hiddenAncestorsFieldPaths: Field[][];
}

interface CategorizedRecords {
  categories: PropertyCategory[];
  records: {
    [categoryName: string]: PropertyRecord[];
  };
}

interface Record {
  record: PropertyRecord;
  field: Field;
}

class PropertyDataBuilder {
  private _descriptor: Descriptor;
  private _contentItem: Item;
  private _includeWithNoValues: boolean;
  private _includeWithCompositeValues: boolean;
  private _wantNestedCategories: boolean;
  private _callbacks: PropertyPaneCallbacks;

  constructor(props: {
    descriptor: Descriptor;
    item: Item;
    includeWithNoValues: boolean;
    includeWithCompositeValues: boolean;
    callbacks: PropertyPaneCallbacks;
    wantNestedCategories: boolean;
  }) {
    this._descriptor = props.descriptor;
    this._contentItem = props.item;
    this._includeWithNoValues = props.includeWithNoValues;
    this._includeWithCompositeValues = props.includeWithCompositeValues;
    this._wantNestedCategories = props.wantNestedCategories;
    this._callbacks = props.callbacks;
  }

  public buildPropertyData(): PropertyData {
    const records = this._wantNestedCategories ? this.createNestedCategorizedRecords() : this.createCategorizedRecords(this.createCategorizedFieldsWithFlatCategories());
    return {
      ...records,
      label: createLabelRecord(this._contentItem.label, "label"),
      description: this._contentItem.classInfo ? this._contentItem.classInfo.label : undefined,
      reusePropertyDataState: true,
    } as PropertyData;
  }

  private createCategorizedFieldsWithFlatCategories(): CategorizedFields {
    const favoritesCategory = getFavoritesCategory();
    const categories = new Array<CategoryDescription>();
    const categoryFields: {
      [categoryName: string]: Field[];
    } = {};
    const hiddenFieldPaths = new Array<Field[]>();
    const hiddenAncestorsFieldPaths = new Array<Field[]>();

    const includeField = (category: CategoryDescription, field: Field) => {
      if (field.type.valueFormat !== PresentationPropertyValueFormat.Primitive && !this._includeWithCompositeValues)
        return false;

      if (!categoryFields.hasOwnProperty(category.name)) {
        categories.push(category);
        categoryFields[category.name] = new Array<Field>();
      }
      categoryFields[category.name].push(field);
      return true;
    };
    const visitField = (category: CategoryDescription, field: Field, isNested: boolean) => {
      if (category !== favoritesCategory && field.isNestedContentField()) {
        // visit all nested fields
        const includedNestedFieldsCount = visitFields(field.nestedFields, true);
        if (includedNestedFieldsCount === field.nestedFields.length)
          return true;
      }
      if (isNested) {
        if (field.category.name === "" || field.category === field.parent!.category) {
          // don't include nested fields which have no category - they
          // will be included as part of the nesting field
          return false;
        }
        // if we're including a nested field as a top-level field, we have to exclude
        // it from it's nesting field
        const path = createFieldPath(field);
        hiddenFieldPaths.push(path);
        hiddenAncestorsFieldPaths.push(path);
      }
      return includeField(category, field);
    };
    const visitFields = (fields: Field[], isNested: boolean) => {
      let includedFieldsCount = 0;
      fields.forEach((field) => {
        if (favoritesCategory.name !== field.category.name && this._callbacks.isFavorite(field)) {
          // if the field is not already in favorites group and we want to make it favorite, visit it
          // with the favorites category as a top level (isNested = false) field
          visitField(favoritesCategory, field, false);
          hiddenAncestorsFieldPaths.push(createFieldPath(field));
        }
        // show field as a top-level field even if it's nested if it has a valid category
        if (visitField(field.category, field, isNested))
          ++includedFieldsCount;
      });
      return includedFieldsCount;
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

  private createCategorizedRecords(fields: CategorizedFields): CategorizedRecords {
    const favoritesCategory = getFavoritesCategory();
    const result: CategorizedRecords = {
      categories: [],
      records: {},
    };
    for (const category of fields.categories) {
      const records = new Array<PropertyRecord>();
      const addRecord = (field: Field, record: PropertyRecord) => {
        if (records.some((r) => r.property.name === record.property.name))
          return;

        // note: favorite fields should be displayed even if they're hidden
        if (category.name === favoritesCategory.name) {
          records.push(record);
          return;
        }

        if (this._callbacks.isHidden(field))
          return;
        if (!this._includeWithNoValues && !record.isMerged && isValueEmpty(record.value))
          return;

        records.push(record);
      };
      const handleNestedContentRecord = (field: NestedContentField, record: PropertyRecord) => {
        if (1 === fields.fields[category.name].length) {
          // note: special handling if this is the only field in the category
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
        addRecord(field, record);
      };

      // create/add records for each field
      for (const field of fields.fields[category.name]) {
        const shouldCreateAncestorsStructure = !containsFieldPath(fields.hiddenAncestorsFieldPaths, createFieldPath(field));
        const hiddenFieldPathsForThisField = (category.name === favoritesCategory.name) ? [] : fields.hiddenFieldPaths;
        const recordEntry = this.createRecord(field, shouldCreateAncestorsStructure, hiddenFieldPathsForThisField);
        if (!recordEntry)
          continue;

        if (field.isNestedContentField())
          handleNestedContentRecord(field, recordEntry.record);
        else
          addRecord(field, recordEntry.record);
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

  private createRecord(field: Field, createStruct: boolean, hiddenFieldPaths: Field[][]): Record | undefined {
    const pathToRootField = createFieldPath(field);

    if (createStruct) {
      const rootField = pathToRootField[0];
      const pathToFieldFromRoot = pathToRootField.slice(1);
      return undefinedIfNoRecord({
        record: ContentBuilder.createPropertyRecord(rootField, this._contentItem, {
          exclusiveIncludePath: pathToFieldFromRoot,
          hiddenFieldPaths: filterMatchingFieldPaths(hiddenFieldPaths, rootField),
          skipChildlessRecords: true,
        }),
        field: rootField,
      });
    }

    let item = this._contentItem;
    // need to remove the last element because the Field information is in `field`
    const pathUpToField = pathToRootField.slice(undefined, -1);
    let namePrefix: string | undefined;
    for (const parentField of pathUpToField) {
      if (item.isFieldMerged(parentField.name))
        return this.createRecord(field, true, hiddenFieldPaths);

      const nestedContentValues = item.values[parentField.name];
      if (!Value.isNestedContent(nestedContentValues))
        throw new PresentationError(PresentationStatus.Error, "value should be nested content");

      if (nestedContentValues.length === 0)
        return undefined;

      namePrefix = applyOptionalPrefix(parentField.name, namePrefix);

      if (nestedContentValues.length > 1) {
        const extractedField = field.clone();
        extractedField.type = {
          valueFormat: PresentationPropertyValueFormat.Array,
          typeName: `${field.type.typeName}[]`,
          memberType: field.type,
        };
        const primaryKeys = nestedContentValues.reduce((keys, ncv) => {
          keys.push(...ncv.primaryKeys);
          return keys;
        }, new Array<InstanceKey>());
        const values = {
          [field.name]: nestedContentValues.reduce((fieldValues, ncv) => {
            fieldValues.push(ncv.values[field.name]);
            return fieldValues;
          }, new Array<Value>()),
        };
        const displayValues = {
          [field.name]: nestedContentValues.reduce((fieldValues, ncv) => {
            fieldValues.push(ncv.displayValues[field.name]);
            return fieldValues;
          }, new Array<DisplayValue>()),
        };
        const extractedItem = new Item(primaryKeys, "", "", undefined, values, displayValues, []);
        return undefinedIfNoRecord({ record: ContentBuilder.createPropertyRecord(extractedField, extractedItem, { namePrefix, skipChildlessRecords: true }), field: extractedField });
      }

      const nestedContentValue = nestedContentValues[0];
      item = new Item(nestedContentValue.primaryKeys, "", "", undefined, nestedContentValue.values,
        nestedContentValue.displayValues, nestedContentValue.mergedFieldNames);
    }
    return undefinedIfNoRecord({ record: ContentBuilder.createPropertyRecord(field, item, { namePrefix, hiddenFieldPaths: filterMatchingFieldPaths(hiddenFieldPaths, field), skipChildlessRecords: true }), field });
  }

  private createNestedCategorizedRecords(): CategorizedRecords {
    const categoriesCache = new PropertyCategoriesCache(this._descriptor);

    // paths of nested fields that we want to exclude from their nesting fields; generally
    // used when nested field has a different category than its parent field
    const hiddenFieldPaths: Field[][] = [];

    // gather all included content fields
    const includedFields = new Array<Field>();
    const visitField = (field: Field, isNested: boolean) => {
      if (field.isNestedContentField()) {
        const includedNestedFieldsCount = visitFields(field.nestedFields, true);
        if (includedNestedFieldsCount === field.nestedFields.length)
          return true;
      }
      if (isNested) {
        if (field.category === field.parent!.category) {
          // don't include nested fields which have no category - they
          // will be included as part of the nesting field
          return false;
        }
        // if we're including a nested field as a top-level field, we have to exclude
        // it from it's nesting field
        const path = createFieldPath(field);
        hiddenFieldPaths.push(path);
      }
      if (field.type.valueFormat !== PresentationPropertyValueFormat.Primitive && !this._includeWithCompositeValues)
        return false;

      includedFields.push(field);
      return true;
    };
    const visitFields = (fields: Field[], isNested: boolean) => {
      let includedFieldsCount = 0;
      fields.forEach((field) => {
        // show field as a top-level field even if it's nested if it has a valid category
        if (visitField(field, isNested))
          ++includedFieldsCount;
      });
      return includedFieldsCount;
    };
    visitFields(this._descriptor.fields, false);

    // create records for each field
    const categorizedRecords = new Map<string, Record[]>();
    const addRecord = (category: CategoryDescription, field: Field, record: PropertyRecord) => {
      let records = categorizedRecords.get(category.name);
      if (!records) {
        records = [];
        categorizedRecords.set(category.name, records);
      }
      if (!records.some((r) => r.field === field))
        records.push({ record, field });
    };
    includedFields.forEach((field: Field) => {
      let isFavorite = this._callbacks.isFavorite(field);
      let isHidden = this._callbacks.isHidden(field);
      const recordEntry = this.createRecord(field, false, hiddenFieldPaths);
      if (!recordEntry)
        return;

      isFavorite = isFavorite || (recordEntry.field !== field) && this._callbacks.isFavorite(recordEntry.field);
      isHidden = isHidden || (recordEntry.field !== field) && this._callbacks.isHidden(recordEntry.field);

      if (isFavorite) {
        const categoryDescr = categoriesCache.getFavoriteCategory(recordEntry.field.category);
        addRecord(categoryDescr, recordEntry.field, recordEntry.record);
      } else {
        // note: favorite fields should be displayed even if they're hidden
        if (isHidden)
          return;
        if (!this._includeWithNoValues && !recordEntry.record.isMerged && isValueEmpty(recordEntry.record.value))
          return;
      }

      addRecord(recordEntry.field.category, recordEntry.field, recordEntry.record);
    });

    // some special nested content handling
    categorizedRecords.forEach((entry) => {
      const destructureNoSiblingsStructs = true;
      if (entry.length === 1) {
        const field = entry[0].field;
        const record = entry[0].record;
        if (destructureNoSiblingsStructs && field.isNestedContentField() && record.value.valueFormat === PropertyValueFormat.Struct) {
          const replacementRecords = [];
          for (const nestedField of field.nestedFields) {
            if (!record.value.members[nestedField.name]) {
              // it is possible that struct specifies a property and record doesn't have this member
              // due to that property being in `hiddenFieldPaths` when creating the record
              continue;
            }
            replacementRecords.push({ record: record.value.members[nestedField.name], field: nestedField });
          }
          entry.splice(0, 1, ...replacementRecords);
        }
      }
    });

    // determine which categories are actually used
    const usedCategoryNames = new Set();
    categorizedRecords.forEach((_entry, categoryName) => {
      let category = categoriesCache.getEntry(categoryName);
      while (category) {
        usedCategoryNames.add(category.name);
        category = category.parent ? categoriesCache.getEntry(category.parent.name) : undefined;
      }
    });

    // set up categories hierarchy
    const categoriesHierarchy = new Map<CategoryDescription | undefined, CategoryDescription[]>();
    categoriesCache.getEntries().forEach((category) => {
      if (!usedCategoryNames.has(category.name)) {
        // skip unused categories
        return;
      }

      let childCategories = categoriesHierarchy.get(category.parent);
      if (!childCategories) {
        childCategories = [];
        categoriesHierarchy.set(category.parent, childCategories);
      }
      childCategories.push(category);
    });

    // sort categories and fields/records
    const nestedSortCategory = (category: CategoryDescription | undefined) => {
      const childCategories = categoriesHierarchy.get(category);
      if (childCategories && childCategories.length > 1)
        this._callbacks.sortCategories(childCategories);

      if (category) {
        const records = categorizedRecords.get(category.name);
        if (records) {
          const sortedFields = records.map((r) => r.field);
          this._callbacks.sortFields(category, sortedFields);
          const sortedRecords = sortedFields.map((field) => records.find((r) => r.field === field)!);
          records.splice(0, records.length, ...sortedRecords);
        }
      }

      if (childCategories)
        childCategories.forEach(nestedSortCategory);
    };
    nestedSortCategory(undefined);

    // create a hierarchy of PropertyCategory
    const propertyCategories = new Array<{
      category: PropertyCategory;
      source: CategoryDescription;
      categoryHasParent: boolean;
    }>();
    const pushPropertyCategories = (parentDescr?: CategoryDescription) => {
      const childCategoryDescriptions = categoriesHierarchy.get(parentDescr);
      const childPropertyCategories = (childCategoryDescriptions ?? []).map((categoryDescr) => {
        const category: PropertyCategory = {
          name: categoryDescr.name,
          label: categoryDescr.label,
          expand: categoryDescr.expand,
        };
        return { category, source: categoryDescr, categoryHasParent: parentDescr !== undefined };
      });
      propertyCategories.push(...childPropertyCategories);
      for (const categoryInfo of childPropertyCategories) {
        categoryInfo.category.childCategories = pushPropertyCategories(categoryInfo.source);
      }
      return childPropertyCategories.map((categoryInfo) => categoryInfo.category);
    };
    pushPropertyCategories(undefined);

    // put everything in return format
    const result: CategorizedRecords = {
      categories: propertyCategories
        .filter(({ categoryHasParent }) => !categoryHasParent)
        .map(({ category }) => category),
      records: {},
    };
    categorizedRecords.forEach((recs, categoryName) => {
      result.records[categoryName] = recs.map((r) => r.record);
    });
    return result;
  }
}

class PropertyCategoriesCache {
  private _byName = new Map<string, CategoryDescription>();

  constructor(descriptor: Descriptor) {
    this.initFromFields(descriptor.fields);

    // add parent categories that have no fields of their own
    [...this._byName.values()].forEach((entry) => {
      let curr: CategoryDescription | undefined = entry;
      while (curr)
        curr = curr.parent ? this.cache(curr.parent) : undefined;
    });
  }

  private initFromFields(fields: Field[]) {
    fields.forEach((field: Field) => {
      if (field.isNestedContentField()) {
        this.initFromFields(field.nestedFields);
      } else {
        this.cache(field.category);
      }
    });
  }

  private cache(category: CategoryDescription) {
    const entry = this._byName.get(category.name);
    if (entry)
      return entry;

    this._byName.set(category.name, category);
    return category;
  }

  public getEntry(descr: string) {
    return this._byName.get(descr);
  }

  public getEntries() {
    return [...this._byName.values()];
  }

  public getFavoriteCategory(sourceCategory: CategoryDescription): CategoryDescription {
    const fieldCategoryRenameStatus = this.getRenamedCategory(`${FAVORITES_CATEGORY_NAME}-${sourceCategory.name}`, sourceCategory);
    let curr = fieldCategoryRenameStatus;
    while (!curr.fromCache && curr.category.parent) {
      const parentCategoryRenameStatus = this.getRenamedCategory(`${FAVORITES_CATEGORY_NAME}-${curr.category.parent.name}`, curr.category.parent);
      curr.category.parent = parentCategoryRenameStatus.category;
      curr = parentCategoryRenameStatus;
    }
    if (!curr.fromCache)
      curr.category.parent = this.getRootFavoritesCategory();
    return fieldCategoryRenameStatus.category;
  }

  private getCachedCategory(name: string, factory: () => CategoryDescription) {
    let cached = this._byName.get(name);
    if (cached)
      return { category: cached, fromCache: true };

    cached = factory();
    this._byName.set(name, cached);
    return { category: cached, fromCache: false };
  }

  private getRootFavoritesCategory() {
    return this.getCachedCategory(FAVORITES_CATEGORY_NAME, getFavoritesCategory).category;
  }

  private getRenamedCategory(name: string, source: CategoryDescription) {
    return this.getCachedCategory(name, () => ({ ...source, name }));
  }
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

const undefinedIfNoRecord = (entry: {
  record: PropertyRecord | undefined;
  field: Field;
}): Record | undefined => {
  if (!entry.record)
    return undefined;
  return { record: entry.record, field: entry.field };
};
