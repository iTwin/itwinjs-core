/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */

import { assert, BeEvent } from "@itwin/core-bentley";
import { FeatureAppearance, FeatureAppearanceProps } from "./FeatureSymbology";
import { PlanarClipMaskMode, PlanarClipMaskProps, PlanarClipMaskSettings } from "./PlanarClipMask";
import { SpatialClassifierProps, SpatialClassifiers, SpatialClassifiersContainer } from "./SpatialClassification";
import { RealityModelDisplayProps, RealityModelDisplaySettings } from "./RealityModelDisplaySettings";

/** JSON representation of the blob properties for an OrbitGt property cloud.
 * @alpha
 */
export interface OrbitGtBlobProps {
  rdsUrl?: string;
  containerName: string;
  blobFileName: string;
  sasToken: string;
  accountName: string;
}

/** Identify the Reality Data service provider
 * @beta
 */
export enum RealityDataProvider {
  /**
   * This is the legacy mode where the access to the 3d tiles is harcoded in ContextRealityModelProps.tilesetUrl property.
   * It was use to support RealityMesh3DTiles, Terrain3DTiles, Cesium3DTiles
   * You should use other mode when possible
   * @see [[RealityDataSource.createKeyFromUrl]] that will try to detect provider from an URL
   */
  TilesetUrl = "TilesetUrl",
  /**
   * This is the legacy mode where the access to the 3d tiles is harcoded in ContextRealityModelProps.OrbitGtBlob property.
   * It was use to support OrbitPointCloud (OPC) from other server than ContextShare
   * You should use other mode when possible
   * @see [[RealityDataSource.createKeyFromOrbitGtBlobProps]] that will try to detect provider from an URL
   */
  OrbitGtBlob = "OrbitGtBlob",
  /**
   * Will provide access url from realityDataId and iTwinId on contextShare for 3dTile storage format or  OPC storage format
   * This provider support all type of 3dTile storage fomat and OrbitPointCloud: RealityMesh3DTiles, Terrain3DTiles, Cesium3DTiles, OPC
   * @see [[RealityDataFormat]].
   */
  ContextShare = "ContextShare",
  /**
   * Will provide Open Street Map Building (OSM) from Cesium Ion (in 3dTile format)
   */
  CesiumIonAsset = "CesiumIonAsset",
}

/** Identify the Reality Data storage format
 * @beta
 */
export enum RealityDataFormat {
  /**
   * 3dTile supported formats; RealityMesh3DTiles, Terrain3DTiles, Cesium3DTiles
   * */
  ThreeDTile = "ThreeDTile",
  /**
   * Orbit Point Cloud (OPC) storage format (RealityDataType.OPC)
  */
  OPC = "OPC",
}

/** Utility function for RealityDataFormat
 * @beta
 */
export namespace RealityDataFormat {
  /**
   * Try to extract the RealityDataFormat from the url
   * @param tilesetUrl the reality data attachment url
   * @returns the extracted RealityDataFormat or ThreeDTile by default if not found
   */
  export function fromUrl(tilesetUrl: string): RealityDataFormat {
    let format = RealityDataFormat.ThreeDTile;
    if (tilesetUrl.includes(".opc"))
      format = RealityDataFormat.OPC;
    return format;
  }
}

/**
 * Key used by RealityDataSource to identify provider and reality data format
 * This key identify one and only one reality data source on the provider
 * @beta
 */
export interface RealityDataSourceKey {
  /**
   * The provider that supplies the access to reality data source for displaying the reality model
   * @see [[RealityDataProvider]] for default supported value;
  */
  provider: string;
  /**
   * The format used by the provider to store the reality data
   * @see [[RealityDataFormat]] for default supported value;
  */
  format: string;
  /** The reality data id that identify a reality data for the provider */
  id: string;
  /** The context id that was used when reality data was attached - if none provided, current session iTwinId will be used */
  iTwinId?: string;
}
/**
 * RealityDataSourceKey utility functions
 * @beta */
export namespace RealityDataSourceKey {
  /** Utility function to convert a RealityDataSourceKey into its string representation */
  export function convertToString(rdSourceKey: RealityDataSourceKey): string {
    return `${rdSourceKey.provider}:${rdSourceKey.format}:${rdSourceKey.id}:${rdSourceKey?.iTwinId}`;
  }
  /** Utility function to compare two RealityDataSourceKey, we consider it equal even if itwinId is different */
  export function isEqual(key1: RealityDataSourceKey, key2: RealityDataSourceKey): boolean {
    if ((key1.provider === RealityDataProvider.CesiumIonAsset) && key2.provider === RealityDataProvider.CesiumIonAsset)
      return true; // ignore other properties for CesiumIonAsset, id is hidden
    if ((key1.provider === key2.provider) && (key1.format === key2.format) && (key1.id === key2.id)) {
      // && (key1?.iTwinId === key2?.iTwinId)) -> ignore iTwinId, consider it is the same reality data
      return true;
    }
    return false;
  }
}

/** JSON representation of the reality data reference attachment properties.
 * @beta
*/
export interface RealityDataSourceProps {
  /** The source key that identify a reality data for the provider. */
  sourceKey: RealityDataSourceKey;
}

/** JSON representation of a [[ContextRealityModel]].
 * @public
 * @extensions
 */
export interface ContextRealityModelProps {
  /** See [[ContextRealityModel.rdSourceKey]].
   * @beta
   */
  rdSourceKey?: RealityDataSourceKey;
  /** The URL that supplies the 3d tiles for displaying the reality model. */
  tilesetUrl: string;
  /** See [[ContextRealityModel.orbitGtBlob]].
   * @alpha
   */
  orbitGtBlob?: OrbitGtBlobProps;
  /** See [[ContextRealityModel.realityDataId]]. */
  realityDataId?: string;
  /** An optional, user-friendly name for the reality model suitable for display in a user interface. */
  name?: string;
  /** An optional, user-friendly description of the reality model suitable for display in a user interface. */
  description?: string;
  /** See [[ContextRealityModel.classifiers]]. */
  classifiers?: SpatialClassifierProps[];
  /** See [[ContextRealityModel.planarClipMask]]. */
  planarClipMask?: PlanarClipMaskProps;
  /** See [[ContextRealityModel.appearanceOverrides]]. */
  appearanceOverrides?: FeatureAppearanceProps;
  /** See [[ContextRealityModel.displaySettings]].
   * @beta
   */
  displaySettings?: RealityModelDisplayProps;
  /** See [[ContextRealityModel.invisible]].
   * @beta
   */
  invisible?: boolean;
}

/** @public */
export namespace ContextRealityModelProps {
  /** Produce a deep copy of `input`. */
  export function clone(input: ContextRealityModelProps): ContextRealityModelProps {
    // Spread operator is shallow, and includes `undefined` properties and empty strings.
    // We want to make deep copies, omit undefined properties and empty strings, and require tilesetUrl to be defined.
    const output: ContextRealityModelProps = { tilesetUrl: input.tilesetUrl ?? "" };

    if (input.rdSourceKey)
      output.rdSourceKey = { ...input.rdSourceKey };

    if (input.name)
      output.name = input.name;

    if (input.realityDataId)
      output.realityDataId = input.realityDataId;

    if (input.description)
      output.description = input.description;

    if (input.orbitGtBlob)
      output.orbitGtBlob = { ...input.orbitGtBlob };

    if (input.appearanceOverrides) {
      output.appearanceOverrides = { ...input.appearanceOverrides };
      if (input.appearanceOverrides.rgb)
        output.appearanceOverrides.rgb = { ...input.appearanceOverrides.rgb };
    }

    if (input.displaySettings) {
      output.displaySettings = { ...input.displaySettings };
      if (input.displaySettings.pointCloud)
        output.displaySettings.pointCloud = { ...output.displaySettings.pointCloud };
    }

    if (input.planarClipMask)
      output.planarClipMask = { ...input.planarClipMask };

    if (input.classifiers)
      output.classifiers = input.classifiers.map((x) => { return { ...x, flags: { ...x.flags } }; });

    if (input.invisible)
      output.invisible = input.invisible;

    return output;
  }
}

/** A reality model not associated with a [GeometricModel]($backend) but instead defined in a [DisplayStyle]($backend) or [DisplayStyleState]($frontend).
 * Such reality models are displayed to provide context to the view and can be freely attached and detached at display time.
 * @see [this interactive example](https://www.itwinjs.org/sample-showcase/?group=Viewer&sample=reality-data-sample)
 * @see [[DisplayStyleSettings.contextRealityModels]] to define context reality models for a display style.
 * @public
 */
export class ContextRealityModel {
  /** @internal */
  protected readonly _props: ContextRealityModelProps;
  /**
   * The reality data source key identify the reality data provider and storage format.
   * It takes precedence over tilesetUrl and orbitGtBlob when present and can be use to actually replace these properties.
   * @beta
   */
  public readonly rdSourceKey?: RealityDataSourceKey;
  /** A name suitable for display in a user interface. By default, an empty string. */
  public readonly name: string;
  /** The URL that supplies the 3d tiles for displaying the reality model. */
  public readonly url: string;
  /** A description of the model suitable for display in a user interface. By default, an empty string. */
  public readonly description: string;
  /** An optional identifier that, if present, can be used to elide a request to the reality data service. */
  public readonly realityDataId?: string;

  private _invisible: boolean;
  private readonly _classifiers: SpatialClassifiers;
  /** @alpha */
  public readonly orbitGtBlob?: Readonly<OrbitGtBlobProps>;
  protected _appearanceOverrides?: FeatureAppearance;
  /** @beta */
  protected _displaySettings: RealityModelDisplaySettings;
  protected _planarClipMask?: PlanarClipMaskSettings;
  /** Event dispatched just before assignment to [[planarClipMaskSettings]]. */
  public readonly onPlanarClipMaskChanged = new BeEvent<(newSettings: PlanarClipMaskSettings | undefined, model: ContextRealityModel) => void>();
  /** Event dispatched just before assignment to [[appearanceOverrides]]. */
  public readonly onAppearanceOverridesChanged = new BeEvent<(newOverrides: FeatureAppearance | undefined, model: ContextRealityModel) => void>();
  /** Event dispatched just before assignment to [[displaySettings]].
   * @beta
   */
  public readonly onDisplaySettingsChanged = new BeEvent<(newSettings: RealityModelDisplaySettings, model: ContextRealityModel) => void>();
  /** Event dispatched just before a model become invisible
   * @beta
   */
  public readonly onInvisibleChanged = new BeEvent<(invisible: boolean, model: ContextRealityModel) => void>();

  /** Construct a new context reality model.
   * @param props JSON representation of the reality model, which will be kept in sync with changes made via the ContextRealityModel's methods.
   * @param options Options to customize how the reality model is created.
   */
  public constructor(props: ContextRealityModelProps, options?: { createClassifiers: (container: SpatialClassifiersContainer) => SpatialClassifiers }) {
    this._props = props;
    this.rdSourceKey = props.rdSourceKey;
    this.name = props.name ?? "";
    this.url = props.tilesetUrl ?? "";
    this.orbitGtBlob = props.orbitGtBlob;
    this.realityDataId = props.realityDataId;
    this.description = props.description ?? "";
    this._invisible = props.invisible ?? false;
    this._appearanceOverrides = props.appearanceOverrides ? FeatureAppearance.fromJSON(props.appearanceOverrides) : undefined;
    this._displaySettings = RealityModelDisplaySettings.fromJSON(props.displaySettings);

    if (props.planarClipMask && props.planarClipMask.mode !== PlanarClipMaskMode.None)
      this._planarClipMask = PlanarClipMaskSettings.fromJSON(props.planarClipMask);

    if (options?.createClassifiers) {
      this._classifiers = options.createClassifiers(props);
    } else {
      this._classifiers = new SpatialClassifiers(props);
    }
  }

  /** A set of [[SpatialClassifier]]s, of which one at any given time can be used to classify the reality model. */
  public get classifiers(): SpatialClassifiers {
    return this._classifiers;
  }

  /** Optionally describes how the geometry of the reality model can be masked by other models. */
  public get planarClipMaskSettings(): PlanarClipMaskSettings | undefined {
    return this._planarClipMask;
  }
  public set planarClipMaskSettings(settings: PlanarClipMaskSettings | undefined) {
    this.onPlanarClipMaskChanged.raiseEvent(settings, this);
    if (!settings)
      delete this._props.planarClipMask;
    else
      this._props.planarClipMask = settings.toJSON();

    this._planarClipMask = settings;
  }

  /** Overrides applied to the appearance of the reality model. Only the rgb, transparency, nonLocatable, and emphasized properties are applicable - the rest are ignored. */
  public get appearanceOverrides(): FeatureAppearance | undefined {
    return this._appearanceOverrides;
  }
  public set appearanceOverrides(overrides: FeatureAppearance | undefined) {
    this.onAppearanceOverridesChanged.raiseEvent(overrides, this);
    if (!overrides)
      delete this._props.appearanceOverrides;
    else
      this._props.appearanceOverrides = overrides.toJSON();

    this._appearanceOverrides = overrides;
  }

  /** Settings controlling how this reality model is displayed in a [Viewport]($frontend).
   * @beta
   */
  public get displaySettings(): RealityModelDisplaySettings {
    return this._displaySettings;
  }
  public set displaySettings(settings: RealityModelDisplaySettings) {
    this.onDisplaySettingsChanged.raiseEvent(settings, this);
    this._props.displaySettings = settings.toJSON();
    this._displaySettings = settings;
  }

  /** If true, reality model is not drawn.
   * @beta
  */
  public get invisible(): boolean {
    return this._invisible;
  }
  public set invisible(invisible: boolean) {
    if (invisible !== this.invisible) {
      this.onInvisibleChanged.raiseEvent(invisible, this);
    }

    this._props.invisible = invisible;
    this._invisible = invisible;
  }

  /** Convert this model to its JSON representation. */
  public toJSON(): ContextRealityModelProps {
    return ContextRealityModelProps.clone(this._props);
  }

  /** Returns true if [[name]] and [[url]] match the specified name and url. */
  public matchesNameAndUrl(name: string, url: string): boolean {
    return this.name === name && this.url === url;
  }
}

/** An object that can store the JSON representation of a list of [[ContextRealityModel]]s.
 * @see [[ContextRealityModels]].
 * @see [[DisplayStyleSettingsProps.contextRealityModels]].
 * @public
 * @extensions
 */
export interface ContextRealityModelsContainer {
  /** The list of reality models. */
  contextRealityModels?: ContextRealityModelProps[];
  /** @internal used for type discrimination with ContextRealityModelsArgs. */
  container?: never;
}

/** Arguments supplied to the constructor of [[ContextRealityModels]].
 * @public
 */
export interface ContextRealityModelsArgs {
  /** The object that holds the JSON representation of the list of context reality models. */
  container: ContextRealityModelsContainer;
  /** Optional function used to instantiate each [[ContextRealityModel]] in the list. */
  createContextRealityModel?: (props: ContextRealityModelProps) => ContextRealityModel;
  /** If true, the list will not be populated by the constructor. Instead, the caller is responsible for calling [[ContextRealityModels.populate]] exactly once after construction.
   * This is chiefly intended for use internally by the [DisplayStyleState]($frontend) constructor.
   */
  deferPopulating?: boolean;
}

/** A list of [[ContextRealityModel]]s attached to a [[DisplayStyleSettings]]. The list may be presented to the user with the name and description of each model.
 * The list is automatically synchronized with the underlying JSON representation provided by the input [[ContextRealityModelsContainer]].
 * @see [this interactive example](https://www.itwinjs.org/sample-showcase/?group=Viewer&sample=reality-data-sample)
 * @see [[DisplayStyleSettings.contextRealityModels]].
 * @public
 */
export class ContextRealityModels {
  private readonly _container: ContextRealityModelsContainer;
  private readonly _createModel: (props: ContextRealityModelProps) => ContextRealityModel;
  private readonly _models: ContextRealityModel[] = [];
  /** Event dispatched just before [[ContextRealityModel.planarClipMaskSettings]] is modified for one of the reality models. */
  public readonly onPlanarClipMaskChanged = new BeEvent<(model: ContextRealityModel, newSettings: PlanarClipMaskSettings | undefined) => void>();
  /** Event dispatched just before [[ContextRealityModel.appearanceOverrides]] is modified for one of the reality models. */
  public readonly onAppearanceOverridesChanged = new BeEvent<(model: ContextRealityModel, newOverrides: FeatureAppearance | undefined) => void>();
  /** Event dispatched just before [[ContextRealityModel.displaySettings]] is modified for one of the reality models.
   * @beta
   */
  public readonly onDisplaySettingsChanged = new BeEvent<(model: ContextRealityModel, newSettings: RealityModelDisplaySettings) => void>();
  /** Event dispatched just before [[ContextRealityModel.invisible]] is modified for one of the reality models.
   * @beta
   */
  public readonly onInvisibleChanged = new BeEvent<(model: ContextRealityModel, invisible: boolean) => void>();
  /** Event dispatched when a model is [[add]]ed, [[delete]]d, [[replace]]d, or [[update]]d. */
  public readonly onChanged = new BeEvent<(previousModel: ContextRealityModel | undefined, newModel: ContextRealityModel | undefined) => void>();

  /** Construct a new list of reality models from its JSON representation. The list will be initialized from `container.contextRealityModels` and that JSON representation
   * will be kept in sync with changes made to the list. The caller should not directly modify `container.contextRealityModels` or its contents as that will cause the list
   * to become out of sync with the JSON representation.
   * @param container The object that holds the JSON representation of the list.
   * @param createContextRealityModel Optional function used to instantiate each [[ContextRealityModel]] in the list.
   */
  public constructor(container: ContextRealityModelsContainer, createContextRealityModel?: (props: ContextRealityModelProps) => ContextRealityModel);

  /** Construct a new list of reality models from its JSON representation. The list will be initialized from `args.container.contextRealityModels` and that JSON representation
   * will be kept in sync with changes made to the list. The caller should not directly modify `container.contextRealityModels` or its contents as that will cause the list
   * to become out of sync with the JSON representation.
   * @param args Specifies the container and optionally customizes how the list of models is populated.
   */
  public constructor(args: ContextRealityModelsArgs);

  /** @internal */
  public constructor(arg0: ContextRealityModelsContainer | ContextRealityModelsArgs, createContextRealityModel?: (props: ContextRealityModelProps) => ContextRealityModel) {
    let container: ContextRealityModelsContainer;
    let defer = false;
    if (arg0.container) {
      container = arg0.container;
      createContextRealityModel = arg0.createContextRealityModel;
      defer = true === arg0.deferPopulating;
    } else {
      container = arg0;
    }

    this._container = container;
    this._createModel = createContextRealityModel ?? ((props) => new ContextRealityModel(props));

    if (!defer)
      this.populate();
  }

  /** @internal needs to be invoked after DisplayStyleSettings constructor by DisplayStyleState constructor.*/
  /** Populate the list of [[models]] from the container that was supplied to the constructor.
   * This should only be invoked once, and only if [[ContextRealityModelsArgs.deferPopulating]] was specified as `true` when calling the constructor.
   * @public
   */
  public populate(): void {
    assert(this._models.length === 0, "do not call ContextRealityModels.populate more than once");
    const models = this._container.contextRealityModels;
    if (models)
      for (const model of models)
        this._models.push(this.createModel(model));
  }

  /** The read-only list of reality models. */
  public get models(): ReadonlyArray<ContextRealityModel> {
    return this._models;
  }

  /** Append a new reality model to the list.
   * @param The JSON representation of the reality model.
   * @returns the newly-added reality model.
   */
  public add(props: ContextRealityModelProps): ContextRealityModel {
    if (!this._container.contextRealityModels)
      this._container.contextRealityModels = [];

    props = ContextRealityModelProps.clone(props);
    const model = this.createModel(props);

    this.onChanged.raiseEvent(undefined, model);

    this._models.push(model);
    this._container.contextRealityModels.push(props);

    return model;
  }

  /** Remove the specified reality model from the list.
   * @param model The reality model to remove.
   * @returns true if the model was removed, or false if the model was not present in the list.
   */
  public delete(model: ContextRealityModel): boolean {
    const index = this._models.indexOf(model);
    if (-1 === index)
      return false;

    assert(undefined !== this._container.contextRealityModels);
    assert(index < this._container.contextRealityModels.length);

    this.dropEventListeners(model);
    this.onChanged.raiseEvent(model, undefined);

    this._models.splice(index, 1);
    if (this.models.length === 0)
      this._container.contextRealityModels = undefined;
    else
      this._container.contextRealityModels.splice(index, 1);

    return true;
  }

  /** Remove all reality models from the list. */
  public clear(): void {
    for (const model of this.models) {
      this.dropEventListeners(model);
      this.onChanged.raiseEvent(model, undefined);
    }

    this._container.contextRealityModels = undefined;
    this._models.length = 0;
  }

  /** Replace a reality model in the list.
   * @param toReplace The reality model to be replaced.
   * @param replaceWith The JSON representation of the replacement reality model.
   * @returns the newly-created reality model that replaced `toReplace`.
   * @throws Error if `toReplace` is not present in the list
   * @note The replacement occupies the same index in the list as `toReplace` did.
   */
  public replace(toReplace: ContextRealityModel, replaceWith: ContextRealityModelProps): ContextRealityModel {
    const index = this._models.indexOf(toReplace);
    if (-1 === index)
      throw new Error("ContextRealityModel not present in list.");

    assert(undefined !== this._container.contextRealityModels);
    assert(index < this._container.contextRealityModels.length);

    replaceWith = ContextRealityModelProps.clone(replaceWith);
    const model = this.createModel(replaceWith);

    this.onChanged.raiseEvent(toReplace, model);
    this.dropEventListeners(toReplace);

    this._models[index] = model;
    this._container.contextRealityModels[index] = replaceWith;

    return model;
  }

  /** Change selected properties of a reality model.
   * @param toUpdate The reality model whose properties are to be modified.
   * @param updateProps The properties to change.
   * @returns The updated reality model, identical to `toUpdate` except for properties explicitly supplied by `updateProps`.
   * @throws Error if `toUpdate` is not present in the list.
   */
  public update(toUpdate: ContextRealityModel, updateProps: Partial<ContextRealityModelProps>): ContextRealityModel {
    const props = {
      ...toUpdate.toJSON(),
      ...updateProps,
    };

    // Partial<> makes it possible to pass `undefined` for tilesetUrl...preserve previous URL in that case.
    if (undefined === props.tilesetUrl)
      props.tilesetUrl = toUpdate.url;

    return this.replace(toUpdate, props);
  }

  private createModel(props: ContextRealityModelProps): ContextRealityModel {
    const model = this._createModel(props);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    model.onPlanarClipMaskChanged.addListener(this.handlePlanarClipMaskChanged, this);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    model.onAppearanceOverridesChanged.addListener(this.handleAppearanceOverridesChanged, this);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    model.onDisplaySettingsChanged.addListener(this.handleDisplaySettingsChanged, this);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    model.onInvisibleChanged.addListener(this.handleInvisibleChanged, this);
    return model;
  }

  private dropEventListeners(model: ContextRealityModel): void {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    model.onPlanarClipMaskChanged.removeListener(this.handlePlanarClipMaskChanged, this);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    model.onAppearanceOverridesChanged.removeListener(this.handleAppearanceOverridesChanged, this);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    model.onDisplaySettingsChanged.removeListener(this.handleDisplaySettingsChanged, this);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    model.onInvisibleChanged.removeListener(this.handleInvisibleChanged, this);
  }

  private handlePlanarClipMaskChanged(mask: PlanarClipMaskSettings | undefined, model: ContextRealityModel): void {
    this.onPlanarClipMaskChanged.raiseEvent(model, mask);
  }

  private handleAppearanceOverridesChanged(app: FeatureAppearance | undefined, model: ContextRealityModel): void {
    this.onAppearanceOverridesChanged.raiseEvent(model, app);
  }

  private handleDisplaySettingsChanged(settings: RealityModelDisplaySettings, model: ContextRealityModel): void {
    this.onDisplaySettingsChanged.raiseEvent(model, settings);
  }

  private handleInvisibleChanged(invisible: boolean, model: ContextRealityModel): void {
    this.onInvisibleChanged.raiseEvent(model, invisible);
  }
}
