/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import { IModelConnection, SnapshotConnection } from "@itwin/core-frontend";
import { ClientDiagnostics } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { initialize, terminate } from "../IntegrationTests";

describe("Diagnostics", async () => {
  let imodel: IModelConnection;

  before(async () => {
    await initialize();
    const testIModelName: string = "assets/datasets/Properties_60InstancesWithUrl2.ibim";
    imodel = await SnapshotConnection.openFile(testIModelName);
    expect(imodel).is.not.null;
  });

  after(async () => {
    await imodel.close();
    await terminate();
  });

  it("doesn't include diagnostics if not requested", async () => {
    const handler = sinon.spy();
    await Presentation.presentation.getElementProperties({
      imodel,
      elementId: "0x1",
      diagnostics: { handler },
    });
    expect(handler).to.not.be.called;
  });

  it("gets backend version", async () => {
    const handler = sinon.spy();
    await Presentation.presentation.getElementProperties({
      imodel,
      elementId: "0x1",
      diagnostics: {
        perf: true,
        backendVersion: true,
        handler,
      },
    });
    expect(handler).to.be.calledOnce;
    expect(handler.firstCall.args[0].backendVersion).to.match(/\d+\.\d+\.\d+/);
  });
});

describe("Learning Snippets", () => {
  describe("Diagnostics", async () => {
    let imodel: IModelConnection;

    before(async () => {
      await initialize();
      imodel = await SnapshotConnection.openFile("assets/datasets/Properties_60InstancesWithUrl2.ibim");
    });

    after(async () => {
      await imodel.close();
      await terminate();
    });

    it("gets frontend per-request diagnostics", async () => {
      const log = sinon.stub();
      const elementId = "0x1";
      // __PUBLISH_EXTRACT_START__ Presentation.Diagnostics.Frontend
      await Presentation.presentation.getElementProperties({
        imodel,
        elementId,
        diagnostics: {
          // request version of the backend that handles this request
          backendVersion: true,
          // supply a callback that'll receive the diagnostics
          handler: (diagnostics: ClientDiagnostics) => {
            // log the backend version
            log(`Backend version: ${diagnostics.backendVersion}`);
          },
        },
      });
      // __PUBLISH_EXTRACT_END__
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const expectedBackendVersion = require("@itwin/presentation-backend/package.json").version;
      expect(log).to.be.calledOnceWith(`Backend version: ${expectedBackendVersion}`);
    });
  });
});
