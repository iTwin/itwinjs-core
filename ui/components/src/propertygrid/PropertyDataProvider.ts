/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module PropertyGrid */

import { BeEvent } from "@bentley/bentleyjs-core";
import { PropertyRecord } from "../properties";

/**
 * Contains metadata about a group of Properties.
 */
export interface PropertyCategory {
  name: string;
  label: string;
  expand: boolean;
}

/**
 * Interface for property data provided to the PropertyGrid React component.
 */
export interface PropertyData {
  label: string;
  description?: string;
  categories: PropertyCategory[];
  records: { [categoryName: string]: PropertyRecord[] };
}

/** A signature for property data change listeners */
export declare type PropertyDataChangesListener = () => void;

/** An event broadcasted on property data changes */
export class PropertyDataChangeEvent extends BeEvent<PropertyDataChangesListener> { }

/**
 * An interface for property data provider which returns
 * property data and broadcasts an event when the data changes
 */
export interface PropertyDataProvider {
  getData: (() => Promise<PropertyData>);
  onDataChanged: PropertyDataChangeEvent;
}
