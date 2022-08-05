/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as moq from "typemoq";
import { DbResult, SpanKind } from "@itwin/core-bentley";
import { ECSqlStatement, ECSqlValue, IModelDb } from "@itwin/core-backend";
import { createRandomId } from "@itwin/presentation-common/lib/cjs/test";
import { convertToReadableSpans, filterDiagnostics, getElementKey, normalizeVersion, Resource, SpanStatusCode } from "../presentation-backend/Utils";
import { Diagnostics } from "@itwin/presentation-common";

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

describe("filterDiagnostics", () => {

  it("returns undefined when diagnostics don't have logs", () => {
    expect(filterDiagnostics({})).to.be.undefined;
  });

  it("returns undefined when all logs removed", () => {
    const diagnostics: Diagnostics = { logs: [
      { scope: "test scope 1", scopeCreateTimestamp: 12345, duration: 200 },
    ]};
    expect(filterDiagnostics(diagnostics, 500)).to.be.undefined;
  });

  it("uses default duration when duration not passed", () => {
    const diagnostics: Diagnostics = { logs: [
      { scope: "test scope 1", scopeCreateTimestamp: 12345, duration: 1111, logs: [
        { scope: "test scope 2", scopeCreateTimestamp: 12350, duration: 40 },
      ]},
    ]};

    const expectedResult: Diagnostics = { logs: [
      { scope: "test scope 1", scopeCreateTimestamp: 12345, duration: 1111 },
    ]};

    const actualResult = filterDiagnostics(diagnostics);
    expect(actualResult).to.deep.eq(expectedResult);
  });

  it("uses default duration when passed duration is too small", () => {
    const diagnostics: Diagnostics = { logs: [
      { scope: "test scope 1", scopeCreateTimestamp: 12345, duration: 1111, logs: [
        { scope: "test scope 2", scopeCreateTimestamp: 12350, duration: 40 },
      ]},
    ]};

    const expectedResult: Diagnostics = { logs: [
      { scope: "test scope 1", scopeCreateTimestamp: 12345, duration: 1111 },
    ]};

    const actualResult = filterDiagnostics(diagnostics, 20);
    expect(actualResult).to.deep.eq(expectedResult);
  });

  it("filters diagnostics by duration", () => {
    const diagnostics: Diagnostics = { logs: [
      { scope: "test scope 1", scopeCreateTimestamp: 12345, duration: 1111, logs: [
        { scope: "test scope 2", scopeCreateTimestamp: 12350, duration: 500 },
        { scope: "test scope 3", scopeCreateTimestamp: 12400, duration: 700, logs: [
          { scope: "test scope 4", scopeCreateTimestamp: 12400, duration: 200 },
        ]},
      ]},
    ]};

    const expectedResult: Diagnostics = { logs: [
      { scope: "test scope 1", scopeCreateTimestamp: 12345, duration: 1111, logs: [
        { scope: "test scope 3", scopeCreateTimestamp: 12400, duration: 700 },
      ]},
    ]};

    const actualResult = filterDiagnostics(diagnostics, 600);
    expect(actualResult).to.deep.eq(expectedResult);
  });

  it("includes messages", () => {
    const diagnostics: Diagnostics = { logs: [
      { scope: "test scope 1", scopeCreateTimestamp: 12345, duration: 10, logs: [
        { severity: { dev: "error", editor: "info" }, message: "test message", category: "test category", timestamp: 12350 },
      ]},
    ]};

    const expectedResult: Diagnostics = { logs: [
      { scope: "test scope 1", scopeCreateTimestamp: 12345, duration: 10, logs: [
        { severity: { dev: "error", editor: "info" }, message: "test message", category: "test category", timestamp: 12350 },
      ]},
    ]};

    const actualResult = filterDiagnostics(diagnostics, 2000);
    expect(actualResult).to.deep.eq(expectedResult);
  });

});

describe("Resource", () => {

  it("creates resource with attributes", () => {
    const attributes = { a: "value" };
    const resource = new Resource(attributes);
    expect(resource.attributes).to.eq(attributes);
  });

  it("merges with null resource", () => {
    const resource = new Resource({ a: "value" });
    expect(resource.merge(null).attributes).to.deep.eq({ a: "value" });
  });

  it("merges resources", () => {
    const resource1 = new Resource({ a: "value1", b: "value2" });
    const resource2 = new Resource({ b: "value3", c: "value4" });
    expect(resource1.merge(resource2).attributes).to.deep.eq({  a: "value1", b: "value3", c: "value4" });
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
    status: { code: SpanStatusCode.UNSET },
  };

  it("converts empty logs to empty readable spans", () => {
    expect(convertToReadableSpans({})).to.be.empty;
    expect(convertToReadableSpans({ logs: [] })).to.be.empty;
  });

  it("does not include logs when duration not set", () => {
    const spans = convertToReadableSpans({ logs: [
      { scope: "test scope 1", scopeCreateTimestamp: 12345 },
    ]});

    expect(spans).to.deep.eq([]);
  });

  it("does not include logs when scopeCreateTimestamp not set", () => {
    const spans = convertToReadableSpans({ logs: [
      { scope: "test scope 1", duration: 100 },
    ]});

    expect(spans).to.deep.eq([]);
  });

  it("converts logs to readable spans", () => {
    const actualSpans = convertToReadableSpans({
      logs: [
        { scope: "test scope 1", scopeCreateTimestamp: 12345, duration: 1111 },
        { scope: "test scope 2", scopeCreateTimestamp: 12350, duration: 40, rules: ["rule1", "rule2"] },
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
        attributes: { rules: ["rule1", "rule2"] },
        name: "test scope 2",
        startTime: [12, 350000000],
        endTime: [12, 390000000],
        duration: [0, 40000000],
      },
    ];

    expect(actualSpans.length).to.eq(2);
    expect(actualSpans[0]).to.deep.include(expectedSpans[0]);
    expect(actualSpans[1]).to.deep.include(expectedSpans[1]);
    expect(actualSpans[0].spanContext().traceId).to.not.eq(actualSpans[1].spanContext().traceId);
    expect(actualSpans[0].spanContext().spanId.length).to.eq(16);
    expect(actualSpans[0].spanContext().traceId.length).to.eq(32);
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

  it("does not include undefined severity attributes", () => {
    const actualSpans = convertToReadableSpans({
      logs: [
        { scope: "test scope", scopeCreateTimestamp: 12345, duration: 1111, logs: [
          { severity: {}, message: "test message", category: "test category", timestamp: 12350 },
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
            category: "test category",
          },
        }],
      },
    ];

    expect(actualSpans.length).to.be.eq(1);
    expect(actualSpans[0]).to.deep.include(expectedSpans[0]);
    expect(actualSpans[0].events[0].attributes).to.not.have.property("devSeverity");
    expect(actualSpans[0].events[0].attributes).to.not.have.property("editorSeverity");
  });

});
