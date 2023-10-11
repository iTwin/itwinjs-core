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

/** Options supplied to a `Viewport.getMapFeatureInfo` .
 * @beta
  */
export interface MapFeatureInfoOptions {
  /** The distance in screen pixels from the specified geometry within which the query operation should be performed. */
  tolerance?: number;
}
/** Contains record data of a [[MapLayerFeature]] instance .
 * @beta
 */
export class MapFeatureInfoRecord extends PropertyRecord {
  /** Construct a record from [PropertyValue]($appui-abstract) and [PropertyDescription]($appui-abstract) objects. */
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
  /** Feature info for each layer. */
  layerInfos?: MapLayerFeatureInfo[];
  /** The approximate location in world coordinates on the identified feature. */
  hitPoint?: Cartographic;
}

/** Features container for a given map-layer.
 * Results are grouped per sub-layer instance.
 * @see [[MapSubLayerFeatureInfo]]
 * @beta
 */
export interface MapLayerFeatureInfo {
  /** Name of the layer associated with the identified feature. */
  layerName: string;
  /** Feature info for each sub-layer. */
  subLayerInfos?: MapSubLayerFeatureInfo[];
}

/** Features container for a given sub-layer.
 * @see [[MapSubLayerFeatureInfo]]
 * @beta
 */
export interface MapSubLayerFeatureInfo {
  /** Name of the layer associated with the identified feature. */
  subLayerName: string;
  /** Name of the field representing the feature label (suggestion only). */
  displayFieldName?: string;
  /** List of features identified for this sub-layer. */
  features: MapLayerFeature[];
}

/** Attributes and graphics container of a given feature instance
 * Results are grouped per sub-layer instance.
 * @see [[GraphicPrimitive]]
 * @see [[MapFeatureInfoRecord]]
 * @beta
 */
export interface MapLayerFeature {
  /** List of geometries identified for this feature. */
  geometries?: MapLayerFeatureGeometry[];
  /** List of attributes identified for this feature. */
  attributes: MapLayerFeatureAttribute[];
}

/** Geometry of a [[MapLayerFeature]]
 * @see [[MapLayerFeature]]
 * @beta
 */
export interface MapLayerFeatureGeometry {
  /** graphic primitive representing a feature. */
  graphic: GraphicPrimitive;
}

/** Attribute of a [[MapLayerFeature]]
 * @see [[MapLayerFeature]]
 * @beta
 */
export interface MapLayerFeatureAttribute {
  /** Value of a feature attribute. */
  value: PropertyValue;
  /** Property (or field) description of a feature attribute. */
  property: PropertyDescription;
}

/** Utility class that creates a [PropertyRecord]($appui-abstract) out of [[MapLayerFeatureAttribute]]
 * @see [[MapLayerFeature]]
 * @beta
 */
export class MapLayerFeatureRecord {
  /** Convert a [[MapLayerFeatureAttribute]] object into [PropertyRecord]($appui-abstract) object. */
  public static createRecordFromAttribute(attribute: MapLayerFeatureAttribute) {
    return new PropertyRecord(attribute.value, attribute.property);
  }
}
