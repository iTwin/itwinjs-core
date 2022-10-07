/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { buildTestIModel, getTestOutputDir, IModelBuilder } from "../presentation-testing";
import * as moq from "typemoq";
import { CodeSpecs, IModelDb, IModelJsFs, SnapshotDb } from "@itwin/core-backend";
import { BisCodeSpec, CodeScopeProps, CodeSpec, ElementAspectProps, ElementProps, ModelProps } from "@itwin/core-common";
import { configureForPromiseResult } from "@itwin/presentation-common/lib/cjs/test";
import { SnapshotConnection } from "@itwin/core-frontend";
import sinon from "sinon";
import { expect } from "chai";
import { join } from "path";

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
      builder.createCode({} as CodeScopeProps, BisCodeSpec.drawing, "codeValue");

      codeSpecsMock.verifyAll();
    });
  });

  describe("buildTestIModel", () => {
    afterEach(() => {
      sinon.restore();
    });

    const setupSnapshot = (): moq.IMock<SnapshotDb> => {
      const snapshotDbMock = moq.Mock.ofType<SnapshotDb>();
      sinon.stub(SnapshotDb, "createEmpty").returns(snapshotDbMock.object);
      sinon.stub(SnapshotConnection, "openFile");
      return snapshotDbMock;
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
      const snapshotDbMock = moq.Mock.ofType<SnapshotDb>();
      const fake = sinon.fake.returns(snapshotDbMock.object);
      sinon.replace(SnapshotDb, "createEmpty", fake);
      sinon.stub(SnapshotConnection, "openFile");

      await buildTestIModel(fileName, () => { });

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
      const snapshotDbMock = setupSnapshot();

      await buildTestIModel("name", () => { });

      expect(snapshotDbMock.verify((x) => x.saveChanges("Created test IModel"), moq.Times.once()));
      expect(snapshotDbMock.verify((x) => x.close(), moq.Times.once()));
    });

    it("builder saves database changes and closes it when callback throws", async () => {
      const snapshotDbMock = setupSnapshot();
      const cb = () => {
        throw new Error("TestError");
      };

      try {
        await buildTestIModel("name", cb);
      } catch { }

      expect(snapshotDbMock.verify((x) => x.saveChanges("Created test IModel"), moq.Times.once()));
      expect(snapshotDbMock.verify((x) => x.close(), moq.Times.once()));
    });

    it("returns result of SnapshotConnection.openFile", async () => {
      const snapshotDbMock = moq.Mock.ofType<SnapshotDb>();
      const snapshotConnectionMock = moq.Mock.ofType<SnapshotConnection>();
      sinon.stub(SnapshotDb, "createEmpty").returns(snapshotDbMock.object);
      sinon.stub(SnapshotConnection, "openFile").resolves(snapshotConnectionMock.object);
      configureForPromiseResult(snapshotConnectionMock);

      const promise = buildTestIModel("name", () => { });
      const result = await promise;

      expect(result).to.equal(snapshotConnectionMock.object);
    });
  });
});
