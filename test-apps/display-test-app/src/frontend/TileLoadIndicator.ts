/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelApp } from "@itwin/core-frontend";

export class TileLoadIndicator {
  private readonly _progress: HTMLProgressElement;

  public constructor(parent: HTMLElement) {
    this._progress = document.createElement("progress");
    parent.appendChild(this._progress);

    IModelApp.viewManager.onFinishRender.addListener(() => this.update());
  }

  private update(): void {
    let ready = 0;
    let total = 0;
    for (const vp of IModelApp.viewManager) {
      ready += vp.numReadyTiles;
      total += vp.numReadyTiles + vp.numRequestedTiles;
    }

    const pctComplete = (total > 0) ? (ready / total) : 1.0;
    this._progress.value = pctComplete;
  }
}
