/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

// Extracted from TileIO.test.ts so other test files can import fakeViewState
// without transitively loading TileIO.test.ts's describe blocks.

import { Id64String } from "@itwin/core-bentley";
import { RenderMode, ViewFlags } from "@itwin/core-common";
import { IModelConnection, ViewState } from "@itwin/core-frontend";

export function fakeViewState(iModel: IModelConnection, options?: { visibleEdges?: boolean, renderMode?: RenderMode, is2d?: boolean, animationId?: Id64String }): ViewState {
  return {
    iModel,
    is3d: () => true !== options?.is2d,
    viewFlags: new ViewFlags({
      renderMode: options?.renderMode ?? RenderMode.SmoothShade,
      visibleEdges: options?.visibleEdges ?? false,
    }),
    displayStyle: {},
  } as unknown as ViewState;
}
