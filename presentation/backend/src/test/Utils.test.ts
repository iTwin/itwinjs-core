/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as moq from "typemoq";
import { DbResult, SpanKind } from "@itwin/core-bentley";
import { ECSqlStatement, ECSqlValue, IModelDb } from "@itwin/core-backend";
import { createRandomId } from "@itwin/presentation-common/lib/cjs/test";
import { convertToReadableSpans, getElementKey, normalizeVersion } from "../presentation-backend/Utils";

describe("getElementKey", () => {

  const imodel = moq.Mock.ofType<IModelDb>();
  const stmt = moq.Mock.ofType<ECSqlStatement>();

  beforeEach(() => {
    stmt.reset();
    imodel.reset();
    imodel.setup((x) => x.withPreparedStatement(moq.It.isAnyString(), moq.It.isAny()))
      .callback((_query: string, cb: (stmt: ECSqlStatement) => void) => {
        cb(stmt.object);
      });
  });

  it("returns valid key for existing id", () => {
    const id = createRandomId();

    const sqlQueryResult = moq.Mock.ofType<ECSqlValue>();
    sqlQueryResult.setup((x) => x.getClassNameForClassId()).returns(() => "schema.class");

    stmt.setup((x) => x.bindId(1, id)).verifiable(moq.Times.once());
    stmt.setup((x) => x.step()).returns(() => DbResult.BE_SQLITE_ROW).verifiable(moq.Times.once());
    stmt.setup((x) => x.getValue(0)).returns(() => sqlQueryResult.object).verifiable(moq.Times.once());

    const result = getElementKey(imodel.object, id);
    stmt.verifyAll();
    expect(result).to.deep.eq({ className: "schema:class", id });
  });

  it("returns undefined for non-existing id", () => {
    const id = "does-not-exist";

    stmt.setup((x) => x.bindId(1, id)).verifiable(moq.Times.once());
    stmt.setup((x) => x.step()).returns(() => DbResult.BE_SQLITE_DONE).verifiable(moq.Times.once());
    stmt.setup((x) => x.getValue(0)).verifiable(moq.Times.never());

    const result = getElementKey(imodel.object, id);
    stmt.verifyAll();
    expect(result).to.be.undefined;
  });

});

describe("getNormalizedVersion", () => {

  it("returns normalized version", () => {
    expect(normalizeVersion(undefined)).to.eq("0.0.0");
    expect(normalizeVersion("1.2.3")).to.eq("1.2.3");
    expect(normalizeVersion("01.002.0003")).to.eq("1.2.3");
  });

  it("returns `0.0.0` on invalid version string", () => {
    expect(normalizeVersion("invalid")).to.eq("0.0.0");
  });

});

describe("convertToReadableSpans", () => {

  const defaultSpanAttributes = {
    attributes: {},
    ended: true,
    events: [],
    instrumentationLibrary: { name: "" },
    kind: SpanKind.INTERNAL,
    links: [],
    resource: { attributes: { "service.name": "iTwin.js Presentation" } },
    status: { code: 0 },
  };

  it("converts empty logs to empty readable spans", () => {
    expect(convertToReadableSpans({})).to.be.empty;
    expect(convertToReadableSpans({ logs: [] })).to.be.empty;
  });

  it("converts logs to readable spans", () => {
    const actualSpans = convertToReadableSpans({
      logs: [
        { scope: "test scope 1", scopeCreateTimestamp: 12345, duration: 1111 },
        { scope: "test scope 2", scopeCreateTimestamp: 12350, duration: 40 },
      ],
    });

    const expectedSpans = [
      {
        ...defaultSpanAttributes,
        name: "test scope 1",
        startTime: [12, 345000000],
        endTime: [13, 456000000],
        duration: [1, 111000000],
      },
      {
        ...defaultSpanAttributes,
        name: "test scope 2",
        startTime: [12, 350000000],
        endTime: [12, 390000000],
        duration: [0, 40000000],
      },
    ];

    expect(actualSpans.length).to.be.eq(2);
    expect(actualSpans[0]).to.deep.include(expectedSpans[0]);
    expect(actualSpans[1]).to.deep.include(expectedSpans[1]);
    expect(actualSpans[0].spanContext().traceId).to.not.eq(actualSpans[1].spanContext().traceId);
  });

  it("converts nested logs to readable spans", () => {
    const actualSpans = convertToReadableSpans({
      logs: [
        { scope: "test scope 1", scopeCreateTimestamp: 12345, duration: 1111, logs: [
          { scope: "test scope 2", scopeCreateTimestamp: 12350, duration: 40 },
        ]},
      ],
    });

    const expectedSpans = [
      {
        ...defaultSpanAttributes,
        name: "test scope 2",
        startTime: [12, 350000000],
        endTime: [12, 390000000],
        duration: [0, 40000000],
      },
      {
        ...defaultSpanAttributes,
        name: "test scope 1",
        startTime: [12, 345000000],
        endTime: [13, 456000000],
        duration: [1, 111000000],
      },
    ];

    expect(actualSpans.length).to.be.eq(2);
    expect(actualSpans[0]).to.deep.include(expectedSpans[0]);
    expect(actualSpans[1]).to.deep.include(expectedSpans[1]);
    expect(actualSpans[0].spanContext().traceId).to.eq(actualSpans[1].spanContext().traceId);
    expect(actualSpans[0].parentSpanId).to.be.eq(actualSpans[1].spanContext().spanId);
  });

  it("converts logs with messages to readable spans with events", () => {
    const actualSpans = convertToReadableSpans({
      logs: [
        { scope: "test scope", scopeCreateTimestamp: 12345, duration: 1111, logs: [
          { severity: { dev: "error", editor: "info" }, message: "test message", category: "test category", timestamp: 12350 },
        ]},
      ],
    });

    const expectedSpans = [
      {
        ...defaultSpanAttributes,
        name: "test scope",
        startTime: [12, 345000000],
        endTime: [13, 456000000],
        duration: [1, 111000000],
        events: [{
          time: [12, 350000000],
          name: "test message",
          attributes: {
            devSeverity: "error",
            editorSeverity: "info",
            category: "test category",
          },
        }],
      },
    ];

    expect(actualSpans.length).to.be.eq(1);
    expect(actualSpans[0]).to.deep.include(expectedSpans[0]);
  });

});
