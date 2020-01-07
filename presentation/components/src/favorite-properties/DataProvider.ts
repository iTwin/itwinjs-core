/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module FavoriteProperties */

import * as _ from "lodash";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { CategoryDescription } from "@bentley/presentation-common";
import { IElementPropertyDataProvider, PropertyData } from "@bentley/ui-components";
import { Presentation, getScopeId } from "@bentley/presentation-frontend";
import { translate } from "../common/Utils";
import { PresentationPropertyDataProvider } from "../propertygrid/DataProvider";

const favoritesCategoryName = "Favorite";
let favoritesCategoryPromise: Promise<CategoryDescription> | undefined;

/** @internal */
export const getFavoritesCategory = async (): Promise<CategoryDescription> => {
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

/** @beta */
export interface FavoritePropertiesDataProviderProps {
  /** @internal */
  propertyDataProviderFactory?: (imodel: IModelConnection, rulesetId?: string) => PresentationPropertyDataProvider;
}

/**
 * Presentation Rules-driven element favorite properties data provider implementation.
 * @beta
 */
export class FavoritePropertiesDataProvider implements IElementPropertyDataProvider {

  /**
   * Should fields with no values be included in the property list. No value means:
   * - For *primitive* fields: null, undefined, "" (empty string)
   * - For *array* fields: [] (empty array)
   * - For *struct* fields: {} (object with no members)
   */
  public includeFieldsWithNoValues: boolean;

  /**
   * Should fields with composite values be included in the property list.
   * Fields with composite values:
   * - *array* fields.
   * - *struct* fields.
   */
  public includeFieldsWithCompositeValues: boolean;

  /**
   * ID of a custom ruleset to use when requesting properties.
   */
  public customRulesetId: string | undefined;

  private _propertyDataProviderFactory: (imodel: IModelConnection, rulesetId?: string) => PresentationPropertyDataProvider;

  /** Constructor. */
  constructor(props?: FavoritePropertiesDataProviderProps) {
    this.includeFieldsWithNoValues = true;
    this.includeFieldsWithCompositeValues = true;
    this._propertyDataProviderFactory = props && props.propertyDataProviderFactory ?
      props.propertyDataProviderFactory : /* istanbul ignore next */
      (imodel: IModelConnection, rulesetId?: string) => new PresentationPropertyDataProvider(imodel, rulesetId);
  }

  /**
   * Returns PropertyData for the specified element.
   * PropertyData only contains a single category for favorite properties (if there are any).
   */
  public async getData(imodel: IModelConnection, elementId: string): Promise<PropertyData> {
    const key = await Presentation.selection.scopes.computeSelection(
      imodel,
      elementId,
      getScopeId(Presentation.selection.scopes.activeScope));

    const propertyDataProvider = this._propertyDataProviderFactory(imodel, this.customRulesetId);
    propertyDataProvider.keys = key;
    propertyDataProvider.includeFieldsWithNoValues = this.includeFieldsWithNoValues;
    propertyDataProvider.includeFieldsWithCompositeValues = this.includeFieldsWithCompositeValues;
    const propertyData = await propertyDataProvider.getData();

    // leave only favorite properties
    const favoritesCategory = await getFavoritesCategory();
    propertyData.categories = propertyData.categories.filter((c) => c.name === favoritesCategory.name);
    propertyData.records = propertyData.records.hasOwnProperty(favoritesCategory.name) ?
      { [favoritesCategory.name]: propertyData.records[favoritesCategory.name] } : {};

    return propertyData;
  }
}
