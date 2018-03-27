/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { BeEvent } from "@bentley/bentleyjs-core/lib/BeEvent";
import { SelectionProvider } from "./SelectionProvider";
import { SelectionChangeType } from "./SelectionChangeType";
import { SelectedItem } from "./SelectedItem";
import { IModelToken } from "@bentley/imodeljs-common/lib/IModel";

/** An interface for selection change listeners */
export declare type SelectionChangesListener = (args: SelectionChangeEventArgs, provider: SelectionProvider) => void;

/** An event broadcasted on selection changes */
export class SelectionChangeEvent extends BeEvent<SelectionChangesListener> { }

/** The event object that's sent when the selection changes */
export interface SelectionChangeEventArgs {

  /** The name of the selection source which caused the selection change. */
  source: string;

  /** Level of the selection. */
  level: number;

  /** The selection change type. */
  changeType: SelectionChangeType;

  /** The selection affected by this selection change event. */
  items: SelectedItem[];

  /** Token of the imodel connection with which the selection is associated. */
  imodelToken: IModelToken;

  /** Ruleset Id. */
  rulesetId?: string;
}
