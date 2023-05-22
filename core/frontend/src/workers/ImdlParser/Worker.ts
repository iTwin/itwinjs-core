/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { assert } from "@itwin/core-bentley";
import { RenderSchedule } from "@itwin/core-common";
import { collectTransferables, ImdlModel } from "../../common/imdl/ImdlModel";
import { ImdlParseError, ImdlParserOptions, ImdlTimeline, parseImdlDocument } from "../../common/imdl/ParseImdlDocument";
import { registerWorker } from "../RegisterWorker";

let timeline: ImdlTimeline | undefined;

/** Parses binary iMdl content into an [[ImdlModel.Document]].
 * @internal
 */
export interface ParseImdlWorker {
  /** The [[ImdlTimeline]] to be applied  to the document's nodes. This must be called no more than once. It should be called before
   * any call to [[parse]].
   */
  setTimeline(timeline: RenderSchedule.ScriptProps | RenderSchedule.ModelTimelineProps): void;
  /** Parse the binary content into a document.
   * @note The [[Uint8Array]] containing the binary data is transferred from the caller to the worker - it will become unusable for the caller.
   */
  parse(options: ImdlParserOptions): ImdlModel.Document | ImdlParseError;
}

registerWorker<ParseImdlWorker>({
  parse: (options: ImdlParserOptions) => {
    const result = parseImdlDocument({
      ...options,
      data: options.data,
      timeline,
    });

    if (typeof result === "number")
      return result;

    return { result, transfer: collectTransferables(result) };
  },
  setTimeline: (arg: RenderSchedule.ScriptProps | RenderSchedule.ModelTimelineProps) => {
    assert(undefined === timeline, "setTimeline must be called only once");
    timeline = Array.isArray(arg) ? RenderSchedule.Script.fromJSON(arg) : RenderSchedule.ModelTimeline.fromJSON(arg);
  },
});
