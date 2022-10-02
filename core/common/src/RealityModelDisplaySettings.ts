/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */

export type PointCloudSizeMode = "voxel" | "pixel";

export type PointCloudShape = "square" | "round";

export interface PointCloudDisplayProps {
  sizeMode?: PointCloudSizeMode;
  voxelScale?: number;
  minPixelsPerVoxel?: number;
  maxPixelsPerVoxel?: number;
  pixelSize?: number;
  shape?: PointCloudShape;
}

export interface RealityModelDisplayProps {
  pointCloud?: PointCloudDisplayProps;
  // ###TODO when we need it: mesh?: RealityMeshDisplayProps;
  overrideColorRatio?: number;
}

export class PointCloudDisplaySettings {
  public readonly shape: PointCloudShape;
  public readonly sizeMode: PointCloudSizeMode;
  public readonly pixelSize: number;
  public readonly voxelScale: number;
  public readonly minPixelsPerVoxel: number;
  public readonly maxPixelsPerVoxel: number;

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

  public static fromJSON(props?: PointCloudDisplayProps): PointCloudDisplaySettings {
    return props ? new PointCloudDisplaySettings(props) : this.defaults;
  }

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

  public clone(changedProps: PointCloudDisplayProps): PointCloudDisplaySettings {
    return PointCloudDisplaySettings.fromJSON({
      ...this.toJSON(),
      ...changedProps,
    });
  }

  public equals(other: PointCloudDisplaySettings): boolean {
    return this.shape === other.shape && this.sizeMode === other.sizeMode && this.pixelSize === other.pixelSize
      && this.voxelScale === other.voxelScale && this.minPixelsPerVoxel === other.minPixelsPerVoxel && this.maxPixelsPerVoxel === other.maxPixelsPerVoxel;
  }
}

export class RealityModelDisplaySettings {
  public readonly overrideColorRatio: number;
  public readonly pointCloud: PointCloudDisplaySettings;

  public static defaults = new RealityModelDisplaySettings(undefined, PointCloudDisplaySettings.defaults);

  private constructor(overrideColorRatio: number | undefined, pointCloud: PointCloudDisplaySettings) {
    this.overrideColorRatio = overrideColorRatio ?? 0.5;
    this.pointCloud = pointCloud;
  }

  public static fromJSON(props?: RealityModelDisplayProps): RealityModelDisplaySettings {
    if (!props)
      return this.defaults;

    return new RealityModelDisplaySettings(props.overrideColorRatio, PointCloudDisplaySettings.fromJSON(props.pointCloud));
  }

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

  public equals(other: RealityModelDisplaySettings): boolean {
    return this.overrideColorRatio === other.overrideColorRatio && this.pointCloud.equals(other.pointCloud);
  }

  public clone(changedProps: RealityModelDisplayProps): RealityModelDisplaySettings {
    const pointCloud = changedProps.pointCloud ? this.pointCloud.clone(changedProps.pointCloud) : this.pointCloud;
    const colorRatio = changedProps.overrideColorRatio ?? this.overrideColorRatio;
    return new RealityModelDisplaySettings(colorRatio, pointCloud);
  }
}
