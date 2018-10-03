/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module CartesianGeometry */
import { Matrix3d } from "./Matrix3d";
export interface IsNullCheck {
  isNull(): boolean;
}
export interface WritableXAndY {
  x: number;
  y: number;
}
export interface WriteableHasZ {
  z: number;
}
export interface WritableXYAndZ extends XAndY, WriteableHasZ {
}
export interface WritableLowAndHighXY {
  low: WritableXAndY;
  high: WritableXAndY;
}
export interface WritableLowAndHighXYZ {
  low: WritableXYAndZ;
  high: WritableXYAndZ;
}
export type HasZ = Readonly<WriteableHasZ>;
export type XAndY = Readonly<WritableXAndY>;
export type XYAndZ = Readonly<WritableXYAndZ>;
export type LowAndHighXY = Readonly<WritableLowAndHighXY>;
export type LowAndHighXYZ = Readonly<WritableLowAndHighXYZ>;
export type XYZProps = {
  x?: number;
  y?: number;
  z?: number;
} | number[];
export type XYProps = {
  x?: number;
  y?: number;
} | number[];
export type Matrix3dProps = number[][] | Matrix3d | number[];
export type TransformProps = number[][] | number[] | {
  origin: XYZProps;
  matrix: Matrix3dProps;
};
export type Range3dProps = {
  low: XYZProps;
  high: XYZProps;
} | XYZProps[];
export type Range2dProps = {
  low: XYProps;
  high: XYProps;
} | XYProps[];
export type Range1dProps = {
  low: number;
  high: number;
} | number[];
