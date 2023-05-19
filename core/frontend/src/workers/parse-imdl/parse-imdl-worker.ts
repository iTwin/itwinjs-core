/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "@itwin/core-bentley";
import { RenderSchedule } from "@itwin/core-common";
import { ImdlParserOptions, ImdlTimeline, parseImdlDocument } from "../../common";
import { registerWorker, WorkerRequest } from "../RegisterWorker";

let timeline: ImdlTimeline | undefined;

interface SetTimelineRequest {
  operation: "setTimeline";
  payload: {
    timeline: RenderSchedule.ModelTimelineProps;
    script?: never;
  } | {
    script: RenderSchedule.ScriptProps;
    timeline?: never;
  };
}

interface ParseRequest {
  operation: "parse";
  payload: ImdlParserOptions;
}

registerWorker((request: ParseRequest | SetTimelineRequest) => {
  switch (request.operation) {
    case "parse":
      return parseImdlDocument({ ...request.payload, timeline });
    case "setTimeline":
      assert(undefined === timeline, "setTimeline must be called only once");
      timeline = request.payload.script ? RenderSchedule.Script.fromJSON(request.payload.script) : RenderSchedule.ModelTimeline.fromJSON(request.payload.timeline);
      return undefined;
  }
});
