/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PropertyGrid
 */

import type { PropertyRecord } from "@itwin/appui-abstract";
import { BeEvent } from "@itwin/core-bentley";

/**
 * Contains metadata about a group of Properties.
 * @public
 */
export interface PropertyCategory {
  name: string;
  label: string;
  expand: boolean;
  childCategories?: PropertyCategory[];
  renderer?: {
    name: string;
  };
}

/**
 * Interface for property data provided to the PropertyGrid React component.
 * @public
 */
export interface PropertyData {
  label: PropertyRecord;
  description?: string;
  categories: PropertyCategory[];
  records: { [categoryName: string]: PropertyRecord[] };

  /**
   * Should state of existing property data in the component be  re-used for this property data
   * @alpha
   */
  reusePropertyDataState?: boolean;
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
