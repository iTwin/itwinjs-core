/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */

import { BackgroundMapProps, BackgroundMapProviderName, BackgroundMapSettings, BackgroundMapType } from "./BackgroundMapSettings";
import { ColorDef, ColorDefProps } from "./ColorDef";
import { MapLayerProps, MapLayerSettings } from "./MapLayerSettings";

/** The JSON representation of base layer properties -- these can be represented by either a full map layer or a simple color.
 * @beta
 */
export type BaseLayerProps = MapLayerProps | ColorDefProps;

/** The JSON representation of the map imagery.  Map imagery include the specification for the base layer (which was originally
 * represented by [[BackgroundMapProps.providerName]]  && [[BackgroundMapProps.providerData]]) and additional map layers.
 * In earlier versions only a background map was supported as specified by the providerName and mapType members of [[BackgroundMapSettings]] object.
 * In order to provide backward compatibility the original [[BackgroundMapSettings]] are synchronized with the [[MapImagerySettings]] base layer as long as
 * the settings are compatible.
 * @beta
 */

export interface BackgroundMapProviderDataProps {
  mapType?: BackgroundMapType;
}
export interface BackgroundMapProviderProps {
  providerName?: string;
  providerData?: {
    /** The type of map graphics to request. Default value: BackgroundMapType.Hybrid. */
    mapType?: BackgroundMapType;
  };
}

function normalizeMapType2(props?: BackgroundMapProviderProps): BackgroundMapType {
  switch (props?.providerData?.mapType) {
    case BackgroundMapType.Street:
    case BackgroundMapType.Aerial:
      return props.providerData.mapType;
    default:
      return BackgroundMapType.Hybrid;
  }
}

function normalizeProviderName2(provider?: string): BackgroundMapProviderName {
  return "MapBoxProvider" === provider ? provider : "BingProvider";
}

export class BackgroundMapProvider {
  public readonly providerName: BackgroundMapProviderName;
  /** The type of map graphics to be drawn. */
  public readonly mapType: BackgroundMapType;

  private constructor(props: BackgroundMapProviderProps) {
    this.providerName = normalizeProviderName2(props.providerName);
    this.mapType =  normalizeMapType2(props);

  }

  public toJSON(): BackgroundMapProviderProps {
    const props: BackgroundMapProviderProps = {};

    if ("BingProvider" !== this.providerName)
      props.providerName = this.providerName;
    if (BackgroundMapType.Hybrid !== this.mapType)
      props.providerData = { mapType: this.mapType };
    return props;
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

  public toMapSettings(): MapLayerSettings {
    let formatId: string, url: string, name: string;
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
        name = `Bing Maps: ${this.mapTypeName()}`;
        url = `https://dev.virtualearth.net/REST/v1/Imagery/Metadata/${imagerySet}?o=json&incl=ImageryProviders&key={bingKey}`;
        break;

      case "MapBoxProvider":
        formatId = "MapboxImagery";
        name = `MapBox: ${this.mapTypeName()}`;
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
    return MapLayerSettings.fromJSON({ name, formatId, url, transparentBackground: false, isBase: true })!;
  }

  public clone(changedProps: BackgroundMapProviderProps): BackgroundMapProvider {
    if (undefined === changedProps)
      return this;

    const props = {
      name: undefined !== changedProps.providerName ? changedProps.providerName : this.providerName,
      providerData: {mapType: undefined !== changedProps.providerData?.mapType ? changedProps.providerData.mapType : this.mapType},

    };
    const clone = BackgroundMapProvider.fromJSON(props)!;

    return clone;
  }

  /** Construct from JSON, performing validation and applying default values for undefined fields. */
  public static fromJSON(props: BackgroundMapProviderProps) {
    return new BackgroundMapProvider(props);
  }

  public static isMatchingProps(props: any): boolean {
    return props?.hasOwnProperty("providerName");
  }
}

/** Normalized representation of base layer properties -- these can be represented by either a full map layer or a simple color.
 * @beta
 */
export type BaseLayerContent = MapLayerSettings | ColorDef | BackgroundMapProvider;
export type BaseLayerContentProps = MapLayerProps | ColorDefProps | BackgroundMapProviderProps;

export interface BaseLayerSettingsProps {
  displaySettings: BackgroundMapProps;
  content: BaseLayerContentProps;
}
export class BaseLayerSettings {
  private _displaySettings: BackgroundMapSettings;
  private _content: BaseLayerContent;

  private constructor(sourceProps?: BaseLayerContentProps, displaySettingsProps?: BackgroundMapProps) {

    let content;
    if (typeof sourceProps === "number") {
      content = ColorDef.create(sourceProps);
    } else if (BackgroundMapProvider.isMatchingProps(sourceProps)) {
      content = BackgroundMapProvider.fromJSON(sourceProps as BackgroundMapProviderProps);
    } else {
      content = MapLayerSettings.fromJSON(sourceProps as MapLayerProps|undefined);
    }

    if (content) {
      this._content = content;
    } else {
      // Default to Bing aerial
      this._content = BackgroundMapProvider.fromJSON({providerName: "Bing", providerData : {mapType: BackgroundMapType.Aerial}});
    }

    this._displaySettings = BackgroundMapSettings.fromJSON(displaySettingsProps);

  }

  public get displaySettings(): BackgroundMapSettings { return this._displaySettings; }
  public set displaySettings(settings: BackgroundMapSettings) { this._displaySettings = settings; }

  public get content(): BaseLayerContent { return this._content; }
  public set content(source: BaseLayerContent) { this._content = source; }

  /** Construct from JSON, performing validation and applying default values for undefined fields. */
  public static fromJSON(baseLayerSettingsProps?: BaseLayerSettingsProps) {
    if (baseLayerSettingsProps) {
      return new BaseLayerSettings(baseLayerSettingsProps.content, baseLayerSettingsProps.displaySettings);
    } else {
      return new BaseLayerSettings();
    }
  }

  public toJSON(): BaseLayerSettingsProps {
    return {
      displaySettings: this._displaySettings.toJSON(),
      content: this._content.toJSON(),
    };
  }

}

/** Provides access to the map imagery settings (Base and layers).
 * In earlier versions only a background map was supported as specified by the providerName and mapType members of [[BackgroundMapSettings]] object.
 * In order to provide backward compatibility the original [[BackgroundMapSettings]] are synchronized with the [[MapImagerySettings]] base layer as long as
 * the settings are compatible.
 * @beta
 */

export interface MapImageryProps {
  backgroundBase?: BaseLayerSettingsProps;
  backgroundLayers?: MapLayerProps[];
  overlayLayers?: MapLayerProps[];
}

export class MapImagerySettings {
  private _backgroundBase: BaseLayerSettings;
  private _backgroundLayers = new Array<MapLayerSettings>();
  private _overlayLayers = new Array<MapLayerSettings>();

  private constructor(baseLayer?: BaseLayerSettingsProps, backgroundLayerProps?: MapLayerProps[], overlayLayersProps?: MapLayerProps[]) {

    this._backgroundBase = BaseLayerSettings.fromJSON(baseLayer);

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
    this._backgroundBase.content;
    if  (this._backgroundBase.content instanceof ColorDef) {
      return (this._backgroundBase.content.getTransparency() / 255);
    } else if (BackgroundMapProvider.isMatchingProps(this._backgroundBase.content )) {
      // TODO: Review this, we don't have transparency on BackgroundMapProvider
      return 0;
    } else {
      return  (this._backgroundBase.content as MapLayerSettings).transparency;
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
