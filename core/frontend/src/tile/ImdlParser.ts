/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { assert, Dictionary } from "@itwin/core-bentley";
import { RenderSchedule } from "@itwin/core-common";
import { createWorkerProxy, WorkerProxy } from "../common/WorkerProxy";
import { ImdlModel } from "../common/imdl/ImdlModel";
import { ImdlParseError, ImdlParserOptions, ImdlTimeline, parseImdlDocument } from "../common/imdl/ParseImdlDocument";
import { ParseImdlWorker } from "../workers/ImdlParser/Worker";
import { IModelApp } from "../IModelApp";

/** An object that can parse binary iMdl content into an iMdl document on a worker thread.
 * Parsers are reference-counted. Their lifetimes are typically managed by an [[ImdlDecoder]].
 * The caller is responsible for invoking [[release]] to decrement the reference count when they are finished using the parsing.
 * @see [[acquireImdlDecoder]] to acquire a decoder that uses a parser internally.
 * @see [[acquireImdlParser]] to obtain a parser directly (but you probably don't need to do that).
 * @internal
 */
export interface ImdlParser {
  parse(options: ImdlParserOptions): Promise<ImdlModel.Document | ImdlParseError>;
  release(): void;
}

/** Arguments supplied to [[acquireImdlParser]].
 * @internal
 */
export interface AcquireImdlParserArgs {
  timeline?: ImdlTimeline;
  noWorker?: boolean;
}

type ParserProxy = WorkerProxy<ParseImdlWorker>;

/** @internal */
export function acquireImdlParser(args: AcquireImdlParserArgs): ImdlParser {
  const timeline = args.timeline;
  if (args.noWorker) {
    return {
      parse: async (options) => Promise.resolve(parseImdlDocument({
        ...options,
        timeline,
      })),
      release: () => undefined,
    };
  }

  if (!args.timeline) {
    if (!defaultParser) {
      const worker = createWorkerProxy<ParseImdlWorker>(`${IModelApp.publicPath}scripts/parse-imdl-worker.js`);
      defaultParser = {
        parse: async (options) => worker.parse(options, [options.data.buffer]),
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
  private readonly _worker: ParserProxy;

  public constructor(timeline: ImdlTimeline) {
    this._timeline = timeline;
    this._worker = createWorkerProxy<ParseImdlWorker>(`${IModelApp.publicPath}scripts/parse-imdl-worker.js`);

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this._worker.setTimeline(timeline.toJSON());
  }

  public async parse(options: ImdlParserOptions) {
    return this._worker.parse(options, [options.data.buffer]);
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
