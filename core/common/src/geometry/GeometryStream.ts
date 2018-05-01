/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Geometry */

import {
  Point2d, Point3d, Vector3d, YawPitchRollAngles, YawPitchRollProps, Transform, RotMatrix, Angle, GeometryQuery, XYZProps, LowAndHighXYZ, Range3d,
} from "@bentley/geometry-core";
import { IModelJson as GeomJson } from "@bentley/geometry-core/lib/serialization/IModelJsonSchema";
import { Id64, Id64Props } from "@bentley/bentleyjs-core";
import { ColorDef } from "../ColorDef";
import { GeometryClass, GeometryParams, FillDisplay, BackgroundFill, Gradient } from "../Render";
import { TextStringProps, TextString } from "./TextString";
import { LineStyle } from "./LineStyle";
import { AreaPattern } from "./AreaPattern";

/** GeometryStream entry to establish a non-default subCategory or to override the subCategory appearance for the geometry that follows.
 *  GeometryAppearanceProps always signifies a reset to the subCategory appearance for all values without an override.
 */
export interface GeometryAppearanceProps {
  /** Optional subCategory id for subsequent geometry. Use to create a GeometryStream with geometry that is not on the default subCategory for the element's category or is on multiple subCategories */
  subCategory?: Id64Props;
  /** Optional color to override the subCategory appearance color for subsequent geometry */
  color?: ColorDef;
  /** Optional weight to override the subCategory appearance weight for subsequent geometry */
  weight?: number;
  /** Optional style to override the subCategory appearance style for subsequent geometry */
  style?: Id64Props;
  /** Optional transparency, default is 0. Effective transparency is a combination of this value and that from the subCategory appearance */
  transparency?: number;
  /** Optional display priority (2d only), default is 0. Effective display priority is a combination of this value and that from the subCategory appearance */
  displayPriority?: number;
  /** Optional GeometryClass (for DGN compatibility, subCategories preferred), default is Primary */
  geometryClass?: GeometryClass;
}

/** GeometryStream entry for adding a background color fill, a solid color fill, or a gradient fill to a planar region (or mesh).
 * Only one value among backgroundFill, color, and gradient should be set.
 */
export interface AreaFillProps {
  /** Fill display type, must be set to something other than [[FillDisplay.Never]] in order to display fill */
  display: FillDisplay;
  /** Optional fill transparency. Allows for different fill and outline transparencies */
  transparency?: number;
  /** Set fill color to view background color. Use [[BackgroundFill.Solid]] for an opaque fill and [[BackgroundFill.Outline]] to display an outline using the line color */
  backgroundFill?: BackgroundFill;
  /** Set fill color to a specific color. If the fill color the same as the line color, it's an opaque fill, otherwise it's an outline fill */
  color?: ColorDef;
  /** Set fill using gradient properties */
  gradient?: Gradient.SymbProps;
}

/** GeometryStream entry to override the material from the subCategory appearance for the geometry that follows.
 */
export interface MaterialProps {
  /** Material id */
  materialId?: Id64Props;
  /** @hidden */
  origin?: XYZProps;
  /** @hidden */
  size?: XYZProps;
  /** @hidden */
  rotation?: YawPitchRollProps;
}

/** GeometryStream entry to a GeometryPart for a GeometricElement */
export interface GeometryPartInstanceProps {
  /** GeometryPart id */
  part: Id64Props;
  /** Optional translation relative to element's placement. Default is 0,0,0. For a 2d element/translation, supply non-zero x and y only */
  origin?: XYZProps;
  /** Optional rotation relative to element's placement. Default is 0,0,0. For a 2d element/rotation, supply a non-zero yaw angle only */
  rotation?: YawPitchRollProps;
  /** Optional scale to apply to part, default scale is 1 */
  scale?: number;
}

/** Allowed GeometryStream entries - should only set one value */
export interface GeometryStreamEntryProps extends GeomJson.GeometryProps {
  appearance?: GeometryAppearanceProps;
  styleMod?: LineStyle.ModifierProps;
  fill?: AreaFillProps;
  pattern?: AreaPattern.ParamsProps;
  material?: MaterialProps;
  geomPart?: GeometryPartInstanceProps;
  textString?: TextStringProps;
  subRange?: LowAndHighXYZ;
}

export type GeometryStreamProps = GeometryStreamEntryProps[];

/** GeometryStreamBuilder is a helper class for populating the GeometryStreamEntryProps array needed to create a GeometricElement or GeometryPart */
export class GeometryStreamBuilder {
  /** Current inverse placement transform, used for converting world coordinate input to be placement relative */
  private worldToLocal?: Transform;
  /** GeometryStream entries */
  public readonly geometryStream: GeometryStreamProps = [];

  /** Supply optional local to world transform. Used to transform world coordinate input relative to element placement.
   * For a GeometricElement's placement to be meaningful, world coordinate geometry should never be appended to an element with an identity placement.
   * Can be called with undefined or identity transform to start appending geometry supplied in local coordinates again.
   */
  public setLocalToWorld(localToWorld?: Transform) {
    this.worldToLocal = (undefined === localToWorld || localToWorld.isIdentity() ? undefined : localToWorld.inverse());
  }

  /** Supply local to world transform from Point3d and YawPitchRollAngles */
  public setLocalToWorld3d(origin: Point3d, angles: YawPitchRollAngles = YawPitchRollAngles.createDegrees(0.0, 0.0, 0.0)) {
    this.setLocalToWorld(Transform.createOriginAndMatrix(origin, angles.toRotMatrix()));
  }

  /** Supply local to world transform from Point2d and Angle */
  public setLocalToWorld2d(origin: Point2d, angle: Angle = Angle.createDegrees(0.0)) {
    this.setLocalToWorld(Transform.createOriginAndMatrix(Point3d.createFrom(origin), RotMatrix.createRotationAroundVector(Vector3d.unitZ(), angle)!));
  }

  /** Store local ranges in GeometryStream for all subsequent geometry appended. Can improve performance of locate and range testing for elements with a GeometryStream
   * containing more than one GeometryQuery differentiable by range. Not useful for a single GeometryQuery, it's range and that of the GeometricElement are the same.
   * Ignored when defining a GeometryPart, and not needed when only appending GeometryPart instances to a GeometricElement as these store their own range.
   */
  public appendGeometryRanges() {
    this.geometryStream.push({ subRange: Range3d.createNull() });
  }

  /** Change sub-category or reset to sub-category appearance for subsequent geometry.
   *  An invalid sub-category id can be supplied to force a reset to the current sub-category appearance.
   *  It is not valid to change the sub-category when defining a GeometryPart. GeometryParts inherit the symbology of their instance for anything not explicitly overridden.
   */
  public appendSubCategoryChange(subCategoryId: Id64): boolean {
    this.geometryStream.push({ appearance: { subCategory: subCategoryId } });
    return true;
  }

  /** Change GeometryParams for subsequent geometry.
   *  It is not valid to change the sub-category when defining a GeometryPart. A GeometryPart inherits the symbology of their instance for anything not explicitly overridden.
   */
  public appendGeometryParamsChange(geomParams: GeometryParams): boolean {
    const appearance: GeometryAppearanceProps = {
      subCategory: geomParams.subCategoryId,
      color: geomParams.lineColor,
      weight: geomParams.weight,
      style: geomParams.styleInfo ? geomParams.styleInfo!.styleId : undefined,
      transparency: geomParams.elmTransparency,
      displayPriority: geomParams.elmPriority,
      geometryClass: geomParams.geometryClass,
    };
    this.geometryStream.push({ appearance });

    if (undefined !== geomParams.materialId)
      this.geometryStream.push({ material: { materialId: geomParams.materialId } });

    if (undefined !== geomParams.fillDisplay && FillDisplay.Never !== geomParams.fillDisplay) {
      const fill: AreaFillProps = {
        display: geomParams.fillDisplay,
        transparency: geomParams.fillTransparency,
      };
      if (undefined !== geomParams.gradient && Gradient.Mode.None !== geomParams.gradient.mode)
        fill.gradient = geomParams.gradient.clone();
      else if (undefined !== geomParams.backgroundFill && BackgroundFill.None !== geomParams.backgroundFill)
        fill.backgroundFill = geomParams.backgroundFill;
      else if (undefined !== geomParams.fillColor)
        fill.color = geomParams.fillColor;
      this.geometryStream.push({ fill });
    }

    if (undefined !== geomParams.pattern) {
      const localPattern = geomParams.pattern.clone();
      if (undefined !== this.worldToLocal && !localPattern.applyTransform(this.worldToLocal))
        return false;
      this.geometryStream.push({ pattern: localPattern });
    }

    if (undefined !== geomParams.styleInfo && undefined !== geomParams.styleInfo.styleMod) {
      const localStyleMod = new LineStyle.Modifier(geomParams.styleInfo.styleMod);
      if (undefined !== this.worldToLocal && !localStyleMod.applyTransform(this.worldToLocal))
        return false;
      this.geometryStream.push({ styleMod: localStyleMod });
    }

    return true;
  }

  /** Append a GeometryPart instance with relative position, orientation, and scale to a GeometryStreamEntryProps array for creating a GeometricElement3d.
   *  Not valid when defining a GeometryPart as nested GeometryParts are not allowed.
   */
  public appendGeometryPart3d(partId: Id64, instanceOrigin?: Point3d, instanceRotation?: YawPitchRollAngles, instanceScale?: number): boolean {
    if (undefined === this.worldToLocal) {
      this.geometryStream.push({ geomPart: { part: partId, origin: instanceOrigin, rotation: instanceRotation, scale: instanceScale } });
      return true;
    }
    const partTrans = Transform.createOriginAndMatrix(instanceOrigin, instanceRotation ? instanceRotation.toRotMatrix() : RotMatrix.createIdentity());
    if (undefined !== instanceScale)
      partTrans.matrix.scaleColumnsInPlace(instanceScale, instanceScale, instanceScale);
    const resultTrans = partTrans.multiplyTransformTransform(this.worldToLocal);
    const scales = new Vector3d();
    if (!resultTrans.matrix.normalizeColumnsInPlace(scales))
      return false;
    const newRotation = YawPitchRollAngles.createFromRotMatrix(resultTrans.matrix);
    if (undefined === newRotation)
      return false;
    this.geometryStream.push({ geomPart: { part: partId, origin: resultTrans.getOrigin(), rotation: newRotation, scale: scales.x } });
    return true;
  }

  /** Append a GeometryPart instance with relative position, orientation, and scale to a GeometryStreamEntryProps array for creating a GeometricElement2d.
   *  Not valid when defining a GeometryPart as nested GeometryParts are not allowed.
   */
  public appendGeometryPart2d(partId: Id64, instanceOrigin?: Point2d, instanceRotation?: Angle, instanceScale?: number): boolean {
    return this.appendGeometryPart3d(partId, instanceOrigin ? Point3d.createFrom(instanceOrigin) : undefined, instanceRotation ? new YawPitchRollAngles(instanceRotation) : undefined, instanceScale);
  }

  /** Append a TextString supplied in either local or world coordinates to the GeometryStreamProps array */
  public appendTextString(textString: TextString): boolean {
    if (undefined === this.worldToLocal) {
      this.geometryStream.push({ textString });
      return true;
    }
    const localTextString = new TextString(textString);
    if (!localTextString.transformInPlace(this.worldToLocal))
      return false;
    this.geometryStream.push({ textString: localTextString });
    return true;
  }

  /** Append a GeometryQuery supplied in either local or world coordinates to the GeometryStreamProps array */
  public appendGeometryQuery(geometry: GeometryQuery): boolean {
    if (undefined === this.worldToLocal) {
      const geomData = GeomJson.Writer.toIModelJson(geometry);
      if (undefined === geomData)
        return false;
      this.geometryStream.push(geomData);
      return true;
    }
    const localGeometry = geometry.cloneTransformed(this.worldToLocal);
    if (undefined === localGeometry)
      return false;
    const localGeomData = GeomJson.Writer.toIModelJson(localGeometry);
    if (undefined === localGeomData)
      return false;
    this.geometryStream.push(localGeomData);
    return true;
  }
}
