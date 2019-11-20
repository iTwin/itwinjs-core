/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/* tslint:disable:no-direct-imports */

import { expect } from "chai";
import sinon from "sinon";
import * as moq from "typemoq";
import {
  createRandomNestedContentField, createRandomPropertiesField, createRandomPrimitiveField,
} from "@bentley/presentation-common/lib/test/_helpers/random";
import { Field, PropertiesField, NestedContentField } from "@bentley/presentation-common";
import { IModelToken } from "@bentley/imodeljs-common";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { FavoritePropertiesManager, IFavoritePropertiesStorage } from "../../presentation-frontend";

describe("FavoritePropertiesManager", () => {

  let manager: FavoritePropertiesManager;
  let propertyField1: PropertiesField;
  let propertyField2: PropertiesField;
  let primitiveField: Field;
  let nestedContentField: NestedContentField;
  const storageMock = moq.Mock.ofType<IFavoritePropertiesStorage>();

  let projectId: string;
  let imodelId: string;
  const imodelMock = moq.Mock.ofType<IModelConnection>();
  const imodelTokenMock = moq.Mock.ofType<IModelToken>();

  before(() => {
    projectId = "project-id";
    imodelId = "imodel-id";
    propertyField1 = createRandomPropertiesField();
    propertyField2 = createRandomPropertiesField();
    primitiveField = createRandomPrimitiveField();
    nestedContentField = createRandomNestedContentField([propertyField1, propertyField2, primitiveField]);
  });

  beforeEach(async () => {
    manager = new FavoritePropertiesManager({ storage: storageMock.object });
    imodelTokenMock.setup((x) => x.iModelId).returns(() => imodelId);
    imodelTokenMock.setup((x) => x.contextId).returns(() => projectId);
    imodelMock.setup((x) => x.iModelToken).returns(() => imodelTokenMock.object);
  });

  afterEach(() => {
    storageMock.reset();
    imodelTokenMock.reset();
    imodelMock.reset();
  });

  describe("initializeConnection", () => {

    it("loads project and iModel favorite properties", async () => {
      await manager.initializeConnection(imodelMock.object);
      storageMock.verify((x) => x.loadProperties(undefined, undefined), moq.Times.once());
      storageMock.verify((x) => x.loadProperties(projectId, imodelId), moq.Times.once());
      storageMock.verify((x) => x.loadProperties(projectId, undefined), moq.Times.once());
    });

    it("loads iModel when project is already loaded", async () => {
      await manager.initializeConnection(imodelMock.object);

      const imodelId2 = "imodel-id-2";
      imodelTokenMock.reset();
      imodelTokenMock.setup((x) => x.iModelId).returns(() => imodelId2);
      imodelTokenMock.setup((x) => x.contextId).returns(() => projectId);
      imodelMock.reset();
      imodelMock.setup((x) => x.iModelToken).returns(() => imodelTokenMock.object);
      await manager.initializeConnection(imodelMock.object);

      storageMock.verify((x) => x.loadProperties(undefined, undefined), moq.Times.once());
      storageMock.verify((x) => x.loadProperties(projectId, imodelId2), moq.Times.once());
      storageMock.verify((x) => x.loadProperties(projectId, undefined), moq.Times.once());
    });

    it("loads global when connection does not have IDs", async () => {
      imodelTokenMock.reset();
      imodelTokenMock.setup((x) => x.iModelId).returns(() => undefined);
      imodelTokenMock.setup((x) => x.contextId).returns(() => undefined);
      imodelMock.reset();
      imodelMock.setup((x) => x.iModelToken).returns(() => imodelTokenMock.object);

      await manager.initializeConnection(imodelMock.object);
      storageMock.verify((x) => x.loadProperties(undefined, undefined), moq.Times.once());
      storageMock.verify((x) => x.loadProperties(projectId, undefined), moq.Times.never());
      storageMock.verify((x) => x.loadProperties(projectId, undefined), moq.Times.never());
    });

  });

  describe("has", () => {

    it("throws if not initialized", () => {
      expect(() => manager.has(propertyField1, projectId, imodelId)).to.throw("Favorite properties are not initialized. Call initializeConnection() with an IModelConnection to initialize.");
    });

    it("throws if not initialized for project", async () => {
      await manager.initializeConnection(imodelMock.object);
      const projectId2 = "project-id-2";
      expect(() => manager.has(propertyField1, projectId2, imodelId)).to.throw(`Favorite properties are not initialized for project: ${projectId2}.`);
    });

    it("throws if not initialized for iModel", async () => {
      await manager.initializeConnection(imodelMock.object);
      const imodelId2 = "imodel-id-2";
      expect(() => manager.has(propertyField1, projectId, imodelId2)).to.throw(`Favorite properties are not initialized for iModel: ${imodelId2}. In project: ${projectId}.`);
    });

    it("returns false for not favorited property field", async () => {
      await manager.initializeConnection(imodelMock.object);

      expect(manager.has(propertyField1)).to.be.false;
    });

    it("returns true for favorited property field", async () => {
      await manager.initializeConnection(imodelMock.object);

      await manager.add(propertyField1);
      expect(manager.has(propertyField1)).to.be.true;
    });

    it("returns true for primitive fields that are not nested", async () => {
      await manager.initializeConnection(imodelMock.object);

      const field = createRandomPrimitiveField();
      await manager.add(field);
      expect(manager.has(field)).to.be.true;
    });

    it("checks iModel scope for favorite properties", async () => {
      await manager.initializeConnection(imodelMock.object);
      await manager.add(propertyField1, projectId, imodelId);
      expect(manager.has(propertyField1, projectId, imodelId)).to.be.true;
    });

    it("checks project scope for favorite properties", async () => {
      await manager.initializeConnection(imodelMock.object);
      await manager.add(propertyField1, projectId);
      expect(manager.has(propertyField1, projectId)).to.be.true;
    });

  });

  describe("add", () => {

    it("throws if not initialized", async () => {
      await expect(manager.add(propertyField1, projectId, imodelId)).to.be.rejectedWith("Favorite properties are not initialized. Call initializeConnection() with an IModelConnection to initialize.");
    });

    it("throws if not initialized for project", async () => {
      await manager.initializeConnection(imodelMock.object);
      const projectId2 = "project-id-2";
      await expect(manager.add(propertyField1, projectId2, imodelId)).to.be.rejectedWith(`Favorite properties are not initialized for project: ${projectId2}.`);
    });

    it("throws if not initialized for iModel", async () => {
      await manager.initializeConnection(imodelMock.object);
      const imodelId2 = "imodel-id-2";
      await expect(manager.add(propertyField1, projectId, imodelId2)).to.be.rejectedWith(`Favorite properties are not initialized for iModel: ${imodelId2}. In project: ${projectId}.`);
    });

    it("raises onFavoritesChanged event", async () => {
      await manager.initializeConnection(imodelMock.object);

      const s = sinon.spy(manager.onFavoritesChanged, "raiseEvent");
      await manager.add(nestedContentField);
      expect(s).to.be.calledOnce;
    });

    it("adds to project scope", async () => {
      await manager.initializeConnection(imodelMock.object);

      await manager.add(propertyField1, projectId);
      expect(manager.has(propertyField1, projectId)).to.be.true;
    });

    it("adds to iModel scope", async () => {
      await manager.initializeConnection(imodelMock.object);

      await manager.add(propertyField1, projectId, imodelId);
      expect(manager.has(propertyField1, projectId, imodelId)).to.be.true;
    });

    it("does not raise onFavoritesChanged event if property is alredy favorite", async () => {
      await manager.initializeConnection(imodelMock.object);
      await manager.add(propertyField1);

      const s = sinon.spy(manager.onFavoritesChanged, "raiseEvent");
      await manager.add(propertyField1);
      expect(s).to.be.not.called;
    });

  });

  describe("remove", () => {

    it("throws if not initialized", async () => {
      await expect(manager.remove(propertyField1, projectId, imodelId)).to.be.rejectedWith("Favorite properties are not initialized. Call initializeConnection() with an IModelConnection to initialize.");
    });

    it("throws if not initialized for project", async () => {
      await manager.initializeConnection(imodelMock.object);
      const projectId2 = "project-id-2";
      await expect(manager.remove(propertyField1, projectId2, imodelId)).to.be.rejectedWith(`Favorite properties are not initialized for project: ${projectId2}.`);
    });

    it("throws if not initialized for iModel", async () => {
      await manager.initializeConnection(imodelMock.object);
      const imodelId2 = "imodel-id-2";
      await expect(manager.remove(propertyField1, projectId, imodelId2)).to.be.rejectedWith(`Favorite properties are not initialized for iModel: ${imodelId2}. In project: ${projectId}.`);
    });

    it("removes single property field", async () => {
      await manager.initializeConnection(imodelMock.object);
      await manager.add(propertyField1);

      await manager.remove(propertyField1);
      expect(manager.has(propertyField1)).to.be.false;
    });

    it("removes single nested property field", async () => {
      await manager.initializeConnection(imodelMock.object);
      await manager.add(nestedContentField);

      await manager.remove(nestedContentField);
      expect(manager.has(nestedContentField)).to.be.false;
    });

    it("removes single primitive field", async () => {
      await manager.initializeConnection(imodelMock.object);
      await manager.add(primitiveField);

      await manager.remove(primitiveField);
      expect(manager.has(primitiveField)).to.be.false;
    });

    it("raises onFavoritesChanged event", async () => {
      await manager.initializeConnection(imodelMock.object);
      await manager.add(nestedContentField);

      const s = sinon.spy(manager.onFavoritesChanged, "raiseEvent");
      await manager.remove(nestedContentField);
      expect(s).to.be.calledOnce;
    });

    it("removes from project scope", async () => {
      await manager.initializeConnection(imodelMock.object);
      await manager.add(propertyField1, projectId);

      await manager.remove(propertyField1, projectId);
      expect(manager.has(propertyField1, projectId)).to.be.false;
    });

    it("removes from iModel scope", async () => {
      await manager.initializeConnection(imodelMock.object);
      await manager.add(propertyField1, projectId, imodelId);

      await manager.remove(propertyField1, projectId, imodelId);
      expect(manager.has(propertyField1, projectId, imodelId)).to.be.false;
    });

    it("removes from all scopes", async () => {
      await manager.initializeConnection(imodelMock.object);
      await manager.add(propertyField1);
      await manager.add(propertyField1, projectId);
      await manager.add(propertyField1, projectId, imodelId);

      await manager.remove(propertyField1, projectId, imodelId);
      expect(manager.has(propertyField1)).to.be.false;
      expect(manager.has(propertyField1, projectId)).to.be.false;
      expect(manager.has(propertyField1, projectId, imodelId)).to.be.false;
    });

    it("removes only from global and project scopes", async () => {
      await manager.initializeConnection(imodelMock.object);
      await manager.add(propertyField1);
      await manager.add(propertyField1, projectId);
      await manager.add(propertyField1, projectId, imodelId);

      await manager.remove(propertyField1, projectId);
      expect(manager.has(propertyField1)).to.be.false;
      expect(manager.has(propertyField1, projectId)).to.be.false;
      expect(manager.has(propertyField1, projectId, imodelId)).to.be.true;
    });

    it("does not raise onFavoritesChanged event if property is not favorite", async () => {
      await manager.initializeConnection(imodelMock.object);

      const s = sinon.spy(manager.onFavoritesChanged, "raiseEvent");
      await manager.remove(propertyField1);
      expect(s).to.be.not.called;
    });

  });

  describe("clear", () => {

    it("throws if not initialized", async () => {
      await expect(manager.clear(projectId, imodelId)).to.be.rejectedWith("Favorite properties are not initialized. Call initializeConnection() with an IModelConnection to initialize.");
    });

    it("throws if not initialized for project", async () => {
      await manager.initializeConnection(imodelMock.object);
      const projectId2 = "project-id-2";
      await expect(manager.clear(projectId2, imodelId)).to.be.rejectedWith(`Favorite properties are not initialized for project: ${projectId2}.`);
    });

    it("throws if not initialized for iModel", async () => {
      await manager.initializeConnection(imodelMock.object);
      const imodelId2 = "imodel-id-2";
      await expect(manager.clear(projectId, imodelId2)).to.be.rejectedWith(`Favorite properties are not initialized for iModel: ${imodelId2}. In project: ${projectId}.`);
    });

    it("clears global", async () => {
      await manager.initializeConnection(imodelMock.object);
      await manager.add(nestedContentField);
      await manager.add(primitiveField);
      await manager.add(propertyField1);

      await manager.clear();
      expect(manager.has(nestedContentField)).to.be.false;
      expect(manager.has(primitiveField)).to.be.false;
      expect(manager.has(propertyField1)).to.be.false;
    });

    it("clears project", async () => {
      await manager.initializeConnection(imodelMock.object);

      await manager.add(nestedContentField, projectId);
      await manager.add(primitiveField, projectId);
      await manager.add(propertyField1, projectId);

      await manager.clear(projectId);
      expect(manager.has(nestedContentField, projectId)).to.be.false;
      expect(manager.has(primitiveField, projectId)).to.be.false;
      expect(manager.has(propertyField1, projectId)).to.be.false;
    });

    it("clears iModel", async () => {
      await manager.initializeConnection(imodelMock.object);

      await manager.add(nestedContentField, projectId, imodelId);
      await manager.add(primitiveField, projectId, imodelId);
      await manager.add(propertyField1, projectId, imodelId);

      await manager.clear(projectId, imodelId);
      expect(manager.has(nestedContentField, projectId, imodelId)).to.be.false;
      expect(manager.has(primitiveField, projectId, imodelId)).to.be.false;
      expect(manager.has(propertyField1, projectId, imodelId)).to.be.false;
    });

    it("does not raise onFavoritesChanged event if there are no favorite properties", async () => {
      await manager.initializeConnection(imodelMock.object);

      const s = sinon.spy(manager.onFavoritesChanged, "raiseEvent");
      await manager.clear();
      expect(s).to.be.not.called;
    });

  });

});
