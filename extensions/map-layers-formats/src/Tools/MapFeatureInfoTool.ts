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
  MapFeatureInfo,
  PrimitiveTool,
} from "@itwin/core-frontend";
import { BeEvent } from "@itwin/core-bentley";
import { ImageMapLayerSettings, MapLayerSettings } from "@itwin/core-common";
import { MapFeatureInfoDecorator } from "./MapFeatureInfoDecorator";

export interface MapFeatureInfoToolData {
  hit: HitDetail;
  mapInfo?: MapFeatureInfo;
}

export class MapFeatureInfoTool extends PrimitiveTool {
  public readonly onInfoReady = new BeEvent<(data: MapFeatureInfoToolData) => void>();

  public static override toolId = "MapFeatureInfoTool";
  public static override iconSpec = "icon-map";

  private _decorator: MapFeatureInfoDecorator = new MapFeatureInfoDecorator();
  private _layerSettingsCache = new Map<string, MapLayerSettings[]>();
  private readonly _detachListeners: VoidFunction[] = [];

  private static readonly _supportedFormats = ["ArcGISFeature", "ArcGIS"];

  public override requireWriteableTarget(): boolean {
    return false;
  }

  public override async onPostInstall() {
    await super.onPostInstall();
    this.initLocateElements();
    IModelApp.locateManager.options.allowDecorations = true;

    this._layerSettingsCache.clear();

    // Listen of display style configuration changes, that we don't have to restart the tool to be up to date.
    const vp = this.targetView;
    if (vp) {

      this._detachListeners.push(vp.onChangeView.addListener((_vp, _previous) => {
        this._layerSettingsCache.clear();
      }));

      this._detachListeners.push(vp.displayStyle.settings.onMapImageryChanged.addListener((_newImagery: any) => {
        this._layerSettingsCache.clear();
      }));
    }

    IModelApp.viewManager.addDecorator(this._decorator);
  }

  public override async onCleanup() {
    this._detachListeners.forEach((f) => f());
    this._detachListeners.length = 0;

    IModelApp.viewManager.dropDecorator(this._decorator);
  }

  private getSettingsFromHit(hit: HitDetail) {
    let settingsFromHit: MapLayerSettings[] = [];
    const fromCache = this._layerSettingsCache.get(hit.sourceId);
    if (fromCache) {
      settingsFromHit = fromCache;
    } else if (this.targetView) {
      settingsFromHit = this.targetView?.mapLayerFromHit(hit).filter(((settings) => settings instanceof ImageMapLayerSettings && MapFeatureInfoTool._supportedFormats.includes(settings.formatId)));
      this._layerSettingsCache.set(hit.sourceId, settingsFromHit);
    }

    return settingsFromHit;
  }

  public override async getToolTip(hit: HitDetail): Promise<HTMLElement | string> {
    const settings = this.getSettingsFromHit(hit);
    if (settings.length > 0) {
      const names = settings.map((setting) => setting.name);
      return `Layer${names.length > 1 ? "s" : ""}: ${names.join(", ")}`;
    }
    return "";
  }

  public override async filterHit(hit: HitDetail, _out?: LocateResponse): Promise<LocateFilterStatus> {
    return this.getSettingsFromHit(hit).length > 0 ? LocateFilterStatus.Accept : LocateFilterStatus.Reject;
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
      let mapInfo: MapFeatureInfo | undefined;
      if (this.getSettingsFromHit(hit).length > 0) {
        IModelApp.toolAdmin.setCursor("wait");
        try {
          mapInfo = await hit.viewport.getMapFeatureInfo(hit);
          if (mapInfo) {
            this._decorator.setState({ hit, mapInfo });
          }
        } finally {
          IModelApp.toolAdmin.setCursor(undefined);
        }
      }

      this.onInfoReady.raiseEvent({ hit, mapInfo });
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

  public override async onRestartTool() {
    const tool = new MapFeatureInfoTool();
    if (!(await tool.run()))
      return this.exitTool();
  }
}
