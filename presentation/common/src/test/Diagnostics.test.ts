/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { DiagnosticsLogEntry, DiagnosticsLogMessage, DiagnosticsScopeLogs } from "../presentation-common/Diagnostics";

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
