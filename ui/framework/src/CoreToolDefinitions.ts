/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tools */

import {
  IModelApp, SelectionTool, FitViewTool, WindowAreaTool,
  PanViewTool, RotateViewTool, ViewToggleCameraTool, WalkViewTool, FlyViewTool, ZoomViewTool,
} from "@bentley/imodeljs-frontend";

// cSpell:ignore configurableui
import { ToolItemDef } from "./configurableui/Item";
import { ContentViewManager } from "./configurableui/ContentViewManager";
import { BaseItemState } from "./configurableui/ItemDefBase";
import { SyncUiEventId } from "./syncui/SyncUiEventDispatcher";
import { AnalysisAnimationTool } from "./tools/AnalysisAnimation";

/** Utility Class that provides definitions of tools provided by imodel.js core. These definitions can be used to populate the ui. */
export class CoreTools {
  public static get fitViewCommand() {
    return new ToolItemDef({
      toolId: FitViewTool.toolId,
      iconSpec: "icon-fit-to-view",
      label: () => FitViewTool.flyover,
      tooltip: () => FitViewTool.description,
      execute: () => { IModelApp.tools.run(FitViewTool.toolId, IModelApp.viewManager.selectedView, true); },
    });
  }

  public static get windowAreaCommand() {
    return new ToolItemDef({
      toolId: WindowAreaTool.toolId,
      iconSpec: "icon-window-area",
      label: () => WindowAreaTool.flyover,
      tooltip: () => WindowAreaTool.description,
      execute: () => { IModelApp.tools.run(WindowAreaTool.toolId, IModelApp.viewManager.selectedView); },
    });
  }

  public static get zoomViewCommand() {
    return new ToolItemDef({
      toolId: ZoomViewTool.toolId,
      iconSpec: "icon-zoom",
      label: () => ZoomViewTool.flyover,
      tooltip: () => ZoomViewTool.description,
      execute: () => { IModelApp.tools.run(ZoomViewTool.toolId, IModelApp.viewManager.selectedView); },
    });
  }

  public static get panViewCommand() {
    return new ToolItemDef({
      toolId: PanViewTool.toolId,
      iconSpec: "icon-hand-2",
      label: () => PanViewTool.flyover,
      tooltip: () => PanViewTool.description,
      execute: () => { IModelApp.tools.run(PanViewTool.toolId, IModelApp.viewManager.selectedView); },
    });
  }

  public static get rotateViewCommand() {
    return new ToolItemDef({
      toolId: RotateViewTool.toolId,
      iconSpec: "icon-rotate-left",
      label: () => RotateViewTool.flyover,
      tooltip: () => RotateViewTool.description,
      execute: () => { IModelApp.tools.run(RotateViewTool.toolId, IModelApp.viewManager.selectedView); },
    });
  }

  public static get walkViewCommand() {
    return new ToolItemDef({
      toolId: WalkViewTool.toolId,
      iconSpec: "icon-walk",
      label: () => WalkViewTool.flyover,
      tooltip: () => WalkViewTool.description,
      execute: () => { IModelApp.tools.run(WalkViewTool.toolId, IModelApp.viewManager.selectedView); },
    });
  }

  public static get selectElementCommand() {
    return new ToolItemDef({
      toolId: SelectionTool.toolId,
      iconSpec: "icon-cursor",
      label: () => SelectionTool.flyover,
      tooltip: () => SelectionTool.description,
      execute: () => { IModelApp.tools.run(SelectionTool.toolId); },
    });
  }

  public static get toggleCameraViewCommand() {
    return new ToolItemDef({
      toolId: ViewToggleCameraTool.toolId,
      iconSpec: "icon-camera",
      label: () => ViewToggleCameraTool.flyover,
      tooltip: () => ViewToggleCameraTool.description,
      execute: () => { IModelApp.tools.run(ViewToggleCameraTool.toolId, IModelApp.viewManager.selectedView); },
    });
  }

  public static get flyViewCommand() {
    return new ToolItemDef({
      toolId: FlyViewTool.toolId,
      iconSpec: "icon-airplane",
      label: () => FlyViewTool.flyover,
      tooltip: () => FlyViewTool.description,
      execute: () => { IModelApp.tools.run(FlyViewTool.toolId, IModelApp.viewManager.selectedView); },
    });
  }

  public static get analysisAnimationCommand() {
    return new ToolItemDef({
      toolId: AnalysisAnimationTool.toolId,
      iconSpec: "icon-camera-animation",
      label: () => AnalysisAnimationTool.flyover,
      tooltip: () => AnalysisAnimationTool.description,
      execute: () => { IModelApp.tools.run(AnalysisAnimationTool.toolId); },
      stateSyncIds: [SyncUiEventId.ActiveContentChanged],
      stateFunc: (currentState: Readonly<BaseItemState>): BaseItemState => {
        const returnState: BaseItemState = { ...currentState };
        const activeContentControl = ContentViewManager.getActiveContentControl();

        if (activeContentControl && activeContentControl.viewport && (undefined !== activeContentControl.viewport.view.AnalysisStyle))
          returnState.isVisible = true;
        else
          returnState.isVisible = false;
        return returnState;
      },
    });
  }
}
