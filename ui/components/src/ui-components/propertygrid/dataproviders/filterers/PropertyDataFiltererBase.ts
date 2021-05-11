/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PropertyGrid
 */

import { BeEvent } from "@bentley/bentleyjs-core";
import { PropertyRecord } from "@bentley/ui-abstract";
import { PropertyCategory } from "../../PropertyDataProvider";

/**
 * Enumeration of possible component filtered types
 * @beta
 */
export enum FilteredType {
  Category,
  Label,
  Value
}

/**
 * Data structure for storing IPropertyDataFilterer matching results
 * @beta
 */
export interface PropertyDataFilterResult {
  /** Indicates whether provided item matched filter */
  matchesFilter: boolean;

  /**
   * Indicates whether descendants nodes should be forcefully included in filtered results.
   * Can only be true for nodes that have `matchesFilter` set to true.
   */
  shouldForceIncludeDescendants?: boolean;

  /**
   * Indicates whether parents of node should be expanded up to this match node.
   * Can only be true for nodes that have `matchesFilter` set to true.
   */
  shouldExpandNodeParents?: boolean;

  /**
   * Indicates how many times filter was matched in the provided item.
   */
  matchesCount?: number;

  /**
   * Indicates what item types were matched.
   */
  filteredTypes?: FilteredType[];
}

/**
 * A signature for property data change listeners
 * @beta
 */
export declare type PropertyFilterChangesListener = () => void;

/**
 * An event broadcasted when property filter changes
 * @beta
 */
export class PropertyFilterChangeEvent extends BeEvent<PropertyFilterChangesListener> { }

/**
 * Interface to be implemented by Property Data Filter classes
 * @beta
 */
export interface IPropertyDataFilterer {
  readonly isActive: boolean;
  recordMatchesFilter: (node: PropertyRecord, parents: PropertyRecord[]) => Promise<PropertyDataFilterResult>;
  categoryMatchesFilter: (node: PropertyCategory, parents: PropertyCategory[]) => Promise<PropertyDataFilterResult>;
  onFilterChanged: PropertyFilterChangeEvent;
}

/**
 * PropertyDataFilter base which helps implement common logic between all IPropertyDataFilterer
 * @beta
 */
export abstract class PropertyDataFiltererBase implements IPropertyDataFilterer {
  public onFilterChanged: PropertyFilterChangeEvent = new PropertyFilterChangeEvent();
  public abstract get isActive(): boolean;
  public abstract recordMatchesFilter(node: PropertyRecord, parents: PropertyRecord[]): Promise<PropertyDataFilterResult>;
  public abstract categoryMatchesFilter(node: PropertyCategory, parents: PropertyCategory[]): Promise<PropertyDataFilterResult>;
}
/**
 * PropertyDataFilter base which is suited for only Category filtering
 * @beta
 */
export abstract class PropertyCategoryDataFiltererBase extends PropertyDataFiltererBase {
  public async recordMatchesFilter(): Promise<PropertyDataFilterResult> {
    return { matchesFilter: !this.isActive };
  }
}
/**
 * PropertyDataFilter base which is suited for only Record filtering
 * @beta
 */
export abstract class PropertyRecordDataFiltererBase extends PropertyDataFiltererBase {
  public async categoryMatchesFilter(): Promise<PropertyDataFilterResult> {
    return { matchesFilter: !this.isActive };
  }
}
