/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { MapSubLayerProps } from "@itwin/core-common";
import { MapLayerImageryProvider } from "@itwin/core-frontend";

export interface StyleMapLayerSettings {
  /** Name */
  name: string;
  /** URL */
  url: string;
  /** Controls visibility of layer */
  visible: boolean;
  /** A transparency value from 0.0 (fully opaque) to 1.0 (fully transparent) to apply to map graphics when drawing, or false to indicate the transparency should not be overridden. Default value: false. */
  transparency: number;
  /** Transparent background */
  transparentBackground: boolean;
  /** set map as underlay or overlay */
  isOverlay: boolean;
  /** Available map sub-layer */
  subLayers?: MapSubLayerProps[];
  /** sub-layer panel displayed. */
  showSubLayers: boolean;
  /** Some format can publish only a single layer at a time (i.e WMTS) */
  provider?: MapLayerImageryProvider;
}

export interface MapTypesOptions {
  readonly supportTileUrl: boolean;
  readonly supportWmsAuthentication: boolean;
}

export interface MapLayerOptions {
  hideExternalMapLayers?: boolean;
  fetchPublicMapLayerSources?: boolean;
  mapTypeOptions?: MapTypesOptions;
}
