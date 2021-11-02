/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */

import { DeprecatedBackgroundMapProps } from "./BackgroundMapSettings";
import { ColorDef, ColorDefProps } from "./ColorDef";
import { BaseMapLayerProps, BaseMapLayerSettings, MapLayerProps, MapLayerSettings } from "./MapLayerSettings";

/** JSON representation of a [[BaseLayerSettings]].
 * @beta
 */
export type BaseLayerProps = BaseMapLayerProps | ColorDefProps;

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

/** The base layer for a [[MapImagerySettings]].
 * @see [[MapImagerySettings.backgroundBase]].
 * @beta
 */
export type BaseLayerSettings = BaseMapLayerSettings | ColorDef;

/** @beta */
// eslint-disable-next-line @typescript-eslint/no-redeclare
export namespace BaseLayerSettings {
  /** Create a base layer from its JSON representation. */
  export function fromJSON(props: BaseLayerProps): BaseLayerSettings {
    return typeof props === "number" ? ColorDef.fromJSON(props) : BaseMapLayerSettings.fromJSON(props);
  }
}

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

  private constructor(base: BaseLayerSettings, backgroundLayerProps?: MapLayerProps[], overlayLayersProps?: MapLayerProps[]) {
    this._backgroundBase = base;
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
  public static fromJSON(imageryJson?: MapImageryProps) {
    return this.createFromJSON(imageryJson, undefined);
  }

  /** @internal */
  public static createFromJSON(imageryJson?: MapImageryProps, mapProps?: DeprecatedBackgroundMapProps) {
    const baseLayer = imageryJson?.backgroundBase ? BaseLayerSettings.fromJSON(imageryJson.backgroundBase) : BaseMapLayerSettings.fromBackgroundMapProps(mapProps ?? { });

    return new MapImagerySettings(baseLayer, imageryJson?.backgroundLayers, imageryJson?.overlayLayers);
  }

  public toJSON(): MapImageryProps {
    const props: MapImageryProps = { backgroundBase: this._backgroundBase.toJSON() };
    if (this._backgroundLayers.length > 0)
      props.backgroundLayers = this._backgroundLayers.map((layer) => layer.toJSON());

    if (this._overlayLayers.length > 0)
      props.overlayLayers = this._overlayLayers.map((layer) => layer.toJSON());

    return props;
  }
}
