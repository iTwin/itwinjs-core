/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */

import { BackgroundMapProps, BackgroundMapSettings } from "./BackgroundMapSettings";
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

/** Normalized representation of base layer properties -- these can be represented by either a full map layer or a simple color.
 * @beta
 */
export type BaseLayerSettings = MapLayerSettings | ColorDef;

/** Provides access to the map imagery settings (Base and layers).
 * In earlier versions only a background map was supported as specified by the providerName and mapType members of [[BackgroundMapSettings]] object.
 * In order to provide backward compatibility the original [[BackgroundMapSettings]] are synchronized with the [[MapImagerySettings]] base layer as long as
 * the settings are compatible.
 * @beta
 */
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
