/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import {
  combineDiagnosticsSeverities,
  compareDiagnosticsSeverities,
  DiagnosticsLogEntry,
  DiagnosticsLogMessage,
  DiagnosticsScopeLogs,
} from "../presentation-common/Diagnostics";

describe("DiagnosticsLogEntry", () => {
  const createMessage = (): DiagnosticsLogMessage => ({
    severity: {
      dev: "info",
      editor: "warning",
    },
    category: "test",
    message: "test",
    timestamp: 999,
  });

  const createScope = (): DiagnosticsScopeLogs => ({
    scope: "test",
    duration: 999,
    logs: [],
  });

  describe("isMessage", () => {
    it("returns correct results", () => {
      expect(DiagnosticsLogEntry.isMessage(createMessage())).to.be.true;
      expect(DiagnosticsLogEntry.isMessage(createScope())).to.be.false;
    });
  });

  describe("isScope", () => {
    it("returns correct results", () => {
      expect(DiagnosticsLogEntry.isScope(createMessage())).to.be.false;
      expect(DiagnosticsLogEntry.isScope(createScope())).to.be.true;
    });
  });
});

describe("combineDiagnosticsSeverities", () => {
  it("returns `undefined` when both inputs are falsy", () => {
    expect(combineDiagnosticsSeverities(undefined, undefined)).to.be.undefined;
    expect(combineDiagnosticsSeverities(false, false)).to.be.undefined;
    expect(combineDiagnosticsSeverities(undefined, false)).to.be.undefined;
    expect(combineDiagnosticsSeverities(false, undefined)).to.be.undefined;
  });

  it('returns "error" when any of the inputs is "error"', () => {
    expect(combineDiagnosticsSeverities("error", "error")).to.eq("error");
    expect(combineDiagnosticsSeverities("error", undefined)).to.eq("error");
    expect(combineDiagnosticsSeverities("error", false)).to.eq("error");
    expect(combineDiagnosticsSeverities(undefined, "error")).to.eq("error");
    expect(combineDiagnosticsSeverities(false, "error")).to.eq("error");
  });

  it('returns "warning" when any of the inputs is "warning" or higher', () => {
    expect(combineDiagnosticsSeverities("warning", "warning")).to.eq("warning");
    expect(combineDiagnosticsSeverities("warning", undefined)).to.eq("warning");
    expect(combineDiagnosticsSeverities("warning", false)).to.eq("warning");
    expect(combineDiagnosticsSeverities("warning", "error")).to.eq("warning");
    expect(combineDiagnosticsSeverities(undefined, "warning")).to.eq("warning");
    expect(combineDiagnosticsSeverities(false, "warning")).to.eq("warning");
    expect(combineDiagnosticsSeverities("error", "warning")).to.eq("warning");
  });

  it('returns "info" when any of the inputs is "info" or higher', () => {
    expect(combineDiagnosticsSeverities("info", "info")).to.eq("info");
    expect(combineDiagnosticsSeverities("info", undefined)).to.eq("info");
    expect(combineDiagnosticsSeverities("info", false)).to.eq("info");
    expect(combineDiagnosticsSeverities("info", "error")).to.eq("info");
    expect(combineDiagnosticsSeverities("info", "warning")).to.eq("info");
    expect(combineDiagnosticsSeverities(undefined, "info")).to.eq("info");
    expect(combineDiagnosticsSeverities(false, "info")).to.eq("info");
    expect(combineDiagnosticsSeverities("error", "info")).to.eq("info");
    expect(combineDiagnosticsSeverities("warning", "info")).to.eq("info");
  });

  it('returns "debug" when any of the inputs is "debug" or higher', () => {
    expect(combineDiagnosticsSeverities("debug", "debug")).to.eq("debug");
    expect(combineDiagnosticsSeverities("debug", undefined)).to.eq("debug");
    expect(combineDiagnosticsSeverities("debug", false)).to.eq("debug");
    expect(combineDiagnosticsSeverities("debug", "error")).to.eq("debug");
    expect(combineDiagnosticsSeverities("debug", "warning")).to.eq("debug");
    expect(combineDiagnosticsSeverities("debug", "info")).to.eq("debug");
    expect(combineDiagnosticsSeverities(undefined, "debug")).to.eq("debug");
    expect(combineDiagnosticsSeverities(false, "debug")).to.eq("debug");
    expect(combineDiagnosticsSeverities("error", "debug")).to.eq("debug");
    expect(combineDiagnosticsSeverities("warning", "debug")).to.eq("debug");
    expect(combineDiagnosticsSeverities("info", "debug")).to.eq("debug");
  });

  it('returns "debug" when any of the inputs is `true` or higher than "debug"', () => {
    expect(combineDiagnosticsSeverities(true, true)).to.eq("debug");
    expect(combineDiagnosticsSeverities(true, undefined)).to.eq("debug");
    expect(combineDiagnosticsSeverities(true, false)).to.eq("debug");
    expect(combineDiagnosticsSeverities(true, "error")).to.eq("debug");
    expect(combineDiagnosticsSeverities(true, "warning")).to.eq("debug");
    expect(combineDiagnosticsSeverities(true, "info")).to.eq("debug");
    expect(combineDiagnosticsSeverities(undefined, true)).to.eq("debug");
    expect(combineDiagnosticsSeverities(false, true)).to.eq("debug");
    expect(combineDiagnosticsSeverities("error", true)).to.eq("debug");
    expect(combineDiagnosticsSeverities("warning", true)).to.eq("debug");
    expect(combineDiagnosticsSeverities("info", true)).to.eq("debug");
  });

  it('returns "trace" when any of the inputs is "trace" or higher', () => {
    expect(combineDiagnosticsSeverities("trace", "trace")).to.eq("trace");
    expect(combineDiagnosticsSeverities("trace", undefined)).to.eq("trace");
    expect(combineDiagnosticsSeverities("trace", false)).to.eq("trace");
    expect(combineDiagnosticsSeverities("trace", "error")).to.eq("trace");
    expect(combineDiagnosticsSeverities("trace", "warning")).to.eq("trace");
    expect(combineDiagnosticsSeverities("trace", "info")).to.eq("trace");
    expect(combineDiagnosticsSeverities("trace", "debug")).to.eq("trace");
    expect(combineDiagnosticsSeverities(undefined, "trace")).to.eq("trace");
    expect(combineDiagnosticsSeverities(false, "trace")).to.eq("trace");
    expect(combineDiagnosticsSeverities("error", "trace")).to.eq("trace");
    expect(combineDiagnosticsSeverities("warning", "trace")).to.eq("trace");
    expect(combineDiagnosticsSeverities("info", "trace")).to.eq("trace");
    expect(combineDiagnosticsSeverities("debug", "trace")).to.eq("trace");
  });
});

describe("compareDiagnosticsSeverities", () => {
  it("returns 0 when given same arguments", () => {
    expect(compareDiagnosticsSeverities(undefined, undefined)).to.eq(0);
    expect(compareDiagnosticsSeverities(false, false)).to.eq(0);
    expect(compareDiagnosticsSeverities(undefined, false)).to.eq(0);
    expect(compareDiagnosticsSeverities(false, undefined)).to.eq(0);
    expect(compareDiagnosticsSeverities(false, "error")).to.eq(0);
    expect(compareDiagnosticsSeverities("error", false)).to.eq(0);
    expect(compareDiagnosticsSeverities(undefined, "error")).to.eq(0);
    expect(compareDiagnosticsSeverities("error", undefined)).to.eq(0);
    expect(compareDiagnosticsSeverities("warning", "warning")).to.eq(0);
    expect(compareDiagnosticsSeverities("info", "info")).to.eq(0);
    expect(compareDiagnosticsSeverities("debug", "debug")).to.eq(0);
    expect(compareDiagnosticsSeverities("debug", true)).to.eq(0);
    expect(compareDiagnosticsSeverities(true, "debug")).to.eq(0);
    expect(compareDiagnosticsSeverities("trace", "trace")).to.eq(0);
  });

  it("returns positive when given lhs is higher severity than rhs", () => {
    expect(compareDiagnosticsSeverities(undefined, "warning")).to.be.greaterThan(0);
    expect(compareDiagnosticsSeverities(undefined, "info")).to.be.greaterThan(0);
    expect(compareDiagnosticsSeverities(undefined, "debug")).to.be.greaterThan(0);
    expect(compareDiagnosticsSeverities(undefined, true)).to.be.greaterThan(0);
    expect(compareDiagnosticsSeverities(undefined, "trace")).to.be.greaterThan(0);

    expect(compareDiagnosticsSeverities(false, "warning")).to.be.greaterThan(0);
    expect(compareDiagnosticsSeverities(false, "info")).to.be.greaterThan(0);
    expect(compareDiagnosticsSeverities(false, "debug")).to.be.greaterThan(0);
    expect(compareDiagnosticsSeverities(false, true)).to.be.greaterThan(0);
    expect(compareDiagnosticsSeverities(false, "trace")).to.be.greaterThan(0);

    expect(compareDiagnosticsSeverities("error", "warning")).to.be.greaterThan(0);
    expect(compareDiagnosticsSeverities("error", "info")).to.be.greaterThan(0);
    expect(compareDiagnosticsSeverities("error", "debug")).to.be.greaterThan(0);
    expect(compareDiagnosticsSeverities("error", true)).to.be.greaterThan(0);
    expect(compareDiagnosticsSeverities("error", "trace")).to.be.greaterThan(0);

    expect(compareDiagnosticsSeverities("warning", "info")).to.be.greaterThan(0);
    expect(compareDiagnosticsSeverities("warning", "debug")).to.be.greaterThan(0);
    expect(compareDiagnosticsSeverities("warning", true)).to.be.greaterThan(0);
    expect(compareDiagnosticsSeverities("warning", "trace")).to.be.greaterThan(0);

    expect(compareDiagnosticsSeverities("info", "debug")).to.be.greaterThan(0);
    expect(compareDiagnosticsSeverities("info", true)).to.be.greaterThan(0);
    expect(compareDiagnosticsSeverities("info", "trace")).to.be.greaterThan(0);

    expect(compareDiagnosticsSeverities("debug", "trace")).to.be.greaterThan(0);
  });

  it("returns negative when given lhs is lower severity than rhs", () => {
    expect(compareDiagnosticsSeverities("trace", "debug")).to.be.lessThan(0);
    expect(compareDiagnosticsSeverities("trace", true)).to.be.lessThan(0);
    expect(compareDiagnosticsSeverities("trace", "info")).to.be.lessThan(0);
    expect(compareDiagnosticsSeverities("trace", "warning")).to.be.lessThan(0);
    expect(compareDiagnosticsSeverities("trace", "error")).to.be.lessThan(0);
    expect(compareDiagnosticsSeverities("trace", false)).to.be.lessThan(0);
    expect(compareDiagnosticsSeverities("trace", undefined)).to.be.lessThan(0);

    expect(compareDiagnosticsSeverities("debug", "info")).to.be.lessThan(0);
    expect(compareDiagnosticsSeverities("debug", "warning")).to.be.lessThan(0);
    expect(compareDiagnosticsSeverities("debug", "error")).to.be.lessThan(0);
    expect(compareDiagnosticsSeverities("debug", false)).to.be.lessThan(0);
    expect(compareDiagnosticsSeverities("debug", undefined)).to.be.lessThan(0);

    expect(compareDiagnosticsSeverities(true, "info")).to.be.lessThan(0);
    expect(compareDiagnosticsSeverities(true, "warning")).to.be.lessThan(0);
    expect(compareDiagnosticsSeverities(true, "error")).to.be.lessThan(0);
    expect(compareDiagnosticsSeverities(true, false)).to.be.lessThan(0);
    expect(compareDiagnosticsSeverities(true, undefined)).to.be.lessThan(0);

    expect(compareDiagnosticsSeverities("info", "warning")).to.be.lessThan(0);
    expect(compareDiagnosticsSeverities("info", "error")).to.be.lessThan(0);
    expect(compareDiagnosticsSeverities("info", false)).to.be.lessThan(0);
    expect(compareDiagnosticsSeverities("info", undefined)).to.be.lessThan(0);

    expect(compareDiagnosticsSeverities("warning", "error")).to.be.lessThan(0);
    expect(compareDiagnosticsSeverities("warning", false)).to.be.lessThan(0);
    expect(compareDiagnosticsSeverities("warning", undefined)).to.be.lessThan(0);
  });
});
