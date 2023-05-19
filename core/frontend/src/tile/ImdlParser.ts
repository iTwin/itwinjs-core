/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { assert, BeDuration, Dictionary } from "@itwin/core-bentley";
import { RenderSchedule } from "@itwin/core-common";
import {
  ImdlModel, ImdlParseError, ImdlParserOptions, ImdlTimeline, parseImdlDocument, WorkerProxy,
} from "../common";
import { IModelApp } from "../IModelApp";

export interface ImdlParser {
  parse(options: Omit<ImdlParserOptions, "timeline">): Promise<ImdlModel.Document | ImdlParseError>;
  release(): void;
}

export interface AcquireImdlParserArgs {
  timeline?: ImdlTimeline;
  noWorker?: boolean;
}

export function acquireImdlParser(args: AcquireImdlParserArgs): ImdlParser {
  const timeline = args.timeline;
  if (args.noWorker) {
    return {
      parse: (options) => Promise.resolve(parseImdlDocument({
        ...options,
        timeline,
      })),
      release: () => undefined,
    };
  }

  if (!args.timeline) {
    if (!defaultParser) {
      const worker = new WorkerProxy(`${IModelApp.publicPath}scripts/parse-imdl-worker.js`);
      defaultParser = {
        parse: (options) => worker.execute("parse", options, [options.stream.arrayBuffer]),
        release: () => undefined,
      };
    }

    return defaultParser;
  }

  let parser = parsersWithTimelines.get(args.timeline);
  if (!parser)
    parsersWithTimelines.set(args.timeline, parser = new ParserWithTimeline(args.timeline));

  assert(parser.refCount >= 0);
  ++parser.refCount;
  return parser;
}

let defaultParser: ImdlParser | undefined;

class ParserWithTimeline implements ImdlParser {
  public refCount = 0;
  private readonly _timeline: ImdlTimeline;
  private readonly _worker: WorkerProxy;

  public constructor(timeline: ImdlTimeline) {
    this._timeline = timeline;

    this._worker = new WorkerProxy(`${IModelApp.publicPath}scripts/parse-imdl-worker.js`);
    this._worker.post("setTimeline", timeline);
  }

  public async parse(options: Omit<ImdlParserOptions, "timeline">) {
    return this._worker.execute("parse", options, [options.stream.arrayBuffer]);
  }

  public release(): void {
    assert(this.refCount > 0);
    --this.refCount;
    if (this.refCount === 0) {
      parsersWithTimelines.delete(this._timeline);
      this._worker.terminate();
    }
  }
}

const parsersWithTimelines = new Dictionary<ImdlTimeline, ParserWithTimeline>((lhs, rhs) => {
  if (lhs instanceof RenderSchedule.ModelTimeline)
    return rhs instanceof RenderSchedule.ModelTimeline ? lhs.compareTo(rhs) : -1;

  return rhs instanceof RenderSchedule.Script ? lhs.compareTo(rhs) : 1;
});
