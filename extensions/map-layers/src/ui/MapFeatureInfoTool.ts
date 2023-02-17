/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import {
  BeButtonEvent,
  EventHandled,
  HitDetail,
  IModelApp,
  LocateFilterStatus,
  LocateResponse,
  MapLayerTileTreeReference,
  MapTileTreeReference,
  PrimitiveTool,
  TileTreeReference,
} from "@itwin/core-frontend";
import { WidgetState } from "@itwin/appui-abstract";
import { ToolItemDef, UiFramework } from "@itwin/appui-react";
import { BeEvent } from "@itwin/core-bentley";
import { FeatureInfoUiItemsProvider } from "./FeatureInfoUiItemsProvider";
import { BaseMapLayerSettings } from "@itwin/core-common";

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
  private baseMapModelId: string|undefined;

  public override requireWriteableTarget(): boolean {
    return false;
  }

  public override async onPostInstall() {
    await super.onPostInstall();
    this.initLocateElements();
    IModelApp.locateManager.options.allowDecorations = true;

    if (this.targetView) {
      const vp = this.targetView;
      vp.forEachMapTreeRef((mapRef: TileTreeReference) => {
        if (this.baseMapModelId === undefined && mapRef instanceof MapTileTreeReference) {
          mapRef.forEachLayerTileTreeRef((layerRef: TileTreeReference) => {
            if (this.baseMapModelId === undefined && layerRef instanceof MapLayerTileTreeReference) {
              if (layerRef.layerSettings instanceof BaseMapLayerSettings)
                this.baseMapModelId = layerRef.treeOwner.tileTree?.modelId;
            }
          });
        }
      });
    }
  }

  public override async getToolTip(hit: HitDetail): Promise<HTMLElement | string> {
    return hit.sourceId !== undefined ? hit.sourceId : "";
  }

  public override async filterHit(hit: HitDetail, _out?: LocateResponse): Promise<LocateFilterStatus> {
    return hit.isMapHit && hit.sourceId !== this.baseMapModelId ? LocateFilterStatus.Accept : LocateFilterStatus.Reject;
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
