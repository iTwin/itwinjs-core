/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import memoize = require("lodash/memoize");
import { IModelToken } from "@bentley/imodeljs-common";
import ContentDataProvider, { CacheInvalidationProps } from "../common/ContentDataProvider";
import ContentBuilder, { PropertyRecord, isValueEmpty, isArrayValue, isStructValue } from "../common/ContentBuilder";
import { KeySet, CategoryDescription, Descriptor, ContentFlags, Field, NestedContentField, DefaultContentDisplayTypes, Item } from "@bentley/ecpresentation-common";

let favoritesCategory: CategoryDescription | undefined;
function getFavoritesCategory(): CategoryDescription {
  if (undefined === favoritesCategory) {
    favoritesCategory = {
      name: "Favorite",
      label: "Favorite", // wip: localization
      description: "", // wip: localization
      priority: Number.MAX_VALUE,
      expand: true,
    } as CategoryDescription;
  }
  return favoritesCategory;
}

interface IPrioritized {
  priority: number;
}
function prioritySortFunction(a: IPrioritized, b: IPrioritized): number {
  if (a.priority > b.priority)
    return -1;
  if (a.priority < b.priority)
    return 1;
  return 0;
}

interface PropertyPaneCallbacks {
  isFavorite(field: Field): boolean;
  isHidden(field: Field): boolean;
  sortCategories(categories: CategoryDescription[]): void;
  sortFields(category: CategoryDescription, fields: Field[]): void;
}

interface CategorizedFields {
  categories: CategoryDescription[];
  fields: { [categoryName: string]: Field[] };
}

export interface PropertyCategory {
  name: string;
  label: string;
  expand: boolean;
}

export interface CategorizedRecords {
  categories: PropertyCategory[];
  records: { [categoryName: string]: PropertyRecord[] };
}

export interface PropertyPaneData extends CategorizedRecords {
  label: string;
  description?: string;
}

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

  private createCategorizedFields(): CategorizedFields {
    const categories = new Array<CategoryDescription>();
    const fields: { [categoryName: string]: Field[] } = {};
    const includeField = (category: CategoryDescription, field: Field) => {
      if (!fields.hasOwnProperty(category.name)) {
        categories.push(category);
        fields[category.name] = new Array<Field>();
      }
      fields[category.name].push(field);
    };

    for (const field of this._descriptor.fields) {
      if (getFavoritesCategory().name !== field.category.name && this._callbacks.isFavorite(field))
        includeField(getFavoritesCategory(), field);
      includeField(field.category, field);
    }

    // sort categories
    this._callbacks.sortCategories(categories);

    // sort fields
    for (const category of categories) {
      const categoryFields = fields[category.name];
      if (categoryFields && categoryFields.length > 0)
        this._callbacks.sortFields(category, categoryFields);
    }

    return {
      categories,
      fields,
    } as CategorizedFields;
  }

  private createRecord(field: Field): PropertyRecord {
    let pathToRootField: Field[] | undefined;
    if (field.parent) {
      pathToRootField = [field];
      let parentField = field.parent;
      while (parentField.parent) {
        pathToRootField.push(parentField);
        parentField = parentField.parent;
      }
      field = parentField;
      pathToRootField.reverse();
    }
    return ContentBuilder.createPropertyRecord(field, this._contentItem, pathToRootField);
  }

  private createCategorizedRecords(fields: CategorizedFields): CategorizedRecords {
    const result: CategorizedRecords = {
      categories: [],
      records: {},
    };
    for (const category of fields.categories) {
      const records = new Array<PropertyRecord>();
      const addRecord = (field: Field, record: PropertyRecord) => {
        if (!record.value)
          return;
        if (category.name !== getFavoritesCategory().name) {
          // note: favorite fields should be displayed even if they're hidden
          if (this._callbacks.isHidden(field))
            return;
          if (!this._includeWithNoValues && !record.isMerged && isValueEmpty(record.value))
            return;
        }
        records.push(record);
      };
      const handleNestedContentRecord = (field: NestedContentField, record: PropertyRecord) => {
        if (1 === fields.fields[category.name].length) {
          // note: special handling if this is the only field in the category
          if (isArrayValue(record.value)) {
            if (0 === record.value.items.length) {
              // don't include empty arrays at all
              return;
            }
            if (1 === record.value.items.length) {
              // for single element arrays just include the first item
              record = record.value.items[0];
            }
          }
          if (isStructValue(record.value)) {
            // for structs just include all their members
            for (const nestedField of field.nestedFields)
              addRecord(nestedField, record.value.members[nestedField.name]);
            return;
          }
        }
        addRecord(field, record);
      };

      // create/add records for each field
      for (const field of fields.fields[category.name]) {
        const record = this.createRecord(field);
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

  public buildPropertyData(): PropertyPaneData {
    const fields = this.createCategorizedFields();
    const records = this.createCategorizedRecords(fields);
    return {
      ...records,
      label: this._contentItem.label,
      description: this._contentItem.classInfo ? this._contentItem.classInfo.label : undefined,
    } as PropertyPaneData;
  }
}

export default class PropertyPaneDataProvider extends ContentDataProvider {
  private _includeFieldsWithNoValues: boolean;
  private _keys: Readonly<KeySet>;

  /** Constructor. */
  constructor(imodelToken: IModelToken, rulesetId: string) {
    super(imodelToken, rulesetId, DefaultContentDisplayTypes.PROPERTY_PANE);
    this._includeFieldsWithNoValues = true;
    this._keys = new KeySet();
  }

  public get keys() { return this._keys; }
  public set keys(keys: Readonly<KeySet>) {
    this._keys = keys;
    this.invalidateCache({ descriptor: true, size: true, content: true });
  }

  protected configureContentDescriptor(descriptor: Readonly<Descriptor>): Descriptor {
    const configured = super.configureContentDescriptor(descriptor);
    configured.contentFlags |= ContentFlags.ShowLabels;
    return configured;
  }

  protected invalidateCache(props: CacheInvalidationProps): void {
    if (this.getData)
      this.getData.cache.clear();
    super.invalidateCache(props);
  }

  protected shouldExcludeFromDescriptor(field: Field): boolean { return this.isFieldHidden(field) && !this.isFieldFavorite(field); }

  public get includeFieldsWithNoValues(): boolean { return this._includeFieldsWithNoValues; }
  public set includeFieldsWithNoValues(value: boolean) {
    this._includeFieldsWithNoValues = value;
    this.invalidateCache({ content: true });
  }

  /** Is the specified field in the favorites list. */
  protected isFieldFavorite(_field: Field): boolean { return false; }

  protected sortCategories(categories: CategoryDescription[]): void {
    categories.sort(prioritySortFunction);
  }

  protected sortFields(_category: CategoryDescription, fields: Field[]): void {
    fields.sort(prioritySortFunction);
  }

  public getData: _.MemoizedFunction = memoize(async (): Promise<PropertyPaneData> => {
    const content = await this.getContent(this._keys);
    if (!content || 0 === content.contentSet.length)
      throw new Error("No content");

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
}
