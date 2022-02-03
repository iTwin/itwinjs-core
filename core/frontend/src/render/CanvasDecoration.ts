/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import type { XAndY } from "@itwin/core-geometry";
import type { BeButtonEvent, BeWheelEvent } from "../tools/Tool";

/** A [Decoration]($docs/learning/frontend/ViewDecorations#canvas-decorations) that is drawn onto the
 * [2d canvas](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D) on top of a ScreenViewport.
 * CanvasDecorations may be pickable by implementing [[pick]].
 * @public
 */
export interface CanvasDecoration {
  /**
   * Required method to draw this decoration into the supplied [CanvasRenderingContext2D](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D). This method is called every time a frame is rendered.
   * @param ctx The CanvasRenderingContext2D for the [[ScreenViewport]] being rendered.
   * @note Before this this function is called, the state of the CanvasRenderingContext2D is [saved](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/save),
   * and it is [restored](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/restore) when this method returns. Therefore,
   * it is *not* necessary for implementers to save/restore themselves.
   */
  drawDecoration(ctx: CanvasRenderingContext2D): void;
  /**
   * Optional view coordinates position of this overlay decoration. If present, [ctx.translate](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/translate) is called
   * with this point before [[drawDecoration]] is called.
   */
  position?: XAndY;
  /** Optional method to provide feedback when mouse events occur on this decoration.
   * @param pt The position of the mouse in the ScreenViewport
   * @return true if the mouse is inside this decoration.
   * @note If this method is not present, no mouse events are directed to this decoration.
   */
  pick?(pt: XAndY): boolean;
  /** Optional method to be called whenever this decorator is picked and the mouse first enters this decoration. */
  onMouseEnter?(ev: BeButtonEvent): void;
  /** Optional method to be called whenever when the mouse leaves this decoration. */
  onMouseLeave?(): void;
  /** Optional method to be called whenever when the mouse moves inside this decoration. */
  onMouseMove?(ev: BeButtonEvent): void;
  /**
   * Optional method to be called whenever this decorator is picked and a mouse button is pressed or released inside this decoration.
   * @return true if the event was handled by this decoration and should *not* be forwarded to the active tool.
   * @note This method is called for both mouse up and down events. If it returns `true` for a down event, it should also return `true` for the
   * corresponding up event.
   */
  onMouseButton?(ev: BeButtonEvent): boolean;
  /**
   * Optional method to be called when the mouse wheel is rolled with the pointer over this decoration.
   * @return true to indicate that the event has been handled and should not be propagated to default handler
   */
  onWheel?(ev: BeWheelEvent): boolean;
  /** Cursor to use when mouse is inside this decoration. Default is "pointer". */
  decorationCursor?: string;
}

/** An array of [[CanvasDecoration]]s.
 * @public
 */
export type CanvasDecorationList = CanvasDecoration[];
