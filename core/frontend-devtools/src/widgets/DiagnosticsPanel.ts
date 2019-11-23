/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module Widgets */

import { ToolSettingsTracker } from "./ToolSettingsTracker";
import { FpsTracker } from "./FpsTracker";
import { MemoryTracker } from "./MemoryTracker";
import { TileStatisticsTracker } from "./TileStatisticsTracker";
import { Viewport } from "@bentley/imodeljs-frontend";
import { dispose } from "@bentley/bentleyjs-core";
import { KeyinField } from "./KeyinField";
import { GpuProfiler } from "./GpuProfiler";

/** Options for configuring a [[DiagnosticsPanel]].
 * @beta
 */
export interface DiagnosticsPanelProps {
  /** Widgets to exclude from the panel. */
  exclude?: {
    keyin?: boolean;
    fps?: boolean;
    tileStats?: boolean;
    memory?: boolean;
    gpuProfiler?: boolean;
    toolSettings?: boolean;
  };
}

/** Consolidates many other widgets into a single panel.
 * @beta
 */
export class DiagnosticsPanel {
  private readonly _element: HTMLElement;
  private readonly _parentElement?: HTMLElement;
  private readonly _fpsTracker?: FpsTracker;
  private readonly _memoryTracker?: MemoryTracker;
  private readonly _statsTracker?: TileStatisticsTracker;
  private readonly _gpuProfiler?: GpuProfiler;
  private readonly _toolSettingsTracker?: ToolSettingsTracker;
  public readonly keyinField?: KeyinField;

  public constructor(vp: Viewport, props?: DiagnosticsPanelProps) {
    const exclude = (undefined !== props && undefined !== props.exclude) ? props.exclude : {};

    this._element = document.createElement("div");
    this._element.className = "debugPanel";

    if (true !== exclude.fps) {
      this._fpsTracker = new FpsTracker(this._element, vp);
      this.addSeparator();
    }

    if (true !== exclude.keyin) {
      this.keyinField = new KeyinField({
        parent: this._element,
        baseId: "diagnosticsPanelKeyin",
        wantButton: true,
        wantLabel: true,
        historyLength: 20,
      });

      this.addSeparator();
    }

    if (true !== exclude.tileStats) {
      this._statsTracker = new TileStatisticsTracker(this._element, vp);
      this.addSeparator();
    }

    if (true !== exclude.memory) {
      this._memoryTracker = new MemoryTracker(this._element, vp);
      this.addSeparator();
    }

    if (true !== exclude.gpuProfiler) {
      this._gpuProfiler = new GpuProfiler(this._element);
      this.addSeparator();
    }

    if (true !== exclude.toolSettings)
      this._toolSettingsTracker = new ToolSettingsTracker(this._element, vp);
  }

  public get element(): HTMLElement { return this._element; }

  public dispose(): void {
    dispose(this._fpsTracker);
    dispose(this._memoryTracker);
    dispose(this._statsTracker);
    dispose(this._gpuProfiler);
    dispose(this._toolSettingsTracker);

    if (undefined !== this._parentElement)
      this._parentElement.removeChild(this._element);
  }

  private addSeparator(): void {
    this._element.appendChild(document.createElement("hr")!);
  }
}
