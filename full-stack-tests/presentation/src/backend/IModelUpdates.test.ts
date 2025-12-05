/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as fs from "fs";
import path from "path";
import * as sinon from "sinon";
import { BriefcaseDb, BriefcaseManager, IModelDb, IpcHost, StandaloneDb } from "@itwin/core-backend";
import { HubMock } from "@itwin/core-backend/lib/cjs/internal/HubMock.js";
import { IModelStatus } from "@itwin/core-bentley";
import { IModel, IpcSocketBackend } from "@itwin/core-common";
import { Presentation } from "@itwin/presentation-backend";
import { KeySet } from "@itwin/presentation-common";
import { PresentationIpcEvents } from "@itwin/presentation-common/internal";
import { createValidIModelFileName } from "../IModelSetupUtils.js";
import { setupTestsOutputDirectory } from "../IntegrationTests.js";
import { getFieldByLabel, getOutputRoot, prepareOutputFilePath, waitFor } from "../Utils.js";

describe("Reacting to IModel data changes", () => {
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

    const validateRootSubject = async (imodel: IModelDb, expectUpdateNotification: boolean, expectedCodeValue: string) => {
      if (expectUpdateNotification) {
        await waitFor(() => {
          expect(updatesSpy).to.be.calledWith(PresentationIpcEvents.Update, {
            [imodel.getRpcProps().key]: { "content-ruleset": { content: "FULL" } },
          });
        });
      }
      const content = await Presentation.getManager().getContent(createContentRequestProps(imodel));
      const codeValueField = getFieldByLabel(content!.descriptor.fields, "Code");
      expect(content!.contentSet[0].values[codeValueField.name]).to.eq(expectedCodeValue);
      updatesSpy.resetHistory();
    };

    it("returns fresh content after iModel update", async function () {
      using test = await setupStandaloneDbTest(this);
      const { imodel } = test;

      await validateRootSubject(imodel, false, "test");

      const rootSubjectProps = imodel.elements.getElementProps({ id: "0x1" });
      imodel.elements.updateElement({
        ...rootSubjectProps,
        code: { ...rootSubjectProps.code, value: "updated" },
      });
      imodel.saveChanges();

      await validateRootSubject(imodel, true, "updated");
    });

    it(`returns fresh content after "pull changes"`, async function () {
      using test = await setupBriefcaseDbTest(this);

      const imodel1 = await test.openIModel();
      const imodel2 = await test.openIModel();

      await validateRootSubject(imodel1, false, "test");

      await imodel2.locks.acquireLocks({ exclusive: IModel.rootSubjectId });
      const rootSubjectProps = imodel2.elements.getElementProps({ id: "0x1" });
      imodel2.elements.updateElement({
        ...rootSubjectProps,
        code: { ...rootSubjectProps.code, value: "updated" },
      });
      imodel2.saveChanges();
      await imodel2.pushChanges({ description: `updated root subject label` });

      await imodel1.pullChanges();

      await validateRootSubject(imodel1, true, "updated");
    });

    it(`returns fresh content after "undo" / "redo"`, async function () {
      using test = await setupStandaloneDbTest(this);
      const { imodel } = test;

      await validateRootSubject(imodel, false, "test");

      const rootSubjectProps = imodel.elements.getElementProps({ id: "0x1" });
      imodel.elements.updateElement({
        ...rootSubjectProps,
        code: { ...rootSubjectProps.code, value: "updated" },
      });
      imodel.saveChanges();
      await validateRootSubject(imodel, true, "updated");

      expect(imodel.txns.reverseTxns(1)).to.eq(IModelStatus.Success);
      await validateRootSubject(imodel, true, "test");

      expect(imodel.txns.reinstateTxn()).to.eq(IModelStatus.Success);
      await validateRootSubject(imodel, true, "updated");
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

    const validateRootSubject = async (imodel: IModelDb, expectUpdateNotification: boolean, expectedLabel: string) => {
      if (expectUpdateNotification) {
        await waitFor(() => {
          expect(updatesSpy).to.be.calledWith(PresentationIpcEvents.Update, {
            [imodel.getRpcProps().key]: { "hierarchy-ruleset": { hierarchy: "FULL" } },
          });
        });
      }
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const nodes = await Presentation.getManager().getNodes(createNodesRequestProps(imodel));
      expect(nodes)
        .to.have.lengthOf(1)
        .and.containSubset([
          {
            key: {
              instanceKeys: [{ className: "BisCore:Subject", id: "0x1" }],
            },
            label: {
              displayValue: expectedLabel,
            },
          },
        ]);
      updatesSpy.resetHistory();
    };

    it("returns fresh hierarchy after iModel update", async function () {
      using test = await setupStandaloneDbTest(this);
      const { imodel } = test;

      // UserLabel property is not set, so CodeValue is used instead
      await validateRootSubject(imodel, false, "test");

      const rootSubjectProps = imodel.elements.getElementProps({ id: "0x1" });
      imodel.elements.updateElement({
        ...rootSubjectProps,
        userLabel: `updated`,
      });
      imodel.saveChanges();

      // UserLabel is now set - using that
      await validateRootSubject(imodel, true, "updated");
    });

    it(`returns fresh hierarchy after "pull changes"`, async function () {
      using test = await setupBriefcaseDbTest(this);
      const imodel1 = await test.openIModel();
      const imodel2 = await test.openIModel();

      // UserLabel property is not set, so CodeValue is used instead
      await validateRootSubject(imodel1, false, "test");

      await imodel2.locks.acquireLocks({ exclusive: IModel.rootSubjectId });
      const rootSubjectProps = imodel2.elements.getElementProps({ id: "0x1" });
      imodel2.elements.updateElement({
        ...rootSubjectProps,
        userLabel: `updated`,
      });
      imodel2.saveChanges();
      await imodel2.pushChanges({ description: `updated root subject label` });

      await imodel1.pullChanges();

      // UserLabel is now set - using that
      await validateRootSubject(imodel1, true, "updated");
    });

    it(`returns fresh hierarchy after "undo" / "redo"`, async function () {
      using test = await setupStandaloneDbTest(this);
      const { imodel } = test;

      await validateRootSubject(imodel, false, "test");

      const rootSubjectProps = imodel.elements.getElementProps({ id: "0x1" });
      imodel.elements.updateElement({
        ...rootSubjectProps,
        userLabel: `updated`,
      });
      imodel.saveChanges();

      await validateRootSubject(imodel, true, "updated");

      expect(imodel.txns.reverseTxns(1)).to.eq(IModelStatus.Success);
      await validateRootSubject(imodel, true, "test");

      expect(imodel.txns.reinstateTxn()).to.eq(IModelStatus.Success);
      await validateRootSubject(imodel, true, "updated");
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
    [Symbol.dispose]: () => {
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
    [Symbol.dispose]: () => {
      imodels.forEach((imodel) => imodel.close());
      HubMock.shutdown();
    },
  };
}
