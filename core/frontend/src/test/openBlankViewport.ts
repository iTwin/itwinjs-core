/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { BlankConnection } from "../IModelConnection";
import { ScreenViewport } from "../Viewport";
import { SpatialViewState } from "../SpatialViewState";
import { createBlankConnection } from "./createBlankConnection";

/** Options for openBlankViewport.
 * @internal
 */
export interface BlankViewportOptions {
  /** Height in pixels. Default 100. */
  height?: number;
  /** Width in pixels. Default 100. */
  width?: number;
  /** iModel. If undefined, a new blank connection will be created. */
  iModel?: BlankConnection;
  /** The position of the containing div. */
  position?: "absolute";
}

/** Open a viewport for a blank spatial view.
 * @internal
 */
export function openBlankViewport(options?: BlankViewportOptions): ScreenViewport {
  const height = options?.height ?? 100;
  const width = options?.width ?? 100;
  const iModel = options?.iModel ?? createBlankConnection();

  const parentDiv = document.createElement("div");
  const hPx = `${height}px`;
  const wPx = `${width}px`;

  parentDiv.setAttribute("height", hPx);
  parentDiv.setAttribute("width", wPx);
  parentDiv.style.height = hPx;
  parentDiv.style.width = wPx;

  if (options?.position) parentDiv.style.position = options.position;

  document.body.appendChild(parentDiv);

  const view = SpatialViewState.createBlank(iModel, { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });

  class BlankViewport extends ScreenViewport {
    public ownedIModel?: BlankConnection;

    public override dispose(): void {
      document.body.removeChild(this.parentDiv);
      super.dispose();
      this.ownedIModel?.closeSync();
    }
  }

  const viewport = BlankViewport.create(parentDiv, view) as BlankViewport;
  if (undefined === options?.iModel) viewport.ownedIModel = iModel;

  return viewport;
}

export type TestBlankViewportOptions = BlankViewportOptions & { test: (vp: ScreenViewport) => void };

/** Open a viewport for a blank spatial view, invoke a test function, then dispose of the viewport and remove it from the DOM.
 * @internal
 */
export function testBlankViewport(args: TestBlankViewportOptions | ((vp: ScreenViewport) => void)): void {
  const vp = openBlankViewport(typeof args === "function" ? undefined : args);
  try {
    if (typeof args === "function") args(vp);
    else args.test(vp);
  } finally {
    vp.dispose();
  }
}

/** Open a viewport for a blank spatial view, invoke a test function, then dispose of the viewport and remove it from the DOM.
 * @internal
 */
export async function testBlankViewportAsync(args: (vp: ScreenViewport) => Promise<void>): Promise<void> {
  const vp = openBlankViewport(typeof args === "function" ? undefined : args);
  try {
    await args(vp);
  } finally {
    vp.dispose();
  }
}
