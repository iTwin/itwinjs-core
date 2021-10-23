/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */

import { assert } from "@itwin/core-bentley";
import { BackgroundMapProvider, BackgroundMapProviderProps, BackgroundMapType } from "./BackgroundMapProvider";
import { DeprecatedBackgroundMapProps } from "./BackgroundMapSettings";

/** @beta */
export type SubLayerId = string | number;

/** JSON representation of the settings associated with a map sublayer included within a [[MapLayerProps]].
 * A map sub layer represents a set of objects within the layer that can be controlled separately.  These
 * are produced only from map servers that produce images on demand and are not supported by tiled (cached) servers.
 * @see [[MapLayerProps]]
 * @beta
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
 * This class can represent an hierarchy, in this case a sub layer is visible only if all its ancestors are also visible.
 * @see [[MapLayerSettings]]
 * @beta
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

/** JSON representation of the settings associated with a map layer.  One or more map layers may be included within a [[MapImageryProps]] object.
 * @see [[MapImageryProps]]
 * @beta
 */
export interface MapLayerProps {
  /** Controls visibility of layer. Defaults to 'true'. */
  visible?: boolean;
  /** Identifies the map layers source.*/
  formatId: string;
  /** Name */
  name: string;
  /** URL */
  url: string;
  /** Source layers. If undefined all layers are displayed. */
  subLayers?: MapSubLayerProps[];
  /** A transparency value from 0.0 (fully opaque) to 1.0 (fully transparent) to apply to map graphics when drawing,
   * or false to indicate the transparency should not be overridden. Default value: 0.
   * If omitted, defaults to 0. */
  transparency?: number;
  /** True to indicate background is transparent.  Defaults to 'true'. */
  transparentBackground?: boolean;
  /** Is a base layer.  Defaults to 'false'. */
  isBase?: boolean;
  /** Access Key for the Layer, like a subscription key or access token.
   * TODO This does not belong in the props object. It should never be persisted.
   */
  accessKey?: MapLayerKey;
}

/**
 * stores key-value pair to be added to all requests made involving map layer.
 * @beta
 */
export interface MapLayerKey {
  key: string;
  value: string;
}

/** Normalized representation of a [[MapLayerProps]] for which values have been  validated and default values have been applied where explicit values not defined.
 * One or more map layers may be included within [[MapImagerySettings]] object.
 * @see [[MapImagerySettings]]
 * @beta
 */
export class MapLayerSettings {
  public readonly visible: boolean;
  public readonly formatId: string;
  public readonly name: string;
  public readonly url: string;
  public readonly transparency: number;
  public readonly subLayers: MapSubLayerSettings[];
  public readonly transparentBackground: boolean;
  public readonly isBase: boolean;
  public userName?: string;
  public password?: string;
  public accessKey?: MapLayerKey;

  public setCredentials(userName?: string, password?: string) {
    this.userName = userName;
    this.password = password;
  }

  /** @internal */
  protected constructor(url: string, name: string, formatId: string, visible = true,
    jsonSubLayers: MapSubLayerProps[] | undefined = undefined, transparency: number = 0,
    transparentBackground = true, isBase = false, userName?: string, password?: string, accessKey?: MapLayerKey) {
    this.formatId = formatId;
    this.name = name;
    this.visible = visible;
    this.transparentBackground = transparentBackground;
    this.isBase = isBase;
    this.subLayers = new Array<MapSubLayerSettings>();
    if (jsonSubLayers !== undefined) {
      let hasUnnamedGroups = false;
      for (const jsonSubLayer of jsonSubLayers) {
        const subLayer = MapSubLayerSettings.fromJSON(jsonSubLayer);
        if (undefined !== subLayer) {
          this.subLayers.push(subLayer);
          if (subLayer.children?.length !== 0 && !subLayer.isNamed && !hasUnnamedGroups)
            hasUnnamedGroups = true;
        }
      }

      this.userName = userName;
      this.password = password;
    }
    this.accessKey = accessKey;
    this.transparency = transparency;
    this.url = url;
  }

  /** Construct from JSON, performing validation and applying default values for undefined fields. */
  public static fromJSON(json: MapLayerProps): MapLayerSettings {
    const transparentBackground = (json.transparentBackground === undefined) ? true : json.transparentBackground;
    return new this(json.url, json.name, json.formatId, json.visible, json.subLayers, json.transparency, transparentBackground, json.isBase === true, undefined, undefined, json.accessKey);
  }

  /** return JSON representation of this MapLayerSettings object */
  public toJSON(): MapLayerProps {
    const props: MapLayerProps = {formatId: this.formatId, name: this.name, url: this.url};
    if (this.subLayers.length > 0) {
      props.subLayers = [];
      this.subLayers.forEach((subLayer) => {
        const subLayerJson = subLayer.toJSON();
        if (subLayerJson)
          props.subLayers!.push(subLayerJson);
      });
    }

    if (0 !== this.transparency)
      props.transparency = this.transparency;

    if (this.transparentBackground === false)
      props.transparentBackground = this.transparentBackground;

    if (this.isBase === true)
      props.isBase = this.isBase;

    props.visible = this.visible;
    return props;
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

  /** Create a copy of this MapLayerSettings, optionally modifying some of its properties.
   * @param changedProps JSON representation of the properties to change.
   * @returns A MapLayerSettings with all of its properties set to match those of `this`, except those explicitly defined in `changedProps`.
   */
  public clone(changedProps: Partial<MapLayerProps>): MapLayerSettings {
    const clone = MapLayerSettings.fromJSON(this.cloneProps(changedProps));

    // Clone members not part of MapLayerProps
    clone.userName = this.userName;
    clone.password = this.password;
    clone.accessKey = this.accessKey;

    return clone;
  }

  /** @internal */
  protected cloneProps(changedProps: Partial<MapLayerProps>): MapLayerProps {
    return {
      name: undefined !== changedProps.name ? changedProps.name : this.name,
      formatId: undefined !== changedProps.formatId ? changedProps.formatId : this.formatId,
      visible: undefined !== changedProps.visible ? changedProps.visible : this.visible,
      url: undefined !== changedProps.url ? changedProps.url : this.url,
      transparency: undefined !== changedProps.transparency ? changedProps.transparency : this.transparency,
      transparentBackground: undefined !== changedProps.transparentBackground ? changedProps.transparentBackground : this.transparentBackground,
      subLayers: undefined !== changedProps.subLayers ? changedProps.subLayers : this.subLayers,
      accessKey: undefined !== changedProps.accessKey ? changedProps.accessKey : this.accessKey,
    };
  }

  /** @internal */
  public displayMatches(other: MapLayerSettings): boolean {
    if (!this.matchesNameAndUrl(other.name, other.url)
      || this.visible !== other.visible
      || this.transparency !== other.transparency
      || this.transparentBackground !== other.transparentBackground
      || this.subLayers.length !== other.subLayers.length) {
      return false;
    }

    if (this.userName !== other.userName || this.password !== other.password) {
      return false;
    }

    for (let i = 0; i < this.subLayers.length; i++)
      if (!this.subLayers[i].displayMatches(other.subLayers[i]))
        return false;

    return true;
  }

  /** @internal */
  public matchesNameAndUrl(name: string, url: string): boolean {
    return this.name === name && this.url === url;
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

  /** Return true if all sublayers are visible. */
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
}

/** JSON representation of a [[BaseMapLayerSettings]].
 * @beta
 */
export interface BaseMapLayerProps extends MapLayerProps {
  provider?: BackgroundMapProviderProps;
}

/** A [[MapLayerSettings]] that can serve as the base layer for a [[MapImagerySettings]].
 * The base layer supports all of the same options as any other layer, but also allows for simplified configuration based
 * on a small set of known supported [[BackgroundMapProvider]]s like [Bing Maps](https://www.microsoft.com/en-us/maps).
 * If the base layer was configured from such a provider, that information will be preserved and can be queried; this allows
 * the imagery provider and/or type to be easily modified.
 * @see [[MapImagerySettings.backgroundBase]].
 * @beta
 */
export class BaseMapLayerSettings extends MapLayerSettings {
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
  public override cloneProps(changedProps: Partial<MapLayerProps>): BaseMapLayerProps {
    const props = super.cloneProps(changedProps) as BaseMapLayerProps;
    if (this.provider)
      props.provider = this.provider.toJSON();

    return props;
  }

  /** Create a copy of this layer. */
  public override clone(changedProps: Partial<MapLayerProps>): BaseMapLayerSettings {
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
        name = `Bing Maps: ${MapLayerSettings.mapTypeName(provider.type)}`;
        url = `https://dev.virtualearth.net/REST/v1/Imagery/Metadata/${imagerySet}?o=json&incl=ImageryProviders&key={bingKey}`;
        break;

      case "MapBoxProvider":
        formatId = "MapboxImagery";
        name = `MapBox: ${MapLayerSettings.mapTypeName(provider.type)}`;
        switch (provider.type) {
          case BackgroundMapType.Street:
            url = "https://api.mapbox.com/v4/mapbox.streets/";
            break;
          case BackgroundMapType.Aerial:
            url = "https://api.mapbox.com/v4/mapbox.satellite/";
            break;
          case BackgroundMapType.Hybrid:
            url = "https://api.mapbox.com/v4/mapbox.streets-satellite/";
            break;
        }
        break;
    }

    const settings = super.fromJSON({
      name,
      formatId,
      url,
      transparentBackground: false,
      isBase: true,
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
