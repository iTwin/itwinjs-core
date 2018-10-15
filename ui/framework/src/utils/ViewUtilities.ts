/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Utils */

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
    return classname === "SpatialViewDefinition" || classname === "OrthographicViewDefinition";
  }

  /**
   * Determines if given class is a drawing view.
   * @param classname Name of class to check
   */
  public static isDrawing(classname: string): boolean {
    return classname === "DrawingViewDefinition";
  }

  /**
   * Determines if given class is a sheet view.
   * @param classname Name of class to check
   */
  public static isSheet(classname: string): boolean {
    return classname === "SheetViewDefinition";
  }
}
