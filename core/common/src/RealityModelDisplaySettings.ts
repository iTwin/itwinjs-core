/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */

/** Specifies how the sizes of the individual points within a point cloud are computed.
 *  - "pixel": Each point is an exact number of pixels in diameter, as specified by [[PointCloudDisplaySettings.pixelSize]].
 *  - "voxel": Each point is the size of a "voxel" in meters, as specified by the [Tile]($frontend) to which the point belongs.
 * @see [[PointCloudDisplaySettings.sizeMode]].
 * @beta
 */
export type PointCloudSizeMode = "voxel" | "pixel";

/** Specifies the shape drawn for each individual point within a point cloud.
 *  - "round": Each point is drawn as a circle.
 *  - "square": Each point is drawn as a square.
 * @see [[PointCloudDisplaySettings.shape]].
 * @beta
 */
export type PointCloudShape = "square" | "round";

/** Specifies the Eye-Dome Lighting mode used for a point cloud.
 *  - "off": EDL is not calculated
 *  - "on": EDL is calculated using a single pass.
 *  - "full" EDL is calculated with full algorithm including optional filtering
 * @see [[PointCloudDisplaySettings.edlMode]].
 * @beta
 */
export type PointCloudEDLMode = "off" | "on" | "full";

/** The JSON representation of [[PointCloudDisplaySettings]].
 * @beta
 */
export interface PointCloudDisplayProps {
  /** See [[PointCloudDisplaySettings.sizeMode]]. */
  sizeMode?: PointCloudSizeMode;
  /** See [[PointCloudDisplaySettings.voxelScale]]. */
  voxelScale?: number;
  /** See [[PointCloudDisplaySettings.minPixelsPerVoxel]]. */
  minPixelsPerVoxel?: number;
  /** See [[PointCloudDisplaySettings.maxPixelsPerVoxel]]. */
  maxPixelsPerVoxel?: number;
  /** See [[PointCloudDisplaySettings.pixelSize]]. */
  pixelSize?: number;
  /** See [[PointCloudDisplaySettings.shape]]. */
  shape?: PointCloudShape;
  /** See [[PointCloudDisplaySettings.edlMode]]. */
  edlMode?: PointCloudEDLMode;
  /** See [[PointCloudDisplaySettings.edlStrength]]. */
  edlStrength?: number;
  /** See [[PointCloudDisplaySettings.edlRadius]]. */
  edlRadius?: number;
  /** See [[PointCloudDisplaySettings.edlFilter]]. */
  edlFilter?: number;
  /** See [[PointCloudDisplaySettings.edlMixWts1]]. */
  edlMixWts1?: number;
  /** See [[PointCloudDisplaySettings.edlMixWts2]]. */
  edlMixWts2?: number;
  /** See [[PointCloudDisplaySettings.edlMixWts4]]. */
  edlMixWts4?: number;
}

/** The JSON representation of [[RealityModelDisplaySettings]].
 * @beta
 */
export interface RealityModelDisplayProps {
  /** See [[RealityModelDisplaySettings.pointCloud]]. */
  pointCloud?: PointCloudDisplayProps;
  /** See [[RealityModelDisplaySettings.overrideColorRatio]]. */
  overrideColorRatio?: number;
  // ###TODO when we need it: mesh?: RealityMeshDisplayProps;
  visible?: boolean;
}

/** Settings that control how a point cloud reality model is displayed within a [Viewport]($frontend).
 * @note This is an immutable type - to modify its properties, use [[clone]].
 * Eye-Dome Lighting (EDL) is a non-photorealistic, image-based shading technique that was designed to improve depth
 * perception in scientific visualization. It is particularly useful for visualizing monochrome point cloud data, but
 * also can be useful for point clouds with color information.
 * @note EDL mode is ignored (off) if the view is not perspective (camera is off)
 * @see [[RealityModelDisplaySettings.pointCloud]].
 * @beta
 */
export class PointCloudDisplaySettings {
  /** The shape drawn for each point in the cloud.
   * Default: "round".
   */
  public readonly shape: PointCloudShape;
  /** The method by which the size of each individual point is computed.
   * Default: "voxel".
   * @see [[pixelSize]] to configure the size for "pixel" mode.
   * @see [[voxelScale]], [[minPixelsPerVoxel]], and [[maxPixelsPerVoxel]] to configure the size for "voxel" mode.
   */
  public readonly sizeMode: PointCloudSizeMode;
  /** The radius of each point in pixels, when [[sizeMode]] is "pixel".
   * The size is expected to be a positive integer. The maximum size will vary based on the graphics hardware in use, but typically is limited to 32 or 64 pixels.
   * Default: 1
   */
  public readonly pixelSize: number;
  /** A scale factor applied to the size of each point, when [[sizeMode]] is "voxel".
   * The scale is expected to be a positive floating point number.
   * Default: 1.0
   */
  public readonly voxelScale: number;
  /** If [[sizeMode]] is "voxel", the minimum radius of each point in pixels. It is expected to be a positive integer no greater than [[maxPixelsPerVoxel]].
   * Default: 2
   */
  public readonly minPixelsPerVoxel: number;
  /** If [[sizeMode]] is "voxel", the maximum radius of each point in pixels. It is expected to be a positive integer no less than [[minPixelsPerVoxel]].
   * Default: 20.
   */
  public readonly maxPixelsPerVoxel: number;
  /** The mode for the Eye-Dome Lighting (EDL) effect.
   * Default: "off"
   * @note EDL mode is ignored (off) if the view is not perspective (camera is off)
   */
  public readonly edlMode: PointCloudEDLMode;
  /** A strength value for the Eye Dome Lighting (EDL) effect.
   * The strength is expected to be a positive floating point number.
   * Default: 5.0
   */
  public readonly edlStrength: number;
  /** A radius value for the Eye Dome Lighting (EDL) effect.
   * The radius is expected to be a positive floating point number
   * It is used to deterimine how far away in pixels to sample for depth change
   * Default: 2.0
   */
  public readonly edlRadius: number;
  /** A flag for whether or not to apply filtering pass in the Eye Dome Lighting (EDL) effect.
   * It only applies if edlMode is "full"
   * Default: 1.0
   */
  public readonly edlFilter?: number;
  /** A weighting value to apply to the full image when combining it with the half and quarter sized ones
   * It only applies if edlMode is "full"
   * The strength is expected to be a floating point number between 0 and 1 inclusive.
   * Default: 1.0
   */
  public readonly edlMixWts1?: number;
  /** A weighting value to apply to the half sized image when combining it with the full and quarter sized ones
   * It only applies if edlMode is "full"
   * The strength is expected to be a floating point number between 0 and 1 inclusive.
   * Default: 0.5
   */
  public readonly edlMixWts2?: number;
  /** A weighting value to apply to the quarter sized image when combining it with the full and half sized ones
   * It only applies if edlMode is "full"
   * The strength is expected to be a floating point number between 0 and 1 inclusive.
   * Default: 0.25
   */
  public readonly edlMixWts4?: number;

  /** Settings with all properties initialized to their default values. */
  public static defaults = new PointCloudDisplaySettings();

  private constructor(props?: PointCloudDisplayProps) {
    this.shape = props?.shape ?? "round";
    this.sizeMode = props?.sizeMode ?? "voxel";

    // No sanity checks here - e.g., min < max, pixelSize and voxelScale > 0, etc.
    this.pixelSize = props?.pixelSize ?? 1;
    this.voxelScale = props?.voxelScale ?? 1;
    this.minPixelsPerVoxel = props?.minPixelsPerVoxel ?? 2;
    this.maxPixelsPerVoxel = props?.maxPixelsPerVoxel ?? 20;
    this.edlMode = props?.edlMode ?? "off";
    this.edlStrength = props?.edlStrength ?? 5;
    this.edlRadius = props?.edlRadius ?? 2;
    this.edlFilter = props?.edlFilter ?? 1;
    this.edlMixWts1 = props?.edlMixWts1 ?? 1.0;
    this.edlMixWts2 = props?.edlMixWts2 ?? 0.5;
    this.edlMixWts4 = props?.edlMixWts4 ?? 0.25;
  }

  /** Create display settings from their JSON representation. If `props` is `undefined`, the default settings are returned. */
  public static fromJSON(props?: PointCloudDisplayProps): PointCloudDisplaySettings {
    return props ? new PointCloudDisplaySettings(props) : this.defaults;
  }

  /** Convert these settings to their JSON representation. */
  public toJSON(): PointCloudDisplayProps | undefined {
    const defs = PointCloudDisplaySettings.defaults;
    if (this.equals(defs))
      return undefined;

    const props: PointCloudDisplayProps = { };
    if (this.shape !== defs.shape)
      props.shape = this.shape;

    if (this.sizeMode !== defs.sizeMode)
      props.sizeMode = this.sizeMode;

    if (this.pixelSize !== defs.pixelSize)
      props.pixelSize = this.pixelSize;

    if (this.voxelScale !== defs.voxelScale)
      props.voxelScale = this.voxelScale;

    if (this.minPixelsPerVoxel !== defs.minPixelsPerVoxel)
      props.minPixelsPerVoxel = this.minPixelsPerVoxel;

    if (this.maxPixelsPerVoxel !== defs.maxPixelsPerVoxel)
      props.maxPixelsPerVoxel = this.maxPixelsPerVoxel;

    if (this.edlMode !== defs.edlMode)
      props.edlMode = this.edlMode;

    if (this.edlStrength !== defs.edlStrength)
      props.edlStrength = this.edlStrength;

    if (this.edlRadius !== defs.edlRadius)
      props.edlRadius = this.edlRadius;

    if (this.edlFilter !== defs.edlFilter)
      props.edlFilter = this.edlFilter;

    if (this.edlMixWts1 !== defs.edlMixWts1)
      props.edlMixWts1 = this.edlMixWts1;

    if (this.edlMixWts2 !== defs.edlMixWts2)
      props.edlMixWts2 = this.edlMixWts2;

    if (this.edlMixWts4 !== defs.edlMixWts4)
      props.edlMixWts4 = this.edlMixWts4;

    return props;
  }

  /** Create a copy of these settings, identical except for any properties explicitly specified by `changedProps`. */
  public clone(changedProps: PointCloudDisplayProps): PointCloudDisplaySettings {
    return PointCloudDisplaySettings.fromJSON({
      ...this.toJSON(),
      ...changedProps,
    });
  }

  /** Returns true if these settings are identical to `other`. */
  public equals(other: PointCloudDisplaySettings): boolean {
    if (this === other)
      return true;

    return this.shape === other.shape && this.sizeMode === other.sizeMode && this.pixelSize === other.pixelSize
      && this.voxelScale === other.voxelScale && this.minPixelsPerVoxel === other.minPixelsPerVoxel && this.maxPixelsPerVoxel === other.maxPixelsPerVoxel
      && this.edlMode === other.edlMode && this.edlStrength === other.edlStrength && this.edlRadius === other.edlRadius
      && this.edlFilter === other.edlFilter
      && this.edlMixWts1 === other.edlMixWts1 && this.edlMixWts2 === other.edlMixWts2 && this.edlMixWts4 === other.edlMixWts4
    ;
  }
}

/** Settings that control how a reality model - whether a [[ContextRealityModel]] or a persistent reality [Model]($backend) - is displayed within a [Viewport]($frontend).
 * @see [[ContextRealityModel.displaySettings]] to apply these settings to a context reality model.
 * @see [[DisplayStyleSettings.setRealityModelDisplaySettings]] to apply these settings to a persistent reality model.
 * @note This is an immutable type - to modify its properties, use [[clone]].
 * @beta
 */
export class RealityModelDisplaySettings {
  /** If the reality model's color is overridden with another color, a ratio in [0..1] with which to mix the two colors together.
   * A ratio of 0 uses only the reality model's color, a ratio of 1 uses only the override color, and a ratio of 0.5 mixes the two colors equally.
   * The color may be overridden using [[FeatureOverrides]] such as those supplied by a [FeatureOverrideProvider]($frontend), or by applying a [[SpatialClassifier]].
   * Default: 0.5
   */
  public readonly overrideColorRatio: number;
  /** Settings that apply specifically to point cloud reality models.
   * Default: [[PointCloudDisplaySettings.defaults]].
   */
  public readonly pointCloud: PointCloudDisplaySettings;

  public readonly visible: boolean;

  /** Settings with all properties initialized to their default values. */
  public static defaults = new RealityModelDisplaySettings(undefined, PointCloudDisplaySettings.defaults, undefined);

  private constructor(overrideColorRatio: number | undefined, pointCloud: PointCloudDisplaySettings, visible: boolean|undefined) {
    this.overrideColorRatio = overrideColorRatio ?? 0.5;
    this.pointCloud = pointCloud;
    this.visible = visible ?? true;
  }

  /** Create display settings from their JSON representation. If `props` is `undefined`, the default settings are returned. */
  public static fromJSON(props?: RealityModelDisplayProps): RealityModelDisplaySettings {
    if (!props)
      return this.defaults;

    return new RealityModelDisplaySettings(props.overrideColorRatio, PointCloudDisplaySettings.fromJSON(props.pointCloud), props.visible);
  }

  /** Convert these settings to their JSON representation, which is `undefined` if all of their properties match the default settings. */
  public toJSON(): RealityModelDisplayProps | undefined {
    const pointCloud = this.pointCloud.toJSON();
    const overrideColorRatio = this.overrideColorRatio === RealityModelDisplaySettings.defaults.overrideColorRatio ? undefined : this.overrideColorRatio;
    const visible = this.visible === RealityModelDisplaySettings.defaults.visible ? undefined : this.visible;

    if (undefined === pointCloud && undefined === overrideColorRatio)
      return undefined;

    const props: RealityModelDisplayProps = { };
    if (undefined !== pointCloud)
      props.pointCloud = pointCloud;

    if (undefined !== overrideColorRatio)
      props.overrideColorRatio = overrideColorRatio;

    if (undefined !== visible)
      props.visible = visible;

    return props;
  }

  /** Returns true if these settings are identical to `other`. */
  public equals(other: RealityModelDisplaySettings): boolean {
    if (this === other)
      return true;

    return this.overrideColorRatio === other.overrideColorRatio && this.pointCloud.equals(other.pointCloud);
  }

  /** Create a copy of these settings, identical except for any properties explicitly specified by `changedProps`. */
  public clone(changedProps: RealityModelDisplayProps): RealityModelDisplaySettings {
    const pointCloud = changedProps.pointCloud ? this.pointCloud.clone(changedProps.pointCloud) : this.pointCloud;
    const colorRatio = changedProps.hasOwnProperty("overrideColorRatio") ? changedProps.overrideColorRatio : this.overrideColorRatio;
    const visible = changedProps.hasOwnProperty("visible") ? changedProps.visible : this.visible;
    return new RealityModelDisplaySettings(colorRatio, pointCloud, visible);
  }
}
