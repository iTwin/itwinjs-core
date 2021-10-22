/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widgets
 */

export class RenderCommandBreakdown {
  private readonly _div: HTMLDivElement;
  private _curIntervalId?: NodeJS.Timer;
  private readonly _cells = new Map<string, HTMLElement>();

  public constructor(parent: HTMLElement) {
    createCheckBox({
      parent,
      name: "Render Commands",
      id: "renderCommandBreakdown",
      handler: () => this.toggle(),
    });
  }

  private toggle(): void {
    if (undefined !== this._curIntervalId) {
      this._div.style.display = "none";
      this.clearInterval();
    } else {
      this._div.style.display = "block";
      this.update();
      this._curIntervalId = setInterval(() => this.update(), 500);
    }
  }

  private clearInterval(): void {
    if (undefined !== this._curIntervalId) {
      clearInterval(this._curIntervalId);
      this._curIntervalId = undefined;
    }
  }

  private update(): void {
  }
}
