/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as fs from "fs";
import path from "path";
import * as sinon from "sinon";
import { BriefcaseDb, BriefcaseManager, HubMock, IModelDb, IpcHost, StandaloneDb } from "@itwin/core-backend";
import { using } from "@itwin/core-bentley";
import { IModel, IpcSocketBackend } from "@itwin/core-common";
import { Presentation } from "@itwin/presentation-backend";
import { KeySet, PresentationIpcEvents } from "@itwin/presentation-common";
import { createValidIModelFileName } from "../IModelSetupUtils";
import { setupTestsOutputDirectory } from "../IntegrationTests";
import { getFieldByLabel, getOutputRoot, prepareOutputFilePath, waitFor } from "../Utils";

describe.only("Reacting to IModel data changes", () => {
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
    updatesSpy.resetHistory();
  });

  describe("content", () => {
    const createContentRequestProps = (imodel: IModelDb) => ({
      imodel,
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
    });

    it("returns fresh content after iModel update", async function () {
      await using(await setupStandaloneDbTest(this), async (test) => {
        const { imodel } = test;

        const contentBefore = await Presentation.getManager().getContent(createContentRequestProps(imodel));
        const codeValueField = getFieldByLabel(contentBefore!.descriptor.fields, "Code");
        const userLabelField = getFieldByLabel(contentBefore!.descriptor.fields, "User Label");
        expect(contentBefore!.contentSet[0].values[codeValueField.name]).to.eq("test");
        expect(contentBefore!.contentSet[0].values[userLabelField.name]).to.be.undefined;

        const rootSubjectProps = imodel.elements.getElementJson({ id: "0x1" });
        imodel.elements.updateElement({
          ...rootSubjectProps,
          userLabel: `updated`,
        });
        imodel.saveChanges();
        await waitFor(() => {
          expect(updatesSpy).to.be.calledWith(PresentationIpcEvents.Update, {
            [imodel.getRpcProps().key]: { "content-ruleset": { content: "FULL" } },
          });
        });

        const contentAfter = await Presentation.getManager().getContent(createContentRequestProps(imodel));
        expect(contentAfter!.contentSet[0].values[codeValueField.name]).to.eq("test");
        expect(contentAfter!.contentSet[0].values[userLabelField.name]).to.eq("updated");
      });
    });

    it.only(`returns fresh content after "pull changes"`, async function () {
      await using(await setupBriefcaseDbTest(this), async (test) => {
        const imodel1 = await test.openIModel();
        const imodel2 = await test.openIModel();

        const contentBefore = await Presentation.getManager().getContent(createContentRequestProps(imodel1));
        const codeValueField = getFieldByLabel(contentBefore!.descriptor.fields, "Code");
        const userLabelField = getFieldByLabel(contentBefore!.descriptor.fields, "User Label");
        expect(contentBefore!.contentSet[0].values[codeValueField.name]).to.eq("test");
        expect(contentBefore!.contentSet[0].values[userLabelField.name]).to.be.undefined;

        await imodel2.locks.acquireLocks({ exclusive: IModel.rootSubjectId });
        const rootSubjectProps = imodel2.elements.getElementJson({ id: "0x1" });
        imodel2.elements.updateElement({
          ...rootSubjectProps,
          userLabel: `updated`,
        });
        imodel2.saveChanges();
        await imodel2.pushChanges({ description: `updated root subject label` });

        await imodel1.pullChanges();
        await waitFor(() => {
          expect(updatesSpy).to.be.calledWith(PresentationIpcEvents.Update, {
            [imodel1.getRpcProps().key]: { "content-ruleset": { content: "FULL" } },
          });
        });

        const contentAfter = await Presentation.getManager().getContent(createContentRequestProps(imodel1));
        expect(contentAfter!.contentSet[0].values[codeValueField.name]).to.eq("test");
        expect(contentAfter!.contentSet[0].values[userLabelField.name]).to.eq("updated");
      });
    });
  });

  describe("hierarchies", () => {
    const createNodesRequestProps = (imodel: IModelDb) => ({
      imodel,
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
    });

    it("returns fresh hierarchy after iModel update", async function () {
      await using(await setupStandaloneDbTest(this), async (test) => {
        const { imodel } = test;

        const nodesBefore = await Presentation.getManager().getNodes(createNodesRequestProps(imodel));
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

        const rootSubjectProps = imodel.elements.getElementJson({ id: "0x1" });
        imodel.elements.updateElement({
          ...rootSubjectProps,
          userLabel: `updated`,
        });
        imodel.saveChanges();
        await waitFor(() => {
          expect(updatesSpy).to.be.calledWith(PresentationIpcEvents.Update, {
            [imodel.getRpcProps().key]: { "hierarchy-ruleset": { hierarchy: "FULL" } },
          });
        });

        const nodesAfter = await Presentation.getManager().getNodes(createNodesRequestProps(imodel));
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

    it(`returns fresh hierarchy after "pull changes"`, async function () {
      await using(await setupBriefcaseDbTest(this), async (test) => {
        const imodel1 = await test.openIModel();
        const imodel2 = await test.openIModel();

        const nodesBefore = await Presentation.getManager().getNodes(createNodesRequestProps(imodel1));
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

        await imodel2.locks.acquireLocks({ exclusive: IModel.rootSubjectId });
        const rootSubjectProps = imodel2.elements.getElementJson({ id: "0x1" });
        imodel2.elements.updateElement({
          ...rootSubjectProps,
          userLabel: `updated`,
        });
        imodel2.saveChanges();
        await imodel2.pushChanges({ description: `updated root subject label` });

        await imodel1.pullChanges();
        await waitFor(() => {
          expect(updatesSpy).to.be.calledWith(PresentationIpcEvents.Update, {
            [imodel1.getRpcProps().key]: { "hierarchy-ruleset": { hierarchy: "FULL" } },
          });
        });

        const nodesAfter = await Presentation.getManager().getNodes(createNodesRequestProps(imodel1));
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
  });
});

async function setupStandaloneDbTest(mochaContext: Mocha.Context) {
  const imodelPath = prepareOutputFilePath(`${createValidIModelFileName(mochaContext.test!.fullTitle())}.bim`);
  if (fs.existsSync(imodelPath)) {
    fs.unlinkSync(imodelPath);
  }
  const imodel = StandaloneDb.createEmpty(imodelPath, {
    rootSubject: { name: "test" },
    allowEdit: JSON.stringify({ txns: true }),
  });
  return {
    imodel,
    dispose: () => {
      imodel.close();
    },
  };
}

async function setupBriefcaseDbTest(mochaContext: Mocha.Context) {
  HubMock.startup(createValidIModelFileName(mochaContext.test!.fullTitle()), getOutputRoot());
  const iTwinId = HubMock.iTwinId;
  const iModelId = await HubMock.createNewIModel({ iTwinId, iModelName: mochaContext.test!.fullTitle(), description: "test" });
  const imodels: IModelDb[] = [];
  let usersCounter = 0;
  return {
    openIModel: async () => {
      const user = `user${++usersCounter}`;
      const briefcaseProps = await BriefcaseManager.downloadBriefcase({ iTwinId, iModelId, accessToken: user });
      const imodel = await BriefcaseDb.open(briefcaseProps);
      imodels.push(imodel);
      return imodel;
    },
    dispose: () => {
      imodels.forEach((imodel) => imodel.close());
      HubMock.shutdown();
    },
  };
}
