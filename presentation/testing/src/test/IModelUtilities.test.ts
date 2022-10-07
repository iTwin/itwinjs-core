/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { buildTestIModel, IModelBuilder } from "../presentation-testing";
import * as moq from "typemoq";
import { CodeSpecs, IModelDb, IModelJsFs, SnapshotDb } from "@itwin/core-backend";
import { BisCodeSpec, CodeScopeProps, CodeSpec, ElementAspectProps, ElementProps, ModelProps } from "@itwin/core-common";
import { configureForPromiseResult } from "@itwin/presentation-common/lib/cjs/test";
import { SnapshotConnection } from "@itwin/core-frontend";
import sinon from "sinon";
import { expect } from "chai";

describe.only("IModelUtilities", () => {
  let imodelMock: moq.IMock<IModelDb>;
  let modelsMock: moq.IMock<IModelDb.Models>;
  let elementsMock: moq.IMock<IModelDb.Elements>;
  let codeSpecsMock: moq.IMock<CodeSpecs>;
  let codeSpecMock: moq.IMock<CodeSpec>;

  let modelPropsMock: moq.IMock<ModelProps>;
  let elementPropsMock: moq.IMock<ElementProps>;
  let elementAspectPropsMock: moq.IMock<ElementAspectProps>;
  let codeScopePropsMock: moq.IMock<CodeScopeProps>;

  let snapshotDbMock: moq.IMock<SnapshotDb>;
  let snapshotConnectionMock: moq.IMock<SnapshotConnection>;

  afterEach(() => {
    sinon.restore();
  });

  const setupSnapshot = () => {
    snapshotDbMock = moq.Mock.ofType<SnapshotDb>();
    sinon.stub(SnapshotDb, "createEmpty").returns(snapshotDbMock.object);
    sinon.stub(SnapshotConnection, "openFile");
  };

  it("insertModel calls iModel.models.insertModel", async () => {
    imodelMock = moq.Mock.ofType<IModelDb>();
    modelPropsMock = moq.Mock.ofType<ModelProps>();
    modelsMock = moq.Mock.ofType<IModelDb.Models>();
    imodelMock.setup((x) => x.models).returns(() => modelsMock.object);

    const builder = new IModelBuilder(imodelMock.object);
    builder.insertModel(modelPropsMock.object);

    modelsMock.verify(async (x) => x.insertModel(modelPropsMock.object), moq.Times.once());
  });

  it("insertElement calls iModel.models.insertElement", async () => {
    imodelMock = moq.Mock.ofType<IModelDb>();
    elementPropsMock = moq.Mock.ofType<ElementProps>();
    elementsMock = moq.Mock.ofType<IModelDb.Elements>();
    imodelMock.setup((x) => x.elements).returns(() => elementsMock.object);

    const builder = new IModelBuilder(imodelMock.object);
    builder.insertElement(elementPropsMock.object);

    elementsMock.verify(async (x) => x.insertElement(elementPropsMock.object), moq.Times.once());
  });

  it("insertAspect calls iModel.models.insertAspect", async () => {
    imodelMock = moq.Mock.ofType<IModelDb>();
    elementAspectPropsMock = moq.Mock.ofType<ElementAspectProps>();
    elementsMock = moq.Mock.ofType<IModelDb.Elements>();
    imodelMock.setup((x) => x.elements).returns(() => elementsMock.object);

    const builder = new IModelBuilder(imodelMock.object);
    builder.insertAspect(elementAspectPropsMock.object);

    elementsMock.verify(async (x) => x.insertAspect(elementAspectPropsMock.object), moq.Times.once());
  });

  it("createCode calls iModel.codeSpecs.getByName", () => {
    imodelMock = moq.Mock.ofType<IModelDb>();
    codeSpecsMock = moq.Mock.ofType<CodeSpecs>();
    codeScopePropsMock = moq.Mock.ofType<CodeScopeProps>();
    codeSpecMock = moq.Mock.ofType<CodeSpec>();
    codeSpecsMock.setup((x) => x.getByName(BisCodeSpec.drawing)).returns(() => codeSpecMock.object).verifiable(moq.Times.once());
    imodelMock.setup((x) => x.codeSpecs).returns(() => codeSpecsMock.object);

    const builder = new IModelBuilder(imodelMock.object);
    builder.createCode(codeScopePropsMock.object, BisCodeSpec.drawing, "codeValue");

    codeSpecsMock.verifyAll();
  });

  it("calls IModelJsFs.mkdirSync if directory does not exist", async () => {
    setupSnapshot();
    sinon.stub(IModelJsFs, "existsSync").returns(false);
    const mkdirFake = sinon.fake();
    const unlinkFake = sinon.fake();
    sinon.replace(IModelJsFs, "mkdirSync", mkdirFake);
    sinon.replace(IModelJsFs, "unlinkSync", unlinkFake);

    await buildTestIModel("name", () => {});

    expect(mkdirFake.calledOnce);
    expect(unlinkFake.notCalled);
  });

  it("calls IModelJsFs.unlinkSync if output file exists", async () => {
    setupSnapshot();
    sinon.stub(IModelJsFs, "existsSync").returns(true);
    const mkdirFake = sinon.fake();
    const unlinkFake = sinon.fake();
    sinon.replace(IModelJsFs, "mkdirSync", mkdirFake);
    sinon.replace(IModelJsFs, "unlinkSync", unlinkFake);

    await buildTestIModel("name", () => {});

    expect(mkdirFake.notCalled);
    expect(unlinkFake.calledOnce);
  });

  it("calls SnapshotDb.createEmpty with correct parameters", async () => {
    const fileName = "fileName";
    snapshotDbMock = moq.Mock.ofType<SnapshotDb>();
    const fake = sinon.fake.returns(snapshotDbMock.object);
    sinon.replace(SnapshotDb, "createEmpty", fake);
    sinon.stub(SnapshotConnection, "openFile");

    await buildTestIModel(fileName, () => {});

    expect(fake.firstCall.firstArg).to.include(`${fileName}.bim`);
    expect(fake.firstCall.lastArg).to.deep.equal({ rootSubject: { name: fileName } });
  });

  it("builder calls provided callback function", async () => {
    setupSnapshot();
    const cb = sinon.spy();

    await buildTestIModel("name", cb);

    expect(cb.calledOnce);
  });

  it("builder saves database changes and closes it when callback succeeds", async () => {
    setupSnapshot();

    await buildTestIModel("name", () => {});

    expect(snapshotDbMock.verify((x) => x.saveChanges("Created test IModel"), moq.Times.once()));
    expect(snapshotDbMock.verify((x) => x.close(), moq.Times.once()));
  });

  it("builder saves database changes and closes it when callback throws", async () => {
    setupSnapshot();
    const cb = () => {
      throw new Error("TestError");
    };

    try {
      await buildTestIModel("name", cb);
    } catch{}

    expect(snapshotDbMock.verify((x) => x.saveChanges("Created test IModel"), moq.Times.once()));
    expect(snapshotDbMock.verify((x) => x.close(), moq.Times.once()));
  });

  it("returns result of SnapshotConnection.openFile", async () => {
    snapshotDbMock = moq.Mock.ofType<SnapshotDb>();
    snapshotConnectionMock = moq.Mock.ofType<SnapshotConnection>();
    sinon.stub(SnapshotDb, "createEmpty").returns(snapshotDbMock.object);
    sinon.stub(SnapshotConnection, "openFile").resolves(snapshotConnectionMock.object);
    configureForPromiseResult(snapshotConnectionMock);

    const promise = buildTestIModel("name", () => {});
    const result = await promise;

    expect(result).to.equal(snapshotConnectionMock.object);
  });
});
