/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tools */

import * as React from "react";

// cSpell:ignore configurableui keyinbrowser
import {
  FitViewTool, FlyViewTool, IModelApp, PanViewTool, RotateViewTool, SelectionTool, ViewToggleCameraTool, WalkViewTool,
  WindowAreaTool, ZoomViewTool, ViewUndoTool, ViewRedoTool,
  ViewClipDecorationProvider,
  ViewClipByShapeTool, ViewClipByRangeTool, ViewClipByElementTool, ViewClipByPlaneTool,

} from "@bentley/imodeljs-frontend";
import { PopupButton, PopupButtonChildrenRenderPropArgs } from "./toolbar/PopupButton";
import { GroupItemDef } from "./toolbar/GroupItem";
import { ViewFlags } from "@bentley/imodeljs-common";
import { ToolItemDef } from "./shared/ToolItemDef";
import { CustomItemDef } from "./shared/CustomItemDef";
import { CommandItemDef } from "./shared/CommandItemDef";
import { KeyinBrowser } from "./keyinbrowser/KeyinBrowser";
import { SyncUiEventId } from "./syncui/SyncUiEventDispatcher";
import { BaseItemState } from "../ui-framework/shared/ItemDefBase";
import { ContentViewManager } from "./content/ContentViewManager";
import { UiFramework } from "./UiFramework";

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
      <KeyinBrowser onExecute={closePanel} onCancel={closePanel} />
    );
  }

  public static get fitViewCommand() {
    return new ToolItemDef({
      toolId: FitViewTool.toolId,
      iconSpec: FitViewTool.iconSpec,
      label: () => FitViewTool.flyover,
      description: () => FitViewTool.description,
      execute: () => { IModelApp.tools.run(FitViewTool.toolId, IModelApp.viewManager.selectedView, true); },
    });
  }

  public static get windowAreaCommand() {
    return new ToolItemDef({
      toolId: WindowAreaTool.toolId,
      iconSpec: WindowAreaTool.iconSpec,
      label: () => WindowAreaTool.flyover,
      description: () => WindowAreaTool.description,
      execute: () => { IModelApp.tools.run(WindowAreaTool.toolId, IModelApp.viewManager.selectedView); },
    });
  }

  public static get zoomViewCommand() {
    return new ToolItemDef({
      toolId: ZoomViewTool.toolId,
      iconSpec: ZoomViewTool.iconSpec,
      label: () => ZoomViewTool.flyover,
      description: () => ZoomViewTool.description,
      execute: () => { IModelApp.tools.run(ZoomViewTool.toolId, IModelApp.viewManager.selectedView); },
    });
  }

  public static get panViewCommand() {
    return new ToolItemDef({
      toolId: PanViewTool.toolId,
      iconSpec: PanViewTool.iconSpec,
      label: () => PanViewTool.flyover,
      description: () => PanViewTool.description,
      execute: () => { IModelApp.tools.run(PanViewTool.toolId, IModelApp.viewManager.selectedView); },
    });
  }

  public static get rotateViewCommand() {
    return new ToolItemDef({
      toolId: RotateViewTool.toolId,
      iconSpec: RotateViewTool.iconSpec,
      label: () => RotateViewTool.flyover,
      description: () => RotateViewTool.description,
      execute: () => { IModelApp.tools.run(RotateViewTool.toolId, IModelApp.viewManager.selectedView); },
    });
  }

  public static get walkViewCommand() {
    return new ToolItemDef({
      toolId: WalkViewTool.toolId,
      iconSpec: WalkViewTool.iconSpec,
      label: () => WalkViewTool.flyover,
      description: () => WalkViewTool.description,
      execute: () => { IModelApp.tools.run(WalkViewTool.toolId, IModelApp.viewManager.selectedView); },
    });
  }

  public static get selectElementCommand() {
    return new ToolItemDef({
      toolId: SelectionTool.toolId,
      iconSpec: SelectionTool.iconSpec,
      label: () => SelectionTool.flyover,
      description: () => SelectionTool.description,
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
      description: () => ViewToggleCameraTool.description,
      execute: () => { IModelApp.tools.run(ViewToggleCameraTool.toolId, IModelApp.viewManager.selectedView); },
    });
  }

  public static get flyViewCommand() {
    return new ToolItemDef({
      toolId: FlyViewTool.toolId,
      iconSpec: FlyViewTool.iconSpec,
      label: () => FlyViewTool.flyover,
      description: () => FlyViewTool.description,
      execute: () => { IModelApp.tools.run(FlyViewTool.toolId, IModelApp.viewManager.selectedView); },
    });
  }

  // TODO - Need to provide a sync message that is fired when the Undo/Redo button needs to be refreshed in the
  // active view.
  public static get viewUndoCommand() {
    return new ToolItemDef({
      toolId: ViewUndoTool.toolId,
      iconSpec: ViewUndoTool.iconSpec,
      label: () => ViewUndoTool.flyover,
      description: () => ViewUndoTool.description,
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
      description: () => ViewRedoTool.description,
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

  public static get clearSelectionItemDef() {
    return new CommandItemDef({
      commandId: "UiFramework.ClearSelection",
      iconSpec: "icon-selection-clear",
      labelKey: "UiFramework:buttons.clearSelection",
      execute: () => {
        const iModelConnection = UiFramework.getIModelConnection();
        if (iModelConnection) {
          iModelConnection.selectionSet.emptyAll();
        }
        IModelApp.toolAdmin.startDefaultTool();
      },
    });
  }

  private static turnOnClipVolume() {
    const vp = IModelApp.viewManager.selectedView;
    if (!vp || !vp.view.is3d())
      return;

    // Turn on clip volume flag for section tools
    const viewFlags: ViewFlags = vp.view.viewFlags.clone();
    viewFlags.clipVolume = true;
    vp.viewFlags = viewFlags;
  }

  // note current ViewClipByPlaneTool is not automatically registered so the app must call ViewClipByPlaneTool.register();
  public static get sectionByPlaneCommandItemDef() {
    return new ToolItemDef({
      toolId: ViewClipByPlaneTool.toolId,
      iconSpec: ViewClipByPlaneTool.iconSpec,
      label: () => ViewClipByPlaneTool.flyover,
      description: () => ViewClipByPlaneTool.description,
      execute: () => {
        this.turnOnClipVolume();
        IModelApp.tools.run(ViewClipByPlaneTool.toolId, ViewClipDecorationProvider.create());
      },
    });
  }

  // note current ViewClipByElementTool is not automatically registered so the app must call ViewClipByElementTool.register();
  public static get sectionByElementCommandItemDef() {
    return new ToolItemDef({
      toolId: ViewClipByElementTool.toolId,
      iconSpec: ViewClipByElementTool.iconSpec,
      label: () => ViewClipByElementTool.flyover,
      description: () => ViewClipByElementTool.description,
      execute: () => {
        this.turnOnClipVolume();
        IModelApp.tools.run(ViewClipByElementTool.toolId, ViewClipDecorationProvider.create());
      },
    });
  }

  // note current ViewClipByRangeTool is not automatically registered so the app must call ViewClipByRangeTool.register();
  public static get sectionByRangeCommandItemDef() {
    return new ToolItemDef({
      toolId: ViewClipByRangeTool.toolId,
      iconSpec: ViewClipByRangeTool.iconSpec,
      label: () => ViewClipByRangeTool.flyover,
      description: () => ViewClipByRangeTool.description,
      execute: () => {
        this.turnOnClipVolume();
        IModelApp.tools.run(ViewClipByRangeTool.toolId, ViewClipDecorationProvider.create());
      },
    });
  }

  // note current ViewClipByShapeTool is not automatically registered so the app must call ViewClipByShapeTool.register();
  public static get sectionByShapeCommandItemDef() {
    return new ToolItemDef({
      toolId: ViewClipByShapeTool.toolId,
      iconSpec: ViewClipByShapeTool.iconSpec,
      label: () => ViewClipByShapeTool.flyover,
      description: () => ViewClipByShapeTool.description,
      execute: () => {
        this.turnOnClipVolume();
        IModelApp.tools.run(ViewClipByShapeTool.toolId, ViewClipDecorationProvider.create());
      },
    });
  }

  public static get sectionToolGroup() {
    ViewClipByElementTool.register();
    ViewClipByPlaneTool.register();
    ViewClipByRangeTool.register();
    ViewClipByShapeTool.register();

    return new GroupItemDef({
      groupId: "sectionTools-group",
      labelKey: "UiFramework:tools.sectionTools",
      iconSpec: "icon-section-tool",
      items: [this.sectionByPlaneCommandItemDef, this.sectionByElementCommandItemDef, this.sectionByRangeCommandItemDef, this.sectionByShapeCommandItemDef],
      itemsInColumn: 4,
    });
  }
}
