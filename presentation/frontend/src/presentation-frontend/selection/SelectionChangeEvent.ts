/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module UnifiedSelection
 */

import { BeEvent } from "@itwin/core-bentley";
import type { IModelConnection } from "@itwin/core-frontend";
import type { KeySet } from "@itwin/presentation-common";
import type { ISelectionProvider } from "./ISelectionProvider";

/**
 * An interface for selection change listeners.
 * @public
 */
export declare type SelectionChangesListener = (args: SelectionChangeEventArgs, provider: ISelectionProvider) => void;

/**
 * An event broadcasted on selection changes
 * @public
 */
export class SelectionChangeEvent extends BeEvent<SelectionChangesListener> { }

/**
 * The type of selection change
 * @public
 */
export enum SelectionChangeType {
  /** Added to selection. */
  Add,

  /** Removed from selection. */
  Remove,

  /** Selection was replaced. */
  Replace,

  /** Selection was cleared. */
  Clear,
}

/**
 * The event object that's sent when the selection changes.
 * @public
 */
export interface SelectionChangeEventArgs {
  /** The name of the selection source which caused the selection change. */
  source: string;

  /** Level of the selection. See [selection levels]($docs/presentation/Unified-Selection/index#selection-levels). */
  level: number;

  /** The selection change type. */
  changeType: SelectionChangeType;

  /** Set of keys affected by this selection change event. */
  keys: Readonly<KeySet>;

  /** iModel connection with which the selection is associated with. */
  imodel: IModelConnection;

  /** The timestamp of when the selection change happened */
  timestamp: Date;

  /** Id of the ruleset associated with the selection change. */
  rulesetId?: string;
}
