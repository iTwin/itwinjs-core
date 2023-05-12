/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module MapLayers
 */

import { PropertyDescription, PropertyRecord, PropertyValue } from "@itwin/appui-abstract";
import { Cartographic } from "@itwin/core-common";
import { GraphicPrimitive } from "../../render/GraphicPrimitive";

/** Contains record data of a [[MapLayerFeature]] instance .
 * @alpha
 */
export class MapFeatureInfoRecord extends PropertyRecord {
  public constructor(value: PropertyValue, property: PropertyDescription) {
    super(value, property);
  }
}

/** Main feature info container for a MapFeatureInfo query.
 * Results are grouped per map-layer instance.
 * @see [[MapLayerFeatureInfo]]
 * @alpha
 */
export interface MapFeatureInfo {
  layerInfos?: MapLayerFeatureInfo[];
  hitPoint?: Cartographic;
}

/** Features container for a given map-layer.
 * Results are grouped per sub-layer instance.
 * @see [[MapSubLayerFeatureInfo]]
 * @alpha
 */
export interface MapLayerFeatureInfo {
  layerName: string;
  subLayerInfos?: MapSubLayerFeatureInfo[];
}

/** Features container for a given sub-layer.
 * @see [[MapSubLayerFeatureInfo]]
 * @alpha
 */
export interface MapSubLayerFeatureInfo {
  subLayerName: string;
  displayFieldName?: string;
  features: MapLayerFeature[];
}

/** Records and graphics container of a given feature instance
 * Results are grouped per sub-layer instance.
 * @see [[GraphicPrimitive]]
 * @see [[MapFeatureInfoRecord]]
 * @alpha
 */
export interface MapLayerFeature {
  graphics?: GraphicPrimitive[];
  records: MapFeatureInfoRecord[];
}
