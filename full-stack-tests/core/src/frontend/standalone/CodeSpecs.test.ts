/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import * as sinon from "sinon";
import { BisCodeSpec, CodeScopeSpec, CodeSpec, CodeSpecProperties, ECSqlReader, QueryRowProxy } from "@itwin/core-common";
import { IModelConnection, SnapshotConnection } from "@itwin/core-frontend";
import { TestUtility } from "../TestUtility";

describe("CodeSpecs", async () => {
  let iModel: IModelConnection;

  before(async () => {
    await TestUtility.startFrontend();
    iModel = await SnapshotConnection.openFile("test.bim");
  });

  after(async () => {
    if (iModel)
      await iModel.close();
    await TestUtility.shutdownFrontend();
  });

  it("should load CodeSpecs", async () => {
    const nullCodeSpec: CodeSpec = await iModel.codeSpecs.getByName(BisCodeSpec.nullCodeSpec);
    assert.equal(nullCodeSpec.scopeType, CodeScopeSpec.Type.Repository);
    assert.equal(nullCodeSpec.scopeReq, CodeScopeSpec.ScopeRequirement.ElementId);

    const subCategoryCodeSpec: CodeSpec = await iModel.codeSpecs.getByName(BisCodeSpec.subCategory);
    assert.equal(subCategoryCodeSpec.scopeType, CodeScopeSpec.Type.ParentElement);
    assert.equal(subCategoryCodeSpec.scopeReq, CodeScopeSpec.ScopeRequirement.ElementId);

    const viewDefinitionCodeSpec: CodeSpec = await iModel.codeSpecs.getByName(BisCodeSpec.viewDefinition);
    assert.equal(viewDefinitionCodeSpec.scopeType, CodeScopeSpec.Type.Model);
    assert.equal(viewDefinitionCodeSpec.scopeReq, CodeScopeSpec.ScopeRequirement.ElementId);
  });
});

describe("CodeSpecs._isCodeSpecProperties()", async () => {
  let iModelStub: sinon.SinonStubbedInstance<IModelConnection>;
  let ecsqlReaderStub: sinon.SinonStubbedInstance<ECSqlReader>;

  before(async () => {
    await TestUtility.startFrontend();
  });

  beforeEach(() => {
    iModelStub = sinon.createStubInstance(IModelConnection);
    ecsqlReaderStub = sinon.createStubInstance(ECSqlReader);
  });

  after(async () => {
    await TestUtility.shutdownFrontend();
  });

  afterEach(() => {
    sinon.restore();
  });

  it("should validate valid CodeSpecProperties", async () => {
    const fakeCodeSpecProperties: CodeSpecProperties = {
      scopeSpec: { type: CodeScopeSpec.Type.Repository, fGuidRequired: true, relationship: "valid" },
      spec: { isManagedWithDgnDb: false },
      version: "1.0.0",
    };
    const fakeRow = {
      toArray: () => ["0x123", "TestCodeSpec", JSON.stringify(fakeCodeSpecProperties)],
    } as QueryRowProxy;

    ecsqlReaderStub.next.resolves({ done: false, value: fakeRow });
    iModelStub.createQueryReader.returns(ecsqlReaderStub);

    const codeSpecs = new IModelConnection.CodeSpecs(iModelStub);
    const codeSpec = await codeSpecs.getByName("TestCodeSpec");

    assert.equal(codeSpec.name, "TestCodeSpec");
    assert.equal(codeSpec.id, "0x123");
    assert.deepEqual(codeSpec.properties, fakeCodeSpecProperties);
  });

  async function expectInvalidCodeSpecPropertiesToBeRejected(codeSpecProperties: any) {
    const fakeRow = {
      toArray: () => ["0x123", "TestCodeSpec", JSON.stringify(codeSpecProperties)],
    } as QueryRowProxy;

    ecsqlReaderStub.next.resolves({ done: false, value: fakeRow });
    iModelStub.createQueryReader.returns(ecsqlReaderStub);

    const codeSpecs = new IModelConnection.CodeSpecs(iModelStub);
    await expect(codeSpecs.getByName("TestCodeSpec")).to.be.rejectedWith(
      Error,
      "Invalid CodeSpecProperties returned in the CodeSpec",
    );
  }

  const invalidCodeSpecPropertiesWithWrongTypes = [
    {
      reason: "invalid scopeSpec.type type",
      codeSpecProperties: {
        scopeSpec: { type: "invalid", fGuidRequired: true, relationship: "valid" },
        spec: { isManagedWithDgnDb: false },
        version: "1.0.0",
      },
    },
    {
      reason: "invalid scopeSpec.fGuidRequired type",
      codeSpecProperties: {
        scopeSpec: { type: CodeScopeSpec.Type.Repository, fGuidRequired: "invalid", relationship: "valid" },
        spec: { isManagedWithDgnDb: false },
        version: "1.0.0",
      },
    },
    {
      reason: "invalid scopeSpec.relationship type",
      codeSpecProperties: {
        scopeSpec: { type: CodeScopeSpec.Type.Repository, fGuidRequired: true, relationship: false },
        spec: { isManagedWithDgnDb: false },
        version: "1.0.0",
      },
    },
    {
      reason: "invalid spec.isManagedWithDgnDb type",
      codeSpecProperties: {
        scopeSpec: { type: CodeScopeSpec.Type.Repository, fGuidRequired: true, relationship: "valid" },
        spec: { isManagedWithDgnDb: "invalid" },
        version: "1.0.0",
      },
    },
    {
      reason: "invalid version type",
      codeSpecProperties: {
        scopeSpec: { type: CodeScopeSpec.Type.Repository, fGuidRequired: true, relationship: "valid" },
        spec: { isManagedWithDgnDb: false },
        version: false,
      },
    },
  ];

  for (const { codeSpecProperties, reason } of invalidCodeSpecPropertiesWithWrongTypes) {
    it(`should not validate invalid CodeSpecProperties with ${reason}`, async () => {
      await expectInvalidCodeSpecPropertiesToBeRejected(codeSpecProperties);
    });
  };

  const invalidCodeSpecPropertiesWithMissingProperties = [
    {
      reason: "codeSpecProperties.scopeSpec are undefined",
      codeSpecProperties: {
        scopeSpec: undefined,
        spec: { isManagedWithDgnDb: false },
        version: "1.0.0",
      },
    },
    {
      reason: "codeSpecProperties.scopeSpec.type are undefined",
      codeSpecProperties: {
        scopeSpec: { type: undefined, fGuidRequired: true, relationship: "valid" },
        spec: { isManagedWithDgnDb: false },
        version: "1.0.0",
      },
    },
  ];

  for (const { codeSpecProperties, reason } of invalidCodeSpecPropertiesWithMissingProperties) {
    it(`should not validate invalid CodeSpecProperties when ${reason}`, async () => {
      await expectInvalidCodeSpecPropertiesToBeRejected(codeSpecProperties);
    });
  };
});
