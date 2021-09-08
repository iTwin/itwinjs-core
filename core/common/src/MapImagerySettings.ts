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
export interface MapImageryProps {
  backgroundBase?: BaseLayerProps;
  backgroundLayers?: MapLayerProps[];
  overlayLayers?: MapLayerProps[];
}

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
    const props: BackgroundMapProps = {};

    if ("BingProvider" !== this.providerName)
      props.providerName = this.providerName;
    if (BackgroundMapType.Hybrid !== this.mapType)
      props.providerData = { mapType: this.mapType };
    return props;
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

  public static isMatchingProps(props: any) : boolean {
    return props?.hasOwnProperty('providerName');
  }
}

/** Normalized representation of base layer properties -- these can be represented by either a full map layer or a simple color.
 * @beta
 */
export type BaseLayerSettings = MapLayerSettings | ColorDef;

export type BaseLayerSource = MapLayerSettings | ColorDef | BackgroundMapProvider;
export type BaseLayerSourceProps = MapLayerProps | ColorDefProps | BackgroundMapProviderProps;


export interface BaseLayerSettings2Props {
  displaySettings: BackgroundMapProps;
  source: BaseLayerSourceProps;
}
export class BaseLayerSettings2 {
  private _displaySettings: BackgroundMapSettings;
  private _source: BaseLayerSource;

  private constructor(sourceProps?: BaseLayerSourceProps, displaySettingsProps?: BackgroundMapProps) {

    let source;
     if (typeof sourceProps === "number") {
      source = ColorDef.create(sourceProps)
     } else if (BackgroundMapProvider.isMatchingProps(sourceProps)) {
        source = BackgroundMapProvider.fromJSON(sourceProps as BackgroundMapProviderProps)
     } else {
      source = MapLayerSettings.fromJSON(sourceProps as MapLayerProps|undefined);
     }

    if (source) {
      this._source = source;
    } else {
      // Default to Bing aerial
      this._source = BackgroundMapProvider.fromJSON({providerName: "Bing", "providerData" : {mapType: BackgroundMapType.Aerial}});
    };

    this._displaySettings = BackgroundMapSettings.fromJSON(displaySettingsProps);

  }

  public get displaySettings(): BackgroundMapSettings { return this._displaySettings; }
  public set displaySettings(settings: BackgroundMapSettings) { this._displaySettings = settings; }

  public get source(): BaseLayerSource { return this._source; }
  public set source(source: BaseLayerSource) { this._source = source; }


  /** Construct from JSON, performing validation and applying default values for undefined fields. */
  public static fromJSON(baseLayerSettingsProps?: BaseLayerSettings2Props) {
    if (baseLayerSettingsProps) {
      return new BaseLayerSettings2(baseLayerSettingsProps.source, baseLayerSettingsProps.displaySettings);
    } else {
      return new BaseLayerSettings2();
    }
  }

  public toJSON(): BaseLayerSettings2Props {
    return {
      displaySettings: this._displaySettings.toJSON(),
      source: this._source.toJSON()
    };
  }

}

/** Provides access to the map imagery settings (Base and layers).
 * In earlier versions only a background map was supported as specified by the providerName and mapType members of [[BackgroundMapSettings]] object.
 * In order to provide backward compatibility the original [[BackgroundMapSettings]] are synchronized with the [[MapImagerySettings]] base layer as long as
 * the settings are compatible.
 * @beta
 */


 export interface MapImageryProps2 {
  backgroundBase?: BaseLayerSettings2Props;
  backgroundLayers?: MapLayerProps[];
  overlayLayers?: MapLayerProps[];
}

 export class MapImagerySettings2 {
  private _backgroundBase: BaseLayerSettings2;
  private _backgroundLayers = new Array<MapLayerSettings>();
  private _overlayLayers = new Array<MapLayerSettings>();

  private constructor(baseLayer?: BaseLayerSettings2Props, backgroundLayerProps?: MapLayerProps[], overlayLayersProps?: MapLayerProps[]) {

    this._backgroundBase = BaseLayerSettings2.fromJSON(baseLayer);

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
  public get backgroundBase(): BaseLayerSettings2 { return this._backgroundBase; }
  public set backgroundBase(base: BaseLayerSettings2) { this._backgroundBase = base; }

  public get backgroundLayers(): MapLayerSettings[] { return this._backgroundLayers; }
  public get overlayLayers(): MapLayerSettings[] { return this._overlayLayers; }

  /** Return base transparency as a number between 0 and 1.
   * @internal
   */
  public get baseTransparency(): number {
    this._backgroundBase.source
    if  (this._backgroundBase.source instanceof ColorDef) {
      return (this._backgroundBase.source.getTransparency() / 255);
    } else if (BackgroundMapProvider.isMatchingProps(this._backgroundBase.source )) {
      // TODO: Review this, we don't have transparency on BackgroundMapProvider
      return 0;
    } else {
      return  (this._backgroundBase.source as MapLayerSettings).transparency
    }

  }

  /** Construct from JSON, performing validation and applying default values for undefined fields. */
  public static fromJSON(imageryJson?: MapImageryProps2) {
    return new MapImagerySettings2(imageryJson?.backgroundBase, imageryJson?.backgroundLayers, imageryJson?.overlayLayers);
  }

  public toJSON(): MapImageryProps2 {
    return {
      backgroundBase: this._backgroundBase.toJSON(),
      backgroundLayers: this._backgroundLayers.length > 0 ? this._backgroundLayers.map((layer) => layer.toJSON()) : undefined,
      overlayLayers: this._overlayLayers.length > 0 ? this._overlayLayers.map((layer) => layer.toJSON()) : undefined,
    };
  }
}

export class MapImagerySettings {
  private _backgroundBase: BaseLayerSettings;
  private _backgroundLayers = new Array<MapLayerSettings>();
  private _overlayLayers = new Array<MapLayerSettings>();

  private constructor(backgroundBaseProps?: BaseLayerProps, backgroundLayerProps?: MapLayerProps[], overlayLayersProps?: MapLayerProps[], mapProps?: BackgroundMapProps) {
    const base = typeof backgroundBaseProps === "number" ? ColorDef.create(backgroundBaseProps) : MapLayerSettings.fromJSON(backgroundBaseProps);
    this._backgroundBase = base ? base : MapLayerSettings.fromMapSettings(BackgroundMapSettings.fromJSON(mapProps));
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
    return (this._backgroundBase instanceof ColorDef) ? (this._backgroundBase.getTransparency() / 255) : this._backgroundBase.transparency;

  }

  /** Construct from JSON, performing validation and applying default values for undefined fields. */
  public static fromJSON(imageryJson?: MapImageryProps, mapProps?: BackgroundMapProps) {
    return new MapImagerySettings(imageryJson?.backgroundBase, imageryJson?.backgroundLayers, imageryJson?.overlayLayers, mapProps);
  }

  public toJSON(): MapImageryProps {
    return {
      backgroundBase: this._backgroundBase.toJSON(),
      backgroundLayers: this._backgroundLayers.length > 0 ? this._backgroundLayers.map((layer) => layer.toJSON()) : undefined,
      overlayLayers: this._overlayLayers.length > 0 ? this._overlayLayers.map((layer) => layer.toJSON()) : undefined,
    };
  }
}
