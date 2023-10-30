/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { convertToReadableSpans } from "../presentation-opentelemetry";
import { SpanContext, SpanKind, SpanStatusCode, TraceFlags } from "@opentelemetry/api";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { Resource } from "@opentelemetry/resources";

describe("convertToReadableSpans", () => {

  const defaultSpanAttributes = {
    attributes: {},
    ended: true,
    events: [],
    instrumentationLibrary: { name: "" },
    kind: SpanKind.INTERNAL,
    links: [],
    resource: new Resource({ [SemanticResourceAttributes.SERVICE_NAME]: "iTwin.js Presentation" }),
    status: { code: SpanStatusCode.UNSET },
  };

  it("converts empty logs to empty readable spans", () => {
    expect(convertToReadableSpans({})).to.be.empty;
    expect(convertToReadableSpans({ logs: [] })).to.be.empty;
  });

  it("does not include logs when duration not set", () => {
    const spans = convertToReadableSpans({
      logs: [
        { scope: "test scope 1", scopeCreateTimestamp: 12345 },
      ],
    });

    expect(spans).to.deep.eq([]);
  });

  it("does not include logs when scopeCreateTimestamp not set", () => {
    const spans = convertToReadableSpans({
      logs: [
        { scope: "test scope 1", duration: 100 },
      ],
    });

    expect(spans).to.deep.eq([]);
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

    expect(actualSpans.length).to.eq(2);
    expect(actualSpans[0]).to.deep.include(expectedSpans[0]);
    expect(actualSpans[1]).to.deep.include(expectedSpans[1]);
    expect(actualSpans[0].spanContext().traceId).to.not.eq(actualSpans[1].spanContext().traceId);
    expect(actualSpans[0].spanContext().spanId.length).to.eq(16);
    expect(actualSpans[0].spanContext().traceId.length).to.eq(32);
  });

  it("converts logs to readable spans when parent span id is provided", () => {
    const parentSpanContext: SpanContext = { traceId: "testTraceId", spanId: "testSpanId", traceFlags: TraceFlags.NONE };
    const actualSpans = convertToReadableSpans({
      logs: [
        { scope: "test scope 1", scopeCreateTimestamp: 12345, duration: 1111 },
      ],
    }, parentSpanContext);

    const expectedSpans = [
      {
        ...defaultSpanAttributes,
        name: "test scope 1",
        startTime: [12, 345000000],
        endTime: [13, 456000000],
        duration: [1, 111000000],
      },
    ];

    expect(actualSpans.length).to.be.eq(1);
    expect(actualSpans[0]).to.deep.include(expectedSpans[0]);
    expect(actualSpans[0].spanContext().traceId).to.eq(parentSpanContext.traceId);
    expect(actualSpans[0].parentSpanId).to.be.eq(parentSpanContext.spanId);
  });

  it("adds span attributes", () => {
    const actualSpans = convertToReadableSpans({
      logs: [{
        scope: "test scope 1",
        scopeCreateTimestamp: 12345,
        duration: 1111,
        attributes: {
          stringAttribute: "stringAttributeValue",
          stringArrayAttribute: ["value1", "value2"],
        },
      }],
    });

    const expectedSpans = [
      {
        ...defaultSpanAttributes,
        attributes: {
          stringAttribute: "stringAttributeValue",
          stringArrayAttribute: ["value1", "value2"],
        },
        name: "test scope 1",
        startTime: [12, 345000000],
        endTime: [13, 456000000],
        duration: [1, 111000000],
      },
    ];

    expect(actualSpans.length).to.eq(1);
    expect(actualSpans[0]).to.deep.include(expectedSpans[0]);
  });

  it("converts nested logs to readable spans", () => {
    const actualSpans = convertToReadableSpans({
      logs: [
        {
          scope: "test scope 1", scopeCreateTimestamp: 12345, duration: 1111, logs: [
            { scope: "test scope 2", scopeCreateTimestamp: 12350, duration: 40 },
          ],
        },
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
        {
          scope: "test scope", scopeCreateTimestamp: 12345, duration: 1111, logs: [
            { severity: { dev: "error", editor: "info" }, message: "test message", category: "test category", timestamp: 12350 },
          ],
        },
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
        {
          scope: "test scope", scopeCreateTimestamp: 12345, duration: 1111, logs: [
            { severity: {}, message: "test message", category: "test category", timestamp: 12350 },
          ],
        },
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
