/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import {
  AccuDrawHintBuilder,
  BeButtonEvent,
  EventHandled,
  HitDetail,
  IModelApp,
  LocateResponse,
  PrimitiveTool,
} from "@itwin/core-frontend";
import { WidgetState } from "@itwin/appui-abstract";
import { ToolItemDef, UiFramework } from "@itwin/appui-react";
import { BeEvent } from "@itwin/core-bentley";
import { FeatureInfoUiItemsProvider } from "./FeatureInfoUiItemsProvider";

export const getDefaultMapFeatureInfoToolItemDef = (): ToolItemDef =>
  new ToolItemDef({
    toolId: DefaultMapFeatureInfoTool.toolId,
    iconSpec: DefaultMapFeatureInfoTool.iconSpec,
    label: () => DefaultMapFeatureInfoTool.flyover,
    description: () => DefaultMapFeatureInfoTool.description,
    execute: async () => { await IModelApp.tools.run(DefaultMapFeatureInfoTool.toolId); },
  });

export class DefaultMapFeatureInfoTool extends PrimitiveTool {
  public static readonly onMapHit = new BeEvent<(hit: HitDetail|undefined) => void>();
  public static override toolId = "MapFeatureInfoTool";
  public static override iconSpec = "icon-map";

  public override requireWriteableTarget(): boolean {
    return false;
  }

  public setupAndPromptForNextAction(): void {
    // NOTE: Tool should call IModelApp.notifications.outputPromptByKey or IModelApp.notifications.outputPrompt to tell user what to do.
    IModelApp.accuSnap.enableSnap(true); // Enable AccuSnap so that linestring can be created by snapping to existing geometry

    const hints = new AccuDrawHintBuilder();
    hints.sendHints();
  }

  public override async onMouseMotion(_ev: BeButtonEvent): Promise<void> {
    // const hit = await IModelApp.locateManager.doLocate(
    //   new LocateResponse(),
    //   true,
    //   ev.point,
    //   ev.viewport,
    //   ev.inputSource
    // );
    // console.log(`isMapHit: ${hit?.isMapHit} modelId: ${hit?.modelId} sourceId: ${hit?.sourceId} subCategoryId: ${hit?.subCategoryId}`);
  }

  public override async onDataButtonDown(
    ev: BeButtonEvent
  ): Promise<EventHandled> {
    const hit = await IModelApp.locateManager.doLocate(
      new LocateResponse(),
      true,
      ev.point,
      ev.viewport,
      ev.inputSource
    );
    if (hit !== undefined) {
      const widgetDef = UiFramework.frontstages.findWidget(
        FeatureInfoUiItemsProvider.widgetId
      );
      if (widgetDef && widgetDef.state !== WidgetState.Open) // eslint-disable-line deprecation/deprecation
        widgetDef.setWidgetState(WidgetState.Open); // eslint-disable-line deprecation/deprecation

      DefaultMapFeatureInfoTool.onMapHit.raiseEvent(hit);
      return EventHandled.Yes;
    }
    DefaultMapFeatureInfoTool.onMapHit.raiseEvent(hit);
    return EventHandled.No;
  }

  public override async onResetButtonUp(
    _ev: BeButtonEvent
  ): Promise<EventHandled> {
    /* Common reset behavior for primitive tools is calling onReinitialize to restart or exitTool to terminate. */
    await this.onReinitialize();
    return EventHandled.No;
  }

  public async onRestartTool() {
    const tool = new DefaultMapFeatureInfoTool();
    if (!(await tool.run()))
      return this.exitTool();
  }
}
