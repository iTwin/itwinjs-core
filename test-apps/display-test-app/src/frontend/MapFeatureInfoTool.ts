/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import {
  BeButtonEvent,
  DecorateContext,
  EventHandled,
  HitDetail,
  IModelApp,
  LocateFilterStatus,
  LocateResponse,
  MapLayerTileTreeReference,
  MapSubLayerFeatureInfo,
  MapTileTreeReference,
  PrimitiveTool,
  TileTreeReference,
} from "@itwin/core-frontend";
import { BeEvent } from "@itwin/core-bentley";
import { BaseMapLayerSettings } from "@itwin/core-common";
import { MapFeatureInfoDecorator } from "./MapFeatureInfoDecorator";

export class DefaultMapFeatureInfoTool extends PrimitiveTool {
  public static readonly onMapHit = new BeEvent<(hit: HitDetail|undefined) => void>();
  public static override toolId = "MapFeatureInfoTool";
  public static override iconSpec = "icon-map";
  private baseMapModelId: string|undefined;
  private _decorator: MapFeatureInfoDecorator = new MapFeatureInfoDecorator();

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
    if (hit !== undefined && hit.isMapHit) {
      /// //////////////////////////
      // This needs to move somewhere else
      // const widgetDef = UiFramework.frontstages.findWidget(
      //   FeatureInfoUiItemsProvider.widgetId
      // );
      // if (widgetDef && widgetDef.state !== WidgetState.Open) // eslint-disable-line deprecation/deprecation
      //   widgetDef.setWidgetState(WidgetState.Open); // eslint-disable-line deprecation/deprecation

      const mapInfo = await hit.viewport.getMapFeatureInfo(hit);
      console.log("Map feature info retrieved");
      if (mapInfo.layerInfo && mapInfo.layerInfo.length > 0 ) {
        const layerInfo = mapInfo.layerInfo[0];
        if (layerInfo.info && !(layerInfo.info instanceof HTMLElement) && layerInfo.info && layerInfo.info.length>0 )
          this._decorator.setState({mapHit:hit, graphics: layerInfo.info[0].graphics});
      }

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

  public override decorate(context: DecorateContext): void {
    this._decorator.decorate(context);
  }
}
