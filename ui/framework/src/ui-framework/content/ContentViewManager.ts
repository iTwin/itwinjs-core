/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ContentView */

import { UiEvent } from "@bentley/ui-core";
import { FrontstageManager } from "../frontstage/FrontstageManager";
import { ContentControl } from "./ContentControl";
import { ViewUtilities } from "../utils/ViewUtilities";
import { ContentLayoutManager } from "./ContentLayoutManager";

/** [[MouseDownChangedEvent]] Args interface.
 * @public
 */
export interface MouseDownChangedEventArgs {
  mouseDown: boolean;
}

/** Mouse Down Changed Event class.
 * @public
 */
export class MouseDownChangedEvent extends UiEvent<MouseDownChangedEventArgs> { }

/** [[ActiveContentChangedEvent]] Args interface.
 * @public
 */
export interface ActiveContentChangedEventArgs {
  oldContent?: React.ReactNode;
  activeContent?: React.ReactNode;
}

/** Active Content Changed Event class.
 * @public
 */
export class ActiveContentChangedEvent extends UiEvent<ActiveContentChangedEventArgs> { }

/** Content View Manager class.
 * @public
 */
export class ContentViewManager {
  private static _mouseDown: boolean = false;
  private static _activeContent?: React.ReactNode;

  /** Gets the [[MouseDownChangedEvent]] */
  public static readonly onMouseDownChangedEvent = new MouseDownChangedEvent();

  /** Determines if the mouse is down in a content view */
  public static get isMouseDown(): boolean {
    return this._mouseDown;
  }

  /** Sets the mouse down status for a content view */
  public static setMouseDown(mouseDown: boolean): void {
    this._mouseDown = mouseDown;
    this.onMouseDownChangedEvent.emit({ mouseDown });
  }

  /** Gets the [[ActiveContentChangedEvent]] */
  public static readonly onActiveContentChangedEvent = new ActiveContentChangedEvent();

  /** Gets the active content as a React.ReactNode. */
  public static getActiveContent(): React.ReactNode | undefined {
    return this._activeContent;
  }

  /** Return the active ContentControl. */
  public static getActiveContentControl(): ContentControl | undefined {
    let activeContentControl: ContentControl | undefined;
    const activeFrontstageDef = FrontstageManager.activeFrontstageDef;

    // istanbul ignore else
    if (this._activeContent && activeFrontstageDef) {
      const activeContentGroup = activeFrontstageDef.contentGroup;
      // istanbul ignore else
      if (activeContentGroup) {
        activeContentControl = activeContentGroup.getControlFromElement(this._activeContent);
      }
    }

    return activeContentControl;
  }

  /** Sets the active [[ContentControl]] */
  public static setActiveContent(activeContent?: React.ReactNode, forceEventProcessing = false): void {
    // istanbul ignore else
    if (this._activeContent !== activeContent || forceEventProcessing) {
      const oldContent = this._activeContent;
      this._activeContent = activeContent;
      this.onActiveContentChangedEvent.emit({ oldContent, activeContent });

      const activeFrontstageDef = FrontstageManager.activeFrontstageDef;

      // istanbul ignore else
      if (activeFrontstageDef) {
        const activeContentGroup = activeFrontstageDef.contentGroup;

        // istanbul ignore else
        if (activeContentGroup) {
          const oldContentControl = oldContent ? activeContentGroup.getControlFromElement(oldContent) : undefined;
          const activeContentControl = activeContentGroup.getControlFromElement(this._activeContent);

          // istanbul ignore else
          if (activeContentControl)
            activeFrontstageDef.setActiveView(activeContentControl, oldContentControl);
        }
      }
    }
  }

  /** Refreshes the active [[ContentControl]] */
  public static refreshActiveContent(activeContent: React.ReactNode) {
    ContentLayoutManager.refreshActiveLayout();
    this.setActiveContent(activeContent, true);
  }

  /**
   * Determines if content displays a Sheet view.
   * @param content ContentControl to check
   */
  public static isContentSheetView(content: ContentControl | undefined): boolean {
    if (!content || !content.viewport)
      return false;
    return (ViewUtilities.isSheetView(content.viewport));
  }

  /**
   * Determines if content displays a Drawing view.
   * @param content ContentControl to check
   */
  public static isContentDrawingView(content: ContentControl | undefined): boolean {
    if (!content || !content.viewport)
      return false;
    return (ViewUtilities.isDrawingView(content.viewport));
  }

  /**
   * Determines if content displays a Spatial view.
   * @param content ContentControl to check
   */
  public static isContentSpatialView(content: ContentControl | undefined): boolean {
    if (!content || !content.viewport)
      return false;
    return (ViewUtilities.isSpatialView(content.viewport));
  }

  /**
   * Determines if content displays a Orthographic view.
   * @param content ContentControl to check
   */
  public static isContentOrthographicView(content: ContentControl | undefined): boolean {
    if (!content || !content.viewport)
      return false;
    return (ViewUtilities.isOrthographicView(content.viewport));
  }

  /**
   * Determines if content displays a 3d view.
   * @param content ContentControl to check
   */
  public static isContent3dView(content: ContentControl | undefined): boolean {
    if (!content || !content.viewport)
      return false;
    return (ViewUtilities.is3dView(content.viewport));
  }

  /**
   * Determines if viewport supports use of a camera.
   * @param content ContentControl to check
   */
  public static contentSupportsCamera(content: ContentControl | undefined): boolean {
    if (!content || !content.viewport)
      return false;
    return (ViewUtilities.viewSupportsCamera(content.viewport));
  }

}
