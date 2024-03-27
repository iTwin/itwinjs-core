/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */
import { assert, BeEvent, Id64, Id64Arg, Id64String } from "@itwin/core-bentley";
import { Range1d, Vector3d } from "@itwin/core-geometry";
import {
  BackgroundMapProps, BackgroundMapProvider, BackgroundMapProviderProps, BackgroundMapSettings,
  BaseLayerSettings, BaseMapLayerSettings, ColorDef, ContextRealityModelProps, DisplayStyle3dSettings, DisplayStyle3dSettingsProps,
  DisplayStyleProps, DisplayStyleSettings, Environment, FeatureAppearance, GlobeMode, ImageMapLayerSettings, LightSettings, MapLayerProps,
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
import { getCesiumOSMBuildingsUrl, MapLayerIndex, TileTreeReference } from "./tile/internal";

/** @internal */
export class TerrainDisplayOverrides {
  public wantSkirts?: boolean;
  public wantNormals?: boolean;
  public produceGeometry?: boolean;
}

/** Options controlling display of [OpenStreetMap Buildings](https://cesium.com/platform/cesium-ion/content/cesium-osm-buildings/).
 * @see [[DisplayStyleState.setOSMBuildingDisplay]].
 * @public
 * @extensions
 */
export interface OsmBuildingDisplayOptions {
  /** If defined, enables or disables display of the buildings by attaching or detaching the OpenStreetMap Buildings reality model. */
  onOff?: boolean;
  /** If defined, overrides aspects of the appearance of the OpenStreetMap building meshes. */
  appearanceOverrides?: FeatureAppearance;
}

/** A DisplayStyle defines the parameters for 'styling' the contents of a [[ViewState]].
 * @public
 * @extensions
 */
export abstract class DisplayStyleState extends ElementState implements DisplayStyleProps {
  public static override get className() { return "DisplayStyle"; }
  private _scriptReference?: RenderSchedule.ScriptReference;
  private _ellipsoidMapGeometry: BackgroundMapGeometry | undefined;
  private _attachedRealityModelPlanarClipMasks = new Map<Id64String, PlanarClipMaskState>();
  /** @internal */
  protected _queryRenderTimelinePropsPromise?: Promise<RenderTimelineProps | undefined>;
  private _assigningScript = false;

  /** Event raised just before the [[scheduleScriptReference]] property is changed.
   * @deprecated in 3.x. use [[onScheduleScriptChanged]].
   */
  public readonly onScheduleScriptReferenceChanged = new BeEvent<(newScriptReference: RenderSchedule.ScriptReference | undefined) => void>();
  /** Event raised just before the [[scheduleScript]] property is changed. */
  public readonly onScheduleScriptChanged = new BeEvent<(newScript: RenderSchedule.Script | undefined) => void>();
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
      this._scriptReference = source._scriptReference;

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
    if (this._scriptReference) {
      if (this.settings.renderTimeline === this._scriptReference.sourceId) {
        // The script came from the same RenderTimeline element. Keep it.
        return;
      }

      if (undefined === this.settings.renderTimeline) {
        // The script came from a display style's JSON properties. Keep it if (1) this style is not persistent or (2) this style has the same Id
        if (this.id === this._scriptReference.sourceId || !Id64.isValidId64(this.id))
          return;
      }
    }

    // The schedule script stored in JSON properties takes precedence over the RenderTimeline if both are defined.
    if (this.settings.scheduleScriptProps)
      this.loadScriptReferenceFromScript(this.settings.scheduleScriptProps);
    else
      await this.loadScriptReferenceFromTimeline(this.settings.renderTimeline);
  }

  private loadScriptReferenceFromScript(scriptProps: Readonly<RenderSchedule.ScriptProps>): void {
    let newState;
    try {
      const script = RenderSchedule.Script.fromJSON(scriptProps);
      if (script)
        newState = new RenderSchedule.ScriptReference(this.id, script);
    } catch (_) {
      // schedule state is undefined.
    }

    if (newState !== this._scriptReference) {
      this.onScheduleScriptReferenceChanged.raiseEvent(newState); // eslint-disable-line deprecation/deprecation
      this.onScheduleScriptChanged.raiseEvent(newState?.script);
      this._scriptReference = newState;
    }
  }

  private async loadScriptReferenceFromTimeline(timelineId: Id64String | undefined): Promise<void> {
    let newState;
    if (timelineId && Id64.isValidId64(timelineId)) {
      try {
        // If a subsequent call to loadScriptReferenceFromTimeline is made while we're awaiting this one, we'll abort this one.
        const promise = this._queryRenderTimelinePropsPromise = this.queryRenderTimelineProps(timelineId);
        const timeline = await promise;
        if (promise !== this._queryRenderTimelinePropsPromise)
          return;

        if (timeline) {
          const scriptProps = JSON.parse(timeline.script);
          const script = RenderSchedule.Script.fromJSON(scriptProps);
          if (script)
            newState = new RenderSchedule.ScriptReference(timelineId, script);
        }
      } catch (_) {
        // schedule state is undefined.
      }
    }

    this._queryRenderTimelinePropsPromise = undefined;
    if (newState !== this._scriptReference) {
      this.onScheduleScriptReferenceChanged.raiseEvent(newState); // eslint-disable-line deprecation/deprecation
      this.onScheduleScriptChanged.raiseEvent(newState?.script);
      this._scriptReference = newState;
    }
  }

  /** @internal */
  protected async queryRenderTimelineProps(timelineId: Id64String): Promise<RenderTimelineProps | undefined> {
    try {
      const omitScriptElementIds = !IModelApp.tileAdmin.enableFrontendScheduleScripts;
      return await this.iModel.elements.loadProps(timelineId, { renderTimeline: { omitScriptElementIds } }) as RenderTimelineProps;
    } catch (_) {
      return undefined;
    }
  }

  /** @internal */
  public get displayTerrain() {
    return this.viewFlags.backgroundMap && this.settings.backgroundMap.applyTerrain;
  }

  /** @internal */
  public get globeMode(): GlobeMode { return this.settings.backgroundMap.globeMode; }

  /** Settings controlling how the base map is displayed within a view.
   *  The base map can be provided by any map imagery source or set to be a single color.
   */
  public get backgroundMapBase(): BaseLayerSettings {
    return this.settings.mapImagery.backgroundBase;
  }
  public set backgroundMapBase(base: BaseLayerSettings) {
    this.settings.mapImagery.backgroundBase = base;
    this._synchBackgroundMapImagery();
  }

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
   * @public
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
    const base = this.settings.mapImagery.backgroundBase;
    if (base instanceof ColorDef) {
      this.settings.mapImagery.backgroundBase = BaseMapLayerSettings.fromProvider(BackgroundMapProvider.fromJSON(props));
    } else {
      const provider = base.provider ? base.provider.clone(props) : BackgroundMapProvider.fromJSON(props);
      this.settings.mapImagery.backgroundBase = base.cloneWithProvider(provider);
    }

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

  private * getRealityModels(): Iterable<ContextRealityModelState> {
    for (const model of this.settings.contextRealityModels.models) {
      assert(model instanceof ContextRealityModelState);
      yield model;
    }
  }

  /** Iterate over the reality models attached to this display style. */
  public get realityModels(): Iterable<ContextRealityModelState> {
    return this.getRealityModels();
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
   * animating the contents of the view, and update [[scheduleScript]] using the script associated with the [RenderTimeline]($backend) element.
   * @see [DisplayStyleSettings.renderTimeline]($common).
   */
  public async changeRenderTimeline(timelineId: Id64String | undefined): Promise<void> {
    // Potentially trigger async loading of new schedule state.
    this.settings.renderTimeline = timelineId;

    // Await async loading if necessary.
    // Note the `await` in loadScriptReferenceFromTimeline will resolve before this one [per the spec](https://262.ecma-international.org/6.0/#sec-triggerpromisereactions).
    if (this._queryRenderTimelinePropsPromise)
      await this._queryRenderTimelinePropsPromise;
  }

  /** The [RenderSchedule.Script]($common) that animates the contents of the view, if any.
   * @see [[changeRenderTimeline]] to change the script.
   */
  public get scheduleScript(): RenderSchedule.Script | undefined {
    return this._scriptReference?.script;
  }

  public set scheduleScript(script: RenderSchedule.Script | undefined) {
    if (script === this.scheduleScript)
      return;

    try {
      const scriptRef = script ? new RenderSchedule.ScriptReference(script) : undefined;
      this.onScheduleScriptReferenceChanged.raiseEvent(scriptRef); // eslint-disable-line deprecation/deprecation
      this.onScheduleScriptChanged.raiseEvent(script);
      this._scriptReference = scriptRef;

      this._assigningScript = true;
      this.settings.scheduleScriptProps = script?.toJSON();

      if (!script)
        this.loadScriptReferenceFromTimeline(this.settings.renderTimeline); // eslint-disable-line @typescript-eslint/no-floating-promises
    } finally {
      this._assigningScript = false;
    }
  }

  /** The [RenderSchedule.Script]($common) that animates the contents of the view, if any, along with the Id of the element that hosts the script.
   * @note The host element may be a [RenderTimeline]($backend) or a [DisplayStyle]($backend).
   * @deprecated in 3.x. Use [[scheduleScript]].
   */
  public get scheduleScriptReference(): RenderSchedule.ScriptReference | undefined {
    return this._scriptReference;
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

  /** Return if a context reality model is attached.
   * @see [[ContextRealityModelProps]].
   */
  public hasAttachedRealityModel(name: string, url: string): boolean {
    return undefined !== this.settings.contextRealityModels.models.find((x) => x.matchesNameAndUrl(name, url));
  }

  /** @internal */
  public getMapLayers(isOverlay: boolean) { return isOverlay ? this.settings.mapImagery.overlayLayers : this.settings.mapImagery.backgroundLayers; }

  /** Attach a map layer to display style.
   * @param Settings representing the map layer.
   * @param mapLayerIndex the [[MapLayerIndex]] where the map layer should be attached.
   * @public
   */
  public attachMapLayer(options: { settings: MapLayerSettings, mapLayerIndex: MapLayerIndex }): void {
    const layerSettings = options.settings.clone({});
    if (undefined === layerSettings)
      return;

    const isOverlay = options.mapLayerIndex.isOverlay;
    const insertIndex = options.mapLayerIndex.index;
    const layers = this.getMapLayers(isOverlay);

    if (insertIndex < 0 || insertIndex > (layers.length - 1)) {
      this.getMapLayers(isOverlay).push(layerSettings);
    } else {
      layers.splice(insertIndex, 0, layerSettings);
    }

    this._synchBackgroundMapImagery();
  }

  /**
   * @param mapLayerIndex the [[MapLayerIndex]] where the map layer should be attached.
   * @internal
   */
  public attachMapLayerProps(options: { props: MapLayerProps, mapLayerIndex: MapLayerIndex }): void {
    const settings = MapLayerSettings.fromJSON(options.props);
    if (undefined === settings)
      return;

    this.attachMapLayer({ settings, mapLayerIndex: options.mapLayerIndex });
  }

  /** @internal */
  public hasAttachedMapLayer(name: string, source: string, isOverlay: boolean): boolean {
    return -1 !== this.findMapLayerIndexByNameAndSource(name, source, isOverlay);
  }

  /** @internal */
  public detachMapLayerByNameAndSource(name: string, source: string, isOverlay: boolean): void {
    const index = this.findMapLayerIndexByNameAndSource(name, source, isOverlay);
    if (- 1 !== index)
      this.detachMapLayerByIndex({ index, isOverlay });
  }

  /** Detach map layer at index (-1 to remove all layers)
   * @param mapLayerIndex the [[MapLayerIndex]] of the map layer to detach.
   * @public
   */
  public detachMapLayerByIndex(mapLayerIndex: MapLayerIndex): void {
    const layers = this.getMapLayers(mapLayerIndex.isOverlay);
    const index = mapLayerIndex.index;
    if (index < 0)
      layers.length = 0;
    else
      layers.splice(index, 1);

    this._synchBackgroundMapImagery();
  }

  /**
   * Lookup a maplayer index by name and source.
   * @param name Name of of the layer.
   * @param source Unique string identifying the layer.
   * @param isOverlay true if layer is overlay, otherwise layer is background. Defaults to false.
   * @public
   *
   */
  public findMapLayerIndexByNameAndSource(name: string, source: string, isOverlay: boolean) {
    return this.getMapLayers(isOverlay).findIndex((layer) => layer.matchesNameAndSource(name, source));
  }

  /** Return the map layer settings for a map layer at the provided index.
   * @param mapLayerIndex the [[MapLayerIndex]] of the map layer.
   * @public
   */
  public mapLayerAtIndex(mapLayerIndex: MapLayerIndex): MapLayerSettings | undefined {
    const layers = this.getMapLayers(mapLayerIndex.isOverlay);
    const index = mapLayerIndex.index;
    return (index < 0 || index >= layers.length) ? undefined : layers[index];
  }

  /** Return map base transparency as a number between 0 and 1.
   * @public
   */
  public get baseMapTransparency(): number {
    return this.settings.mapImagery.baseTransparency;
  }

  /** Change the map base transparency as a number between 0 and 1.
   * @public
   */
  public changeBaseMapTransparency(transparency: number) {
    if (this.settings.mapImagery.backgroundBase instanceof ColorDef) {
      this.settings.mapImagery.backgroundBase = this.settings.mapImagery.backgroundBase.withTransparency(transparency * 255);
    } else {
      this.settings.mapImagery.backgroundBase = this.settings.mapImagery.backgroundBase.clone({ transparency });
    }
    this._synchBackgroundMapImagery();
  }

  /** Modify a subset of a map layer settings.
   * @param props props JSON representation of the properties to change. Any properties not present will retain their current values.
   * @param mapLayerIndex the [[MapLayerIndex]] where the map layer should be inserted.
   *
   * Example that changes only the visibility of the first overlay map layer.
   * ``` ts
   *  style.changeMapLayerProps({ visible: false }, 0, false);
   * ```
   * @public
   */
  public changeMapLayerProps(props: Partial<MapLayerProps>, mapLayerIndex: MapLayerIndex) {
    const index = mapLayerIndex.index;
    const layers = this.getMapLayers(mapLayerIndex.isOverlay);
    if (index < 0 || index >= layers.length)
      return;
    layers[index] = layers[index].clone(props);
    this._synchBackgroundMapImagery();
  }

  /** Change the credentials for a map layer.
   * @param mapLayerIndex the [[MapLayerIndex]] of the map layer to change the credentials of.
   * @public
   */
  public changeMapLayerCredentials(mapLayerIndex: MapLayerIndex, userName?: string, password?: string) {
    const layers = this.getMapLayers(mapLayerIndex.isOverlay);
    const index = mapLayerIndex.index;
    if (index < 0 || index >= layers.length)
      return;
    const layer = layers[index];
    if (layer instanceof ImageMapLayerSettings) {
      layer.setCredentials(userName, password);
      this._synchBackgroundMapImagery();
    }
  }

  /** Modify a subset of a sub-layer settings.
   * @param props props JSON representation of the properties to change. Any properties not present will retain their current values.
   * @param subLayerId Id of the sub-layer that should be modified.
   * @param mapLayerIndex the [[MapLayerIndex]] of the map layer that contains the sub-layer to be modified.
   *
   * @public
   */
  public changeMapSubLayerProps(props: Partial<MapSubLayerProps>, subLayerId: SubLayerId, mapLayerIndex: MapLayerIndex) {
    const mapLayerSettings = this.mapLayerAtIndex(mapLayerIndex);
    if (undefined === mapLayerSettings)
      return;

    if (!(mapLayerSettings instanceof ImageMapLayerSettings)) {
      assert(false);
      return;
    }

    const subLayers = new Array<MapSubLayerProps>();
    for (const subLayer of mapLayerSettings.subLayers) {
      subLayers.push((subLayerId === -1 || subLayer.id === subLayerId) ? subLayer.clone(props).toJSON() : subLayer.toJSON());
    }

    this.changeMapLayerProps({ subLayers }, mapLayerIndex);
  }

  /* @internal */
  private _synchBackgroundMapImagery() {
    this.settings.synchMapImagery();
  }

  /** Move map layer to top.
   * @param mapLayerIndex the [[MapLayerIndex]] of the map layer to move.
   * @public
   *
   */
  public moveMapLayerToTop(mapLayerIndex: MapLayerIndex) {
    const layers = this.getMapLayers(mapLayerIndex.isOverlay);
    const index = mapLayerIndex.index;
    if (index >= 0 && index < layers.length - 1) {
      const layer = layers.splice(index, 1);
      layers.push(layer[0]);
      this._synchBackgroundMapImagery();
    }
  }

  /** Move map layer to bottom.
   * @param mapLayerIndex the [[MapLayerIndex]] of the map layer to move.
   * @public
   */
  public moveMapLayerToBottom(mapLayerIndex: MapLayerIndex) {
    const layers = this.getMapLayers(mapLayerIndex.isOverlay);
    const index = mapLayerIndex.index;
    if (index > 0 && index < layers.length) {
      const layer = layers.splice(index, 1);
      layers.unshift(layer[0]);
      this._synchBackgroundMapImagery();
    }
  }

  /** Reorder map layers
   * @param fromIndex index of map layer to move
   * @param toIndex insert index. If equal to length of map array the map layer is moved to end of array.
   * @param isOverlay true if map-layer is part of the overlay map, otherwise it is part of the background map.
   * @public
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

  /** For each subcategory belonging to any of the specified categories, make it visible by turning off the "invisible" flag in its subcategory appearance.
   * This requires that the categories and subcategories have been previously loaded by, e.g., a call to IModelConnection.querySubCategories.
   * @returns true if the visibility of any subcategory was modified.
   * @see Viewport.changeCategoryDisplay
   * @see ViewCreator3dOptions.allSubCategoriesVisible
   * @internal
   */
  public enableAllLoadedSubCategories(categoryIds: Id64Arg): boolean {
    let anyChanged = false;
    for (const categoryId of Id64.iterable(categoryIds)) {
      const subCategoryIds = this.iModel.subcategories.getSubCategories(categoryId);
      if (undefined !== subCategoryIds)
        for (const subCategoryId of subCategoryIds)
          if (this.setSubCategoryVisible(subCategoryId, true))
            anyChanged = true;
    }

    return anyChanged;
  }

  /** Change the "invisible" flag for the given subcategory's appearance.
   * This requires that the subcategory appearance has been previously loaded by, e.g., a call to IModelConnection.Categories.getSubCategoryInfo.
   * @returns true if the visibility of any subcategory was modified.
   * @see [[enableAllLoadedSubCategories]]
   * @internal
   */
  public setSubCategoryVisible(subCategoryId: Id64String, visible: boolean): boolean {
    const app = this.iModel.subcategories.getSubCategoryAppearance(subCategoryId);
    if (undefined === app)
      return false; // category not enabled or subcategory not found

    const curOvr = this.getSubCategoryOverride(subCategoryId);
    const isAlreadyVisible = undefined !== curOvr && undefined !== curOvr.invisible ? !curOvr.invisible : !app.invisible;
    if (isAlreadyVisible === visible)
      return false;

    // Preserve existing overrides - just flip the visibility flag.
    const json = undefined !== curOvr ? curOvr.toJSON() : {};
    json.invisible = !visible;
    this.overrideSubCategory(subCategoryId, SubCategoryOverride.fromJSON(json));
    return true;
  }

  /** Returns true if solar shadow display is enabled by this display style. */
  public get wantShadows(): boolean {
    return this.is3d() && this.viewFlags.shadows && false !== IModelApp.renderSystem.options.displaySolarShadows;
  }

  /** @internal */
  protected registerSettingsEventListeners(): void {
    this.settings.onScheduleScriptPropsChanged.addListener((scriptProps) => {
      if (this._assigningScript)
        return;

      try {
        this._assigningScript = true;
        if (scriptProps)
          this.loadScriptReferenceFromScript(scriptProps);
        else
          this.loadScriptReferenceFromTimeline(this.settings.renderTimeline); // eslint-disable-line @typescript-eslint/no-floating-promises
      } finally {
        this._assigningScript = false;
      }
    });

    this.settings.onRenderTimelineChanged.addListener((newTimeline) => {
      // Cancel any in-progress loading of script from timeline.
      this._queryRenderTimelinePropsPromise = undefined;

      if (!this.settings.scheduleScriptProps)
        this.loadScriptReferenceFromTimeline(newTimeline); // eslint-disable-line @typescript-eslint/no-floating-promises
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
 * @extensions
 */
export class DisplayStyle2dState extends DisplayStyleState {
  public static override get className() { return "DisplayStyle2d"; }
  private readonly _settings: DisplayStyleSettings;

  public get settings(): DisplayStyleSettings { return this._settings; }

  /** @internal */
  public overrideTerrainDisplay(): TerrainDisplayOverrides | undefined { return undefined; }

  constructor(props: DisplayStyleProps, iModel: IModelConnection) {
    super(props, iModel);
    this._settings = new DisplayStyleSettings(this.jsonProperties, {
      createContextRealityModel: (modelProps) => this.createRealityModel(modelProps),
      deferContextRealityModels: true,
    });

    this._settings.contextRealityModels.populate();
    this.registerSettingsEventListeners();
  }
}

/** A [[DisplayStyleState]] that can be applied to spatial views.
 * @public
 * @extensions
 */
export class DisplayStyle3dState extends DisplayStyleState {
  public static override get className() { return "DisplayStyle3d"; }
  private _settings: DisplayStyle3dSettings;

  public get settings(): DisplayStyle3dSettings { return this._settings; }

  public constructor(props: DisplayStyleProps, iModel: IModelConnection, source?: DisplayStyle3dState) {
    super(props, iModel, source);
    this._settings = new DisplayStyle3dSettings(this.jsonProperties, {
      createContextRealityModel: (modelProps) => this.createRealityModel(modelProps),
      deferContextRealityModels: true,
    });

    this._settings.contextRealityModels.populate();
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
