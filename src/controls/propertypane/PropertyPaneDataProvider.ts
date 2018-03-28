/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "@bentley/bentleyjs-core";
import { IModelToken } from "@bentley/imodeljs-common";
import ContentDataProvider from "../common/ContentDataProvider";
import ContentBuilder, { PropertyRecord } from "../common/ContentBuilder";
import * as content from "@bentley/ecpresentation-common/lib/content";
import { KeySet } from "@bentley/ecpresentation-common";

let favoritesCategory: content.CategoryDescription | undefined;
function getFavoritesCategory(): content.CategoryDescription {
  if (undefined === favoritesCategory) {
    favoritesCategory = {
      name: "Favorite",
      label: "Favorite",
      description: "",
      priority: Number.MAX_VALUE,
      expand: true,
    } as content.CategoryDescription;
  }
  return favoritesCategory;
}

function prioritySortFunction(a: any, b: any): number {
  if (a.priority > b.priority)
    return -1;
  if (a.priority < b.priority)
    return 1;
  return 0;
}

export type CategoriesSortHandler = (a: content.CategoryDescription, b: content.CategoryDescription) => number;
export type FieldsSortHandler = (a: content.Field, b: content.Field) => number;
type FieldPredicate = (field: content.Field) => boolean;
type FieldsSortHandlerSupplier = (a: content.CategoryDescription) => FieldsSortHandler;

class CategoryFields {
  private _categories: content.CategoryDescription[];
  private _fields: { [categoryName: string]: content.Field[] };

  constructor(c: content.Content | undefined, includeFieldsWithNoValues: boolean, isFieldFavorite?: FieldPredicate, isFieldHidden?: FieldPredicate,
    categoriesSortHandler?: CategoriesSortHandler, fieldsSortFunctionSupplier?: FieldsSortHandlerSupplier) {
    this._categories = [];
    this._fields = {};

    if (!c)
      return;

    const fields = c.descriptor.fields;
    for (const field of fields) {
      if (getFavoritesCategory().name !== field.category.name && isFieldFavorite && isFieldFavorite(field))
        this.includeField(getFavoritesCategory(), field);

      if (isFieldHidden && isFieldHidden(field))
        continue;

      if (!includeFieldsWithNoValues) {
        if (0 === c.contentSet.length)
          continue;

        const fieldValue = c.contentSet[0].values[field.name];
        if (undefined === fieldValue || "" === fieldValue)
          continue;
      }

      this.includeField(field.category, field);
    }

    // sort categories by priority
    this._categories.sort(categoriesSortHandler ? categoriesSortHandler : prioritySortFunction);

    // sort fields by priority
    for (const category of this._categories) {
      const sortFunction = fieldsSortFunctionSupplier ? fieldsSortFunctionSupplier(category) : undefined;
      this._fields[category.name].sort(sortFunction ? sortFunction : prioritySortFunction);
    }
  }

  private includeField(category: content.CategoryDescription, field: content.Field): void {
    if (!this._fields.hasOwnProperty(category.name)) {
      this._categories.push(category);
      this._fields[category.name] = new Array<content.Field>();
    }
    this._fields[category.name].push(field);
  }

  public getCategoryCount(): number { return this._categories.length; }
  public getCategory(index: number): content.CategoryDescription { return this._categories[index]; }
  public getFieldCount(category: content.CategoryDescription): number { return this._fields[category.name].length; }
  public getField(category: content.CategoryDescription, fieldIndex: number): content.Field { return this._fields[category.name][fieldIndex]; }
}

export interface PropertyCategory {
  name: string;
  label: string;
  expand: boolean;
}

export default class PropertyPaneDataProvider extends ContentDataProvider {
  private _categorizedFields: CategoryFields | undefined;
  private _includeFieldsWithNoValues: boolean;
  private _favorites: { [name: string]: boolean };
  private _keys: Readonly<KeySet>;

  /** Constructor. */
  constructor(imodelToken: IModelToken, rulesetId: string) {
    super(imodelToken, rulesetId, content.DefaultContentDisplayTypes.PROPERTY_PANE);
    this._includeFieldsWithNoValues = true;
    this._favorites = {};
    this._keys = new KeySet();
  }

  public get keys() { return this._keys; }
  public set keys(keys: Readonly<KeySet>) {
    this._keys = keys;
    this.invalidateCache();
  }

  protected configureContentDescriptor(descriptor: Readonly<content.Descriptor>): content.Descriptor {
    const configured = super.configureContentDescriptor(descriptor);
    configured.contentFlags |= content.ContentFlags.ShowLabels;
    return configured;
  }

  protected invalidateContentCache(invalidateContentSetSize: boolean): void {
    super.invalidateContentCache(invalidateContentSetSize);
    this._categorizedFields = undefined;
  }

  protected shouldExcludeFromDescriptor(field: content.Field): boolean { return this.isFieldHidden(field) && !this.isFieldFavorite(field); }

  public get includeFieldsWithNoValues(): boolean { return this._includeFieldsWithNoValues; }
  public set includeFieldsWithNoValues(value: boolean) {
    this._includeFieldsWithNoValues = value;
    this.invalidateContentCache(false);
  }

  /** Is the specified field in the favorites list.
   * @note Subclasses may override this method to make fields favorite based on their own
   * criteria - in that case @ref AddFavorite and @ref RemoveFavorite do nothing.
   */
  public isFieldFavorite(field: content.Field): boolean { return this._favorites.hasOwnProperty(field.name); }

  /** Gets an array of fields with "favorite" flag. */
  public getFavorites(): string[] {
    const arr = new Array<string>();
    for (const key in this._favorites)
      arr.push(key);
    return arr;
  }

  /** Adds the specified field into favorites list. */
  public addFavorite(fieldName: string): void {
    this._favorites[fieldName] = true;
    this.invalidateContentCache(false);
  }

  /** Removes the specified field from favorites list. */
  public removeFavorite(fieldName: string): void {
    delete this._favorites[fieldName];
    this.invalidateContentCache(false);
  }

  /** Clears the favorite properties list. */
  public resetFavorites(): void {
    this._favorites = {};
    this.invalidateContentCache(false);
  }

  protected supplyCategoriesSortFunction(): CategoriesSortHandler { return prioritySortFunction; }
  protected supplyFieldsSortFunction(_category: content.CategoryDescription): FieldsSortHandler { return prioritySortFunction; }

  private async getCategoryFields(): Promise<CategoryFields> {
    if (!this._categorizedFields) {
      const c = await this.getContent(this._keys, undefined, { pageStart: 0, pageSize: 0 });
      this._categorizedFields = new CategoryFields(c, this.includeFieldsWithNoValues,
        (field) => this.isFieldFavorite(field), (field) => this.isFieldHidden(field),
        this.supplyCategoriesSortFunction(), (category: content.CategoryDescription) => this.supplyFieldsSortFunction(category));
    }
    return this._categorizedFields;
  }

  public async getCategoryCount(): Promise<number> {
    const cf = await this.getCategoryFields();
    return cf.getCategoryCount();
  }

  public async getCategory(index: number): Promise<PropertyCategory> {
    const cf = await this.getCategoryFields();
    const category = cf.getCategory(index);
    return {
      name: category.name,
      label: category.label,
      expand: category.expand,
    };
  }

  public async getPropertyCount(categoryIndex: number): Promise<number> {
    const cf = await this.getCategoryFields();
    const category = cf.getCategory(categoryIndex);
    return cf.getFieldCount(category);
  }

  public async getProperty(categoryIndex: number, propertyIndex: number): Promise<PropertyRecord> {
    const cf = await this.getCategoryFields();
    const category = cf.getCategory(categoryIndex);
    const field = cf.getField(category, propertyIndex);
    const item = await this.getContentItem();
    return item ? ContentBuilder.createPropertyRecord(field, item) : ContentBuilder.createInvalidPropertyRecord();
  }

  public async getContentItem(): Promise<content.Item | undefined> {
    const c = await this.getContent(this._keys, undefined, { pageStart: 0, pageSize: 0 });
    if (c.contentSet.length === 0)
      return undefined;

    assert(c.contentSet.length === 1, "Expecting the number of records to be exactly 1");
    return c.contentSet[0];
  }
}
