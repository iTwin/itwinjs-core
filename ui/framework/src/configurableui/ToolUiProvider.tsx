/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ToolSettings */

import { ConfigurableBase, ConfigurableCreateInfo, ConfigurableUiControlType } from "./ConfigurableUiControl";
import { ToolItemDef } from "./Item";

// -----------------------------------------------------------------------------
// Configurable Ui ToolUiProvider
// -----------------------------------------------------------------------------

/** Properties for the [[ToolUiProvider]] component.
 */
export interface ToolUiProviderProps {
  toolUiProvider: ToolUiProvider;
}

/** ToolUiProvider base class for ConfigurableUi.
 */
export class ToolUiProvider extends ConfigurableBase {
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

  public get toolItem(): ToolItemDef { return this._toolItem; }
  public set toolItem(v: ToolItemDef) { this._toolItem = v; }

  public getType(): ConfigurableUiControlType { return ConfigurableUiControlType.ToolUiProvider; }
}

export default ToolUiProvider;
