/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PropertyGrid
 */

import { BeEvent } from "@bentley/bentleyjs-core";
import { PropertyRecord } from "@bentley/ui-abstract";

/**
 * Data structure for storing IPropertyDataFilterer matching results
 * @alpha
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
  matchesCount?: { label?: number, value?: number };
}

/**
 * A signature for property data change listeners
 * @alpha
 */
export declare type PropertyFilterChangesListener = () => void;

/**
 * An event broadcasted when property filter changes
 * @alpha
 */
export class PropertyFilterChangeEvent extends BeEvent<PropertyFilterChangesListener> { }

/**
 * Interface to be implemented by Property Data Filter classes
 * @alpha
 */
export interface IPropertyDataFilterer {
  readonly isActive: boolean;
  matchesFilter: (node: PropertyRecord, parents: PropertyRecord[]) => Promise<PropertyDataFilterResult>;
  onFilterChanged: PropertyFilterChangeEvent;
}

/**
 * PropertyDataFilter base which helps implement common logic between all IPropertyDataFilterer
 * @alpha
 */
export abstract class PropertyDataFiltererBase implements IPropertyDataFilterer {
  public onFilterChanged: PropertyFilterChangeEvent = new PropertyFilterChangeEvent();
  public abstract get isActive(): boolean;
  public abstract async matchesFilter(node: PropertyRecord, parents: PropertyRecord[]): Promise<PropertyDataFilterResult>;
}
