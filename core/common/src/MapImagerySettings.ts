/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */

import { BackgroundMapProviderName, BackgroundMapType } from "./BackgroundMapSettings";
import { ColorDef, ColorDefProps } from "./ColorDef";
import { MapLayerProps, MapLayerSettings } from "./MapLayerSettings";

/** The JSON representation of the map imagery.  Map imagery include the specification for the base layer (which was originally
 * represented by [[BackgroundMapProps.providerName]]  && [[BackgroundMapProps.providerData]]) and additional map layers.
 * In earlier versions only a background map was supported as specified by the providerName and mapType members of [[BackgroundMapSettings]] object.
 * In order to provide backward compatibility the original [[BackgroundMapSettings]] are synchronized with the [[MapImagerySettings]] base layer as long as
 * the settings are compatible.
 * @beta
 */

export interface BackgroundMapProviderProps {
  providerName?: string;
  providerData?: {
    /** The type of map graphics to request. Default value: BackgroundMapType.Hybrid. */
    mapType?: BackgroundMapType;
    /** Controls visibility of layer. Defaults to 'true'. */
    visible?: boolean;
    /** A transparency value from 0.0 (fully opaque) to 1.0 (fully transparent) to apply to map graphics when drawing,
   * or false to indicate the transparency should not be overridden. Default value: 0.
   * If omitted, defaults to 0. */
    transparency?: number;
  };
}

function normalizeMapType(props?: BackgroundMapProviderProps): BackgroundMapType {
  switch (props?.providerData?.mapType) {
    case BackgroundMapType.Street:
    case BackgroundMapType.Aerial:
      return props.providerData.mapType;
    default:
      return BackgroundMapType.Hybrid;
  }
}

function normalizeProviderName(provider?: string): BackgroundMapProviderName {
  return "MapBoxProvider" === provider ? provider : "BingProvider";
}

export class BackgroundMapProvider {
  public readonly providerName: BackgroundMapProviderName;
  /** The type of map graphics to be drawn. */
  public readonly mapType: BackgroundMapType;
  public readonly visible: boolean;
  public readonly transparency: number;

  private constructor(props: BackgroundMapProviderProps) {
    this.providerName = normalizeProviderName(props.providerName);
    this.mapType =  normalizeMapType(props);
    this.visible = props.providerData?.visible === undefined ? true : props.providerData.visible;
    this.transparency = props.providerData?.transparency === undefined ? 0 : props.providerData.transparency;
  }

  public toJSON(): BackgroundMapProviderProps {
    return {
      providerName: this.providerName,
      providerData:{
        mapType:this.mapType,
        visible:this.visible,
        transparency:this.transparency,
      },
    };
  }
  private mapTypeName() {   // TBD.. Localization.
    switch (this.mapType) {
      case BackgroundMapType.Aerial:
        return "Aerial Imagery";
      default:
      case BackgroundMapType.Hybrid:
        return "Aerial Imagery with labels";
      case BackgroundMapType.Street:
        return "Streets";
    }
  }
  private providerLabel() {
    let label;
    switch (this.providerName) {
      case "BingProvider":
      default:
        label = `Bing Maps`;
        break;

      case "MapBoxProvider":
        label = `MapBox`;
        break;
    }
    return label;
  }

  public label() {
    return  `${this.providerLabel()}: ${this.mapTypeName()}`;
  }

  public toMapSettings(): MapLayerSettings {
    let formatId: string, url: string;
    switch (this.providerName) {
      case "BingProvider":
      default:
        formatId = "BingMaps";

        let imagerySet;
        switch (this.mapType) {
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
        url = `https://dev.virtualearth.net/REST/v1/Imagery/Metadata/${imagerySet}?o=json&incl=ImageryProviders&key={bingKey}`;
        break;

      case "MapBoxProvider":
        formatId = "MapboxImagery";
        switch (this.mapType) {
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
    const name = this.label();
    return MapLayerSettings.fromJSON({ name, formatId, url,
      transparentBackground: false,
      isBase: true,
      visible: this.visible,
      transparency: this.transparency })!;
  }

  public clone(changedProps: BackgroundMapProviderProps): BackgroundMapProvider {
    if (undefined === changedProps)
      return this;

    const props = {
      name: undefined !== changedProps.providerName ? changedProps.providerName : this.providerName,
      providerData: {
        mapType: undefined !== changedProps.providerData?.mapType ? changedProps.providerData.mapType : this.mapType,
        visible: undefined !== changedProps.providerData?.visible ? changedProps.providerData.visible : this.visible,
        transparency: undefined !== changedProps.providerData?.transparency ? changedProps.providerData.transparency : this.transparency,
      },

    };
    const clone = BackgroundMapProvider.fromJSON(props)!;

    return clone;
  }

  /** Construct from JSON, performing validation and applying default values for undefined fields. */
  public static fromJSON(props: BackgroundMapProviderProps) {
    return new BackgroundMapProvider(props);
  }

  /** Used to determine is a JSON struct matches BackgroundMapProviderProps  */
  public static isMatchingProps(props: any): boolean {
    return props?.hasOwnProperty("providerName") || props?.hasOwnProperty("providerData");
  }
}

/** The JSON representation of base layer properties -- these can be represented by either a full map layer or a simple color.
 * @beta
 */
export type BaseLayerProps = MapLayerProps | ColorDefProps | BackgroundMapProviderProps;

/** Normalized representation of base layer properties -- these can be represented by either a full map layer or a simple color.
 * @beta
 */
export type BaseLayerSettings = MapLayerSettings | ColorDef | BackgroundMapProvider;

/** Provides access to the map imagery settings (Base and layers).
 * In earlier versions only a background map was supported as specified by the providerName and mapType members of [[BackgroundMapSettings]] object.
 * In order to provide backward compatibility the original [[BackgroundMapSettings]] are synchronized with the [[MapImagerySettings]] base layer as long as
 * the settings are compatible.
 * @beta
 */

export interface MapImageryProps {
  backgroundBase?: BaseLayerProps;
  backgroundLayers?: MapLayerProps[];
  overlayLayers?: MapLayerProps[];
}

export class MapImagerySettings {
  private _backgroundBase: BaseLayerSettings;
  private _backgroundLayers = new Array<MapLayerSettings>();
  private _overlayLayers = new Array<MapLayerSettings>();

  private constructor(baseLayer?: BaseLayerProps, backgroundLayerProps?: MapLayerProps[], overlayLayersProps?: MapLayerProps[]) {

    let base;
    if (typeof baseLayer === "number") {
      base = ColorDef.create(baseLayer);
    } else if (BackgroundMapProvider.isMatchingProps(baseLayer)) {
      base = BackgroundMapProvider.fromJSON(baseLayer as BackgroundMapProviderProps);
    } else {
      base = MapLayerSettings.fromJSON(baseLayer as MapLayerProps|undefined);
    }

    if (base) {
      this._backgroundBase = base;
    } else {
      // Default to Bing
      this._backgroundBase = BackgroundMapProvider.fromJSON({providerName: "Bing", providerData : {mapType: BackgroundMapType.Hybrid}});
    }

    if (backgroundLayerProps) {
      for (const layerProps of backgroundLayerProps) {
        const layer = MapLayerSettings.fromJSON(layerProps);
        if (layer)
          this._backgroundLayers.push(layer);
      }
    }
    if (overlayLayersProps) {
      for (const overlayLayerProps of overlayLayersProps) {
        const overlayLayer = MapLayerSettings.fromJSON(overlayLayerProps);
        if (overlayLayer)
          this._overlayLayers.push(overlayLayer);
      }
    }
  }

  /** The settings for the base layer.
   *  @note If changing the base provider it is currently necessary to also update the background map settings.
   */
  public get backgroundBase(): BaseLayerSettings { return this._backgroundBase; }
  public set backgroundBase(base: BaseLayerSettings) { this._backgroundBase = base; }

  public get backgroundLayers(): MapLayerSettings[] { return this._backgroundLayers; }
  public get overlayLayers(): MapLayerSettings[] { return this._overlayLayers; }

  /** Return base transparency as a number between 0 and 1.
   * @internal
   */
  public get baseTransparency(): number {
    if  (this._backgroundBase instanceof ColorDef) {
      return (this._backgroundBase.getTransparency() / 255);
    } else if (this._backgroundBase instanceof BackgroundMapProvider) {
      return  (this._backgroundBase ).transparency;
    } else {
      return  (this._backgroundBase ).transparency;
    }
  }

  /** Construct from JSON, performing validation and applying default values for undefined fields. */
  public static fromJSON(imageryJson?: MapImageryProps) {
    return new MapImagerySettings(imageryJson?.backgroundBase, imageryJson?.backgroundLayers, imageryJson?.overlayLayers);
  }

  public toJSON(): MapImageryProps {
    return {
      backgroundBase: this._backgroundBase.toJSON(),
      backgroundLayers: this._backgroundLayers.length > 0 ? this._backgroundLayers.map((layer) => layer.toJSON()) : undefined,
      overlayLayers: this._overlayLayers.length > 0 ? this._overlayLayers.map((layer) => layer.toJSON()) : undefined,
    };
  }
}
