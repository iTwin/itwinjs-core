/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import {
  Viewport,
} from "@bentley/imodeljs-frontend";

export class TileLoadIndicator {
  private readonly _vp: Viewport;
  private readonly _removeMe: () => void;
  private readonly _parent: HTMLElement;
  private readonly _progress: HTMLProgressElement;

  public constructor(parent: HTMLElement, viewport: Viewport) {
    this._parent = parent;
    this._vp = viewport;
    this._removeMe = viewport.onRender.addListener((_vp) => this.update());

    this._progress = document.createElement("progress") as HTMLProgressElement;

    parent.appendChild(this._progress);
  }

  public dispose(): void {
    this._removeMe();
    this._parent.removeChild(this._progress);
  }

  private update(): void {
    const requested = this._vp.numRequestedTiles;
    const ready = this._vp.numReadyTiles;
    const total = ready + requested;
    const pctComplete = (total > 0) ? (ready / total) : 1.0;

    this._progress.value = pctComplete;
  }
}
