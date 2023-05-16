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
 * @beta
 */
export class MapFeatureInfoRecord extends PropertyRecord {
  public constructor(value: PropertyValue, property: PropertyDescription) {
    super(value, property);
  }
}

/** Main feature info container for a MapFeatureInfo query.
 * Results are grouped per map-layer instance.
 * @see [[MapLayerFeatureInfo]]
 * @beta
 */
export interface MapFeatureInfo {
  layerInfos?: MapLayerFeatureInfo[];
  hitPoint?: Cartographic;
}

/** Features container for a given map-layer.
 * Results are grouped per sub-layer instance.
 * @see [[MapSubLayerFeatureInfo]]
 * @beta
 */
export interface MapLayerFeatureInfo {
  layerName: string;
  subLayerInfos?: MapSubLayerFeatureInfo[];
}

/** Features container for a given sub-layer.
 * @see [[MapSubLayerFeatureInfo]]
 * @beta
 */
export interface MapSubLayerFeatureInfo {
  subLayerName: string;
  displayFieldName?: string;
  features: MapLayerFeature[];
}

/** Attributes and graphics container of a given feature instance
 * Results are grouped per sub-layer instance.
 * @see [[GraphicPrimitive]]
 * @see [[MapFeatureInfoRecord]]
 * @beta
 */
export interface MapLayerFeature {
  geometries?: MapLayerFeatureGeometry[];
  attributes: MapLayerFeatureAttribute[];
}

/** Geometry of a [[MapLayerFeature]]
 * @see [[MapLayerFeature]]
 * @beta
 */
export interface MapLayerFeatureGeometry {
  graphic: GraphicPrimitive;
}

/** Attribute of a [[MapLayerFeature]]
 * @see [[MapLayerFeature]]
 * @beta
 */
export interface MapLayerFeatureAttribute {
  value: PropertyValue;
  property: PropertyDescription;
}

/** Utility class that creates a [[PropertyRecord]] out of [[MapLayerFeatureAttribute]]
 * @see [[MapLayerFeature]]
 * @beta
 */
export class MapLayerFeatureRecord {
  public static createRecordFromAttribute(attribute: MapLayerFeatureAttribute) {
    return new PropertyRecord(attribute.value, attribute.property);
  }
}
