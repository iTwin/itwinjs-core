/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import { DiagnosticsScopeLogs } from "@itwin/presentation-common";
import { consoleDiagnosticsHandler, createCombinedDiagnosticsHandler } from "../presentation-frontend/Diagnostics";

describe("consoleDiagnosticsHandler", () => {

  const createConsoleSpies = () => ({
    error: sinon.stub(console, "error"),
    warn: sinon.stub(console, "warn"),
    log: sinon.stub(console, "log"),
  });

  afterEach(() => {
    sinon.restore();
  });

  it("log all messages", () => {
    const spies = createConsoleSpies();
    consoleDiagnosticsHandler([{
      scope: "scope1",
      logs: [{
        category: "test",
        timestamp: 0,
        message: "error",
        severity: { dev: "error" },
      }, {
        category: "test",
        timestamp: 0,
        message: "warning",
        severity: { editor: "warning" },
      }, {
        scope: "scope2",
        logs: [{
          category: "test",
          timestamp: 0,
          message: "info",
          severity: { dev: "info" },
        }, {
          category: "test",
          timestamp: 0,
          message: "debug",
          severity: { editor: "debug" },
        }, {
          category: "test",
          timestamp: 0,
          message: "trace",
          severity: { editor: "trace", dev: "trace" },
        }],
      }, {
        scope: "scope3",
      }],
    }]);
    expect(spies.error).to.be.calledOnceWith("error");
    expect(spies.warn).to.be.calledOnceWith("warning");
    expect(spies.log.callCount).to.eq(4);
    expect(spies.log.getCall(0)).to.be.calledWith("info");
    expect(spies.log.getCall(1)).to.be.calledWith("debug");
    expect(spies.log.getCall(2)).to.be.calledWith("trace");
    expect(spies.log.getCall(3)).to.be.calledWith("trace");
  });

});

describe("createCombinedDiagnosticsHandler", () => {

  it("calls all handlers with argument", () => {
    const arg: DiagnosticsScopeLogs[] = [];
    const handler1 = sinon.spy();
    const handler2 = sinon.spy();
    const combinedHandler = createCombinedDiagnosticsHandler([handler1, handler2]);
    combinedHandler(arg);
    expect(handler1).to.be.calledOnceWith(arg);
    expect(handler2).to.be.calledOnceWith(arg);
  });

});
