/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { BeEvent } from "@bentley/bentleyjs-core";
import { IModelToken } from "@bentley/imodeljs-common";
import { KeySet } from "@bentley/ecpresentation-common";
import { SelectionProvider } from "./SelectionProvider";

/** An interface for selection change listeners */
export declare type SelectionChangesListener = (args: SelectionChangeEventArgs, provider: SelectionProvider) => void;

/** An event broadcasted on selection changes */
export class SelectionChangeEvent extends BeEvent<SelectionChangesListener> { }

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

  /** Token of the imodel connection with which the selection is associated. */
  imodelToken: Readonly<IModelToken>;

  /** Ruleset Id. */
  rulesetId?: string;
}
