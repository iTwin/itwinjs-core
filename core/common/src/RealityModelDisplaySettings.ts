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

export interface RealityMeshDisplayProps {
}

export interface RealityModelDisplayProps {
  pointCloud?: PointCloudDisplayProps;
  mesh?: RealityMeshDisplayProps;
  overrideColorRatio?: number;
}

export class PointCloudDisplaySettings {
  public readonly shape: PointCloudShape;
  public readonly sizeMode: PointCloudSizeMode;
  public readonly pixelSize: number;
  public readonly voxelScale: number;
  public readonly minPixelsPerVoxel: number;
  public readonly maxPixelsPerVoxel: number;

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

  public static defaults = new PointCloudDisplaySettings();

  public toJSON(): PointCloudDisplayProps {
    const defs = PointCloudDisplaySettings.defaults;
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
}
