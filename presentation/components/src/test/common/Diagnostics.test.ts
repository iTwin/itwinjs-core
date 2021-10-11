/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as sinon from "sinon";
import * as PresentationFrontendDiagnostics from "@itwin/presentation-frontend/lib/cjs/presentation-frontend/Diagnostics";
import { createDiagnosticsOptions } from "../../presentation-components/common/Diagnostics";

describe("createDiagnosticsOptions", () => {

  afterEach(() => {
    sinon.restore();
  });

  it("returns undefined when neither rule nor dev diagnostic props are set", () => {
    expect(createDiagnosticsOptions({ ruleDiagnostics: undefined, devDiagnostics: undefined })).to.be.undefined;
  });

  it("returns options with perf flag when dev diagnostic props have it", () => {
    const handler = sinon.stub();
    expect(createDiagnosticsOptions({ devDiagnostics: { perf: true, handler } })).to.deep.eq({ perf: true, handler });
  });

  it("returns options with dev severity when dev diagnostic props have it", () => {
    const handler = sinon.stub();
    expect(createDiagnosticsOptions({ devDiagnostics: { severity: "warning", handler } })).to.deep.eq({ dev: "warning", handler });
  });

  it("returns options with editor severity when rule diagnostic props are set", () => {
    const handler = sinon.stub();
    expect(createDiagnosticsOptions({ ruleDiagnostics: { severity: "warning", handler } })).to.deep.eq({ editor: "warning", handler });
  });

  it("returns options with combined handler when rule and dev props have different handlers", () => {
    const combinedHandler = sinon.stub();
    const combineFunc = sinon.stub(PresentationFrontendDiagnostics, "createCombinedDiagnosticsHandler").returns(combinedHandler);
    const handler1 = sinon.stub();
    const handler2 = sinon.stub();
    expect(createDiagnosticsOptions({
      devDiagnostics: { severity: "info", handler: handler1 },
      ruleDiagnostics: { severity: "warning", handler: handler2 },
    })).to.deep.eq({
      editor: "warning",
      dev: "info",
      handler: combinedHandler,
    });
    expect(combineFunc).to.be.calledOnceWithExactly([handler1, handler2]);
  });

});
