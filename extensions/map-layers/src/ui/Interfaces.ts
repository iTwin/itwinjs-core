/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BeEvent } from "@itwin/core-bentley";
import {  MapSubLayerProps } from "@itwin/core-common";
import { HitDetail,  MapLayerImageryProvider, MapTileTreeScaleRangeVisibility } from "@itwin/core-frontend";

export interface StyleMapLayerSettings {
  /** Name */
  name: string;
  /** source (i.URL for ImageMapLayerSettings or modelId for ModelMapLayerSettings) */
  source: string;
  /** Controls visibility of layer */
  visible: boolean;
  treeVisibility: MapTileTreeScaleRangeVisibility;
  /** A transparency value from 0.0 (fully opaque) to 1.0 (fully transparent) to apply to map graphics when drawing, or false to indicate the transparency should not be overridden. Default value: false. */
  transparency: number;
  /** Transparent background */
  transparentBackground: boolean;
  /** set map as underlay or overlay */
  isOverlay: boolean;
  /** layer index in the viewport */
  layerIndex: number;
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

export interface MapFeatureInfoPropertyGridOptions {
  isPropertySelectionEnabled?: boolean;
}

export type MapHitEvent = BeEvent<(hit: HitDetail) => void>;

export interface MapFeatureInfoOptions {
  /**
   * HitDetail Event whenever the map is clicked.
   * Typically the HitDetail object is provided by ElementLocateManager.doLocate.
   * Every time this event is raised, FeatureInfoWidget will attempt to retrieve data from MapLayerImageryProviders.
   */
  onMapHit: MapHitEvent;
  disableDefaultFeatureInfoTool?: boolean;
  showLoadProgressAnimation?: boolean;
  propertyGridOptions?: MapFeatureInfoPropertyGridOptions;
}
