/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { RenderSchedule as RS } from "@itwin/core-common";
import { ImdlTimeline } from "../../common";
import { acquireImdlParser, ImdlParser, AcquireImdlParserArgs } from "../../tile/internal";

describe("acquireImdlParser", () => {
  const model1Props: RS.ModelTimelineProps = { modelId: "0x1", elementTimelines: [] };
  const model2Props: RS.ModelTimelineProps = { modelId: "0x2", elementTimelines: [] };
  const script1Props: RS.ScriptProps = [{ ...model1Props }];
  const script2Props: RS.ScriptProps = [{ ...model2Props }];

  it("returns the same parser every time if no timeline, even after the parser is released", () => {
    const parser = acquireImdlParser({});
    expect(acquireImdlParser({})).to.equal(parser);

    parser.release();
    expect(acquireImdlParser({})).to.equal(parser);
  });

  function acquire(timeline: ImdlTimeline) {
    return acquireImdlParser({ timeline });
  }

  it("returns the same parser for equivalent timelines", () => {
    const model = RS.ModelTimeline.fromJSON(model1Props);

    const modelParser = acquire(model);
    expect(acquire(model)).to.equal(modelParser);
    expect(acquire(RS.ModelTimeline.fromJSON(model1Props))).to.equal(modelParser);

    const script = RS.Script.fromJSON(script2Props)!;
    const scriptParser = acquire(script);
    expect(acquire(script)).to.equal(scriptParser);
    expect(acquire(RS.Script.fromJSON(script2Props)!)).to.equal(scriptParser);

    modelParser.release();
    modelParser.release();
    modelParser.release();
    scriptParser.release();
    scriptParser.release();
    scriptParser.release();
  });

  it("returns different parsers for different timelines", () => {
    const m1 = acquire(RS.ModelTimeline.fromJSON(model1Props));
    const m2 = acquire(RS.ModelTimeline.fromJSON(model2Props));
    expect(m1).not.to.equal(m2);

    const s1 = acquire(RS.Script.fromJSON(script1Props)!);
    const s2 = acquire(RS.Script.fromJSON(script2Props)!);
    expect(s1).not.to.equal(s2);

    m1.release();
    m2.release();
    s1.release();
    s2.release();
  });

  it("returns a new parser for the same timeline after original parser is released", () => {
    const m = RS.ModelTimeline.fromJSON(model1Props);
    const mp1 = acquire(m); // ref-count = 1
    const mp2 = acquire(m); // ref-count = 2
    expect(mp1).to.equal(mp2);

    mp1.release(); // ref-count = 1
    const mp3 = acquire(m); // ref-count = 2
    expect(mp3).to.equal(mp1);

    mp1.release(); // ref-count = 1
    mp1.release(); // ref-count = 0
    const mp4 = acquire(m);
    expect(mp4).not.to.equal(mp1);
    expect(acquire(m)).to.equal(mp4);

    mp4.release();
    mp4.release();

    const s = RS.Script.fromJSON(script1Props)!;
    const sp1 = acquire(s); // ref-count = 1
    const sp2 = acquire(s); // ref-count = 2
    expect(sp1).to.equal(sp2);

    sp1.release(); // ref-count = 1
    const sp3 = acquire(s); // ref-count = 2
    expect(sp3).to.equal(sp1);

    sp1.release(); // ref-count = 1
    sp1.release(); // ref-count = 0
    const sp4 = acquire(s);
    expect(sp4).not.to.equal(sp1);
    expect(acquire(s)).to.equal(sp4);

    sp4.release();
    sp4.release();
  });

  it("returns a different parser each time if not using web worker", () => {
    const parsers = new Set<ImdlParser>();
    const getParser = (timeline?: ImdlTimeline) => {
      const parser = acquireImdlParser({ noWorker: true, timeline });
      expect(parsers.has(parser)).to.be.false;
      parsers.add(parser);
    };

    getParser();
    getParser();
    const model = RS.ModelTimeline.fromJSON(model1Props);
    getParser(model);
    getParser(model);
    const script = RS.Script.fromJSON(script2Props);
    getParser(script);
    getParser(script);
  });
});
