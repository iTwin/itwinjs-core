/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PropertyGrid
 */

import { inPlaceSort } from "fast-sort";
import memoize from "micro-memoize";
import { assert } from "@bentley/bentleyjs-core";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import {
  CategoryDescription, ContentFlags, DefaultContentDisplayTypes, Descriptor, DescriptorOverrides, Field, InstanceKey, Item, NestedContentField,
  NestedContentValue, PresentationError, PropertyValueFormat as PresentationPropertyValueFormat, PresentationStatus, RelationshipMeaning, Ruleset,
  Value, ValuesMap,
} from "@bentley/presentation-common";
import { FavoritePropertiesScope, Presentation } from "@bentley/presentation-frontend";
import { PropertyRecord, PropertyValue, PropertyValueFormat } from "@bentley/ui-abstract";
import { IPropertyDataProvider, PropertyCategory, PropertyData, PropertyDataChangeEvent } from "@bentley/ui-components";
import { ContentBuilder, FieldRecord } from "../common/ContentBuilder";
import { CacheInvalidationProps, ContentDataProvider, IContentDataProvider } from "../common/ContentDataProvider";
import { DiagnosticsProps } from "../common/Diagnostics";
import { createLabelRecord, findField } from "../common/Utils";
import { FAVORITES_CATEGORY_NAME, getFavoritesCategory } from "../favorite-properties/DataProvider";

const labelsComparer = new Intl.Collator(undefined, { sensitivity: "base" }).compare;

/**
 * Default presentation ruleset used by [[PresentationPropertyDataProvider]]. The ruleset just gets properties
 * of the selected elements.
 *
 * @public
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
export const DEFAULT_PROPERTY_GRID_RULESET: Ruleset = require("./DefaultPropertyGridRules.json");

/**
 * Interface for presentation rules-driven property data provider.
 * @public
 */
export type IPresentationPropertyDataProvider = IPropertyDataProvider & IContentDataProvider;

/**
 * Properties for creating a `LabelsProvider` instance.
 * @public
 */
export interface PresentationPropertyDataProviderProps extends DiagnosticsProps {
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
      ruleset: props.ruleset ? props.ruleset : DEFAULT_PROPERTY_GRID_RULESET,
      displayType: DefaultContentDisplayTypes.PropertyPane,
      enableContentAutoUpdate: props.enableContentAutoUpdate,
      ruleDiagnostics: props.ruleDiagnostics,
      devDiagnostics: props.devDiagnostics,
    });
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

  /** Is nested property categories enabled */
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
    inPlaceSort(categories).by([
      { desc: (c) => c.priority },
      { asc: (c) => c.label, comparer: labelsComparer },
    ]);
  }

  /**
   * Sorts the specified list of fields by priority. May be overriden
   * to supply a different sorting algorithm.
   */
  // eslint-disable-next-line @typescript-eslint/naming-convention
  protected sortFields = (category: CategoryDescription, fields: Field[]) => {
    if (category.name === FAVORITES_CATEGORY_NAME)
      Presentation.favoriteProperties.sortFields(this.imodel, fields);
    else {
      inPlaceSort(fields).by([
        { desc: (f) => f.priority },
        { asc: (f) => f.label, comparer: labelsComparer },
      ]);
    }
  };

  /**
   * Returns property data.
   */
  // eslint-disable-next-line @typescript-eslint/naming-convention
  protected getMemoizedData = memoize(async (): Promise<PropertyData> => {
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

  /**
   * Get keys of instances which were used to create given [[PropertyRecord]].
   * @beta
   */
  public async getPropertyRecordInstanceKeys(record: PropertyRecord): Promise<InstanceKey[]> {
    const content = await this.getContent();
    if (!content || 0 === content.contentSet.length)
      return [];

    let recordField = findField(content.descriptor, record.property.name);
    if (!recordField)
      return [];

    const fieldsStack: Field[] = [];
    while (recordField.parent) {
      recordField = recordField.parent;
      fieldsStack.push(recordField);
    }
    fieldsStack.reverse();

    let contentItems: Array<{ primaryKeys: InstanceKey[], values: ValuesMap }> = content.contentSet;
    fieldsStack.forEach((field) => {
      const nestedContent = contentItems.reduce((nc, curr) => {
        const currItemValue = curr.values[field.name];
        assert(Value.isNestedContent(currItemValue));
        nc.push(...currItemValue);
        return nc;
      }, new Array<NestedContentValue>());
      contentItems = nestedContent.map((nc) => ({
        primaryKeys: nc.primaryKeys,
        values: nc.values,
      }));
    });

    return contentItems.reduce((keys, curr) => {
      keys.push(...curr.primaryKeys);
      return keys;
    }, new Array<InstanceKey>());
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

interface StrictFieldHierarchy {
  field: Field;
  childFields: StrictFieldHierarchy[];
}

interface CategorizedFields {
  categories: CategoryDescription[];
  fields: {
    [categoryName: string]: StrictFieldHierarchy[];
  };
}

interface CategorizedRecords {
  categories: PropertyCategory[];
  records: {
    [categoryName: string]: PropertyRecord[];
  };
}

type FieldHierarchyRecord = FieldRecord & {
  fieldHierarchy: StrictFieldHierarchy;
};

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
      [categoryName: string]: StrictFieldHierarchy[];
    } = {};

    const buildFieldsHierarchy = (fields: Field[]): StrictFieldHierarchy[] => {
      return fields.map((field) => {
        const childFields = field.isNestedContentField() ? buildFieldsHierarchy(field.nestedFields) : [];
        return { field, childFields };
      });
    };
    const includeField = (category: CategoryDescription, fieldHierarchy: StrictFieldHierarchy) => {
      if (!categoryFields.hasOwnProperty(category.name)) {
        categories.push(category);
        categoryFields[category.name] = [];
      }
      categoryFields[category.name].push(fieldHierarchy);
      return fieldHierarchy;
    };
    const visitField = (category: CategoryDescription, field: Field, parentField: Field | undefined): StrictFieldHierarchy | undefined => {
      let childFields: StrictFieldHierarchy[] = [];
      if (field.isNestedContentField()) {
        if (category === favoritesCategory) {
          childFields = buildFieldsHierarchy(field.nestedFields);
        } else {
          childFields = visitFields(field.nestedFields, field);
        }
        if (0 === childFields.length)
          return undefined;
      }
      if (field.type.valueFormat !== PresentationPropertyValueFormat.Primitive && !this._includeWithCompositeValues) {
        // skip composite fields if requested
        return undefined;
      }
      const fieldHierarchy = { field, childFields };
      if (category === parentField?.category) {
        // if categories of this field and its parent field match - return the field hierarchy without
        // including it as a top level field
        return fieldHierarchy;
      }
      if (!tryGroupingWithRelatedFields(categoryFields[category.name] ?? [], fieldHierarchy)) {
        includeField(category, fieldHierarchy);
      }
      return undefined;
    };
    const visitFields = (fields: Field[], parentField: NestedContentField | undefined) => {
      const includedFields: StrictFieldHierarchy[] = [];
      fields.forEach((field) => {
        if (favoritesCategory.name !== field.category.name && this._callbacks.isFavorite(field)) {
          // if the field is not already in favorites group and we want to make it favorite, visit it
          // with the favorites category
          visitField(favoritesCategory, field, undefined);
        }
        const visitedField = visitField(field.category, field, parentField);
        if (visitedField)
          includedFields.push(visitedField);
      });
      return includedFields;
    };
    visitFields(this._descriptor.fields, undefined);

    // sort categories
    this._callbacks.sortCategories(categories);

    // sort fields
    const sortFieldHierarchies = (category: CategoryDescription, fieldHierarchies: StrictFieldHierarchy[]) => {
      const sortedFields = fieldHierarchies.map((fh) => fh.field);
      this._callbacks.sortFields(category, sortedFields);
      fieldHierarchies.sort((lhs, rhs) => {
        const lhsIndex = sortedFields.indexOf(lhs.field);
        const rhsIndex = sortedFields.indexOf(rhs.field);
        return lhsIndex - rhsIndex;
      });
      fieldHierarchies.forEach((fh) => sortFieldHierarchies(category, fh.childFields));
    };
    categories.forEach((category) => sortFieldHierarchies(category, categoryFields[category.name]));

    return {
      categories,
      fields: categoryFields,
    };
  }

  private createCategorizedRecords(fields: CategorizedFields): CategorizedRecords {
    const favoritesCategory = getFavoritesCategory();
    const result: CategorizedRecords = {
      categories: [],
      records: {},
    };
    for (const category of fields.categories) {
      const records = new Array<FieldHierarchyRecord>();
      const addRecord = (entry: FieldHierarchyRecord) => {
        if (category.name === favoritesCategory.name) {
          records.push(entry);
          return;
        }

        if (this._callbacks.isHidden(entry.fieldHierarchy.field))
          return;

        if (!this._includeWithNoValues && !entry.record.isMerged && isValueEmpty(entry.record.value))
          return;

        records.push(entry);
      };

      // create/add records for each field
      for (const fieldHierarchy of fields.fields[category.name]) {
        const recordEntry = ContentBuilder.createPropertyRecord(fieldHierarchy, this._contentItem);
        addRecord({ ...recordEntry, fieldHierarchy });
      }

      destructureRecords(records);

      if (records.length === 0) {
        // don't create the category if it has no records
        continue;
      }

      result.categories.push({
        name: category.name,
        label: category.label,
        expand: category.expand,
      });
      result.records[category.name] = records.map((r) => r.record);
    }
    return result;
  }

  private createFieldsHierarchy(fields: Field[]) {
    const hierarchies = new Array<StrictFieldHierarchy>();
    const visitField = (category: CategoryDescription, field: Field, parentField: Field | undefined): StrictFieldHierarchy | undefined => {
      let childFields: StrictFieldHierarchy[] = [];
      if (field.isNestedContentField()) {
        // visit all nested fields
        childFields = visitFields(field.nestedFields, field);
        if (0 === childFields.length)
          return undefined;
      }
      if (field.type.valueFormat !== PresentationPropertyValueFormat.Primitive && !this._includeWithCompositeValues) {
        // skip composite fields if requested
        return undefined;
      }
      const fieldHierarchy = { field, childFields };
      if (category === parentField?.category) {
        // if categories of this field and its parent field match - return the field hierarchy without
        // including it as a top level field
        return fieldHierarchy;
      }
      if (!tryGroupingWithRelatedFields(hierarchies, fieldHierarchy)) {
        hierarchies.push(fieldHierarchy);
      }
      return undefined;
    };
    const visitFields = (visitedFields: Field[], parentField: NestedContentField | undefined) => {
      const includedFields: StrictFieldHierarchy[] = [];
      visitedFields.forEach((field) => {
        const visitedField = visitField(field.category, field, parentField);
        if (visitedField)
          includedFields.push(visitedField);
      });
      return includedFields;
    };
    visitFields(fields, undefined);
    return hierarchies;
  }

  private createFavoriteFieldsList(fieldHierarchies: StrictFieldHierarchy[]): StrictFieldHierarchy[] {
    const favorites: StrictFieldHierarchy[] = [];
    fieldHierarchies.forEach((fh) => traverseFieldHierarchy(fh, (hierarchy) => {
      if (!this._callbacks.isFavorite(hierarchy.field))
        return true;

      if (!tryGroupingWithRelatedFields(favorites, hierarchy))
        favorites.push(hierarchy);

      return false;
    }));
    return favorites;
  }

  private createNestedCategorizedRecords(): CategorizedRecords {
    const categoriesCache = new PropertyCategoriesCache(this._descriptor);
    const includedFields = this.createFieldsHierarchy(this._descriptor.fields);
    const favoriteFields = this.createFavoriteFieldsList(includedFields);

    // create records for each field
    const categorizedRecords = new Map<string, FieldHierarchyRecord[]>();
    const addRecord = (category: CategoryDescription, entry: FieldHierarchyRecord) => {
      let records = categorizedRecords.get(category.name);
      if (!records) {
        records = [];
        categorizedRecords.set(category.name, records);
      }
      records.push(entry);
    };
    const addFieldHierarchy = (fieldHierarchy: StrictFieldHierarchy, isFavorite: boolean, forceShow: boolean) => {
      const recordEntry = ContentBuilder.createPropertyRecord(fieldHierarchy, this._contentItem);

      const isHidden = !forceShow && this._callbacks.isHidden(fieldHierarchy.field) || (fieldHierarchy.field !== recordEntry.field) && this._callbacks.isHidden(recordEntry.field);
      if (isHidden)
        return;

      if (!forceShow && !this._includeWithNoValues && !recordEntry.record.isMerged && isValueEmpty(recordEntry.record.value))
        return;

      const category = isFavorite ? categoriesCache.getFavoriteCategory(recordEntry.field.category) : recordEntry.field.category;
      addRecord(category, { ...recordEntry, fieldHierarchy });
    };
    includedFields.forEach((fieldHierarchy) => addFieldHierarchy(fieldHierarchy, false, false));
    favoriteFields.forEach((fieldHierarchy) => addFieldHierarchy(fieldHierarchy, true, true));

    categorizedRecords.forEach((records) => destructureRecords(records));

    // determine which categories are actually used
    const usedCategoryNames = new Set();
    categorizedRecords.forEach((records, categoryName) => {
      if (records.length === 0)
        return;
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
          const sortedFields = records.map((r) => r.fieldHierarchy.field);
          this._callbacks.sortFields(category, sortedFields);
          const sortedRecords = sortedFields.map((field) => records.find((r) => r.fieldHierarchy.field === field)!);
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
          renderer: categoryDescr.renderer,
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
      if (recs.length)
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

function shouldDestructureArrayField(field: Field) {
  // destructure arrays if they're based on nested content field or nested under a nested content field
  return field.isNestedContentField() || field.parent;
}

function shouldDestructureStructField(field: Field, totalRecordsCount: number | undefined) {
  // destructure structs if they're based on nested content and:
  // - if relationship meaning is 'same instance' - always destructure
  // - if relationship meaning is 'related instance' - only if it's the only record in the list
  return field.isNestedContentField() && (field.relationshipMeaning === RelationshipMeaning.SameInstance || totalRecordsCount === 1);
}

function destructureStructMember(member: FieldRecord & { fieldHierarchy: StrictFieldHierarchy }): Array<FieldRecord & { fieldHierarchy: StrictFieldHierarchy }> {
  // only destructure array member items
  if (member.record.value.valueFormat !== PropertyValueFormat.Array || !shouldDestructureArrayField(member.field) || !shouldDestructureStructField(member.field, undefined))
    return [member];

  // don't want to include struct arrays without items - just return empty array
  if (member.record.value.items.length === 0)
    return [];

  // the array should be of size 1
  if (member.record.value.items.length > 1)
    return [member];

  // the single item should be a struct
  const item = member.record.value.items[0];
  assert(item.value.valueFormat === PropertyValueFormat.Struct);

  // if all above checks pass, destructure the struct item
  const recs = [{ ...member, record: item }];
  destructureRecords(recs);
  return recs;
}

function destructureStructArrayItems(items: PropertyRecord[], fieldHierarchy: StrictFieldHierarchy) {
  const destructuredFields: StrictFieldHierarchy[] = [];
  fieldHierarchy.childFields.forEach((nestedFieldHierarchy) => {
    items.forEach((item, index) => {
      assert(item.value.valueFormat === PropertyValueFormat.Struct);
      assert(item.value.members[nestedFieldHierarchy.field.name] !== undefined);

      // destructure a single struct array item member
      const destructuredMembers = destructureStructMember({
        fieldHierarchy: nestedFieldHierarchy,
        field: nestedFieldHierarchy.field,
        record: item.value.members[nestedFieldHierarchy.field.name],
      });

      // remove the old member and insert all destructured new members
      delete item.value.members[nestedFieldHierarchy.field.name];
      destructuredMembers.forEach((destructuredMember) => {
        assert(item.value.valueFormat === PropertyValueFormat.Struct);
        item.value.members[destructuredMember.field.name] = destructuredMember.record;
      });

      // store new members. all items are expected to have the same members, so only need to do this once
      if (index === 0)
        destructuredMembers.forEach((destructuredMember) => destructuredFields.push(destructuredMember.fieldHierarchy));
    });
  });

  // if we got a chance to destructure at least one item, replace old members with new ones
  // in the field hierarchy that we got
  if (items.length > 0)
    fieldHierarchy.childFields = destructuredFields;
}

function destructureRecords(records: Array<FieldRecord & { fieldHierarchy: StrictFieldHierarchy }>) {
  let i = 0;
  while (i < records.length) {
    const entry = records[i];

    if (entry.record.value.valueFormat === PropertyValueFormat.Array && shouldDestructureArrayField(entry.field)) {
      if (shouldDestructureStructField(entry.field, 1)) {
        // destructure individual array items
        destructureStructArrayItems(entry.record.value.items, entry.fieldHierarchy);
      }

      // destructure 0 or 1 sized arrays by removing the array record and putting its first item in its place (if any)
      if (entry.record.value.items.length <= 1) {
        records.splice(i, 1);
        if (entry.record.value.items.length > 0) {
          const item = entry.record.value.items[0];
          records.splice(i, 0, { ...entry, fieldHierarchy: entry.fieldHierarchy, record: item });
        }
        continue;
      }
    }

    if (entry.record.value.valueFormat === PropertyValueFormat.Struct && shouldDestructureStructField(entry.field, records.length)) {
      // destructure structs by replacing them with their member records
      const members = entry.fieldHierarchy.childFields.reduce((list, nestedFieldHierarchy) => {
        assert(entry.record.value.valueFormat === PropertyValueFormat.Struct);
        assert(entry.record.value.members[nestedFieldHierarchy.field.name] !== undefined);
        const member = {
          fieldHierarchy: nestedFieldHierarchy,
          field: nestedFieldHierarchy.field,
          record: entry.record.value.members[nestedFieldHierarchy.field.name],
        };
        list.push(...destructureStructMember(member));
        return list;
      }, new Array<FieldRecord & { fieldHierarchy: StrictFieldHierarchy }>());
      records.splice(i, 1, ...members);
      continue;
    }

    ++i;
  }

  // lastly, when there's only one record in the list and it's an array that we want destructured, set the `hideCompositePropertyLabel`
  // attribute so only the items are rendered
  if (records.length === 1 && records[0].record.value.valueFormat === PropertyValueFormat.Array && shouldDestructureArrayField(records[0].field)) {
    records[0].record.property.hideCompositePropertyLabel = true;
  }
}

function findRelatedFields(rootFields: StrictFieldHierarchy[], hierarchy: StrictFieldHierarchy) {
  // build a list of parent fields in hierarchy
  const fields: Field[] = [];
  let currField: Field | undefined = hierarchy.field;
  while (currField) {
    fields.push(currField);
    currField = currField.parent;
  }

  for (let rootIndex = 0; rootIndex < rootFields.length; ++rootIndex) {
    const rootFieldHierarchy = rootFields[rootIndex];
    if (rootFieldHierarchy.field.category !== hierarchy.field.category) {
      // only interested in fields with the same category
      continue;
    }

    let first = true;
    currField = rootFieldHierarchy.field;
    while (currField) {
      const index = fields.findIndex((f) => f.name === currField!.name);
      if (-1 !== index) {
        return {
          existing: {
            field: currField,
            hierarchy: first ? rootFieldHierarchy : undefined,
            index: rootIndex,
          },
          matchingField: fields[index]!,
        };
      }
      currField = currField.parent;
      first = false;
    }
  }

  return undefined;
}

function buildParentHierarchy(hierarchy: StrictFieldHierarchy, parentField: Field) {
  // note: parentField is found by walking up the parentship relationship
  // from hierarchy.field, so we expect to always find it here
  while (hierarchy.field !== parentField) {
    const hierarchyParent = hierarchy.field.parent;
    assert(hierarchyParent !== undefined);
    hierarchy = { field: hierarchyParent, childFields: [hierarchy] };
  }
  return hierarchy;
}

function mergeHierarchies(lhs: StrictFieldHierarchy, rhs: StrictFieldHierarchy) {
  assert(lhs.field.name === rhs.field.name);
  const result: StrictFieldHierarchy = {
    field: lhs.field.clone(),
    childFields: [...lhs.childFields],
  };
  rhs.childFields.forEach((rhsChildHierarchy) => {
    const indexInResult = result.childFields.findIndex((resultHierarchy) => resultHierarchy.field.name === rhsChildHierarchy.field.name);
    if (indexInResult !== -1)
      result.childFields[indexInResult] = mergeHierarchies(result.childFields[indexInResult], rhsChildHierarchy);
    else
      result.childFields.push(rhsChildHierarchy);
  });
  return result;
}

function tryGroupingWithRelatedFields(rootHierarchies: StrictFieldHierarchy[], hierarchy: StrictFieldHierarchy): boolean {
  const match = findRelatedFields(rootHierarchies, hierarchy);
  if (!match)
    return false;

  const targetHierarchy = rootHierarchies[match.existing.index];
  const existingHierarchy = match.existing.hierarchy ?? buildParentHierarchy(targetHierarchy, match.existing.field);
  const insertHierarchy = buildParentHierarchy(hierarchy, match.matchingField);
  const mergedHierarchy = mergeHierarchies(existingHierarchy, insertHierarchy);
  mergedHierarchy.field.category = hierarchy.field.category;
  if (mergedHierarchy.field.category.expand && mergedHierarchy.field.isNestedContentField())
    mergedHierarchy.field.autoExpand = true;
  rootHierarchies[match.existing.index] = mergedHierarchy;
  return true;
}

function traverseFieldHierarchy(hierarchy: StrictFieldHierarchy, cb: (h: StrictFieldHierarchy) => boolean) {
  if (cb(hierarchy))
    hierarchy.childFields.forEach((childHierarchy) => traverseFieldHierarchy(childHierarchy, cb));
}
