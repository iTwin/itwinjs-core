/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tools */

import * as React from "react";

// cSpell:ignore configurableui keyinbrowser
import {
  FitViewTool, FlyViewTool, IModelApp, PanViewTool, RotateViewTool, SelectionTool, ViewToggleCameraTool, WalkViewTool,
  WindowAreaTool, ZoomViewTool, ViewClipByPlaneTool, ViewUndoTool, ViewRedoTool, Tool,
  ViewClipDecorationProvider,
} from "@bentley/imodeljs-frontend";
import {
  SelectTool as Markup_SelectTool,
  LineTool as Markup_LineTool,
  RectangleTool as Markup_RectangleTool,
  PolygonTool as Markup_PolygonTool,
  CloudTool as Markup_CloudTool,
  EllipseTool as Markup_EllipseTool,
  ArrowTool as Markup_ArrowTool,
  DistanceTool as Markup_DistanceTool,
  SketchTool as Markup_SketchTool,
  SymbolTool as Markup_SymbolTool,
  PlaceTextTool as Markup_PlaceTextTool,
} from "@bentley/imodeljs-markup";
import { PopupButton, PopupButtonChildrenRenderPropArgs } from "./toolbar/PopupButton";
import { ViewFlags } from "@bentley/imodeljs-common";
import { ToolItemDef } from "./shared/ToolItemDef";
import { CustomItemDef } from "./shared/CustomItemDef";
import { KeyinBrowser } from "./keyinbrowser/KeyinBrowser";
import { SyncUiEventId } from "./syncui/SyncUiEventDispatcher";
import { BaseItemState } from "../ui-framework/shared/ItemDefBase";
import { ContentViewManager } from "./content/ContentViewManager";

/** Utility Class that provides definitions of tools provided by iModel.js core. These definitions can be used to populate the UI.
 * @public
 */
// istanbul ignore next
export class CoreTools {
  /** Get the CustomItemDef for PopupButton
   * @beta
   */
  public static get keyinBrowserButtonItemDef() {
    return new CustomItemDef({
      customId: "uif:keyinbrowser",
      reactElement: (
        <PopupButton iconSpec="icon-process" labelKey="UiFramework:keyinbrowser.label" betaBadge={true}>
          {this._renderKeyInBrowser}
        </PopupButton>
      ),
    });
  }

  private static _renderKeyInBrowser = ({ closePanel }: PopupButtonChildrenRenderPropArgs) => {
    return (
      <KeyinBrowser onExecute={closePanel} />
    );
  }

  public static get fitViewCommand() {
    return new ToolItemDef({
      toolId: FitViewTool.toolId,
      iconSpec: FitViewTool.iconSpec,
      label: () => FitViewTool.flyover,
      tooltip: () => FitViewTool.description,
      execute: () => { IModelApp.tools.run(FitViewTool.toolId, IModelApp.viewManager.selectedView, true); },
    });
  }

  public static get windowAreaCommand() {
    return new ToolItemDef({
      toolId: WindowAreaTool.toolId,
      iconSpec: WindowAreaTool.iconSpec,
      label: () => WindowAreaTool.flyover,
      tooltip: () => WindowAreaTool.description,
      execute: () => { IModelApp.tools.run(WindowAreaTool.toolId, IModelApp.viewManager.selectedView); },
    });
  }

  public static get zoomViewCommand() {
    return new ToolItemDef({
      toolId: ZoomViewTool.toolId,
      iconSpec: ZoomViewTool.iconSpec,
      label: () => ZoomViewTool.flyover,
      tooltip: () => ZoomViewTool.description,
      execute: () => { IModelApp.tools.run(ZoomViewTool.toolId, IModelApp.viewManager.selectedView); },
    });
  }

  public static get panViewCommand() {
    return new ToolItemDef({
      toolId: PanViewTool.toolId,
      iconSpec: PanViewTool.iconSpec,
      label: () => PanViewTool.flyover,
      tooltip: () => PanViewTool.description,
      execute: () => { IModelApp.tools.run(PanViewTool.toolId, IModelApp.viewManager.selectedView); },
    });
  }

  public static get rotateViewCommand() {
    return new ToolItemDef({
      toolId: RotateViewTool.toolId,
      iconSpec: RotateViewTool.iconSpec,
      label: () => RotateViewTool.flyover,
      tooltip: () => RotateViewTool.description,
      execute: () => { IModelApp.tools.run(RotateViewTool.toolId, IModelApp.viewManager.selectedView); },
    });
  }

  public static get walkViewCommand() {
    return new ToolItemDef({
      toolId: WalkViewTool.toolId,
      iconSpec: WalkViewTool.iconSpec,
      label: () => WalkViewTool.flyover,
      tooltip: () => WalkViewTool.description,
      execute: () => { IModelApp.tools.run(WalkViewTool.toolId, IModelApp.viewManager.selectedView); },
    });
  }

  public static get selectElementCommand() {
    return new ToolItemDef({
      toolId: SelectionTool.toolId,
      iconSpec: SelectionTool.iconSpec,
      label: () => SelectionTool.flyover,
      tooltip: () => SelectionTool.description,
      execute: () => {
        IModelApp.tools.run(SelectionTool.toolId);
      },
    });
  }

  public static get toggleCameraViewCommand() {
    return new ToolItemDef({
      toolId: ViewToggleCameraTool.toolId,
      iconSpec: ViewToggleCameraTool.iconSpec,
      label: () => ViewToggleCameraTool.flyover,
      tooltip: () => ViewToggleCameraTool.description,
      execute: () => { IModelApp.tools.run(ViewToggleCameraTool.toolId, IModelApp.viewManager.selectedView); },
    });
  }

  public static get flyViewCommand() {
    return new ToolItemDef({
      toolId: FlyViewTool.toolId,
      iconSpec: FlyViewTool.iconSpec,
      label: () => FlyViewTool.flyover,
      tooltip: () => FlyViewTool.description,
      execute: () => { IModelApp.tools.run(FlyViewTool.toolId, IModelApp.viewManager.selectedView); },
    });
  }

  // note current ViewClipByPlaneTool is not automatically registered so the app must call ViewClipByPlaneTool.register();
  public static get sectionByPlaneCommand() {
    return new ToolItemDef({
      toolId: ViewClipByPlaneTool.toolId,
      iconSpec: ViewClipByPlaneTool.iconSpec,
      label: () => ViewClipByPlaneTool.flyover,
      tooltip: () => ViewClipByPlaneTool.description,
      execute: () => {
        const vp = IModelApp.viewManager.selectedView;
        if (!vp || !vp.view.is3d())
          return;

        // Turn on clip volume flag for section tools
        const viewFlags: ViewFlags = vp.view.viewFlags.clone();
        viewFlags.clipVolume = true;
        vp.viewFlags = viewFlags;

        IModelApp.tools.run(ViewClipByPlaneTool.toolId, ViewClipDecorationProvider.create());
      },
    });
  }

  // TODO - Need to provide a sync message that is fire when the Undo/Redo button needs to be refreshed in the
  // active view.
  public static get viewUndoCommand() {
    return new ToolItemDef({
      toolId: ViewUndoTool.toolId,
      iconSpec: ViewUndoTool.iconSpec,
      label: () => ViewUndoTool.flyover,
      tooltip: () => ViewUndoTool.description,
      execute: () => { IModelApp.tools.run(ViewUndoTool.toolId, IModelApp.viewManager.selectedView); },
      stateSyncIds: [SyncUiEventId.ActiveContentChanged],
      stateFunc: (currentState: Readonly<BaseItemState>): BaseItemState => {
        const returnState: BaseItemState = { ...currentState };
        const activeContentControl = ContentViewManager.getActiveContentControl();
        if (activeContentControl && activeContentControl.viewport)
          returnState.isEnabled = activeContentControl.viewport.isRedoPossible;
        return returnState;
      },
    });
  }

  public static get viewRedoCommand() {
    return new ToolItemDef({
      toolId: ViewRedoTool.toolId,
      iconSpec: ViewRedoTool.iconSpec,
      label: () => ViewRedoTool.flyover,
      tooltip: () => ViewRedoTool.description,
      execute: () => { IModelApp.tools.run(ViewRedoTool.toolId, IModelApp.viewManager.selectedView); },
      stateSyncIds: [SyncUiEventId.ActiveContentChanged],
      stateFunc: (currentState: Readonly<BaseItemState>): BaseItemState => {
        const returnState: BaseItemState = { ...currentState };
        const activeContentControl = ContentViewManager.getActiveContentControl();
        if (activeContentControl && activeContentControl.viewport)
          returnState.isEnabled = activeContentControl.viewport.isRedoPossible;
        return returnState;
      },
    });
  }

  public static getItemDefForTool(tool: typeof Tool, iconSpec?: string, args?: any[]): ToolItemDef {
    return new ToolItemDef({
      toolId: tool.toolId,
      iconSpec: iconSpec ? iconSpec : tool.iconSpec ? tool.iconSpec : "icon-placeholder",
      label: () => tool.flyover,
      tooltip: () => tool.description,
      execute: () => { IModelApp.tools.run(tool.toolId, args); },
    });
  }

  /* Markup tools - Application must call 'MarkupApp.initialize()' before using the following definitions */
  public static get markupSelectToolDef() {
    return CoreTools.getItemDefForTool(Markup_SelectTool, "icon-cursor");
  }

  public static get markupLineToolDef() {
    return CoreTools.getItemDefForTool(Markup_LineTool);
  }

  public static get markupRectangleToolDef() {
    return CoreTools.getItemDefForTool(Markup_RectangleTool);
  }

  public static get markupPolygonToolDef() {
    return CoreTools.getItemDefForTool(Markup_PolygonTool);
  }

  public static get markupCloudToolDef() {
    return CoreTools.getItemDefForTool(Markup_CloudTool);
  }

  public static get markupEllipseToolDef() {
    return CoreTools.getItemDefForTool(Markup_EllipseTool);
  }

  public static get markupArrowToolDef() {
    return CoreTools.getItemDefForTool(Markup_ArrowTool);
  }

  public static get markupDistanceToolDef() {
    return CoreTools.getItemDefForTool(Markup_DistanceTool);
  }

  public static get markupSketchToolDef() {
    return CoreTools.getItemDefForTool(Markup_SketchTool);
  }

  public static get markupPlaceTextToolDef() {
    return CoreTools.getItemDefForTool(Markup_PlaceTextTool);
  }

  public static get markupSymbolToolDef() {
    return CoreTools.getItemDefForTool(Markup_SymbolTool);
  }
}
