/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import {
  IModelApp, SelectionTool, FitViewTool, WindowAreaTool,
  PanViewTool, RotateViewTool, ViewToggleCameraTool, WalkViewTool, FlyViewTool, ZoomViewTool,
} from "@bentley/imodeljs-frontend";

import { ToolItemDef } from "./configurableui/Item";

/** Utility Class that provides definitions of tools provided by imodel.js core. These definitions can be used to populate the ui. */
export class CoreTools {
  public static get fitViewCommand() {
    return new ToolItemDef({
      toolId: FitViewTool.toolId,
      iconSpec: "icon-fit-to-view",
      labelKey: "CoreTools:tools.View.Fit.flyover",
      tooltipKey: "CoreTools:tools.View.Fit.description",
      execute: () => { IModelApp.tools.run(FitViewTool.toolId, IModelApp.viewManager.selectedView, true); },
    });
  }

  public static get windowAreaCommand() {
    return new ToolItemDef({
      toolId: WindowAreaTool.toolId,
      iconSpec: "icon-window-area",
      labelKey: "CoreTools:tools.View.WindowArea.flyover",
      tooltipKey: "CoreTools:tools.View.WindowArea.description",
      execute: () => { IModelApp.tools.run(WindowAreaTool.toolId, IModelApp.viewManager.selectedView); },
    });
  }

  public static get zoomViewCommand() {
    return new ToolItemDef({
      toolId: ZoomViewTool.toolId,
      iconSpec: "icon-zoom",
      labelKey: "CoreTools:tools.View.Zoom.flyover",
      tooltipKey: "CoreTools:tools.View.Zoom.description",
      execute: () => { IModelApp.tools.run(ZoomViewTool.toolId, IModelApp.viewManager.selectedView); },
    });
  }

  public static get panViewCommand() {
    return new ToolItemDef({
      toolId: PanViewTool.toolId,
      iconSpec: "icon-hand-2",
      labelKey: "CoreTools:tools.View.Pan.flyover",
      tooltipKey: "CoreTools:tools.View.Pan.description",
      execute: () => { IModelApp.tools.run(PanViewTool.toolId, IModelApp.viewManager.selectedView); },
    });
  }

  public static get rotateViewCommand() {
    return new ToolItemDef({
      toolId: RotateViewTool.toolId,
      iconSpec: "icon-rotate-left",
      labelKey: "CoreTools:tools.View.Rotate.flyover",
      tooltipKey: "CoreTools:tools.View.Rotate.description",
      execute: () => { IModelApp.tools.run(RotateViewTool.toolId, IModelApp.viewManager.selectedView); },
    });
  }

  public static get walkViewCommand() {
    return new ToolItemDef({
      toolId: WalkViewTool.toolId,
      iconSpec: "icon-walk",
      labelKey: "CoreTools:tools.View.Walk.flyover",
      tooltipKey: "CoreTools:tools.View.Walk.description",
      execute: () => { IModelApp.tools.run(WalkViewTool.toolId, IModelApp.viewManager.selectedView); },
    });
  }

  public static get selectElementCommand() {
    return new ToolItemDef({
      toolId: SelectionTool.toolId,
      iconSpec: "icon-cursor",
      labelKey: "CoreTools:tools.Select.flyover",
      tooltipKey: "CoreTools:tools.Select.description",
      execute: () => { IModelApp.tools.run(SelectionTool.toolId); },
    });
  }

  public static get toggleCameraViewCommand() {
    return new ToolItemDef({
      toolId: ViewToggleCameraTool.toolId,
      iconSpec: "icon-camera",
      labelKey: "UiFramework:tools.View.ToggleCamera.flyover",
      tooltipKey: "UiFramework:tools.View.ToggleCamera.description",
      execute: () => { IModelApp.tools.run(ViewToggleCameraTool.toolId, IModelApp.viewManager.selectedView); },
    });
  }

  public static get flyViewCommand() {
    return new ToolItemDef({
      toolId: FlyViewTool.toolId,
      iconSpec: "icon-airplane",
      labelKey: "UiFramework:tools.View.Fly.flyover",
      tooltipKey: "UiFramework:tools.View.Fly.description",
      execute: () => { IModelApp.tools.run(FlyViewTool.toolId, IModelApp.viewManager.selectedView); },
    });
  }

}
