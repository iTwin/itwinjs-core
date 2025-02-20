/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/no-deprecated */
/** @packageDocumentation
 * @module UnifiedSelection
 */

import { BeEvent } from "@itwin/core-bentley";
import { IModelConnection } from "@itwin/core-frontend";
import { KeySet } from "@itwin/presentation-common";
import { ISelectionProvider } from "./ISelectionProvider";

/**
 * An interface for selection change listeners.
 * @public
 * @deprecated in 5.0. Use `StorageSelectionChangesListener` from [@itwin/unified-selection](https://github.com/iTwin/presentation/blob/master/packages/unified-selection/README.md) package instead.
 */
export declare type SelectionChangesListener = (args: SelectionChangeEventArgs, provider: ISelectionProvider) => void;

/**
 * An event broadcasted on selection changes
 * @public
 * @deprecated in 5.0. Use `Event<StorageSelectionChangesListener>` from [@itwin/unified-selection](https://github.com/iTwin/presentation/blob/master/packages/unified-selection/README.md) package instead.
 */
export class SelectionChangeEvent extends BeEvent<SelectionChangesListener> {}

/**
 * The type of selection change
 * @public
 * @deprecated in 5.0. Use `StorageSelectionChangeType` from [@itwin/unified-selection](https://github.com/iTwin/presentation/blob/master/packages/unified-selection/README.md) package instead.
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
 * @deprecated in 5.0. Use `StorageSelectionChangeEventArgs` from [@itwin/unified-selection](https://github.com/iTwin/presentation/blob/master/packages/unified-selection/README.md) package instead.
 */
export interface SelectionChangeEventArgs {
  /** The name of the selection source which caused the selection change. */
  source: string;

  /** Level of the selection. See [selection levels documentation section]($docs/presentation/unified-selection/index#selection-levels). */
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
