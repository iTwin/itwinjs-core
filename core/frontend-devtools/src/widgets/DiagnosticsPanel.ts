/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { ToolSettingsTracker } from "./ToolSettingsTracker";
import { FpsTracker } from "./FpsTracker";
import { MemoryTracker } from "./MemoryTracker";
import { TileStatisticsTracker } from "./TileStatisticsTracker";
import { Viewport } from "@bentley/imodeljs-frontend";
import { KeyinField } from "./KeyinField";

/** Consolidates many other widgets into a single panel.
 * @beta
 */
export class DiagnosticsPanel {
  private readonly _element: HTMLElement;
  private readonly _parentElement?: HTMLElement;
  private readonly _fpsTracker: FpsTracker;
  private readonly _memoryTracker: MemoryTracker;
  private readonly _statsTracker: TileStatisticsTracker;
  private readonly _toolSettingsTracker: ToolSettingsTracker;
  public readonly keyinField: KeyinField;

  public constructor(vp: Viewport) {
    this._element = document.createElement("div");
    this._element.className = "debugPanel";

    this._fpsTracker = new FpsTracker(this._element, vp);

    this.addSeparator();
    this.keyinField = new KeyinField({
      parent: this._element,
      baseId: "diagnosticsPanelKeyin",
      wantButton: true,
      wantLabel: true,
      historyLength: 20,
    });

    this.addSeparator();
    this._statsTracker = new TileStatisticsTracker(this._element, vp);

    this.addSeparator();
    this._memoryTracker = new MemoryTracker(this._element, vp);

    this.addSeparator();
    this._toolSettingsTracker = new ToolSettingsTracker(this._element, vp);
  }

  public get element(): HTMLElement { return this._element; }

  public dispose(): void {
    this._fpsTracker.dispose();
    this._memoryTracker.dispose();
    this._statsTracker.dispose();
    this._toolSettingsTracker.dispose();

    if (undefined !== this._parentElement)
      this._parentElement.removeChild(this._element);
  }

  private addSeparator(): void {
    this._element.appendChild(document.createElement("hr")!);
  }
}
