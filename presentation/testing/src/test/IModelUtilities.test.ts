/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { buildTestIModel, getTestOutputDir, IModelBuilder } from "../presentation-testing";
import * as moq from "typemoq";
import { CodeSpecs, IModelDb, IModelJsFs, SnapshotDb } from "@itwin/core-backend";
import { BisCodeSpec, Code, CodeScopeProps, CodeSpec, CreateEmptySnapshotIModelProps, ElementAspectProps, ElementProps, ModelProps } from "@itwin/core-common";
import { configureForPromiseResult } from "@itwin/presentation-common/lib/cjs/test";
import { SnapshotConnection } from "@itwin/core-frontend";
import sinon, { SinonStub } from "sinon";
import { expect } from "chai";
import { join } from "path";

interface SetupSnapshotResult {
  dbMock: moq.IMock<SnapshotDb>;
  connectionMock: moq.IMock<SnapshotConnection>;
  createSnapshotDb: SinonStub<[filePath: string, options: CreateEmptySnapshotIModelProps], SnapshotDb>;
  openSnapshotConnection: SinonStub<[filePath: string], Promise<SnapshotConnection>>;
}

describe("IModelUtilities", () => {
  describe("IModelBuilder", () => {
    it("insertModel calls iModel.models.insertModel", async () => {
      const imodelMock = moq.Mock.ofType<IModelDb>();
      const modelsMock = moq.Mock.ofType<IModelDb.Models>();
      imodelMock.setup((x) => x.models).returns(() => modelsMock.object);

      const builder = new IModelBuilder(imodelMock.object);
      builder.insertModel({} as ModelProps);

      modelsMock.verify(async (x) => x.insertModel({} as ModelProps), moq.Times.once());
    });

    it("insertElement calls iModel.elements.insertElement", async () => {
      const imodelMock = moq.Mock.ofType<IModelDb>();
      const elementsMock = moq.Mock.ofType<IModelDb.Elements>();
      imodelMock.setup((x) => x.elements).returns(() => elementsMock.object);

      const builder = new IModelBuilder(imodelMock.object);
      builder.insertElement({} as ElementProps);

      elementsMock.verify(async (x) => x.insertElement({} as ElementProps), moq.Times.once());
    });

    it("insertAspect calls iModel.elements.insertAspect", async () => {
      const imodelMock = moq.Mock.ofType<IModelDb>();
      const elementsMock = moq.Mock.ofType<IModelDb.Elements>();
      imodelMock.setup((x) => x.elements).returns(() => elementsMock.object);

      const builder = new IModelBuilder(imodelMock.object);
      builder.insertAspect({} as ElementAspectProps);

      elementsMock.verify(async (x) => x.insertAspect({} as ElementAspectProps), moq.Times.once());
    });

    it("createCode calls iModel.codeSpecs.getByName", () => {
      const imodelMock = moq.Mock.ofType<IModelDb>();
      const codeSpecsMock = moq.Mock.ofType<CodeSpecs>();
      const codeSpecMock = moq.Mock.ofType<CodeSpec>();
      codeSpecsMock.setup((x) => x.getByName(BisCodeSpec.drawing)).returns(() => codeSpecMock.object).verifiable(moq.Times.once());
      imodelMock.setup((x) => x.codeSpecs).returns(() => codeSpecsMock.object);

      const builder = new IModelBuilder(imodelMock.object);
      const result = builder.createCode({} as CodeScopeProps, BisCodeSpec.drawing, "codeValue");

      const expected = new Code({ spec: codeSpecMock.object.id, scope: {} as CodeScopeProps, value: "codeValue" });
      expect(result).to.deep.equal(expected);
      codeSpecsMock.verifyAll();
    });
  });

  describe("buildTestIModel", () => {
    afterEach(() => {
      sinon.restore();
    });

    const setupSnapshot = (): SetupSnapshotResult => {
      const dbMock = moq.Mock.ofType<SnapshotDb>();
      const connectionMock = moq.Mock.ofType<SnapshotConnection>();
      const createSnapshotDb = sinon.stub(SnapshotDb, "createEmpty").returns(dbMock.object);
      const openSnapshotConnection = sinon.stub(SnapshotConnection, "openFile");
      openSnapshotConnection.resolves(connectionMock.object);
      configureForPromiseResult(connectionMock);
      return { dbMock, connectionMock, createSnapshotDb, openSnapshotConnection };
    };

    it("calls IModelJsFs.mkdirSync if directory does not exist", async () => {
      setupSnapshot();
      sinon.stub(IModelJsFs, "existsSync").returns(false);
      const mkdirFake = sinon.fake();
      sinon.replace(IModelJsFs, "mkdirSync", mkdirFake);

      await buildTestIModel("name", () => { });

      expect(mkdirFake.calledOnceWith(getTestOutputDir()));
    });

    it("calls IModelJsFs.unlinkSync if output file exists", async () => {
      const fileName = "fileName";
      setupSnapshot();
      sinon.stub(IModelJsFs, "existsSync").returns(true);
      const unlinkFake = sinon.fake();
      sinon.replace(IModelJsFs, "unlinkSync", unlinkFake);

      await buildTestIModel(fileName, () => { });

      const outputFile = join(getTestOutputDir(), `${fileName}.bim`);
      expect(unlinkFake.calledOnceWith(outputFile));
    });

    it("does not call IModelJsFs.unlinkSync if directory does not exist", async () => {
      setupSnapshot();
      sinon.stub(IModelJsFs, "existsSync").returns(false);
      const mkdirFake = sinon.fake();
      sinon.replace(IModelJsFs, "mkdirSync", mkdirFake);
      const unlinkFake = sinon.fake();
      sinon.replace(IModelJsFs, "unlinkSync", unlinkFake);

      await buildTestIModel("name", () => { });

      expect(unlinkFake.notCalled);
    });

    it("does not call IModelJsFs.mkdirSync if output file exists", async () => {
      const fileName = "fileName";
      setupSnapshot();
      sinon.stub(IModelJsFs, "existsSync").returns(true);
      const mkdirFake = sinon.fake();
      sinon.replace(IModelJsFs, "mkdirSync", mkdirFake);
      const unlinkFake = sinon.fake();
      sinon.replace(IModelJsFs, "unlinkSync", unlinkFake);

      await buildTestIModel(fileName, () => { });

      expect(mkdirFake.notCalled);
    });

    it("calls SnapshotDb.createEmpty with correct parameters", async () => {
      const fileName = "fileName";
      const { createSnapshotDb } = setupSnapshot();

      await buildTestIModel(fileName, () => { });

      expect(createSnapshotDb.firstCall.firstArg).to.include(`${fileName}.bim`);
      expect(createSnapshotDb.firstCall.lastArg).to.deep.equal({ rootSubject: { name: fileName } });
    });

    it("builder calls provided callback function", async () => {
      setupSnapshot();
      const cb = sinon.spy();

      await buildTestIModel("name", cb);

      expect(cb.calledOnce);
    });

    it("builder saves database changes and closes it when callback succeeds", async () => {
      const { dbMock } = setupSnapshot();

      await buildTestIModel("name", () => { });

      dbMock.verify((x) => x.saveChanges("Created test IModel"), moq.Times.once());
      dbMock.verify((x) => x.close(), moq.Times.once());
    });

    it("builder saves database changes and closes it when callback throws", async () => {
      const { dbMock } = setupSnapshot();
      const cb = () => {
        throw new Error("TestError");
      };

      const promise = buildTestIModel("name", cb);

      await expect(promise).to.be.rejectedWith(Error);
      dbMock.verify((x) => x.saveChanges("Created test IModel"), moq.Times.once());
      dbMock.verify((x) => x.close(), moq.Times.once());
    });

    it("returns result of SnapshotConnection.openFile", async () => {
      const { connectionMock } = setupSnapshot();

      const promise = buildTestIModel("name", () => { });
      const result = await promise;

      expect(result).to.equal(connectionMock.object);
    });
  });
});
