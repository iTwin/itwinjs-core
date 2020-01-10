/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module PropertyGrid */

import { BeEvent, Id64String } from "@bentley/bentleyjs-core";
import { PropertyRecord, IModelConnection } from "@bentley/imodeljs-frontend";

/**
 * Contains metadata about a group of Properties.
 * @public
 */
export interface PropertyCategory {
  name: string;
  label: string;
  expand: boolean;
}

/**
 * Interface for property data provided to the PropertyGrid React component.
 * @public
 */
export interface PropertyData {
  label: string | PropertyRecord;
  description?: string;
  categories: PropertyCategory[];
  records: { [categoryName: string]: PropertyRecord[] };
}

/** A signature for property data change listeners
 * @public
 */
export declare type PropertyDataChangesListener = () => void;

/** An event broadcasted on property data changes
 * @public
 */
export class PropertyDataChangeEvent extends BeEvent<PropertyDataChangesListener> { }

/**
 * An interface for property data provider which returns
 * property data and broadcasts an event when the data changes
 * @public
 */
export interface IPropertyDataProvider {
  /** Returns property data. */
  getData: (() => Promise<PropertyData>);
  /** Property data change event. */
  onDataChanged: PropertyDataChangeEvent;
}

/**
 * An interface for element property data provider which returns
 * property data for the provided iModel element
 * @beta
 */
export interface IElementPropertyDataProvider {
  /** Returns property data. */
  getData: (imodel: IModelConnection, elementId: Id64String) => Promise<PropertyData>;
}
