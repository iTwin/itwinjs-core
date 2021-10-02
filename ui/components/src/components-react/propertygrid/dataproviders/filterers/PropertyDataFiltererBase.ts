/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PropertyGrid
 */

import { PropertyRecord } from "@itwin/appui-abstract";
import { BeEvent } from "@itwin/core-bentley";
import { PropertyCategory } from "../../PropertyDataProvider";

/**
 * Enumeration of possible component filtered types
 * @public
 */
export enum FilteredType {
  Category,
  Label,
  Value
}

/**
 * Data structure for storing [[IPropertyDataFilterer]] matching results
 * @public
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
 * @public
 */
export declare type PropertyFilterChangesListener = () => void;

/**
 * An event broadcasted when property filter changes
 * @public
 */
export class PropertyFilterChangeEvent extends BeEvent<PropertyFilterChangesListener> { }

/**
 * An interface for a filterer that filters [[PropertyData]] based on content of [[PropertyRecord]]
 * and [[PropertyCategory]] objects.
 * @public
 */
export interface IPropertyDataFilterer {
  readonly isActive: boolean;
  recordMatchesFilter: (node: PropertyRecord, parents: PropertyRecord[]) => Promise<PropertyDataFilterResult>;
  categoryMatchesFilter: (node: PropertyCategory, parents: PropertyCategory[]) => Promise<PropertyDataFilterResult>;
  onFilterChanged: PropertyFilterChangeEvent;
}

/**
 * An abstract implementation of [[IPropertyDataFilterer]] to share common behavior between different implementations.
 * @public
 */
export abstract class PropertyDataFiltererBase implements IPropertyDataFilterer {
  public onFilterChanged: PropertyFilterChangeEvent = new PropertyFilterChangeEvent();
  public abstract get isActive(): boolean;
  public abstract recordMatchesFilter(node: PropertyRecord, parents: PropertyRecord[]): Promise<PropertyDataFilterResult>;
  public abstract categoryMatchesFilter(node: PropertyCategory, parents: PropertyCategory[]): Promise<PropertyDataFilterResult>;
}

/**
 * An abstract implementation of [[IPropertyDataFilterer]] that can be used as base for all
 * filterers that filter based on [[PropertyCategory]] content.
 * @public
 */
export abstract class PropertyCategoryDataFiltererBase extends PropertyDataFiltererBase {
  public async recordMatchesFilter(): Promise<PropertyDataFilterResult> {
    return { matchesFilter: !this.isActive };
  }
}

/**
 * An abstract implementation of [[IPropertyDataFilterer]] that can be used as base for all
 * filterers that filter based on [[PropertyRecord]] content.
 * @public
 */
export abstract class PropertyRecordDataFiltererBase extends PropertyDataFiltererBase {
  public async categoryMatchesFilter(): Promise<PropertyDataFilterResult> {
    return { matchesFilter: !this.isActive };
  }
}
