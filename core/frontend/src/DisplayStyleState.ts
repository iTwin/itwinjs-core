/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */
import { assert, BeEvent, Id64, Id64String } from "@itwin/core-bentley";
import { Angle, Range1d, Vector3d } from "@itwin/core-geometry";
import {
  BackgroundMapProps, BackgroundMapProvider, BackgroundMapProviderProps, BackgroundMapSettings,
  BaseLayerSettings, BaseMapLayerSettings, ColorDef, ContextRealityModelProps, DisplayStyle3dSettings, DisplayStyle3dSettingsProps,
  DisplayStyleProps, DisplayStyleSettings, Environment, FeatureAppearance, GlobeMode, LightSettings, MapLayerProps,
  MapLayerSettings, MapSubLayerProps, RenderSchedule, RenderTimelineProps,
  SolarShadowSettings, SubCategoryOverride, SubLayerId, TerrainHeightOriginMode, ThematicDisplay, ThematicDisplayMode, ThematicGradientMode, ViewFlags,
} from "@itwin/core-common";
import { ApproximateTerrainHeights } from "./ApproximateTerrainHeights";
import { BackgroundMapGeometry } from "./BackgroundMapGeometry";
import { ContextRealityModelState } from "./ContextRealityModelState";
import { ElementState } from "./EntityState";
import { IModelApp } from "./IModelApp";
import { IModelConnection } from "./IModelConnection";
import { PlanarClipMaskState } from "./PlanarClipMaskState";
import { RenderScheduleState } from "./RenderScheduleState";
import { getCesiumOSMBuildingsUrl, MapCartoRectangle, TileTreeReference } from "./tile/internal";
import { viewGlobalLocation, ViewGlobalLocationConstants } from "./ViewGlobalLocation";
import { ScreenViewport } from "./Viewport";

/** @internal */
export class TerrainDisplayOverrides {
  public wantSkirts?: boolean;
  public wantNormals?: boolean;
}
/** Options controlling display of [OpenStreetMap Buildings](https://cesium.com/platform/cesium-ion/content/cesium-osm-buildings/).
 * @see [[DisplayStyleState.setOSMBuildingDisplay]].
 * @public
 */
export interface OsmBuildingDisplayOptions {
  /** If defined, enables or disables display of the buildings by attaching or detaching the OpenStreetMap Buildings reality model. */
  onOff?: boolean;
  /** If defined, overrides aspects of the appearance of the OpenStreetMap building meshes. */
  appearanceOverrides?: FeatureAppearance;
}

/** A DisplayStyle defines the parameters for 'styling' the contents of a [[ViewState]].
 * @public
 */
export abstract class DisplayStyleState extends ElementState implements DisplayStyleProps {
  /** @internal */
  public static override get className() { return "DisplayStyle"; }
  private _scheduleState?: RenderScheduleState;
  private _ellipsoidMapGeometry: BackgroundMapGeometry | undefined;
  private _attachedRealityModelPlanarClipMasks = new Map<Id64String, PlanarClipMaskState>();
  /** Event raised just before the [[scheduleScriptReference]] property is changed. */
  public readonly onScheduleScriptReferenceChanged = new BeEvent<(newScriptReference: RenderSchedule.ScriptReference | undefined) => void>();
  /** Event raised just after [[setOSMBuildingDisplay]] changes the enabled state of the OSM buildings. */
  public readonly onOSMBuildingDisplayChanged = new BeEvent<(osmBuildingDisplayEnabled: boolean) => void>();

  /** The container for this display style's settings. */
  public abstract get settings(): DisplayStyleSettings;

  /** @internal */
  public abstract overrideTerrainDisplay(): TerrainDisplayOverrides | undefined;

  /** Construct a new DisplayStyleState from its JSON representation.
   * @param props JSON representation of the display style.
   * @param iModel IModelConnection containing the display style.
   * @param source If the constructor is being invoked from [[EntityState.clone]], the display style that is being cloned.
   */
  constructor(props: DisplayStyleProps, iModel: IModelConnection, source?: DisplayStyleState) {
    super(props, iModel);
    const styles = this.jsonProperties.styles;

    if (source)
      this._scheduleState = source._scheduleState;

    if (styles) {
      // ###TODO Use DisplayStyleSettings.planarClipMasks
      if (styles.planarClipOvr)
        for (const planarClipOvr of styles.planarClipOvr)
          if (Id64.isValid(planarClipOvr.modelId))
            this._attachedRealityModelPlanarClipMasks.set(planarClipOvr.modelId, PlanarClipMaskState.fromJSON(planarClipOvr));
    }
  }

  /** Ensures all of the data required by the display style is loaded. This method is invoked for you by [[ViewState.load]], but if
   * you obtain a display style by some other means you should `await` this method before using the display style.
   */
  public async load(): Promise<void> {
    // If we were cloned, we may already have a valid schedule state, and our display style Id may be invalid / different.
    // Preserve it if still usable.
    if (this._scheduleState) {
      if (this.settings.renderTimeline === this._scheduleState.sourceId) {
        // The script came from the same RenderTimeline element. Keep it.
        return;
      }

      if (undefined === this.settings.renderTimeline) {
        // The script cam from a display style's JSON properties. Keep it if (1) this style is not persistent or (2) this style has the same Id
        if (this.id === this._scheduleState.sourceId || !Id64.isValidId64(this.id))
          return;
      }
    }

    this._scheduleState = await this.loadScheduleState();
  }

  private async loadScheduleState(): Promise<RenderScheduleState | undefined> {
    // The script can be stored on a separate RenderTimeline element (new, preferred way); or stuffed into the display style's JSON properties (old, deprecated way).
    try {
      let script;
      let sourceId;
      if (this.settings.renderTimeline) {
        const timeline = await this.iModel.elements.loadProps(this.settings.renderTimeline, { renderTimeline: { omitScriptElementIds: true } }) as RenderTimelineProps;
        if (timeline) {
          const scriptProps = JSON.parse(timeline.script);
          script = RenderSchedule.Script.fromJSON(scriptProps);
          sourceId = this.settings.renderTimeline;
        }
      } else if (this.settings.scheduleScriptProps) { // eslint-disable-line deprecation/deprecation
        // eslint-disable-next-line deprecation/deprecation
        script = RenderSchedule.Script.fromJSON(this.settings.scheduleScriptProps);
        sourceId = this.id;
      }

      return (script && sourceId) ? new RenderScheduleState(sourceId, script) : undefined;
    } catch {
      return undefined;
    }
  }

  /** @internal */
  public get displayTerrain() {
    return this.viewFlags.backgroundMap && this.settings.backgroundMap.applyTerrain;
  }

  /** @internal */
  public get globeMode(): GlobeMode { return this.settings.backgroundMap.globeMode; }

  /** @internal */
  public get backgroundMapLayers(): MapLayerSettings[] { return this.settings.mapImagery.backgroundLayers; }

  /** @beta */
  public get backgroundMapBase(): BaseLayerSettings {
    return this.settings.mapImagery.backgroundBase;
  }
  public set backgroundMapBase(base: BaseLayerSettings) {
    this.settings.mapImagery.backgroundBase = base;
    this._synchBackgroundMapImagery();
  }

  /** @internal */
  public get overlayMapLayers(): MapLayerSettings[] { return this.settings.mapImagery.overlayLayers; }

  /** The settings controlling how a background map is displayed within a view.
   * @see [[ViewFlags.backgroundMap]] for toggling display of the map on or off.
   */
  public get backgroundMapSettings(): BackgroundMapSettings { return this.settings.backgroundMap; }
  public set backgroundMapSettings(settings: BackgroundMapSettings) {
    this.settings.backgroundMap = settings;
  }

  /** Modify a subset of the background map display settings.
   * @param name props JSON representation of the properties to change. Any properties not present will retain their current values in `this.backgroundMapSettings`.
   * @see [[ViewFlags.backgroundMap]] for toggling display of the map.
   * @see [[changeBackgroundMapProvider]] to change the type of map imagery displayed.
   *
   * Example that changes only the elevation, leaving the provider and type unchanged:
   * ``` ts
   *  style.changeBackgroundMapProps({ groundBias: 16.2 });
   * ```
   */
  public changeBackgroundMapProps(props: BackgroundMapProps): void {
    const newSettings = this.backgroundMapSettings.clone(props);
    this.backgroundMapSettings = newSettings;
  }

  /** Change aspects of the [BackgroundMapProvider]($common) from which background map imagery is obtained.
   * Any properties not explicitly specified by `props` will retain their current values.
   * @public
   */
  public changeBackgroundMapProvider(props: BackgroundMapProviderProps): void {
    const provider = BackgroundMapProvider.fromJSON(props);
    const base = this.settings.mapImagery.backgroundBase;
    if (base instanceof ColorDef)
      this.settings.mapImagery.backgroundBase = BaseMapLayerSettings.fromProvider(provider);
    else
      this.settings.mapImagery.backgroundBase = base.cloneWithProvider(provider);

    this._synchBackgroundMapImagery();
  }

  /** Call a function for each reality model attached to this display style.
   * @see [DisplayStyleSettings.contextRealityModels]($common).
   */
  public forEachRealityModel(func: (model: ContextRealityModelState) => void): void {
    for (const model of this.settings.contextRealityModels.models) {
      assert(model instanceof ContextRealityModelState);
      func(model);
    }
  }

  /** @internal */
  public forEachRealityTileTreeRef(func: (ref: TileTreeReference) => void): void {
    this.forEachRealityModel((model) => func(model.treeRef));
  }

  /** @internal */
  public forEachTileTreeRef(func: (ref: TileTreeReference) => void): void {
    this.forEachRealityTileTreeRef(func);
  }

  /** Performs logical comparison against another display style. Two display styles are logically equivalent if they have the same name, Id, and settings.
   * @param other The display style to which to compare.
   * @returns true if the specified display style is logically equivalent to this display style - i.e., both styles have the same values for all of their settings.
   */
  public equalState(other: DisplayStyleState): boolean {
    if (this.name !== other.name || this.id !== other.id)
      return false;
    else
      return JSON.stringify(this.settings) === JSON.stringify(other.settings);
  }

  /** The name of this DisplayStyle */
  public get name(): string { return this.code.value; }

  /** Change the Id of the [RenderTimeline]($backend) element that hosts the [RenderSchedule.Script]($common) to be applied by this display style for
   * animating the contents of the view.
   */
  public async changeRenderTimeline(timelineId: Id64String | undefined): Promise<void> {
    if (timelineId === this.settings.renderTimeline)
      return;

    const script = await this.loadScheduleState();
    this.onScheduleScriptReferenceChanged.raiseEvent(script);
    this._scheduleState = script;
  }

  /** The [RenderSchedule.Script]($common) that animates the contents of the view, if any.
   * @see [[changeRenderTimeline]] to change the script.
   */
  public get scheduleScript(): RenderSchedule.Script | undefined {
    return this._scheduleState?.script;
  }

  /** The [RenderSchedule.Script]($common) that animates the contents of the view, if any, along with the Id of the element that hosts the script.
   * @note The host element may be a [RenderTimeline]($backend) or a [DisplayStyle]($backend).
   * @see [[changeRenderTimeline]] to change the script.
   */
  public get scheduleScriptReference(): RenderSchedule.ScriptReference | undefined {
    return this._scheduleState;
  }

  /** @internal */
  public get scheduleState(): RenderScheduleState | undefined {
    return this._scheduleState;
  }

  /** This is only used by [RealityTransitionTool]($frontend-devtools). It basically can only work if the script contains nothing that requires special tiles to be generated -
   * no symbology changes, transforms, or clipping - because the backend tile generator requires a *persistent* element to host the script for those features to work.
   * @internal
   */
  public setScheduleState(state: RenderScheduleState | undefined): void {
    this.onScheduleScriptReferenceChanged.raiseEvent(state);
    this._scheduleState = state;

    // eslint-disable-next-line deprecation/deprecation
    this.settings.scheduleScriptProps = state?.script.toJSON();
  }

  /** Attach a [ContextRealityModel]($common) to this display style.
   * @see [DisplayStyleSettings.contextRealityModels]($common).
   * @see [ContextRealityModels.add]($common)
   */
  public attachRealityModel(props: ContextRealityModelProps): ContextRealityModelState {
    const model = this.settings.contextRealityModels.add(props);
    assert(model instanceof ContextRealityModelState);
    return model;
  }

  /** Detach the first [ContextRealityModel]($common) that matches the specified name and url.
   * @see [DisplayStyleSettings.contextRealityModels]($common)
   * @see [ContextRealityModels.delete]($common)
   */
  public detachRealityModelByNameAndUrl(name: string, url: string): boolean {
    const model = this.settings.contextRealityModels.models.find((x) => x.matchesNameAndUrl(name, url));
    return undefined !== model && this.settings.contextRealityModels.delete(model);
  }

  /** Get the [[ContextRealityModelState]] that displays the OpenStreetMap worldwide building layer, if enabled.
   * @see [[setOSMBuildingDisplay]]
   */
  public getOSMBuildingRealityModel(): ContextRealityModelState | undefined {
    if (!this.iModel.isGeoLocated || this.globeMode !== GlobeMode.Ellipsoid)  // The OSM tile tree is ellipsoidal.
      return undefined;

    const url = getCesiumOSMBuildingsUrl();
    if (undefined === url)
      return undefined;

    return this.contextRealityModelStates.find((x) => x.url === url);
  }

  /** Set the display of the OpenStreetMap worldwide building layer in this display style by attaching or detaching the reality model displaying the buildings.
   * The OSM buildings are displayed from a reality model aggregated and served from Cesium ion.<(https://cesium.com/content/cesium-osm-buildings/>
   * The options [[OsmBuildingDisplayOptions]] control the display and appearance overrides.
   */
  public setOSMBuildingDisplay(options: OsmBuildingDisplayOptions): boolean {
    if (!this.iModel.isGeoLocated || this.globeMode !== GlobeMode.Ellipsoid)  // The OSM tile tree is ellipsoidal.
      return false;

    const url = getCesiumOSMBuildingsUrl();
    if (undefined === url)
      return false;

    let model = this.settings.contextRealityModels.models.find((x) => x.url === url);
    if (options.onOff === false) {
      const turnedOff = undefined !== model && this.settings.contextRealityModels.delete(model);
      if (turnedOff)
        this.onOSMBuildingDisplayChanged.raiseEvent(false);

      return turnedOff;
    }

    if (!model) {
      const name = IModelApp.localization.getLocalizedString("iModelJs:RealityModelNames.OSMBuildings");
      model = this.attachRealityModel({ tilesetUrl: url, name });
      this.onOSMBuildingDisplayChanged.raiseEvent(true);
    }

    if (options.appearanceOverrides)
      model.appearanceOverrides = options.appearanceOverrides;

    return true;
  }

  /**
   * Return if a context reality model is attached.
   * @see [[ContextRealityModelProps]].
   * */
  public hasAttachedRealityModel(name: string, url: string): boolean {
    return undefined !== this.settings.contextRealityModels.models.find((x) => x.matchesNameAndUrl(name, url));
  }

  /** @internal */
  public getMapLayers(isOverlay: boolean) { return isOverlay ? this.overlayMapLayers : this.backgroundMapLayers; }

  /** @internal */
  public attachMapLayerSettings(settings: MapLayerSettings, isOverlay: boolean, insertIndex = -1): void {
    const layerSettings = settings.clone({});
    if (undefined === layerSettings)
      return;

    const layers = this.getMapLayers(isOverlay);

    if (insertIndex < 0 || insertIndex > (layers.length - 1)) {
      this.getMapLayers(isOverlay).push(layerSettings);
    } else {
      layers.splice(insertIndex, 0, layerSettings);
    }

    this._synchBackgroundMapImagery();
  }

  /** @internal */
  public attachMapLayer(props: MapLayerProps, isOverlay: boolean, insertIndex = -1): void {
    const layerSettings = MapLayerSettings.fromJSON(props);
    if (undefined === layerSettings)
      return;

    this.attachMapLayerSettings(layerSettings, isOverlay, insertIndex);
  }

  /** @internal */
  public hasAttachedMapLayer(name: string, url: string, isOverlay: boolean): boolean {
    return -1 !== this.findMapLayerIndexByNameAndUrl(name, url, isOverlay);
  }

  /** @internal */
  public detachMapLayerByNameAndUrl(name: string, url: string, isOverlay: boolean): void {
    const index = this.findMapLayerIndexByNameAndUrl(name, url, isOverlay);
    if (- 1 !== index)
      this.detachMapLayerByIndex(index, isOverlay);
  }

  /** Detach map layer at index (-1 to remove all layers)
   * @internal
   */
  public detachMapLayerByIndex(index: number, isOverlay: boolean): void {
    const layers = this.getMapLayers(isOverlay);
    if (index < 0)
      layers.length = 0;
    else
      layers.splice(index, 1);

    this._synchBackgroundMapImagery();
  }

  /** @internal */
  public findMapLayerIndexByNameAndUrl(name: string, url: string, isOverlay: boolean) {
    return this.getMapLayers(isOverlay).findIndex((x) => x.matchesNameAndUrl(name, url));
  }

  /** @internal */
  public mapLayerAtIndex(index: number, isOverlay: boolean): MapLayerSettings | undefined {
    const layers = this.getMapLayers(isOverlay);
    return (index < 0 || index >= layers.length) ? undefined : layers[index];
  }

  /** Return map base transparency as a number between 0 and 1.
   * @internal
   */
  public get baseMapTransparency(): number {
    return this.settings.mapImagery.baseTransparency;
  }

  /** @internal  */
  public changeBaseMapTransparency(transparency: number) {
    if (this.settings.mapImagery.backgroundBase instanceof ColorDef) {
      this.settings.mapImagery.backgroundBase = this.settings.mapImagery.backgroundBase.withTransparency(transparency * 255);
    } else {
      this.settings.mapImagery.backgroundBase = this.settings.mapImagery.backgroundBase.clone({transparency});
    }
    this._synchBackgroundMapImagery();
  }

  /** @internal */
  public changeMapLayerProps(props: Partial<MapLayerProps>, index: number, isOverlay: boolean) {
    const layers = this.getMapLayers(isOverlay);
    if (index < 0 || index >= layers.length)
      return;
    layers[index] = layers[index].clone(props);
    this._synchBackgroundMapImagery();
  }

  public changeMapLayerCredentials(index: number, isOverlay: boolean, userName?: string, password?: string,) {
    const layers = this.getMapLayers(isOverlay);
    if (index < 0 || index >= layers.length)
      return;
    layers[index].setCredentials(userName, password);
    this._synchBackgroundMapImagery();
  }

  public changeMapSubLayerProps(props: Partial<MapSubLayerProps>, subLayerId: SubLayerId, layerIndex: number, isOverlay: boolean) {
    const mapLayerSettings = this.mapLayerAtIndex(layerIndex, isOverlay);
    if (undefined === mapLayerSettings)
      return;

    const subLayers = new Array<MapSubLayerProps>();
    for (const subLayer of mapLayerSettings.subLayers) {
      subLayers.push((subLayerId === -1 || subLayer.id === subLayerId) ? subLayer.clone(props).toJSON() : subLayer.toJSON());
    }

    this.changeMapLayerProps({ subLayers }, layerIndex, isOverlay);
  }

  /** @internal */
  public async getMapLayerRange(layerIndex: number, isOverlay: boolean): Promise<MapCartoRectangle | undefined> {
    const mapLayerSettings = this.mapLayerAtIndex(layerIndex, isOverlay);
    if (undefined === mapLayerSettings)
      return undefined;

    const imageryProvider = IModelApp.mapLayerFormatRegistry.createImageryProvider(mapLayerSettings);
    if (undefined === imageryProvider)
      return undefined;

    try {
      await imageryProvider.initialize();
      return imageryProvider.cartoRange;

    } catch (_error) {
      return undefined;
    }
    return undefined;
  }

  /** change viewport to include range of map layer.
   * @internal
   */
  public async viewMapLayerRange(layerIndex: number, isOverlay: boolean, vp: ScreenViewport): Promise<boolean> {
    const range = await this.getMapLayerRange(layerIndex, isOverlay);
    if (!range)
      return false;

    if (range.xLength() > 1.5 * Angle.piRadians)
      viewGlobalLocation(vp, true, ViewGlobalLocationConstants.satelliteHeightAboveEarthInMeters, undefined, undefined);
    else
      viewGlobalLocation(vp, true, undefined, undefined, range.globalLocation);

    return true;
  }

  /* @internal */
  private _synchBackgroundMapImagery() {
    this.settings.synchMapImagery();
  }

  /**
   * Move map layer to top.
   * @param index index of layer to move.
   * @param isOverlay true if layer is overlay.
   * @internal
   *
   */
  public moveMapLayerToTop(index: number, isOverlay: boolean) {
    const layers = this.getMapLayers(isOverlay);
    if (index >= 0 && index < layers.length - 1) {
      const layer = layers.splice(index, 1);
      layers.push(layer[0]);
      this._synchBackgroundMapImagery();
    }
  }

  /**
   * Move map layer to bottom.
   * @param index index of layer to move.
   * @param isOverlay true if layer is overlay.
   * @internal
   */
  public moveMapLayerToBottom(index: number, isOverlay: boolean) {
    const layers = this.getMapLayers(isOverlay);
    if (index > 0 && index < layers.length) {
      const layer = layers.splice(index, 1);
      layers.unshift(layer[0]);
      this._synchBackgroundMapImagery();
    }
  }

  /**
   * Reorder map layers
   * @param fromIndex index of map layer to move
   * @param toIndex insert index. If equal to length of map array the map layer is moved to end of array.
   * @internal
   */
  public moveMapLayerToIndex(fromIndex: number, toIndex: number, isOverlay: boolean) {
    const layers = this.getMapLayers(isOverlay);
    if (fromIndex === toIndex)
      return;

    if (fromIndex < 0 || fromIndex >= layers.length || toIndex > layers.length)
      return;

    const layer = layers.splice(fromIndex, 1);
    layers.splice(toIndex, 0, layer[0]); // note: if toIndex === settings.mapImagery.backgroundLayers.length item is appended
    this._synchBackgroundMapImagery();
  }

  /** Flags controlling various aspects of the display style.
   * @see [DisplayStyleSettings.viewFlags]($common)
   */
  public get viewFlags(): ViewFlags { return this.settings.viewFlags; }
  public set viewFlags(flags: ViewFlags) { this.settings.viewFlags = flags; }

  /** The background color for this DisplayStyle */
  public get backgroundColor(): ColorDef { return this.settings.backgroundColor; }
  public set backgroundColor(val: ColorDef) { this.settings.backgroundColor = val; }

  /** The color used to draw geometry in monochrome mode.
   * @see [ViewFlags.monochrome]($common) for enabling monochrome mode.
   */
  public get monochromeColor(): ColorDef { return this.settings.monochromeColor; }
  public set monochromeColor(val: ColorDef) { this.settings.monochromeColor = val; }

  private _backgroundMapGeometry?: {
    bimElevationBias: number;
    geometry: BackgroundMapGeometry;
    globeMode: GlobeMode;
  };

  /** @internal */
  public anyMapLayersVisible(overlay: boolean): boolean {
    const layers = this.getMapLayers(overlay);

    for (const mapLayer of layers)
      if (mapLayer.visible)
        return true;

    return false;
  }

  /** @internal */
  public getIsBackgroundMapVisible(): boolean {
    return undefined !== this.iModel.ecefLocation && (this.viewFlags.backgroundMap || this.anyMapLayersVisible(false));
  }
  /** @internal */
  public get backgroundMapElevationBias(): number | undefined {
    if (this.backgroundMapSettings.applyTerrain) {
      const terrainSettings = this.backgroundMapSettings.terrainSettings;
      switch (terrainSettings.heightOriginMode) {
        case TerrainHeightOriginMode.Ground:
          return (undefined === this.iModel.projectCenterAltitude) ? undefined : terrainSettings.heightOrigin + terrainSettings.exaggeration * this.iModel.projectCenterAltitude;

        case TerrainHeightOriginMode.Geodetic:
          return terrainSettings.heightOrigin;

        case TerrainHeightOriginMode.Geoid:
          return (undefined === this.iModel.geodeticToSeaLevel) ? undefined : terrainSettings.heightOrigin + this.iModel.geodeticToSeaLevel;
      }
    } else {
      return this.backgroundMapSettings.groundBias;
    }

  }

  /** @internal */
  public getBackgroundMapGeometry(): BackgroundMapGeometry | undefined {
    if (undefined === this.iModel.ecefLocation)
      return undefined;

    const bimElevationBias = this.backgroundMapElevationBias;

    if (undefined === bimElevationBias)
      return undefined;

    const globeMode = this.globeMode;
    if (undefined === this._backgroundMapGeometry || this._backgroundMapGeometry.globeMode !== globeMode || this._backgroundMapGeometry.bimElevationBias !== bimElevationBias) {
      const geometry = new BackgroundMapGeometry(bimElevationBias, globeMode, this.iModel);
      this._backgroundMapGeometry = { bimElevationBias, geometry, globeMode };
    }
    return this._backgroundMapGeometry.geometry;
  }

  /** [[ContextRealityModelState]]s attached to this display style.
   * @see [DisplayStyleSettings.contextRealityModels]($common).
   */
  public get contextRealityModelStates(): ReadonlyArray<ContextRealityModelState> {
    return this.settings.contextRealityModels.models as ContextRealityModelState[];
  }

  /** @internal */
  public getGlobalGeometryAndHeightRange(): { geometry: BackgroundMapGeometry, heightRange: Range1d } | undefined {
    let geometry = this.getIsBackgroundMapVisible() ? this.getBackgroundMapGeometry() : undefined;
    const terrainRange = ApproximateTerrainHeights.instance.globalHeightRange;
    let heightRange = this.displayTerrain ? terrainRange : Range1d.createXX(-1, 1);
    if (this.globeMode === GlobeMode.Ellipsoid && this.contextRealityModelStates.find((model) => model.isGlobal)) {
      if (!geometry) {
        if (!this._ellipsoidMapGeometry)
          this._ellipsoidMapGeometry = new BackgroundMapGeometry(0, GlobeMode.Ellipsoid, this.iModel);

        geometry = this._ellipsoidMapGeometry;
      }

      heightRange = terrainRange;
    }

    return geometry ? { geometry, heightRange } : undefined;
  }

  /** Returns true if this is a 3d display style. */
  public is3d(): this is DisplayStyle3dState { return this instanceof DisplayStyle3dState; }

  /** Customize the way geometry belonging to a [[SubCategory]] is drawn by this display style.
   * @param id The ID of the SubCategory whose appearance is to be overridden.
   * @param ovr The overrides to apply to the [[SubCategoryAppearance]].
   * @see [[dropSubCategoryOverride]]
   */
  public overrideSubCategory(id: Id64String, ovr: SubCategoryOverride) { this.settings.overrideSubCategory(id, ovr); }

  /** Remove any [[SubCategoryOverride]] applied to a [[SubCategoryAppearance]] by this style.
   * @param id The ID of the [[SubCategory]].
   * @see [[overrideSubCategory]]
   */
  public dropSubCategoryOverride(id: Id64String) { this.settings.dropSubCategoryOverride(id); }

  /** Returns true if an [[SubCategoryOverride]]s are defined by this style. */
  public get hasSubCategoryOverride() { return this.settings.hasSubCategoryOverride; }

  /** Obtain the overrides applied to a [[SubCategoryAppearance]] by this style.
   * @param id The ID of the [[SubCategory]].
   * @returns The corresponding SubCategoryOverride, or undefined if the SubCategory's appearance is not overridden.
   * @see [[overrideSubCategory]]
   */
  public getSubCategoryOverride(id: Id64String): SubCategoryOverride | undefined { return this.settings.getSubCategoryOverride(id); }

  /** @internal */
  public get wantShadows(): boolean {
    return this.is3d() && this.viewFlags.shadows && false !== IModelApp.renderSystem.options.displaySolarShadows;
  }

  /** @internal */
  protected registerSettingsEventListeners(): void {
    // eslint-disable-next-line deprecation/deprecation
    this.settings.onScheduleScriptPropsChanged.addListener((scriptProps) => {
      let newState: RenderScheduleState | undefined;
      if (scriptProps) {
        const script = RenderSchedule.Script.fromJSON(scriptProps);
        if (script)
          newState = new RenderScheduleState(this.id, script);
      }

      if (newState !== this._scheduleState) {
        this.onScheduleScriptReferenceChanged.raiseEvent(newState);
        this._scheduleState = newState;
      }
    });

    this.settings.onRenderTimelineChanged.addListener((newTimeline) => {
      if (newTimeline !== this._scheduleState?.sourceId) {
        // Loading the new script is asynchronous...people should really be using DisplayStyleState.changeRenderTimeline().
        this.onScheduleScriptReferenceChanged.raiseEvent(undefined);
        this._scheduleState = undefined;
      }
    });

    this.settings.onPlanarClipMaskChanged.addListener((id, newSettings) => {
      if (newSettings)
        this._attachedRealityModelPlanarClipMasks.set(id, PlanarClipMaskState.create(newSettings));
      else
        this._attachedRealityModelPlanarClipMasks.delete(id);
    });
  }

  /** @internal */
  protected createRealityModel(props: ContextRealityModelProps): ContextRealityModelState {
    return new ContextRealityModelState(props, this.iModel, this);
  }

  /** @internal */
  public getPlanarClipMaskState(modelId: Id64String): PlanarClipMaskState | undefined {
    const model = this.iModel.models.getLoaded(modelId)?.asSpatialModel;
    return (model && model.isRealityModel) ? this._attachedRealityModelPlanarClipMasks.get(modelId) : undefined;
  }
}

/** A display style that can be applied to 2d views.
 * @public
 */
export class DisplayStyle2dState extends DisplayStyleState {
  /** @internal */
  public static override get className() { return "DisplayStyle2d"; }
  private readonly _settings: DisplayStyleSettings;

  public get settings(): DisplayStyleSettings { return this._settings; }

  /** @internal */
  public overrideTerrainDisplay(): TerrainDisplayOverrides | undefined { return undefined; }

  constructor(props: DisplayStyleProps, iModel: IModelConnection) {
    super(props, iModel);
    this._settings = new DisplayStyleSettings(this.jsonProperties, { createContextRealityModel: (modelProps) => this.createRealityModel(modelProps) });
    this.registerSettingsEventListeners();
  }
}

/** A [[DisplayStyleState]] that can be applied to spatial views.
 * @public
 */
export class DisplayStyle3dState extends DisplayStyleState {
  /** @internal */
  public static override get className() { return "DisplayStyle3d"; }
  private _settings: DisplayStyle3dSettings;

  public get settings(): DisplayStyle3dSettings { return this._settings; }

  public constructor(props: DisplayStyleProps, iModel: IModelConnection, source?: DisplayStyle3dState) {
    super(props, iModel, source);
    this._settings = new DisplayStyle3dSettings(this.jsonProperties, { createContextRealityModel: (modelProps) => this.createRealityModel(modelProps) });
    this.registerSettingsEventListeners();
  }

  public get environment(): Environment {
    return this.settings.environment;
  }
  public set environment(env: Environment) {
    this.settings.environment = env;
  }

  public get lights(): LightSettings { return this.settings.lights; }
  public set lights(lights: LightSettings) { this.settings.lights = lights; }

  /** The direction of the solar light. */
  public get sunDirection(): Readonly<Vector3d> {
    return this.settings.lights.solar.direction;
  }

  /** Set the solar light direction based on time value
   * @param time The time in unix time milliseconds.
   * @see [DisplayStyle3dSettings.sunTime]($common) to obtain the current sun time.
   * @see [DisplayStyle3dSettings.setSunTime]($common).
   */
  public setSunTime(time: number) {
    this.settings.setSunTime(time, this.iModel);
  }

  /** Settings controlling shadow display. */
  public get solarShadows(): SolarShadowSettings {
    return this.settings.solarShadows;
  }
  public set solarShadows(settings: SolarShadowSettings) {
    this.settings.solarShadows = settings;
  }

  /** @internal */
  protected override registerSettingsEventListeners(): void {
    super.registerSettingsEventListeners();

    this.settings.onOverridesApplied.addListener((overrides: DisplayStyle3dSettingsProps) => {
      if (overrides.thematic && this.settings.thematic.displayMode === ThematicDisplayMode.Height && undefined === overrides.thematic.range) {
        // Use the project extents as reasonable default height range.
        // NB: assumes using Z axis...
        const extents = this.iModel.projectExtents;
        const props = { ...overrides.thematic };
        props.range = { low: extents.zLow, high: extents.zHigh };
        this.settings.thematic = ThematicDisplay.fromJSON(props);
      }
    });
  }

  /** @internal */
  public overrideTerrainDisplay(): TerrainDisplayOverrides | undefined {
    if (undefined !== this.settings.thematic) {
      const ovr = new TerrainDisplayOverrides();
      if (this.viewFlags.thematicDisplay && ThematicGradientMode.IsoLines === this.settings.thematic.gradientSettings.mode)
        ovr.wantSkirts = false;
      if (this.viewFlags.thematicDisplay && (ThematicDisplayMode.Slope === this.settings.thematic.displayMode || ThematicDisplayMode.HillShade === this.settings.thematic.displayMode))
        ovr.wantNormals = true;
      return ovr;
    }
    return undefined;
  }
}
