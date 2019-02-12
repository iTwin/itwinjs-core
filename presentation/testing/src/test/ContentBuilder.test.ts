/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as moq from "typemoq";
import * as sinon from "sinon";
import { expect, use } from "chai";
import * as ChaiAsPromised from "chai-as-promised";
import { PresentationManager, Presentation } from "@bentley/presentation-frontend";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { Content, ContentJSON, Descriptor, DefaultContentDisplayTypes, KeySet, Ruleset, ValuesDictionary, ItemJSON } from "@bentley/presentation-common";
import { ContentBuilder, IContentBuilderDataProvider } from "../ContentBuilder";
// tslint:disable-next-line:no-direct-imports
import RulesetManager from "@bentley/presentation-frontend/lib/RulesetManager";
import { Id64String } from "@bentley/bentleyjs-core";

use(ChaiAsPromised);

class EmptyDataProvider implements IContentBuilderDataProvider {
  // Verifies that given keyset matches a template, otherwise it throws an error
  private _keyVerificationFunction: ((keyset: KeySet) => void) | undefined;

  constructor(keyVerificationFunction?: (keyset: KeySet) => void) {
    this._keyVerificationFunction = keyVerificationFunction;
  }

  private _keyset: KeySet | undefined;
  public getContentSetSize = async () => 0;
  public getContent = async (): Promise<Readonly<Content> | undefined> => undefined;

  public set keys(keyset: KeySet) {
    if (this._keyVerificationFunction)
      this._keyVerificationFunction(keyset);
    this._keyset = keyset;
  }
  public get keys() {
    return this._keyset ? this._keyset : new KeySet();
  }
}

function createItemJSON(properties: ValuesDictionary<any>): ItemJSON {
  const displayValues = { ...properties };

  for (const key in displayValues) {
    if (displayValues.hasOwnProperty(key)) {
      displayValues[key] = null;
    }
  }

  return {
    displayValues,
    values: properties,
    imageId: "",
    label: "Test class",
    mergedFieldNames: [],
    primaryKeys: Object.keys(properties).map((key) => ({ className: "testClass", id: key })),
  };
}

async function getContent(items: Array<ValuesDictionary<any>>, descriptor: Descriptor) {
  const json: ContentJSON = {
    contentSet: items.map((item) => createItemJSON(item)),
    descriptor,
  };

  return Content.fromJSON(json)!;
}

class DataProvider extends EmptyDataProvider {
  public descriptor: Descriptor = {
    connectionId: "a",
    inputKeysHash: "a",
    contentOptions: {},
    displayType: "Grid",
    selectClasses: [],
    fields: [
      { name: "width", type: { typeName: "string" } },
      { name: "title", type: { typeName: "string" } },
      { name: "weight", type: { typeName: "string" } },
      { name: "weight", type: { typeName: "string" } }, // Repeated so that sort function could be tested
    ],
    contentFlags: 1,
  } as any;

  public items = [
    { title: "Item", height: 15, width: 16 },
    { title: "Circle", radius: 13 },
  ];

  public getContentSetSize = async () => this.items.length;
  public getContent = async () => getContent(this.items, this.descriptor);
}

async function getEmptyContent({ }, descriptor: Readonly<Descriptor>) {
  const json: ContentJSON = {
    contentSet: [],
    descriptor,
  };

  return Content.fromJSON(json)!;
}

interface TestInstance {
  schemaName: string;
  className: string;
  ids: Array<{ id: Id64String }>;
}

function verifyInstanceKey(instanceKey: [string, Set<string>], instances: TestInstance[]) {
  const className = instanceKey[0];
  const ids = Array.from(instanceKey[1].values());
  for (const instance of instances) {
    if (`${instance.schemaName}:${instance.className}` === className) {
      for (const idEntry of instance.ids) {
        if (!ids.includes(idEntry.id)) {
          throw new Error(`Wrong id provided - '${idEntry.id}'`);
        }
      }
      return;
    }
  }
  throw new Error(`Wrong className provided - '${className}'`);
}

async function executeQuery(query: string, instances: TestInstance[]): Promise<any[]> {
  if (query.includes("SELECT s.Name")) {
    return instances as Array<{ schemaName: string, className: string }>; // ids are returned as well, but that shouldn't be a problem
  }

  for (const entry of instances) {
    if (query.includes(`"${entry.schemaName}"."${entry.className}"`)) {
      return entry.ids;
    }
  }

  return [];
}

function verifyKeyset(keyset: KeySet, testInstances: TestInstance[], verificationSpy: sinon.SinonSpy) {
  verificationSpy();
  for (const entry of keyset.instanceKeys.entries()) {
    verifyInstanceKey(entry, testInstances);
  }
}

describe("ContentBuilder", () => {
  const imodelMock = moq.Mock.ofType<IModelConnection>();

  describe("createContent", () => {
    const presentationManagerMock = moq.Mock.ofType<PresentationManager>();
    const rulesetMock = moq.Mock.ofType<Ruleset>();
    const rulesetManager = new RulesetManager();

    before(() => {
      rulesetMock.setup((ruleset) => ruleset.id).returns(() => "1");
    });

    beforeEach(() => {
      presentationManagerMock.reset();
      presentationManagerMock.setup((manager) => manager.rulesets()).returns(() => rulesetManager);
      presentationManagerMock.setup(async (manager) => manager.getContent(moq.It.isAny(), moq.It.isAny(), moq.It.isAny())).returns(getEmptyContent);
      Presentation.presentation = presentationManagerMock.object;
    });

    it("returns empty records when there is no content returned from presentation", async () => {
      const builder = new ContentBuilder(imodelMock.object);
      let content = await builder.createContent("1", []);
      expect(content).to.be.empty;

      presentationManagerMock.verify((manager) => manager.rulesets(), moq.Times.never());
      content = await builder.createContent(rulesetMock.object, []);
      presentationManagerMock.verify((manager) => manager.rulesets(), moq.Times.once());
      expect(content).to.be.empty;

      content = await builder.createContent("1", [], DefaultContentDisplayTypes.LIST);
      expect(content).to.be.empty;
    });

    it("returns empty records when there is no content in the supplied data provider", async () => {
      const builder = new ContentBuilder(imodelMock.object, new EmptyDataProvider());
      const content = await builder.createContent("1", []);
      expect(content).to.be.empty;
    });

    it("returns correct records when there is content in the supplied data provider", async () => {
      const dataProvider = new DataProvider();
      const builder = new ContentBuilder(imodelMock.object, dataProvider);
      const content = await builder.createContent("1", []);
      expect(content.length).to.equal(dataProvider.items.length * dataProvider.descriptor.fields.length);
    });
  });

  describe("createContentForAllClasses", () => {
    const testInstances: TestInstance[] = [
      {
        className: "Class1",
        schemaName: "Schema1",
        ids: [{ id: "0x2" }, { id: "0x3" }],
      },
      {
        className: "Class2",
        schemaName: "Schema2",
        ids: [{ id: "0x5" }, { id: "0x6" }],
      },
    ];

    before(() => {
      imodelMock.reset();
      imodelMock.setup(async (imodel) => imodel.queryPage(moq.It.isAny(), moq.It.isAny(), moq.It.isAny())).returns(async (query) => executeQuery(query, testInstances));
    });

    it("returns all required instances with empty records", async () => {
      const verificationSpy = sinon.spy();

      const builder = new ContentBuilder(
        imodelMock.object,
        new EmptyDataProvider((keyset: KeySet) => verifyKeyset(keyset, testInstances, verificationSpy)));

      const content = await builder.createContentForAllInstances("1");

      expect(content.length).to.equal(2);

      expect(content.find((c) => c.className === "Schema1:Class1")).to.not.be.undefined;
      expect(content.find((c) => c.className === "Schema2:Class2")).to.not.be.undefined;

      expect(content[0].records).to.be.empty;
      expect(content[1].records).to.be.empty;

      expect(verificationSpy.calledTwice).to.be.true;
    });
  });

  describe("createContentForInstancePerClass", () => {
    context("test instances have ids", () => {
      const testInstances: TestInstance[] = [
        {
          className: "Class1",
          schemaName: "Schema1",
          ids: [{ id: "0x1" }],
        },
        {
          className: "Class2",
          schemaName: "Schema2",
          ids: [{ id: "0x9" }],
        },
      ];

      it("returns all required instances with empty records", async () => {
        imodelMock.reset();
        imodelMock.setup(async (imodel) => imodel.queryPage(moq.It.isAny(), moq.It.isAny(), moq.It.isAny())).returns(async (query) => executeQuery(query, testInstances));

        const verificationSpy = sinon.spy();

        const builder = new ContentBuilder(
          imodelMock.object,
          new EmptyDataProvider((keyset: KeySet) => verifyKeyset(keyset, testInstances, verificationSpy)));

        const content = await builder.createContentForInstancePerClass("1");

        expect(content.length).to.equal(2);

        expect(content.find((c) => c.className === "Schema1:Class1")).to.not.be.undefined;
        expect(content.find((c) => c.className === "Schema2:Class2")).to.not.be.undefined;

        expect(content[0].records).to.be.empty;
        expect(content[1].records).to.be.empty;

        expect(verificationSpy.calledTwice).to.be.true;
      });

      it("throws when id query throws an unexpected error", async () => {
        function executeQueryAndThrow(query: string, instances: TestInstance[]) {
          if (query.includes("SELECT s.Name")) {
            return instances as Array<{ schemaName: string, className: string }>;
          }
          throw new Error("Test error");
        }

        imodelMock.reset();
        imodelMock.setup(async (imodel) => imodel.queryPage(moq.It.isAny(), moq.It.isAny(), moq.It.isAny())).returns(async (query) => executeQueryAndThrow(query, testInstances));

        const verificationSpy = sinon.spy();

        const builder = new ContentBuilder(
          imodelMock.object,
          new EmptyDataProvider((keyset: KeySet) => verifyKeyset(keyset, testInstances, verificationSpy)));

        await expect(builder.createContentForInstancePerClass("1")).to.be.rejectedWith("Test error");
      });
    });

    context("test instances have no ids", () => {
      const testInstances: TestInstance[] = [{ className: "Class1", schemaName: "Schema1", ids: [] }];

      before(() => {
        imodelMock.reset();
        imodelMock.setup(async (imodel) => imodel.queryPage(moq.It.isAny(), moq.It.isAny(), moq.It.isAny())).returns(async (query) => executeQuery(query, testInstances));
      });

      it("returns an empty list", async () => {
        const verificationSpy = sinon.spy();

        const builder = new ContentBuilder(
          imodelMock.object,
          new EmptyDataProvider((keyset: KeySet) => verifyKeyset(keyset, testInstances, verificationSpy)));

        const content = await builder.createContentForInstancePerClass("1");

        expect(content).to.be.empty;
        expect(verificationSpy.notCalled).to.be.true;
      });
    });
  });
});
