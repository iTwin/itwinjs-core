/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { BackgroundFill, ColorDef, FillDisplay, FlatBufferGeometryStream, FrameGeometry, GeometryParams, GeometryStreamBuilder, JsonGeometryStream, PlacementProps, TextAnnotation, TextAnnotationProps } from "@itwin/core-common";
import { Stroker } from "./Stroker";
import { produceTextAnnotationGeometry } from "../TextAnnotationGeometry";
import { IModelDb } from "../IModelDb";
import { FrameGeometryProps } from "@itwin/core-common/lib/cjs/annotation/FrameGeometryProps";
import { Id64 } from "@itwin/core-bentley";
import { Loop } from "@itwin/core-geometry";

/** @packageDocumentation
 * @module Strokers
 */

export class TextAnnotationStroker extends Stroker<TextAnnotationProps> {
  private _iModel: IModelDb;
  private _builder: GeometryStreamBuilder;

  public constructor(iModel: IModelDb) {
    super();
    this._iModel = iModel;
    this._builder = new GeometryStreamBuilder();
  }

  public get builder(): GeometryStreamBuilder { return this._builder };

  public createGeometry(props: TextAnnotationProps, placementProps?: PlacementProps): FlatBufferGeometryStream | JsonGeometryStream | undefined {
    if (placementProps) this._builder.setLocalToWorldFromPlacement(placementProps)

    const annotation = TextAnnotation.fromJSON(props);

    const { textBlockGeometry, frameGeometry } = produceTextAnnotationGeometry({ iModel: this._iModel, annotation });

    this._builder.appendTextBlock(textBlockGeometry);
    if (undefined !== frameGeometry) {
      this.appendFrame(frameGeometry)
    }

    return { format: "json", data: this._builder.geometryStream };
  }


  private appendFrame(frameProps: FrameGeometryProps): boolean {
    for (const entry of frameProps.entries) {
      let result: boolean;
      if (undefined !== entry.frame) {
        const params = new GeometryParams(Id64.invalid);
        params.elmPriority = 0;

        if (entry.frame.fillColor === undefined) {
          params.fillDisplay = FillDisplay.Never;
        } else if (entry.frame.fillColor === "background") {
          params.backgroundFill = BackgroundFill.Outline;
          params.fillDisplay = FillDisplay.Always;
        } else if (entry.frame.fillColor !== "subcategory") {
          params.fillColor = ColorDef.fromJSON(entry.frame.fillColor);
          params.lineColor = params.fillColor;
          params.fillDisplay = FillDisplay.Always;
        }

        if (entry.frame.lineColor !== "subcategory") {
          params.lineColor = ColorDef.fromJSON(entry.frame.lineColor);
          params.weight = entry.frame.lineWidth;
        }

        const frame = FrameGeometry.computeFrame(entry.frame.shape, entry.frame.range, entry.frame.transform);

        result = this._builder.appendGeometryParamsChange(params);
        result = result && this._builder.appendGeometry(frame);

      } else if (entry.debugSnap) {
        // TODO: remove
        const params = new GeometryParams(Id64.invalid);
        params.lineColor = ColorDef.black;
        params.weight = 1;
        params.fillColor = ColorDef.white;
        params.fillDisplay = FillDisplay.Always;
        this._builder.appendGeometryParamsChange(params);
        const points = FrameGeometry.debugIntervals(entry.debugSnap.shape, entry.debugSnap.range, entry.debugSnap.transform, 0.5, 0.25);
        points?.forEach(point => this._builder.appendGeometry(Loop.create(point)));
        result = true;
      } else {
        result = false;
      }

      if (!result) {
        return false;
      }
    }

    return true;
  }
}