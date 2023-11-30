/* eslint-disable deprecation/deprecation */
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module MapLayers
 */

import { assert, Id64String } from "@itwin/core-bentley";
import { BackgroundMapProvider, BackgroundMapProviderProps, BackgroundMapType } from "./BackgroundMapProvider";
import { DeprecatedBackgroundMapProps } from "./BackgroundMapSettings";

/** The current set of supported map layer formats.
 * In order to be displayed, a corresponding format must have been registered in the [MapLayerFormatRegistry]($frontend)
 * @public
 */
export type ImageryMapLayerFormatId  = "ArcGIS" | "BingMaps" | "MapboxImagery" | "TileURL" | "WMS" | "WMTS";

/** @public */
export type SubLayerId = string | number;

/** JSON representation of the settings associated with a map sublayer included within a [[MapLayerProps]].
 * A map sub layer represents a set of objects within the layer that can be controlled separately.  These
 * are produced only from map servers that produce images on demand and are not supported by tiled (cached) servers.
 * @see [[MapLayerProps]]
 * @public
 */
export interface MapSubLayerProps {
  name: string;
  title?: string;
  visible?: boolean;
  id?: SubLayerId;
  parent?: SubLayerId;
  children?: SubLayerId[];
}

/** Normalized representation of a [[MapSubLayerProps]] for which values
 * have been validated and default values have been applied where explicit values not defined.
 * A map sub layer represents a set of objects within the layer that can be controlled separately.  These
 * are produced only from map servers that produce images on demand and are not supported by tiled (cached) servers.
 * This class can represent a hierarchy, in this case a sub layer is visible only if all its ancestors are also visible.
 * @see [[MapLayerSettings]]
 * @public
 */
export class MapSubLayerSettings {
  /** Typically Name is a single word used for machine-to-machine communication while the Title is for the benefit of humans (WMS) */
  public readonly name: string;
  /** Title. */
  public readonly title?: string;
  /** If true the sub layer is visible.  If part of a hierarchy, a sub layer is visible only if its ancestors are also visible. */
  public readonly visible: boolean;
  /** A unique string or number that may be used to identify the sub layer (ArcGIS) */
  public readonly id: SubLayerId;
  /** One or more sublayer children */
  public readonly children?: SubLayerId[];
  /** sublayer parent. */
  public readonly parent?: SubLayerId;

  constructor(name: string, title?: string, visible?: boolean, id?: SubLayerId, parent?: SubLayerId, children?: SubLayerId[]) {
    this.name = name;
    this.title = title;
    this.visible = visible !== undefined && visible;
    this.id = (id === undefined) ? this.name : id;
    this.parent = parent;
    this.children = children;
  }

  /** Construct from JSON, performing validation and applying default values for undefined fields. */
  public static fromJSON(json: MapSubLayerProps): MapSubLayerSettings {
    return new MapSubLayerSettings(json.name, json.title, json.visible, (json.id === json.name) ? undefined : json.id, json.parent, json.children);
  }

  public toJSON(): MapSubLayerProps {
    const props: MapSubLayerProps = { name: this.name, visible: this.visible };

    if (undefined !== this.id && this.id !== this.name)
      props.id = this.id;

    if (undefined !== this.title)
      props.title = this.title;

    if (this.children)
      props.children = [...this.children];

    if (undefined !== this.parent)
      props.parent = this.parent;

    return props;
  }

  /** Creating a copy of this MapSubLayer, optionally modifying some if its properties */
  public clone(changedProps: Partial<MapSubLayerProps>): MapSubLayerSettings {
    if (undefined === changedProps)
      return this;

    const props = {
      name: undefined !== changedProps.name ? changedProps.name : this.name,
      id: undefined !== changedProps.id ? changedProps.id : this.id,
      visible: undefined !== changedProps.visible ? changedProps.visible : this.visible,
      parent: undefined !== changedProps.parent ? changedProps.parent : this.parent,
      children: undefined !== changedProps.children ? changedProps.children.slice() : this.children?.slice(),
      title: undefined !== changedProps.title ? changedProps.title : this.title,
    };
    return MapSubLayerSettings.fromJSON(props)!;
  }

  /** @internal */
  public displayMatches(other: MapSubLayerSettings): boolean {
    return this.name === other.name && this.visible === other.visible;
  }

  /** return true if this sublayer is named. */
  public get isNamed(): boolean { return this.name.length > 0; }

  /** return true if this sublayer is a leaf (has no children) */
  public get isLeaf(): boolean { return this.children === undefined || this.children.length === 0; }

  /** return true if this sublayer is an unnamed group */
  public get isUnnamedGroup(): boolean { return !this.isLeaf && !this.isNamed; }

  /** return a string representing this sublayer id (converting to string if underlying id is number) */
  public get idString(): string { return (typeof this.id === "number") ? this.id.toString(10) : this.id; }
}

/** JSON representation of properties common to both [[ImageMapLayerProps]] and [[ModelMapLayerProps]].
 * @see [[MapImageryProps]]
 * @public
 */
export interface CommonMapLayerProps {
  /** Controls visibility of layer. Defaults to 'true'. */
  visible?: boolean;

  /** A user-friendly name for the layer. */
  name: string;
  /** A transparency value from 0.0 (fully opaque) to 1.0 (fully transparent) to apply to map graphics when drawing,
   * or false to indicate the transparency should not be overridden.
   * Default value: 0.
   */
  transparency?: number;
  /** True to indicate background is transparent.
   * Default: true.
   */
  transparentBackground?: boolean;
}

/** JSON representation of an [[ImageMapLayerSettings]].
 * @see [[MapImagerySettings]].
 * @see [[ImageryMapLayerFormatId]].
 * @public
 */
export interface ImageMapLayerProps extends CommonMapLayerProps {
  /** URL */
  url: string;
  /** Identifies the map layers source.*/
  formatId: string;
  /** Source layers. If undefined all layers are displayed. */
  subLayers?: MapSubLayerProps[];
  /** Access Key for the Layer, like a subscription key or access token.
   * ###TODO This does not belong in the props object. It should never be persisted.
   */
  /** @internal */
  accessKey?: MapLayerKey;

  /** @internal */
  modelId?: never;

  /** List of query parameters that will get appended to the source.
   * @beta
  */
  queryParams?: { [key: string]: string };

}

/** JSON representation of a [[ModelMapLayerSettings]].
 * @see [[MapImagerySettings]].
 * @public
 */
export interface ModelMapLayerProps extends CommonMapLayerProps {
  /** The Id of the [GeometricModel]($backend) containing the geometry to be drawn by the layer. */
  modelId: Id64String;

  /** @internal */
  url?: never;
  /** @internal */
  formatId?: never;
  /** @internal */
  subLayers?: never;
  /** @internal */
  accessKey?: never;
}

/** JSON representation of a [[MapLayerSettings]].
 * @see [[MapImagerySettings]].
 * @public
 */
export type MapLayerProps = ImageMapLayerProps | ModelMapLayerProps;

/**
 * stores key-value pair to be added to all requests made involving map layer.
 * @public
 */
export interface MapLayerKey {
  key: string;
  value: string;
}

/** Abstract base class for normalized representation of a [[MapLayerProps]] for which values have been validated and default values have been applied where explicit values not defined.
 * This class is extended by [[ImageMapLayerSettings]] and [ModelMapLayerSettings]] to create the settings for image and model based layers.
 * One or more map layers may be included within [[MapImagerySettings]] object.
 * @see [[MapImagerySettings]]
 * @public
 */
export abstract class MapLayerSettings {
  public readonly visible: boolean;

  public readonly name: string;
  public readonly transparency: number;
  public readonly transparentBackground: boolean;
  public abstract get allSubLayersInvisible(): boolean;
  public abstract clone(changedProps: Partial<MapLayerProps>): MapLayerSettings;
  public abstract toJSON(): MapLayerProps;

  /** @internal */
  protected constructor(name: string, visible = true, transparency: number = 0, transparentBackground = true) {
    this.name = name;
    this.visible = visible;
    this.transparentBackground = transparentBackground;
    this.transparency = transparency;
  }

  /** Create a map layer settings from its JSON representation. */
  public static fromJSON(props: MapLayerProps): MapLayerSettings {
    return undefined !== props.modelId ? ModelMapLayerSettings.fromJSON(props) : ImageMapLayerSettings.fromJSON(props);
  }

  /** @internal */
  protected _toJSON(): CommonMapLayerProps {
    const props: CommonMapLayerProps = {
      name: this.name,
      visible: this.visible,
    };

    if (0 !== this.transparency)
      props.transparency = this.transparency;

    if (this.transparentBackground === false)
      props.transparentBackground = this.transparentBackground;

    return props;
  }

  /** @internal */
  protected cloneProps(changedProps: Partial<MapLayerProps>): CommonMapLayerProps {
    return {
      name: undefined !== changedProps.name ? changedProps.name : this.name,
      visible: undefined !== changedProps.visible ? changedProps.visible : this.visible,
      transparency: undefined !== changedProps.transparency ? changedProps.transparency : this.transparency,
      transparentBackground: undefined !== changedProps.transparentBackground ? changedProps.transparentBackground : this.transparentBackground,
    };
  }

  /** @internal */
  public displayMatches(other: MapLayerSettings): boolean {
    return this.name === other.name && this.visible === other.visible && this.transparency === other.transparency && this.transparentBackground === other.transparentBackground;
  }

  /** Return a unique string identifying the layers source... The URL for image layer or modelID for model layer  */
  public abstract get source(): string;

  /** @internal */
  public matchesNameAndSource(name: string, source: string): boolean {
    return this.name === name && this.source === source;
  }
}

/** Normalized representation of a [[ImageMapLayerProps]] for which values have been validated and default values have been applied where explicit values not defined.
 * Image map layers are created from servers that produce images that represent map tiles.  Map layers map also be represented by models.
 * One or more map layers may be included within [[MapImagerySettings]] object.
 * @see [[MapImagerySettings]]
 * @see [[ModelMapLayerSettings]] for model based map layer settings.
 * @public
 */
export class ImageMapLayerSettings extends MapLayerSettings {
  public readonly formatId: string;
  public readonly url: string;
  public userName?: string;
  public password?: string;
  public accessKey?: MapLayerKey;

  /** List of query parameters to append to the settings URL and persisted as part of the JSON representation.
   * @note Sensitive information like user credentials should be provided in [[unsavedQueryParams]] to ensure it is never persisted.
   * @beta
  */
  public savedQueryParams?: { [key: string]: string };

  /** List of query parameters that will get appended to the settings URL that should *not* be be persisted part of the JSON representation.
   * @beta
  */
  public unsavedQueryParams?: { [key: string]: string };
  public readonly subLayers: MapSubLayerSettings[];
  public override get source(): string { return this.url; }

  /** @internal */
  protected constructor(props: ImageMapLayerProps) {
    const transparentBackground = props.transparentBackground ?? true;
    super(props.name, props.visible, props.transparency, transparentBackground);

    this.formatId = props.formatId;
    this.url = props.url;
    this.accessKey = props.accessKey;
    if (props.queryParams) {
      this.savedQueryParams = {...props.queryParams};
    }
    this.subLayers = [];
    if (!props.subLayers)
      return;

    for (const subLayerProps of props.subLayers) {
      const subLayer = MapSubLayerSettings.fromJSON(subLayerProps);
      if (subLayer)
        this.subLayers.push(subLayer);
    }
  }

  public static override fromJSON(props: ImageMapLayerProps): ImageMapLayerSettings {
    return new this(props);
  }

  /** return JSON representation of this MapLayerSettings object */
  public override toJSON(): ImageMapLayerProps {
    const props = super._toJSON() as ImageMapLayerProps;
    props.url = this.url;
    props.formatId = this.formatId;

    if (this.subLayers.length > 0)
      props.subLayers = this.subLayers.map((x) => x.toJSON());

    if (this.savedQueryParams)
      props.queryParams = {...this.savedQueryParams};

    return props;
  }

  /** Create a copy of this MapLayerSettings, optionally modifying some of its properties.
   * @param changedProps JSON representation of the properties to change.
   * @returns A MapLayerSettings with all of its properties set to match those of `this`, except those explicitly defined in `changedProps`.
   */
  public clone(changedProps: Partial<ImageMapLayerProps>): ImageMapLayerSettings {
    const clone = ImageMapLayerSettings.fromJSON(this.cloneProps(changedProps));

    // Clone members not part of MapLayerProps
    clone.userName = this.userName;
    clone.password = this.password;
    clone.accessKey = this.accessKey;
    if (this.unsavedQueryParams)
      clone.unsavedQueryParams = {...this.unsavedQueryParams};
    if (this.savedQueryParams)
      clone.savedQueryParams = {...this.savedQueryParams};

    return clone;
  }

  /** @internal */
  protected override cloneProps(changedProps: Partial<ImageMapLayerProps>): ImageMapLayerProps {
    const props = super.cloneProps(changedProps) as ImageMapLayerProps;

    props.formatId = changedProps.formatId ?? this.formatId;
    props.url = changedProps.url ?? this.url;
    props.accessKey = changedProps.accessKey ?? this.accessKey;
    props.subLayers = changedProps.subLayers ?? this.subLayers;
    if (changedProps.queryParams) {
      props.queryParams = {...changedProps.queryParams};
    } else if (this.savedQueryParams) {
      props.queryParams = {...this.savedQueryParams};
    }

    return props;
  }

  /** @internal */
  public override displayMatches(other: MapLayerSettings): boolean {
    if (! (other instanceof ImageMapLayerSettings) || !super.displayMatches(other))
      return false;

    if (this.userName !== other.userName || this.password !== other.password || this.subLayers.length !== other.subLayers.length) {
      return false;
    }

    for (let i = 0; i < this.subLayers.length; i++)
      if (!this.subLayers[i].displayMatches(other.subLayers[i]))
        return false;

    return true;
  }

  /** Return a sublayer matching id -- or undefined if not found */
  public subLayerById(id?: SubLayerId): MapSubLayerSettings | undefined {
    return id === undefined ? undefined : this.subLayers.find((subLayer) => subLayer.id === id);
  }

  private hasInvisibleAncestors(subLayer?: MapSubLayerSettings): boolean {
    if (!subLayer || !subLayer.parent)
      return false;

    const parent = this.subLayerById(subLayer.parent);
    if (!parent)
      return false;

    // Visibility of named group has no impact on the visibility of children (only unnamed group does)
    // i.e For WMS, its should be possible to request a child layer when its parent is not visible (if the parent is also named)
    return (!parent.visible && !parent.isNamed) || this.hasInvisibleAncestors(parent);
  }

  /** Return true if sublayer is visible -- testing ancestors for visibility if they exist. */
  public isSubLayerVisible(subLayer: MapSubLayerSettings): boolean {
    if (!subLayer.visible)
      return false;

    return !this.hasInvisibleAncestors(subLayer);
  }

  /** Return true if all sublayers are invisible. */
  public get allSubLayersInvisible(): boolean {
    if (this.subLayers.length === 0)
      return false;

    return this.subLayers.every((subLayer) => (subLayer.isUnnamedGroup || !this.isSubLayerVisible(subLayer)));
  }

  /** Return the children for a sublayer */
  public getSubLayerChildren(subLayer: MapSubLayerSettings): MapSubLayerSettings[] | undefined {
    if (!subLayer.children)
      return undefined;

    const children = new Array<MapSubLayerSettings>();
    subLayer.children.forEach((childId) => {
      const child = this.subLayerById(childId);
      if (child !== undefined)
        children.push(child);
    });

    return children;
  }

  /** @internal */
  protected static mapTypeName(type: BackgroundMapType) {   // TBD.. Localization.
    switch (type) {
      case BackgroundMapType.Aerial:
        return "Aerial Imagery";
      default:
      case BackgroundMapType.Hybrid:
        return "Aerial Imagery with labels";
      case BackgroundMapType.Street:
        return "Streets";
    }
  }

  public setCredentials(userName?: string, password?: string) {
    this.userName = userName;
    this.password = password;
  }

  /** Collect all query parameters
 * @beta
 */
  public collectQueryParams() {
    let queryParams: {[key: string]: string} = {};
    if (this.savedQueryParams)
      queryParams = {...this.savedQueryParams};

    if (this.unsavedQueryParams)
      queryParams = {...queryParams, ...this.unsavedQueryParams};

    return queryParams;
  }
}

/** Normalized representation of a [[ModelMapLayerProps]] for which values have been validated and default values have been applied where explicit values not defined.
 * Model map layers are produced from models, typically from two dimensional geometry that may originate in a GIS system.
 * One or more map layers may be included within [[MapImagerySettings]] object.
 * @see [[MapImagerySettings]]
 * @see [[ImageMapLayerSettings]] for image based map layer settings.
 * @public
 */
export class ModelMapLayerSettings extends MapLayerSettings {
  public readonly modelId: Id64String;
  public override get source(): string { return this.modelId; }

  /** @internal */
  protected constructor(modelId: Id64String,  name: string, visible = true,
    transparency: number = 0, transparentBackground = true) {
    super(name, visible, transparency, transparentBackground);
    this.modelId = modelId;
  }

  /** Construct from JSON, performing validation and applying default values for undefined fields. */
  public static override fromJSON(json: ModelMapLayerProps): ModelMapLayerSettings {
    const transparentBackground = (json.transparentBackground === undefined) ? true : json.transparentBackground;
    return new this(json.modelId, json.name, json.visible, json.transparency, transparentBackground);
  }

  /** return JSON representation of this MapLayerSettings object */
  public override toJSON(): ModelMapLayerProps {
    const props = super._toJSON() as ModelMapLayerProps;
    props.modelId = this.modelId;
    return props;
  }

  /** Create a copy of this MapLayerSettings, optionally modifying some of its properties.
   * @param changedProps JSON representation of the properties to change.
   * @returns A MapLayerSettings with all of its properties set to match those of `this`, except those explicitly defined in `changedProps`.
   */
  public clone(changedProps: Partial<ModelMapLayerProps>): ModelMapLayerSettings {
    return ModelMapLayerSettings.fromJSON(this.cloneProps(changedProps));
  }

  /** @internal */
  protected override cloneProps(changedProps: Partial<ModelMapLayerProps>): ModelMapLayerProps {
    const props = super.cloneProps(changedProps) as ModelMapLayerProps;
    props.modelId = changedProps.modelId ?? this.modelId;
    return props;
  }

  /** @internal */
  public override displayMatches(other: MapLayerSettings): boolean {
    if (!(other instanceof ModelMapLayerSettings) || !super.displayMatches(other))
      return false;

    return this.modelId === other.modelId;
  }

  /** Return true if all sublayers are invisible (always false as model layers do not include sublayers). */
  public get allSubLayersInvisible(): boolean {
    return false;
  }
}

/** JSON representation of a [[BaseMapLayerSettings]].
 * @public
 */
export interface BaseMapLayerProps extends ImageMapLayerProps {
  provider?: BackgroundMapProviderProps;
}

/** A [[ImageMapLayerSettings]] that can serve as the base layer for a [[MapImagerySettings]].
 * The base layer supports all of the same options as any other layer, but also allows for simplified configuration based
 * on a small set of known supported [[BackgroundMapProvider]]s like [Bing Maps](https://www.microsoft.com/en-us/maps).
 * If the base layer was configured from such a provider, that information will be preserved and can be queried; this allows
 * the imagery provider and/or type to be easily modified.
 * @see [[MapImagerySettings.backgroundBase]].
 * @public
 */
export class BaseMapLayerSettings extends ImageMapLayerSettings {
  private _provider?: BackgroundMapProvider;

  /** The provider from which this base layer was configured, if any. */
  public get provider(): BackgroundMapProvider | undefined { return this._provider; }

  /** Create a base layer from its JSON representation.
   * TODO: This, MapLayerSettings.fromJSON, and MapSubLayerSettings.fromJSON should never return undefined.
   * That means they should not accept undefined for props and should define props such that it fully describes the
   * layer - e.g., url and name must be defined.
   */
  public static override fromJSON(props: BaseMapLayerProps): BaseMapLayerSettings {
    const settings = super.fromJSON(props);
    assert(settings instanceof BaseMapLayerSettings);
    if (props.provider)
      settings._provider = BackgroundMapProvider.fromJSON(props.provider);

    return settings;
  }

  /** Convert this layer to its JSON representation. */
  public override toJSON(): BaseMapLayerProps {
    const props = super.toJSON() as BaseMapLayerProps;
    if (this.provider)
      props.provider = this.provider.toJSON();

    return props;
  }

  /** @internal */
  public override cloneProps(changedProps: Partial<BaseMapLayerProps>): BaseMapLayerProps {
    const props = super.cloneProps(changedProps) as BaseMapLayerProps;

    if (changedProps.provider)
      props.provider = changedProps.provider;
    else if (this.provider)
      props.provider = this.provider.toJSON();

    return props;
  }

  /** Create a copy of this layer. */
  public override clone(changedProps: Partial<BaseMapLayerProps>): BaseMapLayerSettings {
    const prevUrl = this.url;
    const clone = BaseMapLayerSettings.fromJSON(this.cloneProps(changedProps))!;

    if (this.provider && prevUrl !== this.url)
      clone._provider = undefined;

    return clone;
  }

  /** Create a base layer from a BackgroundMapProvider. */
  public static fromProvider(provider: BackgroundMapProvider, options?: { invisible?: boolean, transparency?: number }): BaseMapLayerSettings {
    let formatId: string, url: string, name: string;
    switch (provider.name) {
      case "BingProvider":
      default:
        formatId = "BingMaps";

        let imagerySet;
        switch (provider.type) {
          case BackgroundMapType.Street:
            imagerySet = "Road";
            break;
          case BackgroundMapType.Aerial:
            imagerySet = "Aerial";
            break;
          case BackgroundMapType.Hybrid:
          default:
            imagerySet = "AerialWithLabels";
            break;
        }

        name = `Bing Maps: ${ImageMapLayerSettings.mapTypeName(provider.type)}`;
        url = `https://dev.virtualearth.net/REST/v1/Imagery/Metadata/${imagerySet}?o=json&incl=ImageryProviders&key={bingKey}`;
        break;

      case "MapBoxProvider":
        formatId = "MapboxImagery";
        name = `MapBox: ${ImageMapLayerSettings.mapTypeName(provider.type)}`;
        switch (provider.type) {
          case BackgroundMapType.Street:
            url = "https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/";
            break;
          case BackgroundMapType.Aerial:
            url = "https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/";
            break;
          case BackgroundMapType.Hybrid:
            url = "https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v11/tiles/";
            break;
        }

        break;
    }

    const settings = super.fromJSON({
      name,
      formatId,
      url,
      transparentBackground: false,
      visible: !options?.invisible,
      transparency: options?.transparency,
    });

    assert(undefined !== settings);
    assert(settings instanceof BaseMapLayerSettings);

    settings._provider = provider;
    return settings;
  }

  /** @internal */
  public static fromBackgroundMapProps(props: DeprecatedBackgroundMapProps): BaseMapLayerSettings {
    return this.fromProvider(BackgroundMapProvider.fromBackgroundMapProps(props));
  }

  /** @alpha */
  public cloneWithProvider(provider: BackgroundMapProvider): BaseMapLayerSettings {
    return BaseMapLayerSettings.fromProvider(provider, { invisible: !this.visible, transparency: this.transparency });
  }
}
