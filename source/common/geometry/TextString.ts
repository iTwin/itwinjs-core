/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { XYZProps, Point3d, YawPitchRollAngles, YawPitchRollProps } from "@bentley/geometry-core";

/** Properties for a TextString class */
export interface TextStringProps {
  /** text string */
  text: string;
  /** font number. Font numbers are mapped to font names and types via the FontMap */
  font: number;
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

/**
 * A single line of text, all with the same font, styles (underline, bold, italic), and size.
 * This class also holds the origin, and direction for the text.
 * A paragraph is composed of one or more instances of TextStrings.
 */
export class TextString {
  /** Text string */
  public text: string;
  /** font number. Font numbers are mapped to font names and types via the FontMap */
  public font: number;
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
    const val: any = {};
    val.text = this.text;
    val.font = this.font;
    val.height = this.height;
    val.widthFactor = this.widthFactor;
    val.bold = this.bold;
    val.italic = this.italic;
    val.underline = this.underline;
    if (!this.origin.isAlmostZero()) val.origin = this.origin;
    if (!this.rotation.isIdentity()) val.rotation = this.rotation;
    return val;
  }
}
