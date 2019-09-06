/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import {
  IModelApp,
} from "@bentley/imodeljs-frontend";

export class TileLoadIndicator {
  private readonly _progress: HTMLProgressElement;

  public constructor(parent: HTMLElement) {
    this._progress = document.createElement("progress") as HTMLProgressElement;
    parent.appendChild(this._progress);

    IModelApp.viewManager.onFinishRender.addListener(() => this.update());
  }

  private update(): void {
    let ready = 0;
    let total = 0;
    IModelApp.viewManager.forEachViewport((vp) => {
      ready += vp.numReadyTiles;
      total += vp.numReadyTiles + vp.numRequestedTiles;
    });

    const pctComplete = (total > 0) ? (ready / total) : 1.0;
    this._progress.value = pctComplete;
  }
}
