/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module UnifiedSelection */

import { BeEvent } from "@bentley/bentleyjs-core";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { KeySet } from "@bentley/presentation-common";
import ISelectionProvider from "./ISelectionProvider";

/** An interface for selection change listeners */
export declare type SelectionChangesListener = (args: SelectionChangeEventArgs, provider: ISelectionProvider) => void;

/** An event broadcasted on selection changes */
export default class SelectionChangeEvent extends BeEvent<SelectionChangesListener> { }

/** The type of selection change */
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

/** The event object that's sent when the selection changes */
export interface SelectionChangeEventArgs {
  /** The name of the selection source which caused the selection change. */
  source: string;

  /** Level of the selection. */
  level: number;

  /** The selection change type. */
  changeType: SelectionChangeType;

  /** Set of keys affected by this selection change event. */
  keys: Readonly<KeySet>;

  /** iModel connection with which the selection is associated with. */
  imodel: IModelConnection;

  /** The timestamp of when the selection change happened */
  timestamp: Date;

  /** Ruleset Id. */
  rulesetId?: string;
}
