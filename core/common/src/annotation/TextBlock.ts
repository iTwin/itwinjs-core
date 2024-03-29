/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Annotation
 */

/*
import { TextStyle } from "./TextStyle";

export class TextRun {
  public readonly type: "text";
  private _style: TextStyle;

  public get style(): TextStyle {
    return this._style;
  }

  public set style(style: TextStyle) {
    this._style = style.clone();
  }
}
*/

/*
RunBase
  style: TextStyle
  clone(): RunBase
TextRun // ContentRun?
  shift: "subscript" | "superscript" | "none"
  content: string
FractionRun
  denominator: string
  numerator: string
LineBreakRun
  // nothing additional
Paragraph
  style
  runs: RunBase[]
  clone()
  applyStyle(style, options)
TextBlock
  width: number
  justification: "left" | "center" | "right"
  style
  paragraphs: Paragraph[]
  clone()
  applyStyle(style, options)
  isEmpty
  toString(options): string
  appendParagraph(): Paragraph
    If empty, create one with same style
    Else, use last paragraph as seed
  // don't need appendParagraph(paragraph) // just does paragraphs.push(par)
  appendRun(run)
    Create a paragraph if empty, then append run to last paragraph
  
*/
