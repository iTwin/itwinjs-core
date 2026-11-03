/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as sinon from "sinon";
import { BlobContainer } from "../../BlobContainerService";
import { IModelHost } from "../../IModelHost";
import { SettingsPriority } from "../../workspace/Settings";
import { SettingsContainers } from "../../workspace/SettingsEditor";

const projectId = "11111111-1111-4111-8111-111111111111";
const accountId = "22222222-2222-4222-8222-222222222222";
const metadata = (containerId: string, iTwinId = projectId, iModelId?: string) => ({
  containerId, iTwinId, iModelId, accountITwinId: accountId, containerType: "settings", label: containerId,
});
const projectRoot = metadata("project-root");
const accountRoot = metadata("account-root", accountId);
const iModels = [metadata("iModel-a", projectId, "iModel-a-id"), metadata("iModel-b", projectId, "iModel-b-id")];

describe("SettingsContainers root discovery", () => {
  let savedService: BlobContainer.ContainerService | undefined;
  let query: sinon.SinonStub;
  let requestToken: sinon.SinonStub;

  beforeEach(() => {
    savedService = BlobContainer.service;
    sinon.stub(IModelHost, "getAccessToken").resolves("test-token");
    query = sinon.stub();
    requestToken = sinon.stub().callsFake(async ({ containerId }) => ({
      token: "read-token", baseUri: "https://example.test", provider: "azure", containerId,
    }));
    BlobContainer.service = {
      create: sinon.stub(), delete: sinon.stub(), queryScope: sinon.stub(), queryMetadata: sinon.stub(),
      queryContainersMetadata: query, updateJson: sinon.stub(), requestToken,
    };
  });

  afterEach(() => {
    BlobContainer.service = savedService;
    sinon.restore();
  });

  for (const { name, containers, expected } of [
    { name: "project root and iModel containers", containers: [projectRoot, ...iModels], expected: "project-root" },
    { name: "a sole iModel container without a project root", containers: iModels.slice(0, 1), expected: undefined },
    { name: "iModel containers without a project root", containers: iModels, expected: undefined },
  ]) {
    it(`selects only the project root for write lookup with ${name}`, async () => {
      query.resolves(containers);
      expect(await SettingsContainers.getITwinContainerId(projectId)).to.equal(expected);
      expect(query.calledOnceWithExactly("test-token", { iTwinId: projectId, containerType: "settings" })).to.be.true;
      expect(requestToken.called).to.be.false;
    });
  }

  for (const { name, containers, expected } of [
    { name: "project root and iModel containers", containers: [projectRoot, ...iModels], expected: ["project-root"] },
    { name: "a sole iModel container without a project root", containers: iModels.slice(0, 1), expected: [] },
    { name: "iModel containers without a project root", containers: iModels, expected: [] },
    {
      name: "organization root, project root and iModel containers",
      containers: [projectRoot, ...iModels, accountRoot, metadata("account-iModel", accountId, "account-iModel-id")],
      expected: ["project-root", "account-root"],
    },
  ]) {
    it(`selects only roots for read discovery with ${name}`, async () => {
      query.resolves(containers);
      const sources = await SettingsContainers.getITwinSettingsSources(projectId);
      expect(sources?.map((source) => source.containerId) ?? []).to.deep.equal(expected);
      expect(requestToken.getCalls().map((call) => call.args[0].containerId)).to.deep.equal(expected);
      if (expected.length === 0)
        expect(sources).to.be.undefined;
      else
        expect(sources?.map((source) => source.priority)).to.deep.equal(expected.map((id) => id === "account-root" ? SettingsPriority.organization : SettingsPriority.iTwin));
    });
  }

  it("still rejects duplicate project roots for write lookup and read discovery", async () => {
    query.resolves([projectRoot, ...iModels, metadata("duplicate-root")]);
    for (const discover of [SettingsContainers.getITwinContainerId, SettingsContainers.getITwinSettingsSources]) {
      try {
        await discover(projectId);
        expect.fail("Duplicate roots must be rejected");
      } catch (error) {
        expect((error as Error).message).to.include("Multiple iTwin settings containers");
      }
    }
  });

  it("still rejects duplicate organization roots for read discovery", async () => {
    query.resolves([accountRoot, metadata("duplicate-account-root", accountId), ...iModels]);
    try {
      await SettingsContainers.getITwinSettingsSources(projectId);
      expect.fail("Duplicate organization roots must be rejected");
    } catch (error) {
      expect((error as Error).message).to.include("Multiple iTwin settings containers");
    }
  });
});
