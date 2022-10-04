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
}

/** Settings that control how a point cloud reality model is displayed within a [Viewport]($frontend).
 * @note This is an immutable type - to modify its properties, use [[clone]].
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
      && this.voxelScale === other.voxelScale && this.minPixelsPerVoxel === other.minPixelsPerVoxel && this.maxPixelsPerVoxel === other.maxPixelsPerVoxel;
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

  /** Settings with all properties initialized to their default values. */
  public static defaults = new RealityModelDisplaySettings(undefined, PointCloudDisplaySettings.defaults);

  private constructor(overrideColorRatio: number | undefined, pointCloud: PointCloudDisplaySettings) {
    this.overrideColorRatio = overrideColorRatio ?? 0.5;
    this.pointCloud = pointCloud;
  }

  /** Create display settings from their JSON representation. If `props` is `undefined`, the default settings are returned. */
  public static fromJSON(props?: RealityModelDisplayProps): RealityModelDisplaySettings {
    if (!props)
      return this.defaults;

    return new RealityModelDisplaySettings(props.overrideColorRatio, PointCloudDisplaySettings.fromJSON(props.pointCloud));
  }

  /** Convert these settings to their JSON representation, which is `undefined` if all of their properties match the default settings. */
  public toJSON(): RealityModelDisplayProps | undefined {
    const pointCloud = this.pointCloud.toJSON();
    const overrideColorRatio = this.overrideColorRatio === RealityModelDisplaySettings.defaults.overrideColorRatio ? undefined : this.overrideColorRatio;

    if (undefined === pointCloud && undefined === overrideColorRatio)
      return undefined;

    const props: RealityModelDisplayProps = { };
    if (undefined !== pointCloud)
      props.pointCloud = pointCloud;

    if (undefined !== overrideColorRatio)
      props.overrideColorRatio = overrideColorRatio;

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
    return new RealityModelDisplaySettings(colorRatio, pointCloud);
  }
}
