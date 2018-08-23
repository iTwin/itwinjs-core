/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Symbology */

import { Vector3d, XYZProps, YawPitchRollProps, YawPitchRollAngles, Transform } from "@bentley/geometry-core";
import { Id64 } from "@bentley/bentleyjs-core";

export namespace LineStyle {

  /** GeometryStream entry to modify the line style appearance without changing the line style definition.
   * Applies to the style previously established by a GeometryAppearanceProps or current subCategory appearance.
   * Most of the modifiers affect the line style stroke pattern, with the orientation and scales being the exception.
   */
  export interface ModifierProps {
    /** Optional scale to apply to all length values, 1.0 if undefined */
    scale?: number;
    /** Optional scale to apply to scalable dashes, 1.0 if undefined */
    dashScale?: number;
    /** Optional scale to apply to scalable gaps, 1.0 if undefined */
    gapScale?: number;
    /** Optional start width in meters to apply to dashes, no width if undefined */
    startWidth?: number;
    /** Optional end width in meters to apply to dashes, same as startWidth if undefined */
    endWidth?: number;
    /** Optional shift by distance in meters, 0.0 if undefined */
    distPhase?: number;
    /** Optional shift by fraction, 0.0 if undefined */
    fractPhase?: number;
    /** Optional flag to center stroke pattern and stretch ends, false if undefined */
    centerPhase?: boolean;
    /** Optional flag to enable or disable single segment mode */
    segmentMode?: boolean;
    /** Optional flag that denotes startWidth and endWidth represent physical widths that should not be affected by scale, false if undefined */
    physicalWidth?: boolean;
    /** Optional up vector for style (applicable to 3d only), 0.0,0.0,1.0 if undefined */
    normal?: XYZProps;
    /** Optional orientation for style (applicable to 3d only), 0.0,0.0,0.0 if undefined */
    rotation?: YawPitchRollProps;
  }

  /** Optional modifiers to override line style definition */
  export class Modifier implements ModifierProps {
    public scale?: number;
    public dashScale?: number;
    public gapScale?: number;
    public startWidth?: number;
    public endWidth?: number;
    public distPhase?: number;
    public fractPhase?: number;
    public centerPhase?: boolean;
    public segmentMode?: boolean;
    public physicalWidth?: boolean;
    public normal?: Vector3d;
    public rotation?: YawPitchRollAngles;

    /** constructor for LineStyle.Modifier */
    constructor(props: ModifierProps) {
      this.scale = props.scale;
      this.dashScale = props.dashScale;
      this.gapScale = props.gapScale;
      this.startWidth = props.startWidth;
      this.endWidth = props.endWidth;
      this.distPhase = props.distPhase;
      this.fractPhase = props.fractPhase;
      this.centerPhase = props.centerPhase;
      this.segmentMode = props.segmentMode;
      this.physicalWidth = props.physicalWidth;
      this.normal = props.normal ? Vector3d.fromJSON(props.normal) : undefined;
      this.rotation = props.rotation ? YawPitchRollAngles.fromJSON(props.rotation) : undefined;
    }

    /** Returns a deep copy of this object. */
    public clone() {
      return new Modifier(this);
    }

    /** Compare two LineStyle.Modifier for equivalence */
    public isEqualTo(other: Modifier): boolean {
      if (this === other)   // same pointer
        return true;

      if (other.scale !== this.scale ||
        other.dashScale !== this.dashScale ||
        other.gapScale !== this.gapScale ||
        other.startWidth !== this.startWidth ||
        other.endWidth !== this.endWidth ||
        other.distPhase !== this.distPhase ||
        other.fractPhase !== this.fractPhase ||
        other.centerPhase !== this.centerPhase ||
        other.segmentMode !== this.segmentMode ||
        other.physicalWidth !== this.physicalWidth)
        return false;

      if ((this.normal === undefined) !== (other.normal === undefined))
        return false;
      if (this.normal && !this.normal.isAlmostEqual(other.normal!))
        return false;

      if ((this.rotation === undefined) !== (other.rotation === undefined))
        return false;
      if (this.rotation && !this.rotation.isAlmostEqual(other.rotation!))
        return false;

      return true;
    }

    public applyTransform(transform: Transform): boolean {
      if (transform.isIdentity)
        return true;
      if (this.normal) {
        transform.matrix.multiplyVector(this.normal, this.normal);
        const normalized = this.normal.normalize();
        if (normalized)
          this.normal.setFrom(normalized);
        else
          return false;
      }
      if (this.rotation) {
        const newTransform = this.rotation.toMatrix3d().multiplyMatrixTransform(transform);
        const scales = new Vector3d();
        if (!newTransform.matrix.normalizeColumnsInPlace(scales))
          return false;
        const newRotation = YawPitchRollAngles.createFromMatrix3d(newTransform.matrix);
        if (undefined === newRotation)
          return false;
        this.rotation.setFrom(newRotation);
      }

      let scaleFactor = 1.0;
      const scaleVector = Vector3d.create();
      const scaleMatrix = transform.matrix;
      scaleMatrix.normalizeRowsInPlace(scaleVector);

      // Check for flatten transform, dividing scaleVector by 3 gives wrong scaleFactor
      if (scaleVector.x !== 0.0 && scaleVector.y !== 0.0 && scaleVector.z !== 0.0)
        scaleFactor = (scaleVector.x + scaleVector.y + scaleVector.z) / 3.0;
      else
        scaleFactor = (scaleVector.x + scaleVector.y + scaleVector.z) / 2.0;

      if (1.0 === scaleFactor)
        return true;

      if (this.scale)
        this.scale *= scaleFactor;

      if (this.physicalWidth)
        return true;

      if (this.startWidth)
        this.startWidth *= scaleFactor;

      if (this.endWidth)
        this.endWidth *= scaleFactor;

      return true;
    }
  }

  /** Line style id and optional modifiers to override line style definition */
  export class Info {
    public styleId: Id64;
    public styleMod?: Modifier; // Optional modifiers to override line style definition

    /** Creates a LineStyle.Info object */
    constructor(styleId: Id64, styleMod?: Modifier) {
      this.styleId = styleId;
      this.styleMod = styleMod;
    }

    /** Returns a deep copy of this object. */
    public clone(): Info {
      return new Info(this.styleId, this.styleMod ? this.styleMod.clone() : undefined);
    }

    public isEqualTo(other: Info): boolean {
      if (this === other)
        return true;
      if (!this.styleId.equals(other.styleId))
        return false;
      if ((this.styleMod === undefined) !== (other.styleMod === undefined))
        return false;
      if (this.styleMod && !this.styleMod.isEqualTo(other.styleMod!))
        return false;
      return true;
    }
  }
}
