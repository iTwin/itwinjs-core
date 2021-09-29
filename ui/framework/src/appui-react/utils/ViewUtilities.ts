/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utilities
 */

// cSpell:ignore classname

import { DrawingViewState, OrthographicViewState, ScreenViewport, SheetViewState, SpatialViewState } from "@itwin/core-frontend";

/**
 * Various View utility methods
 * @public
 */
export class ViewUtilities {

  /**
   * Extracts the BisBaseClass from a full class name.
   * @param classFullName full class name
   * @returns BisBaseClass name
   */
  public static getBisBaseClass(classFullName: string) {
    const bisBaseClass = classFullName.substring(classFullName.indexOf(":") + 1);
    return bisBaseClass;
  }

  /**
   * Determines if given class is a spatial view.
   * @param classname Name of class to check
   */
  public static isSpatial(classname: string): boolean {
    return classname === SpatialViewState.className || classname === OrthographicViewState.className;
  }

  /**
   * Determines if given class is a spatial view.
   * @param classname Name of class to check
   */
  public static isOrthographic(classname: string): boolean {
    return classname === OrthographicViewState.className;
  }

  /**
   * Determines if given class is a drawing view.
   * @param classname Name of class to check
   */
  public static isDrawing(classname: string): boolean {
    return classname === DrawingViewState.className;
  }

  /**
   * Determines if given class is a sheet view.
   * @param classname Name of class to check
   */
  public static isSheet(classname: string): boolean {
    return classname === SheetViewState.className;
  }

  /**
   * Determines if viewport displays a Sheet view.
   * @param viewport ScreenViewport to check
   */
  public static isSheetView(viewport: ScreenViewport): boolean {
    return ViewUtilities.isSheet(ViewUtilities.getBisBaseClass(viewport.view.classFullName));
  }

  /**
   * Determines if viewport displays a Drawing view.
   * @param viewport ScreenViewport to check
   */
  public static isDrawingView(viewport: ScreenViewport): boolean {
    return ViewUtilities.isDrawing(ViewUtilities.getBisBaseClass(viewport.view.classFullName));
  }

  /**
   * Determines if viewport displays a Orthographic view.
   * @param viewport ScreenViewport to check
   */
  public static isOrthographicView(viewport: ScreenViewport): boolean {
    return ViewUtilities.isOrthographic(ViewUtilities.getBisBaseClass(viewport.view.classFullName));
  }

  /**
   * Determines if viewport displays a Spatial view.
   * @param viewport ScreenViewport to check
   */
  public static isSpatialView(viewport: ScreenViewport): boolean {
    return ViewUtilities.isSpatial(ViewUtilities.getBisBaseClass(viewport.view.classFullName));
  }

  /**
   * Determines if viewport displays a 3d view.
   * @param viewport ScreenViewport to check
   */
  public static is3dView(viewport: ScreenViewport): boolean {
    return viewport.view.is3d();
  }

  /**
   * Determines if viewport supports use of a camera.
   * @param viewport ScreenViewport to check
   */
  public static viewSupportsCamera(viewport: ScreenViewport): boolean {
    return SpatialViewState.className === ViewUtilities.getBisBaseClass(viewport.view.classFullName);
  }
}
