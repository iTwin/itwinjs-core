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
  MapTileTreeReference,
  PrimitiveTool,
  TileTreeReference,
  Viewport,
} from "@itwin/core-frontend";
import { BeEvent } from "@itwin/core-bentley";
import { BaseMapLayerSettings, IModel, ImageMapLayerSettings, MapLayerSettings } from "@itwin/core-common";
import { MapFeatureInfoDecorator } from "./MapFeatureInfoDecorator";

export class DefaultMapFeatureInfoTool extends PrimitiveTool {
  public static readonly onMapHit = new BeEvent<(hit: HitDetail | undefined) => void>();

  public static override toolId = "MapFeatureInfoTool";
  public static override iconSpec = "icon-map";

  private _decorator: MapFeatureInfoDecorator = new MapFeatureInfoDecorator();
  private _layerSettingsCache = new Map<string, ImageMapLayerSettings[]>;
  private readonly _detachListeners: VoidFunction[] = [];

  private static readonly _supportedFormats = ['ArcGISFeature'];

  public override requireWriteableTarget(): boolean {
    return false;
  }

  public override async onPostInstall() {
    await super.onPostInstall();
    this.initLocateElements();
    IModelApp.locateManager.options.allowDecorations = true;

    this.updateMapLayerSettingsCache();

    // Listen of display style configuration changes, that we don't have to restart the tool to be up to date.
    const vp = this.targetView;
    if (vp) {

      this._detachListeners.push(vp.onChangeView.addListener((vp, _previous) => {
        this.updateMapLayerSettingsCache(vp);
      }));

      this._detachListeners.push(vp.displayStyle.settings.onMapImageryChanged.addListener((_newImagery: any) => {
        this.updateMapLayerSettingsCache();
      }));
    }

    IModelApp.viewManager.addDecorator(this._decorator);
  }

  public override async onCleanup() {
    this._detachListeners.forEach((f) => f());
    this._detachListeners.length = 0;

    IModelApp.viewManager.dropDecorator(this._decorator);
  }

  private getMapLayerSettingsFromTileTreeId(tileTreeId: string) {
    return this._layerSettingsCache.get(tileTreeId) ?? [];
  }

  private updateMapLayerSettingsCache(vp?: Viewport) {

    if (!vp) {
      if (this.targetView)
        vp = this.targetView;
      else
        return;
    }
    this._layerSettingsCache.clear();
    vp.forEachMapTreeRef((mapRef: TileTreeReference) => {
      if (mapRef instanceof MapTileTreeReference) {
        mapRef.forEachLayerTileTreeRef((layerRef: TileTreeReference) => {
          if (layerRef instanceof MapLayerTileTreeReference
            && layerRef.layerSettings instanceof ImageMapLayerSettings
            && DefaultMapFeatureInfoTool._supportedFormats.includes(layerRef.layerSettings.formatId)
            && layerRef.treeOwner.tileTree?.modelId) {

            const entry = this._layerSettingsCache.get(layerRef.treeOwner.tileTree?.modelId);
            this._layerSettingsCache.set(layerRef.treeOwner.tileTree?.modelId, (entry ? [...entry, layerRef.layerSettings] : [layerRef.layerSettings]));
          }
        });
      }
    });
  }

  public override async getToolTip(hit: HitDetail): Promise<HTMLElement | string> {
    if (hit.isMapHit) {
      const settings = this.getMapLayerSettingsFromTileTreeId(hit.sourceId);
      if (settings.length > 0) {
        const names = settings.map(setting => setting.name);
        return `Layer${names.length > 1 ? 's' : ''}: ${names.join(', ')}"`
      }
    }
    return "";
  }

  public override async filterHit(hit: HitDetail, _out?: LocateResponse): Promise<LocateFilterStatus> {
    return hit.isMapHit && this.getMapLayerSettingsFromTileTreeId(hit.sourceId).length > 0 ? LocateFilterStatus.Accept : LocateFilterStatus.Reject;
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
    if (hit !== undefined && hit.isMapHit && this.getMapLayerSettingsFromTileTreeId(hit.sourceId).length > 0) {
      IModelApp.toolAdmin.setCursor("wait");
      try {
        const mapInfo = await hit.viewport.getMapFeatureInfo(hit);
        if (mapInfo.layerInfo && mapInfo.layerInfo.length > 0) {
          const layerInfo = mapInfo.layerInfo[0];
          if (layerInfo.info && !(layerInfo.info instanceof HTMLElement) && layerInfo.info && layerInfo.info.length > 0)
            this._decorator.setState({ mapHit: hit, graphics: layerInfo.info[0].graphics });
        }
      } finally {
        IModelApp.toolAdmin.setCursor(undefined);
        DefaultMapFeatureInfoTool.onMapHit.raiseEvent(hit);
      }

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
