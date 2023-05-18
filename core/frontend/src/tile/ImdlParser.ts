/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { assert, Dictionary } from "@itwin/core-bentley";
import { RenderSchedule } from "@itwin/core-common";
import { ImdlModel, ImdlParseError, ImdlParserOptions, ImdlTimeline, parseImdlDocument } from "../common";

export interface ImdlParser {
  parse(options: ImdlParserOptions): Promise<ImdlModel.Document | ImdlParseError>;
  release(): void;
}

export interface AcquireImdlParserArgs {
  timeline?: ImdlTimeline;
  noWorker?: boolean;
}

export function acquireImdlParser(args: AcquireImdlParserArgs): ImdlParser {
  if (args.noWorker) {
    return {
      parse: (options) => Promise.resolve(parseImdlDocument(options)),
      release: () => undefined,
    };
  }

  if (!args.timeline) {
    return defaultParserWorker ?? (defaultParserWorker = {
      parse: (options) => Promise.resolve(parseImdlDocument(options)),
      release: () => undefined,
    });
  }

  let parser = parsersWithTimelines.get(args.timeline);
  if (!parser)
    parsersWithTimelines.set(args.timeline, parser = new ParserWithTimeline(args.timeline));

  assert(parser.refCount >= 0);
  ++parser.refCount;
  return parser;
}

let defaultParserWorker: ImdlParser | undefined;

class ParserWithTimeline implements ImdlParser {
  public refCount = 0;
  private readonly _timeline: ImdlTimeline;

  public constructor(timeline: ImdlTimeline) {
    this._timeline = timeline;
    // ###TODO allocate worker and post a message to set the timeline
  }

  public async parse(options: ImdlParserOptions) {
    return Promise.resolve(parseImdlDocument(options));
  }

  public release(): void {
    assert(this.refCount > 0);
    --this.refCount;
    if (this.refCount === 0)
      parsersWithTimelines.delete(this._timeline);
  }
}

const parsersWithTimelines = new Dictionary<ImdlTimeline, ParserWithTimeline>((lhs, rhs) => {
  if (lhs instanceof RenderSchedule.ModelTimeline)
    return rhs instanceof RenderSchedule.ModelTimeline ? lhs.compareTo(rhs) : -1;

  return rhs instanceof RenderSchedule.Script ? lhs.compareTo(rhs) : 1;
});
