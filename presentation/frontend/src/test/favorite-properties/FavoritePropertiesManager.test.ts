/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* tslint:disable:no-direct-imports */

import { expect } from "chai";
import sinon from "sinon";
import * as moq from "typemoq";
import {
  createRandomNestedContentField, createRandomPropertiesField, createRandomPrimitiveField, createRandomRelatedClassInfo,
} from "@bentley/presentation-common/lib/test/_helpers/random";
import { Field, PropertiesField, NestedContentField, PropertyInfo } from "@bentley/presentation-common";
import { IModelToken } from "@bentley/imodeljs-common";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import {
  FavoritePropertiesManager, IFavoritePropertiesStorage, FavoritePropertiesOrderInfo,
  FavoritePropertiesScope, getFieldInfos, createFieldOrderInfos,
} from "../../presentation-frontend";
import { PropertyFullName } from "../../presentation-frontend/favorite-properties/FavoritePropertiesManager";

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
    propertyField1 = createRandomPropertiesField(); propertyField1.properties[0].property.classInfo.name = "Schema:ClassName1";
    propertyField2 = createRandomPropertiesField(); propertyField2.properties[0].property.classInfo.name = "Schema:ClassName2";
    primitiveField = createRandomPrimitiveField();
    nestedContentField = createRandomNestedContentField([propertyField1, propertyField2, primitiveField]); nestedContentField.contentClassInfo.name = "Schema:NestedContentClassName";
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

    it("loads project and iModel scopes", async () => {
      await manager.initializeConnection(imodelMock.object);
      storageMock.verify((x) => x.loadProperties(undefined, undefined), moq.Times.once());
      storageMock.verify((x) => x.loadProperties(projectId, imodelId), moq.Times.once());
      storageMock.verify((x) => x.loadProperties(projectId, undefined), moq.Times.once());
    });

    it("loads iModel scope when project scope is already loaded", async () => {
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

    it("does not load iModel scope when iModel scope is already loaded", async () => {
      await manager.initializeConnection(imodelMock.object);
      await manager.initializeConnection(imodelMock.object);

      storageMock.verify((x) => x.loadProperties(undefined, undefined), moq.Times.once());
      storageMock.verify((x) => x.loadProperties(projectId, imodelId), moq.Times.once());
      storageMock.verify((x) => x.loadProperties(projectId, undefined), moq.Times.once());
    });

    it("removes non-favorited property order information", async () => {
      const globalField = createRandomPropertiesField();
      const projectField = createRandomPropertiesField();

      const globalFieldInfos = new Set<PropertyFullName>(getFieldsInfos([globalField]));
      storageMock.setup((x) => x.loadProperties()).returns(async () => globalFieldInfos);

      const projectFieldInfos = new Set<PropertyFullName>(getFieldsInfos([projectField]));
      storageMock.setup((x) => x.loadProperties(moq.It.isAny())).returns(async () => projectFieldInfos);

      const nonFavoritedField = createRandomPropertiesField();
      const allFields = [globalField, projectField, nonFavoritedField];
      const orderInfos = getFieldsOrderInfos(allFields);
      storageMock.setup((x) => x.loadPropertiesOrder(moq.It.isAny(), moq.It.isAny())).returns(async () => orderInfos);

      await manager.initializeConnection(imodelMock.object);

      expect(globalFieldInfos.size).to.eq(1);
      expect(projectFieldInfos.size).to.eq(1);
      expect(orderInfos.length).to.eq(2);
    });

    it("adds favorited property order information for those who don't have it", async () => {
      const withOrderInfo = createRandomPropertiesField(); withOrderInfo.properties[0].property.classInfo.name = "Schema:ClassName";
      const allFields = [withOrderInfo, propertyField1, nestedContentField, primitiveField];

      const fieldInfos = new Set<PropertyFullName>(getFieldsInfos(allFields));
      storageMock.setup((x) => x.loadProperties()).returns(async () => fieldInfos);

      const fields = [withOrderInfo];
      const orderInfos = getFieldsOrderInfos(fields);
      storageMock.setup((x) => x.loadPropertiesOrder(moq.It.isAny(), moq.It.isAny())).returns(async () => orderInfos);

      await manager.initializeConnection(imodelMock.object);

      expect(fieldInfos.size).to.eq(4);
      expect(orderInfos.length).to.eq(4);
    });

  });

  describe("deprected has", () => {

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

    it("returns false for not favorite property field", async () => {
      await manager.initializeConnection(imodelMock.object);
      expect(manager.has(propertyField1)).to.be.false;
    });

    it("returns true for favorite property field", async () => {
      await manager.initializeConnection(imodelMock.object);
      await manager.add(propertyField1);
      expect(manager.has(propertyField1)).to.be.true;
    });

    it("returns false for not favorite primitive fields", async () => {
      await manager.initializeConnection(imodelMock.object);
      const field = createRandomPrimitiveField();
      expect(manager.has(field)).to.be.false;
    });

    it("returns true for favorite primitive fields", async () => {
      await manager.initializeConnection(imodelMock.object);
      const field = createRandomPrimitiveField();
      await manager.add(field);
      expect(manager.has(field)).to.be.true;
    });

    it("returns false for not favorite nested content fields", async () => {
      await manager.initializeConnection(imodelMock.object);
      const field = createRandomNestedContentField();
      expect(manager.has(field)).to.be.false;
    });

    it("returns true for favorite nested content fields", async () => {
      await manager.initializeConnection(imodelMock.object);
      const field = createRandomNestedContentField();
      await manager.add(field);
      expect(manager.has(field)).to.be.true;
    });

    it("returns false for not favorite property fields", async () => {
      await manager.initializeConnection(imodelMock.object);
      const field = createRandomPropertiesField();
      expect(manager.has(field)).to.be.false;
    });

    it("returns true for favorite nested fields", async () => {
      await manager.initializeConnection(imodelMock.object);
      const field = createRandomPropertiesField();
      await manager.add(field);
      expect(manager.has(field)).to.be.true;
    });

    it("returns false for not favorite nested fields", async () => {
      await manager.initializeConnection(imodelMock.object);
      const parentField = createRandomNestedContentField();
      const nestedField = createRandomPropertiesField();
      parentField.nestedFields.push(nestedField);
      parentField.rebuildParentship();
      expect(manager.has(nestedField)).to.be.false;
    });

    it("returns true for favorite nested fields", async () => {
      await manager.initializeConnection(imodelMock.object);
      const parentField = createRandomNestedContentField();
      const nestedField = createRandomPropertiesField();
      parentField.nestedFields.push(nestedField);
      parentField.rebuildParentship();
      await manager.add(nestedField);
      expect(manager.has(nestedField)).to.be.true;
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

  describe("has", () => {

    it("throws if not initialized", () => {
      expect(() => manager.has(propertyField1, imodelMock.object, FavoritePropertiesScope.IModel)).to.throw(`Favorite properties are not initialized for iModel: '${imodelId}', in project: '${projectId}'. Call initializeConnection() with an IModelConnection to initialize.`);
    });

    it("returns false for not favorite property field", async () => {
      await manager.initializeConnection(imodelMock.object);
      expect(manager.has(propertyField1, imodelMock.object, FavoritePropertiesScope.Global)).to.be.false;
    });

    it("returns true for favorite property field", async () => {
      await manager.initializeConnection(imodelMock.object);
      await manager.add(propertyField1, imodelMock.object, FavoritePropertiesScope.Global);
      expect(manager.has(propertyField1, imodelMock.object, FavoritePropertiesScope.Global)).to.be.true;
    });

    it("returns false for not favorite primitive fields", async () => {
      await manager.initializeConnection(imodelMock.object);
      const field = createRandomPrimitiveField();
      expect(manager.has(field, imodelMock.object, FavoritePropertiesScope.Global)).to.be.false;
    });

    it("returns true for favorite primitive fields", async () => {
      await manager.initializeConnection(imodelMock.object);
      const field = createRandomPrimitiveField();
      await manager.add(field, imodelMock.object, FavoritePropertiesScope.Global);
      expect(manager.has(field, imodelMock.object, FavoritePropertiesScope.Global)).to.be.true;
    });

    it("returns false for not favorite nested content fields", async () => {
      await manager.initializeConnection(imodelMock.object);
      const field = createRandomNestedContentField();
      expect(manager.has(field, imodelMock.object, FavoritePropertiesScope.Global)).to.be.false;
    });

    it("returns true for favorite nested content fields", async () => {
      await manager.initializeConnection(imodelMock.object);
      const field = createRandomNestedContentField();
      await manager.add(field, imodelMock.object, FavoritePropertiesScope.Global);
      expect(manager.has(field, imodelMock.object, FavoritePropertiesScope.Global)).to.be.true;
    });

    it("returns false for not favorite property fields", async () => {
      await manager.initializeConnection(imodelMock.object);
      const field = createRandomPropertiesField();
      expect(manager.has(field, imodelMock.object, FavoritePropertiesScope.Global)).to.be.false;
    });

    it("returns true for favorite nested fields", async () => {
      await manager.initializeConnection(imodelMock.object);
      const field = createRandomPropertiesField();
      await manager.add(field, imodelMock.object, FavoritePropertiesScope.Global);
      expect(manager.has(field, imodelMock.object, FavoritePropertiesScope.Global)).to.be.true;
    });

    it("returns false for not favorite nested fields", async () => {
      await manager.initializeConnection(imodelMock.object);
      const parentField = createRandomNestedContentField();
      const nestedField = createRandomPropertiesField();
      parentField.nestedFields.push(nestedField);
      parentField.rebuildParentship();
      expect(manager.has(nestedField, imodelMock.object, FavoritePropertiesScope.Global)).to.be.false;
    });

    it("returns true for favorite nested fields", async () => {
      await manager.initializeConnection(imodelMock.object);
      const parentField = createRandomNestedContentField();
      const nestedField = createRandomPropertiesField();
      parentField.nestedFields.push(nestedField);
      parentField.rebuildParentship();
      await manager.add(nestedField, imodelMock.object, FavoritePropertiesScope.Global);
      expect(manager.has(nestedField, imodelMock.object, FavoritePropertiesScope.Global)).to.be.true;
    });

    it("checks iModel scope for favorite properties", async () => {
      await manager.initializeConnection(imodelMock.object);
      await manager.add(propertyField1, imodelMock.object, FavoritePropertiesScope.IModel);
      expect(manager.has(propertyField1, imodelMock.object, FavoritePropertiesScope.IModel)).to.be.true;
    });

    it("checks project scope for favorite properties", async () => {
      await manager.initializeConnection(imodelMock.object);
      await manager.add(propertyField1, imodelMock.object, FavoritePropertiesScope.Project);
      expect(manager.has(propertyField1, imodelMock.object, FavoritePropertiesScope.Project)).to.be.true;
    });

  });

  describe("deprecated add", () => {

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

  describe("add", () => {

    it("throws if not initialized", async () => {
      await expect(manager.add(propertyField1, imodelMock.object, FavoritePropertiesScope.Global)).to.be.rejectedWith(`Favorite properties are not initialized for iModel: '${imodelId}', in project: '${projectId}'. Call initializeConnection() with an IModelConnection to initialize.`);
    });

    it("raises onFavoritesChanged event", async () => {
      await manager.initializeConnection(imodelMock.object);

      const s = sinon.spy(manager.onFavoritesChanged, "raiseEvent");
      await manager.add(nestedContentField, imodelMock.object, FavoritePropertiesScope.Global);
      expect(s).to.be.calledOnce;
    });

    it("adds to project scope", async () => {
      await manager.initializeConnection(imodelMock.object);

      await manager.add(propertyField1, imodelMock.object, FavoritePropertiesScope.Project);
      expect(manager.has(propertyField1, imodelMock.object, FavoritePropertiesScope.Project)).to.be.true;
    });

    it("adds to iModel scope", async () => {
      await manager.initializeConnection(imodelMock.object);

      await manager.add(propertyField1, imodelMock.object, FavoritePropertiesScope.IModel);
      expect(manager.has(propertyField1, imodelMock.object, FavoritePropertiesScope.IModel)).to.be.true;
    });

    it("does not raise onFavoritesChanged event if property is alredy favorite", async () => {
      await manager.initializeConnection(imodelMock.object);
      await manager.add(propertyField1, imodelMock.object, FavoritePropertiesScope.Global);

      const s = sinon.spy(manager.onFavoritesChanged, "raiseEvent");
      await manager.add(propertyField1, imodelMock.object, FavoritePropertiesScope.Global);
      expect(s).to.be.not.called;
    });

    it("adds new favorited properties to the end of the list", async () => {
      await manager.initializeConnection(imodelMock.object);
      await manager.add(propertyField1, imodelMock.object, FavoritePropertiesScope.Global);
      await manager.add(propertyField2, imodelMock.object, FavoritePropertiesScope.Global);
      await manager.add(primitiveField, imodelMock.object, FavoritePropertiesScope.Global);
    });

  });

  describe("deprecated remove", () => {

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

  describe("remove", () => {

    it("throws if not initialized", async () => {
      await expect(manager.remove(propertyField1, imodelMock.object, FavoritePropertiesScope.Global)).to.be.rejectedWith(`Favorite properties are not initialized for iModel: '${imodelId}', in project: '${projectId}'. Call initializeConnection() with an IModelConnection to initialize.`);
    });

    it("removes single property field", async () => {
      await manager.initializeConnection(imodelMock.object);
      await manager.add(propertyField1, imodelMock.object, FavoritePropertiesScope.Global);

      await manager.remove(propertyField1, imodelMock.object, FavoritePropertiesScope.Global);
      expect(manager.has(propertyField1, imodelMock.object, FavoritePropertiesScope.Global)).to.be.false;
    });

    it("removes single nested property field", async () => {
      await manager.initializeConnection(imodelMock.object);
      await manager.add(nestedContentField, imodelMock.object, FavoritePropertiesScope.Global);

      await manager.remove(nestedContentField, imodelMock.object, FavoritePropertiesScope.Global);
      expect(manager.has(nestedContentField, imodelMock.object, FavoritePropertiesScope.Global)).to.be.false;
    });

    it("removes single primitive field", async () => {
      await manager.initializeConnection(imodelMock.object);
      await manager.add(primitiveField, imodelMock.object, FavoritePropertiesScope.Global);

      await manager.remove(primitiveField, imodelMock.object, FavoritePropertiesScope.Global);
      expect(manager.has(primitiveField, imodelMock.object, FavoritePropertiesScope.Global)).to.be.false;
    });

    it("raises onFavoritesChanged event", async () => {
      await manager.initializeConnection(imodelMock.object);
      await manager.add(nestedContentField, imodelMock.object, FavoritePropertiesScope.Global);

      const s = sinon.spy(manager.onFavoritesChanged, "raiseEvent");
      await manager.remove(nestedContentField, imodelMock.object, FavoritePropertiesScope.Global);
      expect(s).to.be.calledOnce;
    });

    it("removes from project scope", async () => {
      await manager.initializeConnection(imodelMock.object);
      await manager.add(propertyField1, imodelMock.object, FavoritePropertiesScope.Project);

      await manager.remove(propertyField1, imodelMock.object, FavoritePropertiesScope.Project);
      expect(manager.has(propertyField1, imodelMock.object, FavoritePropertiesScope.Project)).to.be.false;
    });

    it("removes from iModel scope", async () => {
      await manager.initializeConnection(imodelMock.object);
      await manager.add(propertyField1, imodelMock.object, FavoritePropertiesScope.IModel);

      await manager.remove(propertyField1, imodelMock.object, FavoritePropertiesScope.IModel);
      expect(manager.has(propertyField1, imodelMock.object, FavoritePropertiesScope.IModel)).to.be.false;
    });

    it("removes from all scopes", async () => {
      await manager.initializeConnection(imodelMock.object);
      await manager.add(propertyField1, imodelMock.object, FavoritePropertiesScope.Global);
      await manager.add(propertyField1, imodelMock.object, FavoritePropertiesScope.Project);
      await manager.add(propertyField1, imodelMock.object, FavoritePropertiesScope.IModel);

      await manager.remove(propertyField1, imodelMock.object, FavoritePropertiesScope.IModel);
      expect(manager.has(propertyField1, imodelMock.object, FavoritePropertiesScope.Global)).to.be.false;
      expect(manager.has(propertyField1, imodelMock.object, FavoritePropertiesScope.Project)).to.be.false;
      expect(manager.has(propertyField1, imodelMock.object, FavoritePropertiesScope.IModel)).to.be.false;
    });

    it("removes only from global and project scopes", async () => {
      await manager.initializeConnection(imodelMock.object);
      await manager.add(propertyField1, imodelMock.object, FavoritePropertiesScope.Global);
      await manager.add(propertyField1, imodelMock.object, FavoritePropertiesScope.Project);
      await manager.add(propertyField1, imodelMock.object, FavoritePropertiesScope.IModel);

      await manager.remove(propertyField1, imodelMock.object, FavoritePropertiesScope.Project);
      expect(manager.has(propertyField1, imodelMock.object, FavoritePropertiesScope.Global)).to.be.false;
      expect(manager.has(propertyField1, imodelMock.object, FavoritePropertiesScope.Project)).to.be.false;
      expect(manager.has(propertyField1, imodelMock.object, FavoritePropertiesScope.IModel)).to.be.true;
    });

    it("does not raise onFavoritesChanged event if property is not favorite", async () => {
      await manager.initializeConnection(imodelMock.object);

      const s = sinon.spy(manager.onFavoritesChanged, "raiseEvent");
      await manager.remove(propertyField1, imodelMock.object, FavoritePropertiesScope.Global);
      expect(s).to.be.not.called;
    });

  });

  describe("deprecated clear", () => {

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

  describe("clear", () => {

    it("throws if not initialized", async () => {
      await expect(manager.clear(imodelMock.object, FavoritePropertiesScope.IModel)).to.be.rejectedWith(`Favorite properties are not initialized for iModel: '${imodelId}', in project: '${projectId}'. Call initializeConnection() with an IModelConnection to initialize.`);
    });

    it("clears global", async () => {
      await manager.initializeConnection(imodelMock.object);
      await manager.add(nestedContentField, imodelMock.object, FavoritePropertiesScope.Global);
      await manager.add(primitiveField, imodelMock.object, FavoritePropertiesScope.Global);
      await manager.add(propertyField1, imodelMock.object, FavoritePropertiesScope.Global);

      await manager.clear(imodelMock.object, FavoritePropertiesScope.Global);
      expect(manager.has(nestedContentField, imodelMock.object, FavoritePropertiesScope.Global)).to.be.false;
      expect(manager.has(primitiveField, imodelMock.object, FavoritePropertiesScope.Global)).to.be.false;
      expect(manager.has(propertyField1, imodelMock.object, FavoritePropertiesScope.Global)).to.be.false;
    });

    it("clears project", async () => {
      await manager.initializeConnection(imodelMock.object);

      await manager.add(nestedContentField, imodelMock.object, FavoritePropertiesScope.Project);
      await manager.add(primitiveField, imodelMock.object, FavoritePropertiesScope.Project);
      await manager.add(propertyField1, imodelMock.object, FavoritePropertiesScope.Project);

      await manager.clear(imodelMock.object, FavoritePropertiesScope.Project);
      expect(manager.has(nestedContentField, imodelMock.object, FavoritePropertiesScope.Project)).to.be.false;
      expect(manager.has(primitiveField, imodelMock.object, FavoritePropertiesScope.Project)).to.be.false;
      expect(manager.has(propertyField1, imodelMock.object, FavoritePropertiesScope.Project)).to.be.false;
    });

    it("clears iModel", async () => {
      await manager.initializeConnection(imodelMock.object);

      await manager.add(nestedContentField, imodelMock.object, FavoritePropertiesScope.IModel);
      await manager.add(primitiveField, imodelMock.object, FavoritePropertiesScope.IModel);
      await manager.add(propertyField1, imodelMock.object, FavoritePropertiesScope.IModel);

      await manager.clear(imodelMock.object, FavoritePropertiesScope.IModel);
      expect(manager.has(nestedContentField, imodelMock.object, FavoritePropertiesScope.IModel)).to.be.false;
      expect(manager.has(primitiveField, imodelMock.object, FavoritePropertiesScope.IModel)).to.be.false;
      expect(manager.has(propertyField1, imodelMock.object, FavoritePropertiesScope.IModel)).to.be.false;
    });

    it("does not raise onFavoritesChanged event if there are no favorite properties", async () => {
      await manager.initializeConnection(imodelMock.object);

      const s = sinon.spy(manager.onFavoritesChanged, "raiseEvent");
      await manager.clear(imodelMock.object, FavoritePropertiesScope.Global);
      expect(s).to.be.not.called;
    });

    it("removes property order information", async () => {
      const globalA = createRandomPropertiesField();
      const globalB = createRandomPropertiesField();
      const projectA = createRandomPropertiesField();

      const globalFields = [globalA, globalB];
      const globalFieldInfos = new Set<PropertyFullName>(getFieldsInfos(globalFields));
      storageMock.setup((x) => x.loadProperties()).returns(async () => globalFieldInfos);

      const projectFields = [projectA];
      const projectFieldInfos = new Set<PropertyFullName>(getFieldsInfos(projectFields));
      storageMock.setup((x) => x.loadProperties(moq.It.isAny())).returns(async () => projectFieldInfos);

      const nonFavoritedField = createRandomPropertiesField();
      const allFields = [globalA, globalB, projectA, nonFavoritedField];
      const orderInfos = getFieldsOrderInfos(allFields);
      storageMock.setup((x) => x.loadPropertiesOrder(moq.It.isAny(), moq.It.isAny())).returns(async () => orderInfos);

      await manager.initializeConnection(imodelMock.object);
      await manager.clear(imodelMock.object, FavoritePropertiesScope.Global);

      expect(globalFieldInfos.size).to.eq(0);
      expect(projectFieldInfos.size).to.eq(1);
      expect(orderInfos.length).to.eq(1);
    });

  });

  describe("sortFields", () => {

    it("sorts favorite properties", async () => {
      const a = createRandomPropertiesField();
      const b = createRandomNestedContentField();
      const c = createRandomPrimitiveField();
      const d = createRandomPropertiesField();
      const favoriteFields = [a, b, c, d];

      const fieldInfos = getFieldsInfos(favoriteFields);
      storageMock.setup((x) => x.loadProperties(moq.It.isAny(), moq.It.isAny())).returns(async () => new Set<PropertyFullName>(fieldInfos));
      const orderInfos = getFieldsOrderInfos(favoriteFields);
      storageMock.setup((x) => x.loadPropertiesOrder(moq.It.isAny(), moq.It.isAny())).returns(async () => orderInfos);

      await manager.initializeConnection(imodelMock.object);
      const fields = [b, d, a, c];
      manager.sortFields(imodelMock.object, fields);

      expect(fields[0]).to.eq(a);
      expect(fields[1]).to.eq(b);
      expect(fields[2]).to.eq(c);
      expect(fields[3]).to.eq(d);
    });

    it("sorts partialy non-favorite and favorite properties", async () => {
      const a = createRandomPropertiesField(); a.priority = 1; a.name = "A";
      const b = createRandomPropertiesField(); b.priority = 2; b.name = "B";
      const c = createRandomPropertiesField(); c.priority = 10; c.name = "C";
      const d = createRandomPropertiesField(); d.priority = 10; d.name = "D";
      const e = createRandomPropertiesField(); e.priority = 9; d.name = "E";

      const favoriteFields = [a, b];
      const fieldInfos = getFieldsInfos(favoriteFields);
      storageMock.setup((x) => x.loadProperties(moq.It.isAny(), moq.It.isAny())).returns(async () => new Set<PropertyFullName>(fieldInfos));
      const orderInfos = getFieldsOrderInfos(favoriteFields);
      storageMock.setup((x) => x.loadPropertiesOrder(moq.It.isAny(), moq.It.isAny())).returns(async () => orderInfos);

      await manager.initializeConnection(imodelMock.object);
      const fields = [b, d, e, c, a];
      manager.sortFields(imodelMock.object, fields);

      expect(fields[0]).to.eq(a);
      expect(fields[1]).to.eq(b);
      expect(fields[2]).to.eq(c);
      expect(fields[3]).to.eq(d);
      expect(fields[4]).to.eq(e);
    });

    it("uses fields most recent property to sort by", async () => {
      /** Class hierarhy:
       *  A <- B
       * Field properties:
       * F1 - a1, b1
       * F2 - a2, b2
       * F3 - a3, b3
       */
      const f1 = createRandomPropertiesField(true, 2);
      const a1 = f1.properties[0].property; a1.classInfo.name = "S:A";
      const b1 = f1.properties[1].property; b1.classInfo.name = "S:B";
      const f2 = createRandomPropertiesField(true, 2);
      const a2 = f2.properties[0].property; a2.classInfo.name = "S:A";
      const b2 = f2.properties[1].property; b2.classInfo.name = "S:B";
      const f3 = createRandomPropertiesField(true, 2);
      const a3 = f3.properties[0].property; a3.classInfo.name = "S:A";
      const b3 = f3.properties[1].property; b3.classInfo.name = "S:B";
      const fields = [f1, f2, f3];
      const properties = [a3, a1, a2, b1, b2, b3];

      const fieldInfos = getFieldsInfos(fields);
      storageMock.setup((x) => x.loadProperties(moq.It.isAny(), moq.It.isAny())).returns(async () => new Set<PropertyFullName>(fieldInfos));

      let priority = properties.length;
      const orderInfos = properties.map((property: PropertyInfo): FavoritePropertiesOrderInfo => ({
        parentClassName: property.classInfo.name,
        name: `${property.classInfo.name}:${property.name}`,
        orderedTimestamp: new Date(),
        priority: priority--,
      }));
      orderInfos[3].orderedTimestamp.setDate(orderInfos[3].orderedTimestamp.getDate() + 1); // make b1 more recent than a1
      orderInfos[2].orderedTimestamp.setDate(orderInfos[2].orderedTimestamp.getDate() + 1); // make a2 more recent than b2
      orderInfos[0].orderedTimestamp = orderInfos[5].orderedTimestamp; // make a3 and b3 equal

      storageMock.setup((x) => x.loadPropertiesOrder(moq.It.isAny(), moq.It.isAny())).returns(async () => orderInfos);

      await manager.initializeConnection(imodelMock.object);
      manager.sortFields(imodelMock.object, fields);

      expect(fields[0]).to.eq(f3);
      expect(fields[1]).to.eq(f2);
      expect(fields[2]).to.eq(f1);
    });

  });

  describe("changeFieldPriority", () => {

    it("throws if both fields are the same object", async () => {
      const a = createRandomPropertiesField();
      const allFields = [a];

      const fieldInfos = getFieldsInfos(allFields);
      storageMock.setup((x) => x.loadProperties(moq.It.isAny(), moq.It.isAny())).returns(async () => new Set<PropertyFullName>(fieldInfos));

      const orderInfos = getFieldsOrderInfos(allFields);
      storageMock.setup((x) => x.loadPropertiesOrder(moq.It.isAny(), moq.It.isAny())).returns(async () => orderInfos);

      await manager.initializeConnection(imodelMock.object);
      await expect(manager.changeFieldPriority(imodelMock.object, a, a, allFields)).to.be.rejectedWith("`field` can not be the same as `afterField`.");
    });

    it("throws if given non-visible field", async () => {
      const a = createRandomPropertiesField();
      const b = createRandomPropertiesField();
      const allFields = [a, b];

      const fieldInfos = getFieldsInfos(allFields);
      storageMock.setup((x) => x.loadProperties(moq.It.isAny(), moq.It.isAny())).returns(async () => new Set<PropertyFullName>(fieldInfos));

      const orderInfos = getFieldsOrderInfos(allFields);
      storageMock.setup((x) => x.loadPropertiesOrder(moq.It.isAny(), moq.It.isAny())).returns(async () => orderInfos);

      await manager.initializeConnection(imodelMock.object);
      await expect(manager.changeFieldPriority(imodelMock.object, createRandomPropertiesField(), b, allFields)).to.be.rejectedWith("Field is not contained in visible fields.");
    });

    it("throws if given non-favorite field", async () => {
      const a = createRandomPropertiesField();
      const b = createRandomPropertiesField();
      const allFields = [a, b];

      const fieldInfos = getFieldsInfos(allFields);
      storageMock.setup((x) => x.loadProperties(moq.It.isAny(), moq.It.isAny())).returns(async () => new Set<PropertyFullName>(fieldInfos));

      const orderInfos = getFieldsOrderInfos(allFields);
      storageMock.setup((x) => x.loadPropertiesOrder(moq.It.isAny(), moq.It.isAny())).returns(async () => orderInfos);

      const nonFavoriteField = createRandomPropertiesField();
      const visibleFields = [...allFields, nonFavoriteField];
      await manager.initializeConnection(imodelMock.object);
      await expect(manager.changeFieldPriority(imodelMock.object, nonFavoriteField, b, visibleFields)).to.be.rejectedWith("Field has no property order information.");
    });

    it("throws if given non-visible afterField", async () => {
      const a = createRandomPropertiesField();
      const b = createRandomPropertiesField();
      const allFields = [a, b];

      const fieldInfos = getFieldsInfos(allFields);
      storageMock.setup((x) => x.loadProperties(moq.It.isAny(), moq.It.isAny())).returns(async () => new Set<PropertyFullName>(fieldInfos));

      const orderInfos = getFieldsOrderInfos(allFields);
      storageMock.setup((x) => x.loadPropertiesOrder(moq.It.isAny(), moq.It.isAny())).returns(async () => orderInfos);

      await manager.initializeConnection(imodelMock.object);
      await expect(manager.changeFieldPriority(imodelMock.object, a, createRandomPropertiesField(), allFields)).to.be.rejectedWith("Field is not contained in visible fields.");
    });

    it("throws if given non-favorite afterField", async () => {
      const a = createRandomPropertiesField();
      const b = createRandomPropertiesField();
      const allFields = [a, b];

      const fieldInfos = getFieldsInfos(allFields);
      storageMock.setup((x) => x.loadProperties(moq.It.isAny(), moq.It.isAny())).returns(async () => new Set<PropertyFullName>(fieldInfos));

      const orderInfos = getFieldsOrderInfos(allFields);
      storageMock.setup((x) => x.loadPropertiesOrder(moq.It.isAny(), moq.It.isAny())).returns(async () => orderInfos);

      const nonFavoriteField = createRandomPropertiesField();
      const visibleFields = [...allFields, nonFavoriteField];
      await manager.initializeConnection(imodelMock.object);
      await expect(manager.changeFieldPriority(imodelMock.object, a, nonFavoriteField, visibleFields)).to.be.rejectedWith("Field has no property order information.");
    });

    it("does not query for base classes if it already has it cached", async () => {
      const a = createRandomPropertiesField(); a.properties[0].property.classInfo.name = "S:A";
      const b = createRandomPropertiesField(); b.properties[0].property.classInfo.name = "S:B";
      const allFields = [a, b];

      const classBaseClass = [{ classFullName: "S:A", baseClassFullName: "S:A" },
      { classFullName: "S:B", baseClassFullName: "S:B" }, { classFullName: "S:B", baseClassFullName: "S:A" }];
      imodelMock.setup((x) => x.query(moq.It.isAnyString())).returns(() => createAsyncIterator(classBaseClass));

      const fieldInfos = getFieldsInfos(allFields);
      storageMock.setup((x) => x.loadProperties(moq.It.isAny(), moq.It.isAny())).returns(async () => new Set<PropertyFullName>(fieldInfos));
      const orderInfos = getFieldsOrderInfos(allFields);
      const oldOrderInfo = [...orderInfos];
      storageMock.setup((x) => x.loadPropertiesOrder(moq.It.isAny(), moq.It.isAny())).returns(async () => orderInfos);

      await manager.initializeConnection(imodelMock.object);
      await manager.changeFieldPriority(imodelMock.object, a, b, allFields);
      expect(orderInfos[0]).to.eq(oldOrderInfo[1]); // b
      expect(orderInfos[1]).to.eq(oldOrderInfo[0]); // a

      await manager.changeFieldPriority(imodelMock.object, b, a, allFields);
      expect(orderInfos[0]).to.eq(oldOrderInfo[0]); // a
      expect(orderInfos[1]).to.eq(oldOrderInfo[1]); // b
      imodelMock.verify((x) => x.query(moq.It.isAnyString()), moq.Times.once());
    });

    it("does not change the order of irrelevant properties", async () => {
      /** Class hierarhy:
       *    A
       *   / \
       *  B   C
       * Moving a1 after c:
       *  a1    b1
       *  b1    a2
       *  a2 -> c
       *  b2    a1
       *  c     b2
       */
      const a1 = createRandomPropertiesField(); a1.properties[0].property.classInfo.name = "S:A";
      const b1 = createRandomPropertiesField(); b1.properties[0].property.classInfo.name = "S:B";
      const a2 = createRandomPropertiesField(); a2.properties[0].property.classInfo.name = "S:A";
      const b2 = createRandomPropertiesField(); b2.properties[0].property.classInfo.name = "S:B";
      const c = createRandomPropertiesField(); c.properties[0].property.classInfo.name = "S:C";
      const allFields = [a1, b1, a2, b2, c];
      const visibleFields = [a1, a2, c]; // imitating a selection of a class C instance

      // data of table ECDbMeta.ClassHasAllBaseClasses
      const classBaseClass = [{ classFullName: "S:A", baseClassFullName: "S:A" },
      { classFullName: "S:B", baseClassFullName: "S:B" }, { classFullName: "S:B", baseClassFullName: "S:A" },
      { classFullName: "S:C", baseClassFullName: "S:C" }, { classFullName: "S:C", baseClassFullName: "S:A" }];
      imodelMock.setup((x) => x.query(moq.It.isAnyString())).returns(() => createAsyncIterator(classBaseClass));

      const fieldInfos = getFieldsInfos(allFields);
      storageMock.setup((x) => x.loadProperties(moq.It.isAny(), moq.It.isAny())).returns(async () => new Set<PropertyFullName>(fieldInfos));
      const orderInfos = getFieldsOrderInfos(allFields);
      const oldOrderInfo = [...orderInfos];
      storageMock.setup((x) => x.loadPropertiesOrder(moq.It.isAny(), moq.It.isAny())).returns(async () => orderInfos);

      await manager.initializeConnection(imodelMock.object);
      await manager.changeFieldPriority(imodelMock.object, a1, c, visibleFields);

      expect(orderInfos[0]).to.eq(oldOrderInfo[1]); // b1
      expect(orderInfos[1]).to.eq(oldOrderInfo[2]); // a2
      expect(orderInfos[2]).to.eq(oldOrderInfo[4]); // c
      expect(orderInfos[3]).to.eq(oldOrderInfo[0]); // a1
      expect(orderInfos[4]).to.eq(oldOrderInfo[3]); // b2
    });

    it("does not change the order of irrelevant properties when moving up", async () => {
      /** Class hierarhy:
       *    A
       *   / \
       *  B   C
       * Moving a1 after c:
       *  c     c
       *  b2    b2
       *  a2 -> a1
       *  b1    a2
       *  a1    b1
       */
      const c = createRandomPropertiesField(); c.properties[0].property.classInfo.name = "S:C";
      const b2 = createRandomPropertiesField(); b2.properties[0].property.classInfo.name = "S:B";
      const a2 = createRandomPropertiesField(); a2.properties[0].property.classInfo.name = "S:A";
      const b1 = createRandomPropertiesField(); b1.properties[0].property.classInfo.name = "S:B";
      const a1 = createRandomPropertiesField(); a1.properties[0].property.classInfo.name = "S:A";
      const allFields = [c, b2, a2, b1, a1];
      const visibleFields = [c, a2, a1]; // imitating a selection of a class C instance

      // data of table ECDbMeta.ClassHasAllBaseClasses
      const classBaseClass = [{ classFullName: "S:A", baseClassFullName: "S:A" },
      { classFullName: "S:B", baseClassFullName: "S:B" }, { classFullName: "S:B", baseClassFullName: "S:A" },
      { classFullName: "S:C", baseClassFullName: "S:C" }, { classFullName: "S:C", baseClassFullName: "S:A" }];
      imodelMock.setup((x) => x.query(moq.It.isAnyString())).returns(() => createAsyncIterator(classBaseClass));

      const fieldInfos = getFieldsInfos(allFields);
      storageMock.setup((x) => x.loadProperties(moq.It.isAny(), moq.It.isAny())).returns(async () => new Set<PropertyFullName>(fieldInfos));
      const orderInfos = getFieldsOrderInfos(allFields);
      const oldOrderInfo = [...orderInfos];
      storageMock.setup((x) => x.loadPropertiesOrder(moq.It.isAny(), moq.It.isAny())).returns(async () => orderInfos);

      await manager.initializeConnection(imodelMock.object);
      await manager.changeFieldPriority(imodelMock.object, a1, c, visibleFields);

      expect(orderInfos[0]).to.eq(oldOrderInfo[0]); // c
      expect(orderInfos[1]).to.eq(oldOrderInfo[1]); // b2
      expect(orderInfos[2]).to.eq(oldOrderInfo[4]); // a1
      expect(orderInfos[3]).to.eq(oldOrderInfo[2]); // a2
      expect(orderInfos[4]).to.eq(oldOrderInfo[3]); // b1
    });

    it("does not change the order of irrelevant properties when moving to top", async () => {
      /** Class hierarhy:
       *    A
       *   / \
       *  B   C
       * Moving a1 to top:
       *  c     b2
       *  b2    a1
       *  a2 -> c
       *  b1    a2
       *  a1    b1
       */
      const c = createRandomPropertiesField(); c.properties[0].property.classInfo.name = "S:C";
      const b2 = createRandomPropertiesField(); b2.properties[0].property.classInfo.name = "S:B";
      const a2 = createRandomPropertiesField(); a2.properties[0].property.classInfo.name = "S:A";
      const b1 = createRandomPropertiesField(); b1.properties[0].property.classInfo.name = "S:B";
      const a1 = createRandomPropertiesField(); a1.properties[0].property.classInfo.name = "S:A";
      const allFields = [c, b2, a2, b1, a1];
      const visibleFields = [c, a2, a1]; // imitating a selection of a class C instance

      // data of table ECDbMeta.ClassHasAllBaseClasses
      const classBaseClass = [{ classFullName: "S:A", baseClassFullName: "S:A" },
      { classFullName: "S:B", baseClassFullName: "S:B" }, { classFullName: "S:B", baseClassFullName: "S:A" },
      { classFullName: "S:C", baseClassFullName: "S:C" }, { classFullName: "S:C", baseClassFullName: "S:A" }];
      imodelMock.setup((x) => x.query(moq.It.isAnyString())).returns(() => createAsyncIterator(classBaseClass));

      const fieldInfos = getFieldsInfos(allFields);
      storageMock.setup((x) => x.loadProperties(moq.It.isAny(), moq.It.isAny())).returns(async () => new Set<PropertyFullName>(fieldInfos));
      const orderInfos = getFieldsOrderInfos(allFields);
      const oldOrderInfo = [...orderInfos];
      storageMock.setup((x) => x.loadPropertiesOrder(moq.It.isAny(), moq.It.isAny())).returns(async () => orderInfos);

      await manager.initializeConnection(imodelMock.object);
      await manager.changeFieldPriority(imodelMock.object, a1, undefined, visibleFields);

      expect(orderInfos[0]).to.eq(oldOrderInfo[1]); // b2
      expect(orderInfos[1]).to.eq(oldOrderInfo[4]); // a1
      expect(orderInfos[2]).to.eq(oldOrderInfo[0]); // c
      expect(orderInfos[3]).to.eq(oldOrderInfo[2]); // a2
      expect(orderInfos[4]).to.eq(oldOrderInfo[3]); // b1
    });

    it("does not change non-visible primitive field order with respect to visible fields", async () => {
      /** Class hierarhy:
       *    A
       *   / \
       *  B   C
       * Moving a after c:
       * a       prim
       * b1      c
       * prim -> a
       * b2      b1
       * c       b2
       * Note:
       * prim is a primitive field, only visible having selected class B instances
       */
      const a = createRandomPropertiesField(); a.properties[0].property.classInfo.name = "S:A";
      const b1 = createRandomPropertiesField(); b1.properties[0].property.classInfo.name = "S:B";
      const prim = createRandomPrimitiveField();
      const b2 = createRandomPropertiesField(); b2.properties[0].property.classInfo.name = "S:B";
      const c = createRandomPropertiesField(); c.properties[0].property.classInfo.name = "S:C";
      const allFields = [a, b1, prim, b2, c];
      const visibleFields = [a, c]; // imitating a selection of a class C instance

      // data of table ECDbMeta.ClassHasAllBaseClasses
      const classBaseClass = [{ classFullName: "S:A", baseClassFullName: "S:A" },
      { classFullName: "S:B", baseClassFullName: "S:B" }, { classFullName: "S:B", baseClassFullName: "S:A" },
      { classFullName: "S:C", baseClassFullName: "S:C" }, { classFullName: "S:C", baseClassFullName: "S:A" }];
      imodelMock.setup((x) => x.query(moq.It.isAnyString())).returns(() => createAsyncIterator(classBaseClass));

      const fieldInfos = getFieldsInfos(allFields);
      storageMock.setup((x) => x.loadProperties(moq.It.isAny(), moq.It.isAny())).returns(async () => new Set<PropertyFullName>(fieldInfos));
      const orderInfos = getFieldsOrderInfos(allFields);
      const oldOrderInfo = [...orderInfos];
      storageMock.setup((x) => x.loadPropertiesOrder(moq.It.isAny(), moq.It.isAny())).returns(async () => orderInfos);

      await manager.initializeConnection(imodelMock.object);
      await manager.changeFieldPriority(imodelMock.object, a, c, visibleFields);

      expect(orderInfos[0]).to.eq(oldOrderInfo[2]); // prim
      expect(orderInfos[1]).to.eq(oldOrderInfo[4]); // c
      expect(orderInfos[2]).to.eq(oldOrderInfo[0]); // a
      expect(orderInfos[3]).to.eq(oldOrderInfo[1]); // b1
      expect(orderInfos[4]).to.eq(oldOrderInfo[3]); // b2
    });

    it("treats parent class as the primary class", async () => {
      /** Class hierarhy:
       *    A
       *   / \
       *  B   C
       * Moving a after C.A.a2:
       *  a1       C.A.a2
       *  b     -> a1
       *  C.A.a2   b
       */
      const a1 = createRandomPropertiesField(); a1.properties[0].property.classInfo.name = "S:A";
      const a2 = createRandomPropertiesField(); a2.properties[0].property.classInfo.name = "S:A";
      const b = createRandomPropertiesField(); b.properties[0].property.classInfo.name = "S:B";
      const caa2 = createRandomPropertiesField(); caa2.properties[0] = a2.properties[0];

      const relTop = createRandomRelatedClassInfo();
      relTop.sourceClassInfo.name = "S:A";
      relTop.targetClassInfo.name = "S:C";
      const nestedTop = createRandomNestedContentField();
      nestedTop.pathToPrimaryClass = [relTop];

      const relMiddle = createRandomRelatedClassInfo();
      relMiddle.sourceClassInfo.name = "S:A";
      relMiddle.targetClassInfo.name = "S:A";
      const nestedMiddle = createRandomNestedContentField();
      nestedMiddle.pathToPrimaryClass = [relMiddle];
      nestedMiddle.rebuildParentship(nestedTop);

      caa2.rebuildParentship(nestedMiddle);

      const allFields = [a1, b, caa2];
      const visibleFields = [a1, caa2]; // imitating a selection of a class C instance

      // data of table ECDbMeta.ClassHasAllBaseClasses
      const classBaseClass = [{ classFullName: "S:A", baseClassFullName: "S:A" },
      { classFullName: "S:B", baseClassFullName: "S:B" }, { classFullName: "S:B", baseClassFullName: "S:A" },
      { classFullName: "S:C", baseClassFullName: "S:C" }, { classFullName: "S:C", baseClassFullName: "S:A" }];
      imodelMock.setup((x) => x.query(moq.It.isAnyString())).returns(() => createAsyncIterator(classBaseClass));

      const fieldInfos = getFieldsInfos(allFields);
      storageMock.setup((x) => x.loadProperties(moq.It.isAny(), moq.It.isAny())).returns(async () => new Set<PropertyFullName>(fieldInfos));
      const orderInfos = getFieldsOrderInfos(allFields);
      const oldOrderInfo = [...orderInfos];
      storageMock.setup((x) => x.loadPropertiesOrder(moq.It.isAny(), moq.It.isAny())).returns(async () => orderInfos);

      await manager.initializeConnection(imodelMock.object);
      await manager.changeFieldPriority(imodelMock.object, a1, caa2, visibleFields);

      expect(orderInfos[0]).to.eq(oldOrderInfo[2]); // caa2
      expect(orderInfos[1]).to.eq(oldOrderInfo[0]); // a1
      expect(orderInfos[2]).to.eq(oldOrderInfo[1]); // b
    });

  });

});

async function* createAsyncIterator<T>(list: T[]): AsyncIterableIterator<T> {
  for (const e of list)
    yield e;
}

const getFieldsInfos = (fields: Field[]): PropertyFullName[] => fields.reduce((total: PropertyFullName[], field) => ([...total, ...getFieldInfos(field)]), []);

const getFieldsOrderInfos = (fields: Field[]): FavoritePropertiesOrderInfo[] => {
  const orderInfos = fields.reduce((total: FavoritePropertiesOrderInfo[], field) => ([...total, ...createFieldOrderInfos(field)]), []);
  let priority = orderInfos.length;
  orderInfos.forEach((orderInfo) => orderInfo.priority = priority--);
  return orderInfos;
};
