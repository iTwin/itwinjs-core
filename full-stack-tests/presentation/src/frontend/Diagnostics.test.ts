/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
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
    let diagnostics: ClientDiagnostics | undefined;
    await Presentation.presentation.getElementProperties({
      imodel,
      elementId: "0x1",
      diagnostics: {
        handler: (logs) => {
          diagnostics = logs;
        },
      },
    });
    expect(diagnostics).to.be.undefined;
  });

  it("gets backend version", async () => {
    let diagnostics: ClientDiagnostics;
    await Presentation.presentation.getElementProperties({
      imodel,
      elementId: "0x1",
      diagnostics: {
        backendVersion: true,
        handler: (logs) => {
          diagnostics = logs;
        },
      },
    });
    expect(diagnostics!.backendVersion).to.match(/\d+\.\d+\.\d+/);
  });

});
