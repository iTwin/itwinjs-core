/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as fs from "fs";
import path from "path";
import * as sinon from "sinon";
import { IpcHost, StandaloneDb } from "@itwin/core-backend";
import { IpcSocketBackend } from "@itwin/core-common";
import { Presentation } from "@itwin/presentation-backend";
import { KeySet, PresentationIpcEvents } from "@itwin/presentation-common";
import { createValidIModelFileName } from "../IModelSetupUtils";
import { setupTestsOutputDirectory } from "../IntegrationTests";
import { getFieldByLabel, prepareOutputFilePath, waitFor } from "../Utils";

describe("Reacting to IModel data changes", () => {
  let imodelPath: string;
  let imodelDb: StandaloneDb;
  let updatesSpy: sinon.SinonSpy<[string, ...any[]], void>;

  before(async () => {
    const outputRoot = setupTestsOutputDirectory();
    const cachesDirectory = path.join(outputRoot, "caches");
    if (!fs.existsSync(cachesDirectory)) {
      fs.mkdirSync(cachesDirectory);
    }
    const socketStub = {
      send: sinon.stub(),
      addListener: sinon.stub().returns(() => {}),
      removeListener: sinon.stub(),
      handle: sinon.stub().returns(() => {}),
    };
    await IpcHost.startup({
      ipcHost: {
        socket: socketStub as IpcSocketBackend,
      },
      iModelHost: {
        cacheDir: cachesDirectory,
      },
    });
    updatesSpy = sinon.spy(IpcHost, "send");
    Presentation.initialize();
  });

  after(async () => {
    Presentation.terminate();
    await IpcHost.shutdown();
  });

  beforeEach(function () {
    imodelPath = prepareOutputFilePath(`${createValidIModelFileName(this.test!.fullTitle())}.bim`);
    if (fs.existsSync(imodelPath)) {
      fs.unlinkSync(imodelPath);
    }
    imodelDb = StandaloneDb.createEmpty(imodelPath, {
      rootSubject: { name: "test" },
      allowEdit: JSON.stringify({ txns: true }),
    });
    updatesSpy.resetHistory();
  });

  afterEach(() => {
    imodelDb.close();
  });

  it("returns fresh content after iModel update", async () => {
    const contentRequestProps = {
      imodel: imodelDb,
      rulesetOrId: {
        id: "content-ruleset",
        rules: [
          {
            ruleType: "Content" as const,
            specifications: [
              {
                specType: "SelectedNodeInstances" as const,
              },
            ],
          },
        ],
      },
      descriptor: {},
      keys: new KeySet([{ className: "BisCore.Subject", id: "0x1" }]),
    };

    const contentBefore = await Presentation.getManager().getContent(contentRequestProps);
    const codeValueField = getFieldByLabel(contentBefore!.descriptor.fields, "Code")!;
    const userLabelField = getFieldByLabel(contentBefore!.descriptor.fields, "User Label")!;
    expect(contentBefore!.contentSet[0].values[codeValueField.name]).to.eq("test");
    expect(contentBefore!.contentSet[0].values[userLabelField.name]).to.be.undefined;

    const rootSubjectProps = imodelDb.elements.getElementJson({ id: "0x1" });
    imodelDb.elements.updateElement({
      ...rootSubjectProps,
      userLabel: `updated`,
    });
    imodelDb.saveChanges();
    await waitFor(() => {
      expect(updatesSpy).to.be.calledWith(PresentationIpcEvents.Update, {
        [imodelDb.getRpcProps().key]: { "content-ruleset": { content: "FULL" } },
      });
    });

    const contentAfter = await Presentation.getManager().getContent(contentRequestProps);
    expect(contentAfter!.contentSet[0].values[codeValueField.name]).to.eq("test");
    expect(contentAfter!.contentSet[0].values[userLabelField.name]).to.eq("updated");
  });

  it("returns fresh hierarchy after iModel update", async () => {
    const nodesRequestProps = {
      imodel: imodelDb,
      rulesetOrId: {
        id: "hierarchy-ruleset",
        rules: [
          {
            ruleType: "RootNodes" as const,
            specifications: [
              {
                specType: "InstanceNodesOfSpecificClasses" as const,
                classes: [{ schemaName: "BisCore", classNames: ["Subject"] }],
                instanceFilter: "this.Parent = NULL",
                groupByClass: false,
                groupByLabel: false,
              },
            ],
          },
        ],
      },
    };

    const nodesBefore = await Presentation.getManager().getNodes(nodesRequestProps);
    expect(nodesBefore)
      .to.have.lengthOf(1)
      .and.containSubset([
        {
          key: {
            instanceKeys: [{ className: "BisCore:Subject", id: "0x1" }],
          },
          label: {
            // UserLabel property is not set, so CodeValue is used instead
            displayValue: "test",
          },
        },
      ]);

    const rootSubjectProps = imodelDb.elements.getElementJson({ id: "0x1" });
    imodelDb.elements.updateElement({
      ...rootSubjectProps,
      userLabel: `updated`,
    });
    imodelDb.saveChanges();
    await waitFor(() => {
      expect(updatesSpy).to.be.calledWith(PresentationIpcEvents.Update, {
        [imodelDb.getRpcProps().key]: { "hierarchy-ruleset": { hierarchy: "FULL" } },
      });
    });

    const nodesAfter = await Presentation.getManager().getNodes(nodesRequestProps);
    expect(nodesAfter)
      .to.have.lengthOf(1)
      .and.containSubset([
        {
          key: {
            instanceKeys: [{ className: "BisCore:Subject", id: "0x1" }],
          },
          label: {
            // UserLabel is now set - using that
            displayValue: "updated",
          },
        },
      ]);
  });
});
