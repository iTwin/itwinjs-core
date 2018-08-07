/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as moq from "@helpers/Mocks";
import * as faker from "faker";
import { using } from "@bentley/bentleyjs-core";
import { IModelDb } from "@bentley/imodeljs-backend";
import { HierarchyRequestOptions, Paged, ContentRequestOptions, KeySet } from "@bentley/ecpresentation-common";
import IBackendECPresentationManager, { Props } from "@src/IBackendECPresentationManager";
import MultiClientECPresentationManager from "@src/MultiClientECPresentationManager";
import SingleClientECPresentationManager from "@src/SingleClientECPresentationManager";
import { createRandomECInstanceNodeKey } from "@helpers/random/Hierarchy";
import { createRandomECInstanceKey } from "@helpers/random/EC";
import { createRandomDescriptor } from "@helpers/random/Content";
import TemporaryStorage from "@src/TemporaryStorage";

describe("MultiClientECPresentationManager", () => {

  const createdClientManagerMocks = new Map<string, moq.IMock<IBackendECPresentationManager>>();
  const factoryMock = moq.Mock.ofType<(clientId: string, props: Props) => IBackendECPresentationManager>();
  const imodelMock = moq.Mock.ofType<IModelDb>();
  let manager: MultiClientECPresentationManager;
  beforeEach(() => {
    manager = new MultiClientECPresentationManager({
      clientManagerFactory: factoryMock.object,
    });
    factoryMock.reset();
    factoryMock.setup((x) => x(moq.It.isAnyString(), moq.It.isAny())).returns((clientId: string) => {
      const mock = moq.Mock.ofType<IBackendECPresentationManager>();
      createdClientManagerMocks.set(clientId, mock);
      return mock.object;
    });
    createdClientManagerMocks.clear();
  });
  afterEach(() => {
    manager.dispose();
  });

  it("by default uses empty string for clientId", async () => {
    manager.rulesets(undefined);
    expect(createdClientManagerMocks.size).to.eq(1);
    expect(createdClientManagerMocks.has("")).to.be.true;
  });

  it("by default creates SingleClientECPresentationManager as a client manager", async () => {
    using(new MultiClientECPresentationManager(), (newManager) => {
      newManager.rulesets(undefined);
      expect((newManager as any).getClientManager("")).to.be.instanceof(SingleClientECPresentationManager);
    });
  });

  it("sets value lifetime for temporary storage", async () => {
    const unusedClientLifetime = faker.random.number();
    using(new MultiClientECPresentationManager({ unusedClientLifetime }), (newManager) => {
      const storage = (newManager as any)._clientsStorage as TemporaryStorage<IBackendECPresentationManager>;
      expect(storage.props.valueLifetime).to.eq(unusedClientLifetime);
    });
  });

  describe("dispose", () => {

    it("disposes all client managers", () => {
      // force create some client managers
      [0, 1, 2].forEach(() => manager.rulesets(faker.random.uuid()));
      expect(createdClientManagerMocks.size).to.eq(3);

      manager.dispose();
      createdClientManagerMocks.forEach((clientManagerMock) => {
        clientManagerMock.verify((x) => x.dispose(), moq.Times.once());
      });
    });

  });

  describe("activeLocale", () => {

    it("by default uses activeLocale set in props", () => {
      const locale = faker.random.locale();
      using(new MultiClientECPresentationManager({ activeLocale: locale }), (newManager) => {
        expect(newManager.activeLocale).to.eq(locale);
      });
    });

    it("sets active locale to all client managers", () => {
      // force create some client managers
      [0, 1, 2].forEach(() => manager.rulesets(faker.random.uuid()));
      expect(createdClientManagerMocks.size).to.eq(3);

      manager.activeLocale = faker.random.locale();
      createdClientManagerMocks.forEach((clientManagerMock) => {
        clientManagerMock.verify((x) => x.activeLocale = manager.activeLocale, moq.Times.once());
      });
    });

  });

  describe("rulesets", () => {

    it("creates rulesets manager for each different client", async () => {
      // verify rulesets manager gets created
      let clientId = faker.random.uuid();
      manager.rulesets(clientId);
      expect(createdClientManagerMocks.size).to.eq(1);
      expect(createdClientManagerMocks.has(clientId)).to.be.true;

      // verify a new rulesets manager doesn't get created for the same client
      manager.rulesets(clientId);
      expect(createdClientManagerMocks.size).to.eq(1);
      expect(createdClientManagerMocks.has(clientId)).to.be.true;

      // verify a new rulesets manager does get created for a different client
      clientId = faker.random.uuid();
      manager.rulesets(clientId);
      expect(createdClientManagerMocks.size).to.eq(2);
      expect(createdClientManagerMocks.has(clientId)).to.be.true;
    });

  });

  describe("vars", () => {

    it("creates RulesetVariablesManager for each different client", async () => {
      const rulesetId = faker.random.word();

      // verify variables object gets created
      let clientId = faker.random.uuid();
      manager.vars(rulesetId, clientId);
      expect(createdClientManagerMocks.size).to.eq(1);
      expect(createdClientManagerMocks.has(clientId)).to.be.true;

      // verify a new variables object doesn't get created for the same client
      manager.vars(faker.random.word(), clientId);
      expect(createdClientManagerMocks.size).to.eq(1);
      expect(createdClientManagerMocks.has(clientId)).to.be.true;

      // verify a new variables object does get created for a different client
      clientId = faker.random.uuid();
      manager.vars(rulesetId, clientId);
      expect(createdClientManagerMocks.size).to.eq(2);
      expect(createdClientManagerMocks.has(clientId)).to.be.true;
    });

  });

  describe("getRootNodes", () => {

    it("requests root nodes of client manager with specific client id", async () => {
      const options: Paged<HierarchyRequestOptions<IModelDb>> = {
        clientId: faker.random.uuid(),
        imodel: imodelMock.object,
        rulesetId: faker.random.word(),
      };
      await manager.getRootNodes(options);
      expect(createdClientManagerMocks.size).to.eq(1);
      createdClientManagerMocks.get(options.clientId!)!.verify((x) => x.getRootNodes(options), moq.Times.once());
    });

  });

  describe("getRootNodesCount", () => {

    it("requests root nodes count of client manager with specific client id", async () => {
      const options: HierarchyRequestOptions<IModelDb> = {
        clientId: faker.random.uuid(),
        imodel: imodelMock.object,
        rulesetId: faker.random.word(),
      };
      await manager.getRootNodesCount(options);
      expect(createdClientManagerMocks.size).to.eq(1);
      createdClientManagerMocks.get(options.clientId!)!.verify((x) => x.getRootNodesCount(options), moq.Times.once());
    });

  });

  describe("getChildren", () => {

    it("requests child nodes of client manager with specific client id", async () => {
      const options: Paged<HierarchyRequestOptions<IModelDb>> = {
        clientId: faker.random.uuid(),
        imodel: imodelMock.object,
        rulesetId: faker.random.word(),
      };
      const parentKey = createRandomECInstanceNodeKey();
      await manager.getChildren(options, parentKey);
      expect(createdClientManagerMocks.size).to.eq(1);
      createdClientManagerMocks.get(options.clientId!)!.verify((x) => x.getChildren(options, parentKey), moq.Times.once());
    });

  });

  describe("getChildrenCount", () => {

    it("requests child nodes count of client manager with specific client id", async () => {
      const options: HierarchyRequestOptions<IModelDb> = {
        clientId: faker.random.uuid(),
        imodel: imodelMock.object,
        rulesetId: faker.random.word(),
      };
      const parentKey = createRandomECInstanceNodeKey();
      await manager.getChildrenCount(options, parentKey);
      expect(createdClientManagerMocks.size).to.eq(1);
      createdClientManagerMocks.get(options.clientId!)!.verify((x) => x.getChildrenCount(options, parentKey), moq.Times.once());
    });

  });

  describe("getNodePaths", () => {

    it("requests node paths of client manager with specific client id", async () => {
      const options: HierarchyRequestOptions<IModelDb> = {
        clientId: faker.random.uuid(),
        imodel: imodelMock.object,
        rulesetId: faker.random.word(),
      };
      const paths = [[createRandomECInstanceKey(), createRandomECInstanceKey()]];
      const markedIndex = faker.random.number();
      await manager.getNodePaths(options, paths, markedIndex);
      expect(createdClientManagerMocks.size).to.eq(1);
      createdClientManagerMocks.get(options.clientId!)!.verify((x) => x.getNodePaths(options, paths, markedIndex), moq.Times.once());
    });

  });

  describe("getFilteredNodePaths", () => {

    it("requests filtered node paths of client manager with specific client id", async () => {
      const options: HierarchyRequestOptions<IModelDb> = {
        clientId: faker.random.uuid(),
        imodel: imodelMock.object,
        rulesetId: faker.random.word(),
      };
      const filter = faker.random.words();
      await manager.getFilteredNodePaths(options, filter);
      expect(createdClientManagerMocks.size).to.eq(1);
      createdClientManagerMocks.get(options.clientId!)!.verify((x) => x.getFilteredNodePaths(options, filter), moq.Times.once());
    });

  });

  describe("getContentDescriptor", () => {

    it("requests content descriptor of client manager with specific client id", async () => {
      const options: ContentRequestOptions<IModelDb> = {
        clientId: faker.random.uuid(),
        imodel: imodelMock.object,
        rulesetId: faker.random.word(),
      };
      const displayType = faker.random.word();
      const keys = new KeySet();
      await manager.getContentDescriptor(options, displayType, keys, undefined);
      expect(createdClientManagerMocks.size).to.eq(1);
      createdClientManagerMocks.get(options.clientId!)!.verify((x) => x.getContentDescriptor(options, displayType, keys, undefined), moq.Times.once());
    });

  });

  describe("getContentSetSize", () => {

    it("requests content set size of client manager with specific client id", async () => {
      const options: ContentRequestOptions<IModelDb> = {
        clientId: faker.random.uuid(),
        imodel: imodelMock.object,
        rulesetId: faker.random.word(),
      };
      const descriptor = createRandomDescriptor();
      const keys = new KeySet();
      await manager.getContentSetSize(options, descriptor, keys);
      expect(createdClientManagerMocks.size).to.eq(1);
      createdClientManagerMocks.get(options.clientId!)!.verify((x) => x.getContentSetSize(options, descriptor, keys), moq.Times.once());
    });

  });

  describe("getContent", () => {

    it("requests content of client manager with specific client id", async () => {
      const options: Paged<ContentRequestOptions<IModelDb>> = {
        clientId: faker.random.uuid(),
        imodel: imodelMock.object,
        rulesetId: faker.random.word(),
      };
      const descriptor = createRandomDescriptor();
      const keys = new KeySet();
      await manager.getContent(options, descriptor, keys);
      expect(createdClientManagerMocks.size).to.eq(1);
      createdClientManagerMocks.get(options.clientId!)!.verify((x) => x.getContent(options, descriptor, keys), moq.Times.once());
    });

  });

  describe("getDistinctValues", () => {

    it("requests content of client manager with specific client id", async () => {
      const options: ContentRequestOptions<IModelDb> = {
        clientId: faker.random.uuid(),
        imodel: imodelMock.object,
        rulesetId: faker.random.word(),
      };
      const descriptor = createRandomDescriptor();
      const keys = new KeySet();
      const fieldName = faker.random.word();
      await manager.getDistinctValues(options, descriptor, keys, fieldName);
      expect(createdClientManagerMocks.size).to.eq(1);
      createdClientManagerMocks.get(options.clientId!)!.verify((x) => x.getDistinctValues(options, descriptor, keys, fieldName, 0), moq.Times.once());
    });

  });

});
