/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Geometry
 */

import { Point2d, Point3d, Range2d, Transform, Vector3d, XYZProps, YawPitchRollAngles, YawPitchRollProps } from "@itwin/core-geometry";
import { FontId } from "../Fonts";

/**
 * Optional cached text layout information used to support legacy proxy graphics.
 * @beta
 */
export interface TextStringGlyphData {
  glyphIds: number[];
  glyphOrigins: Point2d[];
  range: Range2d;
}

/** Properties for a TextString class.
 * @see [[GeometryStreamEntryProps]]
 * @public
 * @extensions
 */
export interface TextStringProps {
  /** text string */
  text: string;
  /** FontId for the TextString. FontIds are mapped to font names and types via the FontMap */
  font: FontId;
  /* text height */
  height: number;
  /*  width / height ratio. Default is 1.0 */
  widthFactor?: number;
  /** bold text. Default is false */
  bold?: boolean;
  /** italic text. Default is false */
  italic?: boolean;
  /** underline text. Default is false */
  underline?: boolean;
  /** Optional position relative to element's placement. Default is 0,0,0 */
  origin?: XYZProps;
  /** Optional rotation relative to element's placement. Default is identity matrix */
  rotation?: YawPitchRollProps;
}

/** A single line of text, all with the same font, styles (underline, bold, italic), and size.
 * This class also holds the origin and direction for the text.
 * A paragraph is composed of one or more instances of TextStrings.
 * @public
 */
export class TextString {
  /** Text string */
  public text: string;
  /** FontId for this TextString. FontIds are mapped to font names and types via the FontMap */
  public font: FontId;
  /* text height, in meters */
  public height: number;
  /*  width / height ratio. Default is 1.0 */
  public widthFactor?: number;
  /** bold text. Default is false */
  public bold?: boolean;
  /** italic text. Default is false */
  public italic?: boolean;
  /** underline text. Default is false */
  public underline?: boolean;
  /** position relative to element's placement */
  public readonly origin: Point3d;
  /** Rotation relative to element's placement */
  public readonly rotation: YawPitchRollAngles;
  public get width() { return this.height * (this.widthFactor ? this.widthFactor : 1.0); }

  public constructor(props: TextStringProps) {
    this.text = props.text;
    this.font = props.font;
    this.height = props.height;
    this.widthFactor = props.widthFactor;
    this.bold = props.bold;
    this.italic = props.italic;
    this.underline = props.underline;
    this.origin = Point3d.fromJSON(props.origin);
    this.rotation = YawPitchRollAngles.fromJSON(props.rotation);
  }

  public toJSON(): TextStringProps {
    const props: TextStringProps = {
      text: this.text,
      font: this.font,
      height: this.height,
      widthFactor: this.widthFactor,
      bold: this.bold,
      italic: this.italic,
      underline: this.underline,
    };

    if (!this.origin.isAlmostZero) {
      props.origin = this.origin.toJSON();
    }

    if (!this.rotation.isIdentity()) {
      props.rotation = this.rotation.toJSON();
    }

    return props;
  }

  public transformInPlace(transform: Transform): boolean {
    const newOrigin = transform.multiplyPoint3d(this.origin, this.origin);
    const newTransform = this.rotation.toMatrix3d().multiplyMatrixTransform(transform);
    const scales = new Vector3d();
    if (!newTransform.matrix.normalizeColumnsInPlace(scales))
      return false;
    const newRotation = YawPitchRollAngles.createFromMatrix3d(newTransform.matrix);
    if (undefined === newRotation)
      return false;
    const newHeight = this.height * scales.y;
    const newWidth = this.width * scales.x;
    if (newHeight < 1.0e-10 || newWidth < 1.0e-10)
      return false;
    this.origin.setFrom(newOrigin);
    this.rotation.setFrom(newRotation);
    this.height = newHeight;
    this.widthFactor = (newHeight === newWidth ? undefined : (newWidth / newHeight));
    return true;
  }
}
