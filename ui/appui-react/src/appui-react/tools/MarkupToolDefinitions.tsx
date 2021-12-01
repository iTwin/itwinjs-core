/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tools
 */

import {
  ArrowTool, CloudTool, DistanceTool, EllipseTool, LineTool, PlaceTextTool, PolygonTool, RectangleTool, SelectTool, SketchTool, SymbolTool,
} from "@itwin/core-markup";
import { ToolItemDef } from "../shared/ToolItemDef";

/** Utility Class that provides definitions of tools provided by @itwin/core-markup package. These definitions can be used to populate the UI.
 *  Note: Application must call 'MarkupApp.initialize()' or 'MarkupApp.start()' before using these definitions.
 * @public @deprecated Use the tools directly from the @itwin/core-markup package.
 */
// istanbul ignore next
export class MarkupTools {
  public static get selectToolDef() {
    return ToolItemDef.getItemDefForTool(SelectTool, "icon-cursor");
  }

  public static get lineToolDef() {
    return ToolItemDef.getItemDefForTool(LineTool);
  }

  public static get rectangleToolDef() {
    return ToolItemDef.getItemDefForTool(RectangleTool);
  }

  public static get polygonToolDef() {
    return ToolItemDef.getItemDefForTool(PolygonTool);
  }

  public static get cloudToolDef() {
    return ToolItemDef.getItemDefForTool(CloudTool);
  }

  public static get ellipseToolDef() {
    return ToolItemDef.getItemDefForTool(EllipseTool);
  }

  public static get arrowToolDef() {
    return ToolItemDef.getItemDefForTool(ArrowTool);
  }

  public static get distanceToolDef() {
    return ToolItemDef.getItemDefForTool(DistanceTool);
  }

  public static get sketchToolDef() {
    return ToolItemDef.getItemDefForTool(SketchTool);
  }

  public static get placeTextToolDef() {
    return ToolItemDef.getItemDefForTool(PlaceTextTool);
  }

  public static get symbolToolDef() {
    return ToolItemDef.getItemDefForTool(SymbolTool);
  }
}
