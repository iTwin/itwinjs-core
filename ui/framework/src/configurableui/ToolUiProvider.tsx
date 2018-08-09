/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module ToolSettings */

import { Configurable, ConfigurableCreateInfo } from "./ConfigurableUiControl";
import { ToolItemDef } from "./Item";

// -----------------------------------------------------------------------------
// Configurable Ui Widget Control
// -----------------------------------------------------------------------------

/** Props for a Tool Settings & Tool Assistance React component.
 */
export interface ToolUiProviderProps {
  toolUiProvider: ToolUiProvider;
}

/** ToolUiProvider base class for ConfigurableUi.
 */
export class ToolUiProvider extends Configurable {
  private _toolItem!: ToolItemDef;
  private _toolSettingsNode: React.ReactNode;
  private _toolAssistanceNode: React.ReactNode;

  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);
  }

  public get toolSettingsNode(): React.ReactNode { return this._toolSettingsNode; }
  public set toolSettingsNode(r: React.ReactNode) { this._toolSettingsNode = r; }

  public get toolAssistanceNode(): React.ReactNode { return this._toolAssistanceNode; }
  public set toolAssistanceNode(r: React.ReactNode) { this._toolAssistanceNode = r; }

  public get toolItem() { return this._toolItem; }
  public set toolItem(v: ToolItemDef) { this._toolItem = v; }
}

export default ToolUiProvider;
