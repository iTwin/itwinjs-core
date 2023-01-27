/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import {
  BeButtonEvent,
  EventHandled,
  HitDetail,
  IModelApp,
  LocateResponse,
  PrimitiveTool,
} from "@itwin/core-frontend";
import { WidgetState } from "@itwin/appui-abstract";
import { FrontstageManager, ToolItemDef } from "@itwin/appui-react";
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
  public static readonly onMapHit = new BeEvent<(hit: HitDetail) => void>();
  public static override toolId = "MapFeatureInfoTool";
  public static override iconSpec = "icon-map";

  public override requireWriteableTarget(): boolean {
    return false;
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
      const widgetDef = FrontstageManager.findWidget(
        FeatureInfoUiItemsProvider.widgetId
      );
      if (widgetDef && widgetDef.state !== WidgetState.Open) // eslint-disable-line deprecation/deprecation
        widgetDef.setWidgetState(WidgetState.Open); // eslint-disable-line deprecation/deprecation

      DefaultMapFeatureInfoTool.onMapHit.raiseEvent(hit);
      return EventHandled.Yes;
    }

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
