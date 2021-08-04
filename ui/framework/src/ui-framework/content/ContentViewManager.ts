/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ContentView
 */

import * as React from "react";
import { UiEvent } from "@bentley/ui-core";
import { FrontstageManager } from "../frontstage/FrontstageManager";
import { ViewUtilities } from "../utils/ViewUtilities";
import { ContentControl } from "./ContentControl";
import { ContentLayoutManager } from "./ContentLayoutManager";
import { IModelApp } from "@bentley/imodeljs-frontend";

/** [[MouseDownChangedEvent]] Args interface.
 * @public
 */
export interface MouseDownChangedEventArgs {
  /** Indicates whether the mouse is down */
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
  /** React node of the old content */
  oldContent?: React.ReactNode;
  /** React node of the newly active content */
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

      const activeFrontstageDef = FrontstageManager.activeFrontstageDef;

      // istanbul ignore else
      if (activeFrontstageDef) {
        const activeContentGroup = activeFrontstageDef.contentGroup;

        // istanbul ignore else
        if (activeContentGroup) {
          const oldContentControl = oldContent ? activeContentGroup.getControlFromElement(oldContent) : undefined;
          const activeContentControl = activeContentGroup.getControlFromElement(this._activeContent);

          // Only call setActiveView if going to or coming from a non-viewport ContentControl
          // istanbul ignore else
          if (activeContentControl) {
            // istanbul ignore next
            const doSetActiveView =
              forceEventProcessing || (!activeContentControl.viewport ||
                (/* istanbul ignore next */ oldContentControl && /* istanbul ignore next */ !oldContentControl.viewport));

            // istanbul ignore else
            if (doSetActiveView) {
              activeFrontstageDef.setActiveView(activeContentControl, oldContentControl);
              this.onActiveContentChangedEvent.emit({ activeContent, oldContent });
            } else {
              if (activeContentControl.viewport && activeContentControl.viewport !== IModelApp.viewManager.selectedView) {
                IModelApp.viewManager.setSelectedView(activeContentControl.viewport);
              }
            }
          }
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
