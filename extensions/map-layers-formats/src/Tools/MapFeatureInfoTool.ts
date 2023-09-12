/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module MapLayersFormats
 */

import {
  BeButtonEvent,
  EventHandled,
  HitDetail,
  IModelApp,
  LocateFilterStatus,
  LocateResponse,
  MapFeatureInfo,
  MapLayerInfoFromTileTree,
  MapLayerScaleRangeVisibility,
  MapTileTreeScaleRangeVisibility,
  PrimitiveTool,
} from "@itwin/core-frontend";
import { BeEvent } from "@itwin/core-bentley";
import { ImageMapLayerSettings, MapImageryProps, MapImagerySettings, MapLayerProps } from "@itwin/core-common";
import { MapFeatureInfoDecorator } from "./MapFeatureInfoDecorator";

/** Data provided every time [[MapFeatureInfoTool]] retrieve feature information.
 * @see [[MapFeatureInfoToolData]]
 * @beta
 */
export interface MapFeatureInfoToolData {
  hit: HitDetail;
  mapInfo?: MapFeatureInfo;
}

class ActiveMapLayerState {
  public activeMapLayers: MapLayerInfoFromTileTree[]|undefined;

  public get hasMapLayers() { return (this.activeMapLayers && this.activeMapLayers.length > 0);}

  public compareWithImagerySettings(imagery: MapImageryProps) {
    const result = {exists: false, hidden: false};
    if (this.hasMapLayers) {
      const oldMls = this.activeMapLayers![0];    // consider only first layer for now

      let newMls: MapLayerProps|undefined;
      if (oldMls.isBaseLayer) {
        if (typeof (imagery.backgroundBase) !== "number") {
          newMls = imagery.backgroundBase;
        }
      } else if (oldMls.index?.isOverlay && imagery.overlayLayers && imagery.overlayLayers.length > oldMls.index.index) {
        newMls = imagery.overlayLayers[oldMls.index.index];

      } else if ((oldMls.index !== undefined) && imagery.backgroundLayers && imagery.backgroundLayers.length > oldMls.index.index) {
        newMls = imagery.backgroundLayers[oldMls.index.index];
      }

      // We want to make sure that newMls and OldMls are the same (but ignoring the 'visible' flag).
      // by using the serialized JSON object
      let tmpNewMls = newMls;
      if (newMls && newMls.visible !== oldMls.settings.visible) {
        tmpNewMls = {...newMls, visible: oldMls.settings.visible};
      }
      const newJson = tmpNewMls ? JSON.stringify(tmpNewMls) : "";
      const oldJson = JSON.stringify(oldMls.settings.toJSON());

      if (newJson === oldJson ) {
        // We consider newMls and OldMls to be the same mapLayer instance.
        result.exists = true;
        result.hidden = !newMls!.visible;
      }

    }
    return result;
  }

  public compareWithScaleRangeVisibility(layerIndexes: MapLayerScaleRangeVisibility[]) {
    if (this.hasMapLayers) {
      const currentMls = this.activeMapLayers![0];    // consider only first layer for now
      for (const scaleRangeVisibility of layerIndexes) {
        if (currentMls.index?.index === scaleRangeVisibility.index) {
          return scaleRangeVisibility.visibility === MapTileTreeScaleRangeVisibility.Hidden;
        }
      }
    }
    return undefined;

  }
}
/** Tools that allow extracting feature information from map-layers.
 * Simulate feature highlight by drawing overlay decorations.  It also
 * fire an event that provide further feature information meant to be displayed in a UI / Widget.
 * @see [[MapFeatureInfoToolData]]
 * @beta
 */
export class MapFeatureInfoTool extends PrimitiveTool {
  public readonly onInfoReady = new BeEvent<(data: MapFeatureInfoToolData) => void>();

  public static override toolId = "MapFeatureInfoTool";
  public static override iconSpec = "icon-map";

  private _decorator: MapFeatureInfoDecorator = new MapFeatureInfoDecorator();
  private _layerSettingsCache = new Map<string, MapLayerInfoFromTileTree[]>();

  private _state: ActiveMapLayerState = new ActiveMapLayerState();
  private readonly _detachListeners: VoidFunction[] = [];
  private  _detachOnMapImageryChanged: VoidFunction|undefined;

  public override requireWriteableTarget(): boolean {
    return false;
  }

  public override async onPostInstall() {
    await super.onPostInstall();
    this.initLocateElements();
    IModelApp.locateManager.options.allowDecorations = true;

    this._layerSettingsCache.clear();

    // Listen of display style configuration changes, that way we don't have to restart the tool to be up to date.
    const vp = this.targetView;
    if (vp) {
      const mapImageryChangeHandler = (newImagery: Readonly<MapImagerySettings>) => {
        if (this._state.hasMapLayers) {
          const result = this._state.compareWithImagerySettings(newImagery.toJSON());
          if (result.exists) {
            this._decorator.hidden = result.hidden;
          } else {
            this._decorator.clearState();   // Flush existing decorations until another click is made
          }
          vp.invalidateDecorations();
        }
        this._layerSettingsCache.clear();
      };

      this._detachListeners.push(vp.onChangeView.addListener((viewport, _previousViewState) => {

        // When a saved view is loaded, 'onMapImageryChanged' events are no longer handled, we
        // have to re-attach.
        if (this._detachOnMapImageryChanged) {
          this._detachOnMapImageryChanged();
        }
        this._detachOnMapImageryChanged = viewport.displayStyle.settings.onMapImageryChanged.addListener(mapImageryChangeHandler);

        if (this._state.hasMapLayers) {
          const result = this._state.compareWithImagerySettings({
            backgroundBase: viewport.displayStyle.backgroundMapBase.toJSON(),
            backgroundLayers: viewport.displayStyle.getMapLayers(false).map((value) => value.toJSON()),
            overlayLayers: viewport.displayStyle.getMapLayers(true).map((value) => value.toJSON()),
          });
          if (result.exists) {
            this._decorator.hidden = result.hidden;
          } else {
            this._decorator.clearState();   // Flush existing decorations until another click is made
          }
          vp.invalidateDecorations();
        }
        this._layerSettingsCache.clear();
      }));

      this._detachOnMapImageryChanged = vp.displayStyle.settings.onMapImageryChanged.addListener(mapImageryChangeHandler);

      // Every time a layer goes out of range it, its associated decoration should be hidden (and restore if enter again the range)
      this._detachListeners.push(vp.onMapLayerScaleRangeVisibilityChanged.addListener(((layerIndexes: MapLayerScaleRangeVisibility[]) => {
        if (this._state.hasMapLayers) {
          const hidden = this._state.compareWithScaleRangeVisibility(layerIndexes);
          if (hidden !== undefined) {
            this._decorator.hidden = hidden;
            vp.invalidateDecorations();
          }
        }
        this._layerSettingsCache.clear();
      })));

    }

    IModelApp.viewManager.addDecorator(this._decorator);
  }

  public override async onCleanup() {
    this._detachListeners.forEach((f) => f());
    this._detachListeners.length = 0;

    IModelApp.viewManager.dropDecorator(this._decorator);
  }

  /** @internal */
  private getMapLayerInfoFromHit(hit: HitDetail) {
    let mapLayerFromHit: MapLayerInfoFromTileTree[] = [];
    const fromCache = this._layerSettingsCache.get(hit.sourceId);
    if (fromCache) {
      mapLayerFromHit = fromCache;
    } else if (this.targetView) {
      mapLayerFromHit = this.targetView?.mapLayerFromHit(hit).filter(((info) => info.settings instanceof ImageMapLayerSettings && info.provider?.supportsMapFeatureInfo));
      this._layerSettingsCache.set(hit.sourceId, mapLayerFromHit);
    }

    return mapLayerFromHit;
  }

  public override async getToolTip(hit: HitDetail): Promise<HTMLElement | string> {
    const infos = this.getMapLayerInfoFromHit(hit);
    if (infos.length > 0) {
      const names = infos.map((info) => info.settings.name);
      return `Layer${names.length > 1 ? "s" : ""}: ${names.join(", ")}`;
    }
    return "";
  }

  public override async filterHit(hit: HitDetail, _out?: LocateResponse): Promise<LocateFilterStatus> {
    return this.getMapLayerInfoFromHit(hit).length > 0 ? LocateFilterStatus.Accept : LocateFilterStatus.Reject;
  }

  public override async onDataButtonDown(
    ev: BeButtonEvent,
  ): Promise<EventHandled> {
    const hit = await IModelApp.locateManager.doLocate(
      new LocateResponse(),
      true,
      ev.point,
      ev.viewport,
      ev.inputSource,
    );
    if (hit !== undefined) {
      let mapInfo: MapFeatureInfo | undefined;

      const mapLayersHit = this.getMapLayerInfoFromHit(hit);
      if (mapLayersHit.length > 0) {
        this._state.activeMapLayers = mapLayersHit;
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
    _ev: BeButtonEvent,
  ): Promise<EventHandled> {
    this._state.activeMapLayers = undefined;
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
