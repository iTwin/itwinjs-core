/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, ByteStream } from "@itwin/core-bentley";
import { RenderSchedule } from "@itwin/core-common";
import { collectTransferables, ImdlModel, ImdlParseError, ImdlParserOptions, ImdlTimeline, parseImdlDocument } from "../../common";
import { registerWorker } from "../RegisterWorker";

let timeline: ImdlTimeline | undefined;

export interface ParseImdlWorker {
  setTimeline(timeline: RenderSchedule.ScriptProps | RenderSchedule.ModelTimelineProps): void;
  parse(options: Omit<ImdlParserOptions, "timeline" | "stream"> & { data: Uint8Array }): ImdlModel.Document | ImdlParseError;
}

registerWorker<ParseImdlWorker>({
  parse: (options: Omit<ImdlParserOptions, "timeline" | "stream"> & { data: Uint8Array }) => {
    const result = parseImdlDocument({
      ...options,
      stream: ByteStream.fromUint8Array(options.data),
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
