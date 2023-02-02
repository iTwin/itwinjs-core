/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ContentView
 */

import * as React from "react";
import { ContentControl } from "./ContentControl";
import { InternalContentViewManager as internal } from "./InternalContentViewManager";

/** Content View Manager class.
 * @public
 * @deprecated in 3.6. Use `UiFramework.content` property
 */
export class ContentViewManager {
  public static get onMouseDownChangedEvent() { return internal.onMouseDownChangedEvent; }

  /** Determines if the mouse is down in a content view */
  public static get isMouseDown(): boolean {
    return internal.isMouseDown;
  }

  /** Sets the mouse down status for a content view */
  public static setMouseDown(mouseDown: boolean): void {
    return internal.setMouseDown(mouseDown);
  }

  /** Gets the [[ActiveContentChangedEvent]] */
  public static get onActiveContentChangedEvent() { return internal.onActiveContentChangedEvent; }

  /** Fires when floating contents are added or removed */

  public static get onAvailableContentChangedEvent() { return internal.onAvailableContentChangedEvent; }

  /** Gets the active content as a React.ReactNode. */
  public static getActiveContent(): React.ReactNode | undefined {
    return internal.getActive();
  }

  /** Return the active ContentControl. */
  public static getActiveContentControl(): ContentControl | undefined {
    return internal.getActiveContentControl();
  }

  public static addFloatingContentControl(contentControl?: ContentControl) {
    return internal.addFloatingContentControl(contentControl);
  }

  public static dropFloatingContentControl(contentControl?: ContentControl) {
    return internal.dropFloatingContentControl(contentControl);
  }

  /** Sets the active [[ContentControl]] */
  public static setActiveContent(activeContent?: React.ReactNode, forceEventProcessing = false): void {
    return internal.setActive(activeContent, forceEventProcessing);
  }

  /** Refreshes the active [[ContentControl]] */
  public static refreshActiveContent(activeContent: React.ReactNode) {
    return internal.refreshActive(activeContent);
  }

  /**
   * Determines if content displays a Sheet view.
   * @param content ContentControl to check
   */
  public static isContentSheetView(content: ContentControl | undefined): boolean {
    return internal.isContentSheetView(content);
  }

  /**
   * Determines if content displays a Drawing view.
   * @param content ContentControl to check
   */
  public static isContentDrawingView(content: ContentControl | undefined): boolean {
    return internal.isContentDrawingView(content);
  }

  /**
   * Determines if content displays a Spatial view.
   * @param content ContentControl to check
   */
  public static isContentSpatialView(content: ContentControl | undefined): boolean {
    return internal.isContentSpatialView(content);
  }

  /**
   * Determines if content displays a Orthographic view.
   * @param content ContentControl to check
   */
  public static isContentOrthographicView(content: ContentControl | undefined): boolean {
    return internal.isContentOrthographicView(content);
  }

  /**
   * Determines if content displays a 3d view.
   * @param content ContentControl to check
   */
  public static isContent3dView(content: ContentControl | undefined): boolean {
    return internal.isContent3dView(content);
  }

  /**
   * Determines if viewport supports use of a camera.
   * @param content ContentControl to check
   */
  public static contentSupportsCamera(content: ContentControl | undefined): boolean {
    return internal.contentSupportsCamera(content);
  }
}
