/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Annotation
 */

import { TextString } from "../geometry/TextString";
import { TextStyleColor, TextStyleSettings } from "./TextStyle";
import { LineSegment3d } from "@itwin/core-geometry";
import { TextBlockLayoutResult } from "./TextBlockLayoutResult";
import { TextBlock } from "./TextBlock";
 
export interface TextStringGeometryEntry {
  color: TextStyleColor;
  text: TextString;
  separator?: never;
}

export interface FractionSeparatorGeometryEntry {
  color: TextStyleColor;
  separator: LineSegment3d;
  text?: never;
}

export type TextBlockGeometryEntry = TextStringGeometryEntry | FractionSeparatorGeometryEntry;

export interface ProcessTextBlockGeometryArgs {
  textBlock: TextBlock;
  layout: TextBlockLayoutResult;
  acceptEntry(entry: TextBlockGeometryEntry): void;
  getSettings(styleName: string): TextStyleSettings;
}

export function processTextBlockGeometry(args: ProcessTextBlockGeometryArgs): void {
  const context = new GeometryContext(args);
  context.process();
}

class GeometryContext {
  private readonly _settings = new Map<string, TextStyleSettings>();
  private readonly _textBlock: TextBlock;
  private readonly _layout: TextBlockLayoutResult;
  private readonly _getSettings: (styleName: string) => TextStyleSettings;
  private readonly _accept: (entry: TextBlockGeometryEntry) => void;

  public constructor(args: ProcessTextBlockGeometryArgs) {
    this._textBlock = args.textBlock;
    this._layout = args.layout;
    this._getSettings = args.getSettings;
    this._accept = args.acceptEntry;
  }

  public process(): void {
    
  }
}
