/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PropertyGrid
 */
import { IModelConnection } from "@itwin/core-frontend";
import { Field } from "@itwin/presentation-common";
import { FavoritePropertiesScope, Presentation } from "@itwin/presentation-frontend";
import { PropertyRecord } from "@itwin/appui-abstract";
import { PropertyDataFiltererBase, PropertyDataFilterResult } from "@itwin/components-react";
import { IPresentationPropertyDataProvider } from "../../presentation-components/propertygrid/DataProvider";

/**
 * Props for [[FavoritePropertiesDataFilterer]].
 * @beta
 */
export interface FavoritePropertiesDataFiltererProps {
  /** Source properties data provider */
  source: IPresentationPropertyDataProvider;

  /** Scope used to determine favorite properties */
  favoritesScope: FavoritePropertiesScope;

  /** Should the filterer become active when created. */
  isActive?: boolean;

  /** Callback to check whether a property is favorite or not */
  isFavorite?: (field: Field, imodel: IModelConnection, scope: FavoritePropertiesScope) => boolean;
}

/**
 * [[IPropertyDataFilterer]] implementation which filters favorite properties
 * @beta
 */
export class FavoritePropertiesDataFilterer extends PropertyDataFiltererBase {
  private _source: IPresentationPropertyDataProvider;
  private _favoritesScope: FavoritePropertiesScope;
  private _favoritesCheckCallback: (field: Field, imodel: IModelConnection, scope: FavoritePropertiesScope) => boolean;
  private _isActive: boolean;

  public constructor(props: FavoritePropertiesDataFiltererProps) {
    super();
    this._source = props.source;
    this._favoritesScope = props.favoritesScope;
    this._isActive = props.isActive ?? false;
    this._favoritesCheckCallback = props.isFavorite ?? defaultFavoritePropertyCheckCallback;
  }

  /** Is this filterer currently active */
  public get isActive() { return this._isActive; }
  public set isActive(value: boolean) {
    if (value !== this._isActive) {
      this._isActive = value;
      this.onFilterChanged.raiseEvent();
    }
  }

  private async isFavorite(record: PropertyRecord): Promise<boolean> {
    const field = await this._source.getFieldByPropertyRecord(record);
    return !!field && this._favoritesCheckCallback(field, this._source.imodel, this._favoritesScope);
  }

  public async recordMatchesFilter(node: PropertyRecord, parents: PropertyRecord[]): Promise<PropertyDataFilterResult> {
    if (!this.isActive)
      return { matchesFilter: true };

    // If one of the parents is favorite, we don't want to expand to this node, because the parent has already matched and expanded
    const anyParentFavorite = (await Promise.all(parents.map(async (parent) => this.isFavorite(parent)))).some((isParentFavorite) => isParentFavorite);
    if (anyParentFavorite)
      return { matchesFilter: true };

    // If none of the parents is favorite, but provided node is, then we want to expand up to this match
    const isFavorite = await this.isFavorite(node);
    if (isFavorite)
      return { matchesFilter: true, shouldExpandNodeParents: true };

    return { matchesFilter: false };
  }

  public async categoryMatchesFilter(): Promise<PropertyDataFilterResult> {
    return { matchesFilter: !this.isActive };
  }
}

function defaultFavoritePropertyCheckCallback(field: Field, imodel: IModelConnection, scope: FavoritePropertiesScope) {
  return Presentation.favoriteProperties.has(field, imodel, scope);
}
