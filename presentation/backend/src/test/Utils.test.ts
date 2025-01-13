/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import * as moq from "typemoq";
import { ECSqlStatement, ECSqlValue, IModelDb } from "@itwin/core-backend";
import { DbResult } from "@itwin/core-bentley";
import { createRandomId } from "@itwin/presentation-common/lib/cjs/test";
import { combineDiagnosticsOptions, getElementKey, getLocalizedStringEN, normalizeVersion, reportDiagnostics } from "../presentation-backend/Utils";

describe("getElementKey", () => {
  const imodel = moq.Mock.ofType<IModelDb>();
  const stmt = moq.Mock.ofType<ECSqlStatement>();

  beforeEach(() => {
    stmt.reset();
    imodel.reset();
    imodel
      .setup((x) => x.withPreparedStatement(moq.It.isAnyString(), moq.It.isAny()))
      .callback((_query: string, cb: (stmt: ECSqlStatement) => void) => {
        cb(stmt.object);
      });
  });

  it("returns valid key for existing id", () => {
    const id = createRandomId();

    const sqlQueryResult = moq.Mock.ofType<ECSqlValue>();
    sqlQueryResult.setup((x) => x.getClassNameForClassId()).returns(() => "schema.class");

    stmt.setup((x) => x.bindId(1, id)).verifiable(moq.Times.once());
    stmt
      .setup((x) => x.step())
      .returns(() => DbResult.BE_SQLITE_ROW)
      .verifiable(moq.Times.once());
    stmt
      .setup((x) => x.getValue(0))
      .returns(() => sqlQueryResult.object)
      .verifiable(moq.Times.once());

    const result = getElementKey(imodel.object, id);
    stmt.verifyAll();
    expect(result).to.deep.eq({ className: "schema:class", id });
  });

  it("returns undefined for non-existing id", () => {
    const id = "does-not-exist";

    stmt.setup((x) => x.bindId(1, id)).verifiable(moq.Times.once());
    stmt
      .setup((x) => x.step())
      .returns(() => DbResult.BE_SQLITE_DONE)
      .verifiable(moq.Times.once());
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

describe("getLocalizedStringEN", () => {
  it("translates from Presentation", () => {
    expect(getLocalizedStringEN("Presentation:label.notSpecified")).to.be.eq("Not specified");
    expect(getLocalizedStringEN("Presentation:label.other")).to.be.eq("Other");
    expect(getLocalizedStringEN("Presentation:label.varies")).to.be.eq("Varies");
    expect(getLocalizedStringEN("Presentation:label.multipleInstances")).to.be.eq("Multiple items");
    expect(getLocalizedStringEN("Presentation:field.label")).to.be.eq("Label");
    expect(getLocalizedStringEN("Presentation:selectedItems.categoryLabel")).to.be.eq("Selected Item(s)");
    expect(getLocalizedStringEN("Presentation:selectedItems.categoryDescription")).to.be.eq("Contains properties of selected item(s)");
  });

  it("does not translate if key not found", () => {
    expect(getLocalizedStringEN("wrong:Label")).to.be.eq("wrong:Label");
    expect(getLocalizedStringEN("Presentation:label")).to.be.eq("Presentation:label");
    expect(getLocalizedStringEN("Presentation:label.non-existent")).to.be.eq("Presentation:label.non-existent");
  });
});

describe("combineDiagnosticsOptions", () => {
  const handler = sinon.spy();

  it("doesn't set `perf` if none of the arguments have it", () => {
    expect(combineDiagnosticsOptions({ perf: false, handler }, { perf: undefined, handler }, undefined)).to.be.undefined;
  });

  it("sets `perf` to the single truthy value", () => {
    expect(combineDiagnosticsOptions({ perf: true, handler }, undefined)).to.deep.eq({ perf: true });
    expect(combineDiagnosticsOptions({ perf: true, handler }, { perf: false, handler })).to.deep.eq({ perf: true });
    expect(combineDiagnosticsOptions({ perf: false, handler }, { perf: true, handler })).to.deep.eq({ perf: true });
    expect(combineDiagnosticsOptions({ perf: { minimumDuration: 123 }, handler }, { perf: false, handler })).to.deep.eq({ perf: { minimumDuration: 123 } });
    expect(combineDiagnosticsOptions({ perf: false, handler }, { perf: { minimumDuration: 456 }, handler })).to.deep.eq({ perf: { minimumDuration: 456 } });
  });

  it("sets `perf` to lower requirement", () => {
    expect(
      combineDiagnosticsOptions(
        { perf: { minimumDuration: 123 }, handler },
        { perf: { minimumDuration: 0 }, handler },
        { perf: { minimumDuration: 456 }, handler },
        { perf: true, handler },
      ),
    ).to.deep.eq({ perf: true });
    expect(
      combineDiagnosticsOptions(
        { perf: { minimumDuration: 123 }, handler },
        { perf: { minimumDuration: 0 }, handler },
        { perf: { minimumDuration: 456 }, handler },
      ),
    ).to.deep.eq({ perf: { minimumDuration: 0 } });
  });

  it("doesn't set `dev` if none of the arguments have it", () => {
    expect(combineDiagnosticsOptions({ dev: undefined, handler }, undefined)).to.be.undefined;
  });

  it("sets `dev` severity", () => {
    expect(combineDiagnosticsOptions({ handler }, { dev: "error", handler }, { dev: true, handler })).to.deep.eq({ dev: "debug" });
  });

  it("doesn't set `editor` if none of the arguments have it", () => {
    expect(combineDiagnosticsOptions({ editor: undefined, handler }, undefined)).to.be.undefined;
  });

  it("sets `editor` severity", () => {
    expect(combineDiagnosticsOptions({ handler }, { editor: "error", handler }, { editor: true, handler })).to.deep.eq({ editor: "debug" });
  });

  it("combines multiple attributes", () => {
    expect(
      combineDiagnosticsOptions({ handler }, { editor: "info", handler }, { dev: "error", handler }, { perf: { minimumDuration: 123 }, handler }),
    ).to.deep.eq({ editor: "info", dev: "error", perf: { minimumDuration: 123 } });
  });
});

describe("reportDiagnostics", () => {
  const handler = sinon.spy();

  beforeEach(() => {
    handler.resetHistory();
  });

  it("only calls handler when there are logs to be reported", () => {
    reportDiagnostics({}, { handler, perf: true, dev: "trace", editor: "trace" });
    expect(handler).to.not.be.called;
    reportDiagnostics({ logs: [] }, { handler, perf: true, dev: "trace", editor: "trace" });
    expect(handler).to.not.be.called;
  });

  it("calls handler with provided context", () => {
    const context = {};
    const diagnostics = { logs: [{ scope: "x", duration: 1 }] };
    reportDiagnostics(diagnostics, { handler, perf: true }, context);
    expect(handler).to.be.calledOnceWithExactly(diagnostics, context);
  });

  it("only includes entries matching given options", () => {
    reportDiagnostics(
      {
        logs: [
          {
            scope: "scope with higher duration",
            duration: 101,
          },
          {
            scope: "scope with equal duration",
            duration: 100,
          },
          {
            scope: "scope with lower duration",
            duration: 99,
          },
          {
            scope: "scope with equal duration and matching logs",
            duration: 100,
            logs: [
              {
                category: "test category",
                message: "matching dev severity",
                timestamp: 1,
                severity: { dev: "info" },
              },
              {
                category: "test category",
                message: "higher dev severity",
                timestamp: 2,
                severity: { dev: "warning" },
              },
              {
                category: "test category",
                message: "lower dev severity",
                timestamp: 3,
                severity: { dev: "trace" },
              },
              {
                category: "test category",
                message: "matching editor severity",
                timestamp: 4,
                severity: { editor: "warning" },
              },
              {
                category: "test category",
                message: "higher editor severity",
                timestamp: 5,
                severity: { editor: "error" },
              },
              {
                category: "test category",
                message: "lower editor severity",
                timestamp: 6,
                severity: { editor: "info" },
              },
              {
                category: "test category",
                message: "matching dev and editor severities",
                timestamp: 6,
                severity: { dev: "error", editor: "error" },
              },
            ],
          },
          {
            scope: "scope with equal duration and non-matching logs",
            duration: 100,
            logs: [
              {
                category: "test category",
                message: "non-matching severities",
                timestamp: 1,
                severity: {},
              },
            ],
          },
          {
            scope: "scope with lower duration and matching logs",
            duration: 1,
            logs: [
              {
                category: "test category",
                message: "matching severities",
                timestamp: 1,
                severity: { dev: "error", editor: "error" },
              },
            ],
          },
        ],
      },
      { handler, perf: { minimumDuration: 100 }, dev: "info", editor: "warning" },
    );
    expect(handler).to.be.calledOnce;
    expect(handler.firstCall.args[0]).to.deep.eq({
      logs: [
        {
          scope: "scope with higher duration",
          duration: 101,
        },
        {
          scope: "scope with equal duration",
          duration: 100,
        },
        {
          scope: "scope with equal duration and matching logs",
          duration: 100,
          logs: [
            {
              category: "test category",
              message: "matching dev severity",
              timestamp: 1,
              severity: { dev: "info" },
            },
            {
              category: "test category",
              message: "higher dev severity",
              timestamp: 2,
              severity: { dev: "warning" },
            },
            {
              category: "test category",
              message: "matching editor severity",
              timestamp: 4,
              severity: { editor: "warning" },
            },
            {
              category: "test category",
              message: "higher editor severity",
              timestamp: 5,
              severity: { editor: "error" },
            },
            {
              category: "test category",
              message: "matching dev and editor severities",
              timestamp: 6,
              severity: { dev: "error", editor: "error" },
            },
          ],
        },
        {
          scope: "scope with equal duration and non-matching logs",
          duration: 100,
        },
        {
          scope: "scope with lower duration and matching logs",
          logs: [
            {
              category: "test category",
              message: "matching severities",
              timestamp: 1,
              severity: { dev: "error", editor: "error" },
            },
          ],
        },
      ],
    });
  });

  it("includes zero duration scopes when requesting all performance diagnostics", () => {
    reportDiagnostics(
      {
        logs: [
          {
            scope: "zero duration scope",
            duration: 0,
            scopeCreateTimestamp: 123,
          },
        ],
      },
      { handler, perf: true },
    );
    expect(handler).to.be.calledOnce;
    expect(handler.firstCall.args[0]).to.deep.eq({
      logs: [
        {
          scope: "zero duration scope",
          duration: 0,
          scopeCreateTimestamp: 123,
        },
      ],
    });
  });
});
