/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import sinon from "sinon";
import * as moq from "typemoq";
import { QueryRowFormat } from "@itwin/core-common";
import { IModelConnection } from "@itwin/core-frontend";
import { Field, NestedContentField, PropertiesField, PropertyInfo } from "@itwin/presentation-common";
import {
  createTestECClassInfo, createTestNestedContentField, createTestPropertiesContentField, createTestPropertyInfo, createTestRelatedClassInfo, createTestSimpleContentField,
} from "@itwin/presentation-common/lib/cjs/test";
import {
  createFieldOrderInfos, FavoritePropertiesManager, FavoritePropertiesOrderInfo, FavoritePropertiesScope, getFieldInfos, IFavoritePropertiesStorage,
} from "../../presentation-frontend";
import { PropertyFullName } from "../../presentation-frontend/favorite-properties/FavoritePropertiesManager";

describe("FavoritePropertiesManager", () => {

  let manager: FavoritePropertiesManager;
  let propertyField1: PropertiesField;
  let propertyField2: PropertiesField;
  let primitiveField: Field;
  let nestedContentField: NestedContentField;
  const storageMock = moq.Mock.ofType<IFavoritePropertiesStorage>();

  let iTwinId: string;
  let imodelId: string;
  const imodelMock = moq.Mock.ofType<IModelConnection>();

  before(() => {
    iTwinId = "itwin-id";
    imodelId = "imodel-id";
    propertyField1 = createTestPropertiesContentField({
      properties: [{ property: createTestPropertyInfo({ classInfo: createTestECClassInfo({ name: "Schema:ClassName1" }) }) }],
    });
    propertyField2 = createTestPropertiesContentField({
      properties: [{ property: createTestPropertyInfo({ classInfo: createTestECClassInfo({ name: "Schema:ClassName2" }) }) }],
    });
    primitiveField = createTestSimpleContentField();
    nestedContentField = createTestNestedContentField({
      contentClassInfo: createTestECClassInfo({ name: "Schema:NestedContentClassName" }),
      nestedFields: [propertyField1, propertyField2, primitiveField],
    });
  });

  beforeEach(async () => {
    manager = new FavoritePropertiesManager({ storage: storageMock.object });
    imodelMock.setup((x) => x.iModelId).returns(() => imodelId);
    imodelMock.setup((x) => x.iTwinId).returns(() => iTwinId);
  });

  afterEach(() => {
    manager.dispose();
    storageMock.reset();
    imodelMock.reset();
  });

  describe("initializeConnection", () => {

    it("loads iTwin and iModel scopes", async () => {
      await manager.initializeConnection(imodelMock.object);
      storageMock.verify(async (x) => x.loadProperties(undefined, undefined), moq.Times.once());
      storageMock.verify(async (x) => x.loadProperties(iTwinId, imodelId), moq.Times.once());
      storageMock.verify(async (x) => x.loadProperties(iTwinId, undefined), moq.Times.once());
    });

    it("loads iModel scope when iTwin scope is already loaded", async () => {
      await manager.initializeConnection(imodelMock.object);

      const imodelId2 = "imodel-id-2";
      imodelMock.reset();
      imodelMock.setup((x) => x.iModelId).returns(() => imodelId2);
      imodelMock.setup((x) => x.iTwinId).returns(() => iTwinId);
      await manager.initializeConnection(imodelMock.object);

      storageMock.verify(async (x) => x.loadProperties(undefined, undefined), moq.Times.once());
      storageMock.verify(async (x) => x.loadProperties(iTwinId, imodelId2), moq.Times.once());
      storageMock.verify(async (x) => x.loadProperties(iTwinId, undefined), moq.Times.once());
    });

    it("does not load iModel scope when iModel scope is already loaded", async () => {
      await manager.initializeConnection(imodelMock.object);
      await manager.initializeConnection(imodelMock.object);

      storageMock.verify(async (x) => x.loadProperties(undefined, undefined), moq.Times.once());
      storageMock.verify(async (x) => x.loadProperties(iTwinId, imodelId), moq.Times.once());
      storageMock.verify(async (x) => x.loadProperties(iTwinId, undefined), moq.Times.once());
    });

    it("removes non-favorited property order information", async () => {
      const globalField = createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ name: "global" }) }] });
      const iTwinField = createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ name: "iTwin" }) }] });

      const globalFieldInfos = new Set<PropertyFullName>(getFieldsInfos([globalField]));
      storageMock.setup(async (x) => x.loadProperties()).returns(async () => globalFieldInfos);

      const iTwinFieldInfos = new Set<PropertyFullName>(getFieldsInfos([iTwinField]));
      storageMock.setup(async (x) => x.loadProperties(moq.It.isAny())).returns(async () => iTwinFieldInfos);

      const nonFavoritedField = createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ name: "non-favorite" }) }] });
      const allFields = [globalField, iTwinField, nonFavoritedField];
      const orderInfos = getFieldsOrderInfos(allFields);
      storageMock.setup(async (x) => x.loadPropertiesOrder(moq.It.isAny(), moq.It.isAny())).returns(async () => orderInfos);

      await manager.initializeConnection(imodelMock.object);

      expect(globalFieldInfos.size).to.eq(1);
      expect(iTwinFieldInfos.size).to.eq(1);
      expect(orderInfos.length).to.eq(2);
    });

    it("adds favorited property order information for those who don't have it", async () => {
      const withOrderInfo = createTestPropertiesContentField({
        properties: [{ property: createTestPropertyInfo({ name: "global", classInfo: createTestECClassInfo({ name: "Schema:ClassName" }) }) }],
      });
      const allFields = [withOrderInfo, propertyField1, nestedContentField, primitiveField];

      const fieldInfos = new Set<PropertyFullName>(getFieldsInfos(allFields));
      storageMock.setup(async (x) => x.loadProperties()).returns(async () => fieldInfos);

      const fields = [withOrderInfo];
      const orderInfos = getFieldsOrderInfos(fields);
      storageMock.setup(async (x) => x.loadPropertiesOrder(moq.It.isAny(), moq.It.isAny())).returns(async () => orderInfos);

      await manager.initializeConnection(imodelMock.object);

      expect(fieldInfos.size).to.eq(4);
      expect(orderInfos.length).to.eq(4);
    });

  });

  describe("has", () => {

    it("throws if not initialized", () => {
      expect(() => manager.has(propertyField1, imodelMock.object, FavoritePropertiesScope.IModel)).to.throw(`Favorite properties are not initialized for iModel: '${imodelId}', in iTwin: '${iTwinId}'. Call initializeConnection() with an IModelConnection to initialize.`);
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
      const field = createTestSimpleContentField();
      expect(manager.has(field, imodelMock.object, FavoritePropertiesScope.Global)).to.be.false;
    });

    it("returns true for favorite primitive fields", async () => {
      await manager.initializeConnection(imodelMock.object);
      const field = createTestSimpleContentField();
      await manager.add(field, imodelMock.object, FavoritePropertiesScope.Global);
      expect(manager.has(field, imodelMock.object, FavoritePropertiesScope.Global)).to.be.true;
    });

    it("returns false for not favorite nested content fields", async () => {
      await manager.initializeConnection(imodelMock.object);
      const field = createTestNestedContentField({ nestedFields: [] });
      expect(manager.has(field, imodelMock.object, FavoritePropertiesScope.Global)).to.be.false;
    });

    it("returns true for favorite nested content fields", async () => {
      await manager.initializeConnection(imodelMock.object);
      const field = createTestNestedContentField({ nestedFields: [] });
      await manager.add(field, imodelMock.object, FavoritePropertiesScope.Global);
      expect(manager.has(field, imodelMock.object, FavoritePropertiesScope.Global)).to.be.true;
    });

    it("returns false for not favorite property fields", async () => {
      await manager.initializeConnection(imodelMock.object);
      const field = createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo() }] });
      expect(manager.has(field, imodelMock.object, FavoritePropertiesScope.Global)).to.be.false;
    });

    it("returns true for favorite nested fields", async () => {
      await manager.initializeConnection(imodelMock.object);
      const field = createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo() }] });
      await manager.add(field, imodelMock.object, FavoritePropertiesScope.Global);
      expect(manager.has(field, imodelMock.object, FavoritePropertiesScope.Global)).to.be.true;
    });

    it("returns false for not favorite nested fields", async () => {
      await manager.initializeConnection(imodelMock.object);
      const nestedField = createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo() }] });
      const parentField = createTestNestedContentField({
        nestedFields: [nestedField],
      });
      parentField.rebuildParentship();
      expect(manager.has(nestedField, imodelMock.object, FavoritePropertiesScope.Global)).to.be.false;
    });

    it("returns true for favorite nested fields", async () => {
      await manager.initializeConnection(imodelMock.object);
      const nestedField = createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo() }] });
      const parentField = createTestNestedContentField({
        nestedFields: [nestedField],
      });
      parentField.rebuildParentship();
      await manager.add(nestedField, imodelMock.object, FavoritePropertiesScope.Global);
      expect(manager.has(nestedField, imodelMock.object, FavoritePropertiesScope.Global)).to.be.true;
    });

    it("checks iModel scope for favorite properties", async () => {
      await manager.initializeConnection(imodelMock.object);
      await manager.add(propertyField1, imodelMock.object, FavoritePropertiesScope.IModel);
      expect(manager.has(propertyField1, imodelMock.object, FavoritePropertiesScope.IModel)).to.be.true;
    });

    it("checks iTwin scope for favorite properties", async () => {
      await manager.initializeConnection(imodelMock.object);
      await manager.add(propertyField1, imodelMock.object, FavoritePropertiesScope.ITwin);
      expect(manager.has(propertyField1, imodelMock.object, FavoritePropertiesScope.ITwin)).to.be.true;
    });

  });

  describe("add", () => {

    it("throws if not initialized", async () => {
      await expect(manager.add(propertyField1, imodelMock.object, FavoritePropertiesScope.Global)).to.be.rejectedWith(`Favorite properties are not initialized for iModel: '${imodelId}', in iTwin: '${iTwinId}'. Call initializeConnection() with an IModelConnection to initialize.`);
    });

    it("raises onFavoritesChanged event", async () => {
      await manager.initializeConnection(imodelMock.object);

      const s = sinon.spy(manager.onFavoritesChanged, "raiseEvent");
      await manager.add(nestedContentField, imodelMock.object, FavoritePropertiesScope.Global);
      expect(s).to.be.calledOnce;
    });

    it("adds to iTwin scope", async () => {
      await manager.initializeConnection(imodelMock.object);

      await manager.add(propertyField1, imodelMock.object, FavoritePropertiesScope.ITwin);
      expect(manager.has(propertyField1, imodelMock.object, FavoritePropertiesScope.ITwin)).to.be.true;
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

  describe("remove", () => {

    it("throws if not initialized", async () => {
      await expect(manager.remove(propertyField1, imodelMock.object, FavoritePropertiesScope.Global)).to.be.rejectedWith(`Favorite properties are not initialized for iModel: '${imodelId}', in iTwin: '${iTwinId}'. Call initializeConnection() with an IModelConnection to initialize.`);
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

    it("removes from iTwin scope", async () => {
      await manager.initializeConnection(imodelMock.object);
      await manager.add(propertyField1, imodelMock.object, FavoritePropertiesScope.ITwin);

      await manager.remove(propertyField1, imodelMock.object, FavoritePropertiesScope.ITwin);
      expect(manager.has(propertyField1, imodelMock.object, FavoritePropertiesScope.ITwin)).to.be.false;
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
      await manager.add(propertyField1, imodelMock.object, FavoritePropertiesScope.ITwin);
      await manager.add(propertyField1, imodelMock.object, FavoritePropertiesScope.IModel);

      await manager.remove(propertyField1, imodelMock.object, FavoritePropertiesScope.IModel);
      expect(manager.has(propertyField1, imodelMock.object, FavoritePropertiesScope.Global)).to.be.false;
      expect(manager.has(propertyField1, imodelMock.object, FavoritePropertiesScope.ITwin)).to.be.false;
      expect(manager.has(propertyField1, imodelMock.object, FavoritePropertiesScope.IModel)).to.be.false;
    });

    it("removes only from global and iTwin scopes", async () => {
      await manager.initializeConnection(imodelMock.object);
      await manager.add(propertyField1, imodelMock.object, FavoritePropertiesScope.Global);
      await manager.add(propertyField1, imodelMock.object, FavoritePropertiesScope.ITwin);
      await manager.add(propertyField1, imodelMock.object, FavoritePropertiesScope.IModel);

      await manager.remove(propertyField1, imodelMock.object, FavoritePropertiesScope.ITwin);
      expect(manager.has(propertyField1, imodelMock.object, FavoritePropertiesScope.Global)).to.be.false;
      expect(manager.has(propertyField1, imodelMock.object, FavoritePropertiesScope.ITwin)).to.be.false;
      expect(manager.has(propertyField1, imodelMock.object, FavoritePropertiesScope.IModel)).to.be.true;
    });

    it("does not raise onFavoritesChanged event if property is not favorite", async () => {
      await manager.initializeConnection(imodelMock.object);

      const s = sinon.spy(manager.onFavoritesChanged, "raiseEvent");
      await manager.remove(propertyField1, imodelMock.object, FavoritePropertiesScope.Global);
      expect(s).to.be.not.called;
    });

  });

  describe("clear", () => {

    it("throws if not initialized", async () => {
      await expect(manager.clear(imodelMock.object, FavoritePropertiesScope.IModel)).to.be.rejectedWith(`Favorite properties are not initialized for iModel: '${imodelId}', in iTwin: '${iTwinId}'. Call initializeConnection() with an IModelConnection to initialize.`);
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

    it("clears iTwin", async () => {
      await manager.initializeConnection(imodelMock.object);

      await manager.add(nestedContentField, imodelMock.object, FavoritePropertiesScope.ITwin);
      await manager.add(primitiveField, imodelMock.object, FavoritePropertiesScope.ITwin);
      await manager.add(propertyField1, imodelMock.object, FavoritePropertiesScope.ITwin);

      await manager.clear(imodelMock.object, FavoritePropertiesScope.ITwin);
      expect(manager.has(nestedContentField, imodelMock.object, FavoritePropertiesScope.ITwin)).to.be.false;
      expect(manager.has(primitiveField, imodelMock.object, FavoritePropertiesScope.ITwin)).to.be.false;
      expect(manager.has(propertyField1, imodelMock.object, FavoritePropertiesScope.ITwin)).to.be.false;
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
      const globalA = createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ name: "global-a" }) }] });
      const globalB = createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ name: "global-b" }) }] });
      const iTwinA = createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ name: "iTwin-a" }) }] });

      const globalFields = [globalA, globalB];
      const globalFieldInfos = new Set<PropertyFullName>(getFieldsInfos(globalFields));
      storageMock.setup(async (x) => x.loadProperties()).returns(async () => globalFieldInfos);

      const iTwinFields = [iTwinA];
      const iTwinFieldInfos = new Set<PropertyFullName>(getFieldsInfos(iTwinFields));
      storageMock.setup(async (x) => x.loadProperties(moq.It.isAny())).returns(async () => iTwinFieldInfos);

      const nonFavoritedField = createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ name: "non-favorite" }) }] });
      const allFields = [globalA, globalB, iTwinA, nonFavoritedField];
      const orderInfos = getFieldsOrderInfos(allFields);
      storageMock.setup(async (x) => x.loadPropertiesOrder(moq.It.isAny(), moq.It.isAny())).returns(async () => orderInfos);

      await manager.initializeConnection(imodelMock.object);
      await manager.clear(imodelMock.object, FavoritePropertiesScope.Global);

      expect(globalFieldInfos.size).to.eq(0);
      expect(iTwinFieldInfos.size).to.eq(1);
      expect(orderInfos.length).to.eq(1);
    });

  });

  describe("sortFields", () => {

    it("sorts favorite properties", async () => {
      const a = createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ name: "a" }) }] });
      const b = createTestNestedContentField({ nestedFields: [] });
      const c = createTestSimpleContentField();
      const d = createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ name: "d" }) }] });
      const favoriteFields = [a, b, c, d];

      const fieldInfos = getFieldsInfos(favoriteFields);
      storageMock.setup(async (x) => x.loadProperties(moq.It.isAny(), moq.It.isAny())).returns(async () => new Set<PropertyFullName>(fieldInfos));
      const orderInfos = getFieldsOrderInfos(favoriteFields);
      storageMock.setup(async (x) => x.loadPropertiesOrder(moq.It.isAny(), moq.It.isAny())).returns(async () => orderInfos);

      await manager.initializeConnection(imodelMock.object);
      const fields = [b, d, a, c];
      manager.sortFields(imodelMock.object, fields);

      expect(fields[0]).to.eq(a);
      expect(fields[1]).to.eq(b);
      expect(fields[2]).to.eq(c);
      expect(fields[3]).to.eq(d);
    });

    it("sorts partially non-favorite and favorite properties", async () => {
      const a = createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ name: "a" }) }], priority: 1, name: "A" });
      const b = createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ name: "b" }) }], priority: 2, name: "B" });
      const c = createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ name: "c" }) }], priority: 10, name: "C" });
      const d = createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ name: "d" }) }], priority: 10, name: "D" });
      const e = createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ name: "e" }) }], priority: 9, name: "E" });

      const favoriteFields = [a, b];
      const fieldInfos = getFieldsInfos(favoriteFields);
      storageMock.setup(async (x) => x.loadProperties(moq.It.isAny(), moq.It.isAny())).returns(async () => new Set<PropertyFullName>(fieldInfos));
      const orderInfos = getFieldsOrderInfos(favoriteFields);
      storageMock.setup(async (x) => x.loadPropertiesOrder(moq.It.isAny(), moq.It.isAny())).returns(async () => orderInfos);

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
      /** Class hierarchy:
       *  A <- B
       * Field properties:
       * F1 - a1, b1
       * F2 - a2, b2
       * F3 - a3, b3
       */
      const f1 = createTestPropertiesContentField({
        properties: [
          { property: createTestPropertyInfo({ name: "f1-1", classInfo: createTestECClassInfo({ name: "S:A" }) }) },
          { property: createTestPropertyInfo({ name: "f1-2", classInfo: createTestECClassInfo({ name: "S:B" }) }) },
        ],
      });
      const f2 = createTestPropertiesContentField({
        properties: [
          { property: createTestPropertyInfo({ name: "f2-1", classInfo: createTestECClassInfo({ name: "S:A" }) }) },
          { property: createTestPropertyInfo({ name: "f2-2", classInfo: createTestECClassInfo({ name: "S:B" }) }) },
        ],
      });
      const f3 = createTestPropertiesContentField({
        properties: [
          { property: createTestPropertyInfo({ name: "f3-1", classInfo: createTestECClassInfo({ name: "S:A" }) }) },
          { property: createTestPropertyInfo({ name: "f3-2", classInfo: createTestECClassInfo({ name: "S:B" }) }) },
        ],
      });
      const fields = [f1, f2, f3];
      const properties = [
        f3.properties[0].property,
        f1.properties[0].property,
        f2.properties[0].property,
        f1.properties[1].property,
        f2.properties[1].property,
        f3.properties[1].property,
      ];

      const fieldInfos = getFieldsInfos(fields);
      storageMock.setup(async (x) => x.loadProperties(moq.It.isAny(), moq.It.isAny())).returns(async () => new Set<PropertyFullName>(fieldInfos));

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

      storageMock.setup(async (x) => x.loadPropertiesOrder(moq.It.isAny(), moq.It.isAny())).returns(async () => orderInfos);

      await manager.initializeConnection(imodelMock.object);
      manager.sortFields(imodelMock.object, fields);

      expect(fields[0]).to.eq(f3);
      expect(fields[1]).to.eq(f2);
      expect(fields[2]).to.eq(f1);
    });

  });

  describe("changeFieldPriority", () => {

    it("throws if both fields are the same object", async () => {
      const a = createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ name: "a" }) }] });
      const allFields = [a];

      const fieldInfos = getFieldsInfos(allFields);
      storageMock.setup(async (x) => x.loadProperties(moq.It.isAny(), moq.It.isAny())).returns(async () => new Set<PropertyFullName>(fieldInfos));

      const orderInfos = getFieldsOrderInfos(allFields);
      storageMock.setup(async (x) => x.loadPropertiesOrder(moq.It.isAny(), moq.It.isAny())).returns(async () => orderInfos);

      await manager.initializeConnection(imodelMock.object);
      await expect(manager.changeFieldPriority(imodelMock.object, a, a, allFields)).to.be.rejectedWith("`field` can not be the same as `afterField`.");
    });

    it("throws if given non-visible field", async () => {
      const a = createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ name: "a" }) }] });
      const b = createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ name: "b" }) }] });
      const allFields = [a, b];

      const fieldInfos = getFieldsInfos(allFields);
      storageMock.setup(async (x) => x.loadProperties(moq.It.isAny(), moq.It.isAny())).returns(async () => new Set<PropertyFullName>(fieldInfos));

      const orderInfos = getFieldsOrderInfos(allFields);
      storageMock.setup(async (x) => x.loadPropertiesOrder(moq.It.isAny(), moq.It.isAny())).returns(async () => orderInfos);

      await manager.initializeConnection(imodelMock.object);

      const fakeField = createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ name: "does-not-exist" }) }] });
      await expect(manager.changeFieldPriority(imodelMock.object, fakeField, b, allFields)).to.be.rejectedWith("Field is not contained in visible fields.");
    });

    it("throws if given non-favorite field", async () => {
      const a = createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ name: "a" }) }] });
      const b = createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ name: "b" }) }] });
      const allFields = [a, b];

      const fieldInfos = getFieldsInfos(allFields);
      storageMock.setup(async (x) => x.loadProperties(moq.It.isAny(), moq.It.isAny())).returns(async () => new Set<PropertyFullName>(fieldInfos));

      const orderInfos = getFieldsOrderInfos(allFields);
      storageMock.setup(async (x) => x.loadPropertiesOrder(moq.It.isAny(), moq.It.isAny())).returns(async () => orderInfos);

      const nonFavoriteField = createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ name: "non-favorite" }) }] });
      const visibleFields = [...allFields, nonFavoriteField];
      await manager.initializeConnection(imodelMock.object);
      await expect(manager.changeFieldPriority(imodelMock.object, nonFavoriteField, b, visibleFields)).to.be.rejectedWith("Field has no property order information.");
    });

    it("throws if given non-visible afterField", async () => {
      const a = createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ name: "a" }) }] });
      const b = createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ name: "b" }) }] });
      const allFields = [a, b];

      const fieldInfos = getFieldsInfos(allFields);
      storageMock.setup(async (x) => x.loadProperties(moq.It.isAny(), moq.It.isAny())).returns(async () => new Set<PropertyFullName>(fieldInfos));

      const orderInfos = getFieldsOrderInfos(allFields);
      storageMock.setup(async (x) => x.loadPropertiesOrder(moq.It.isAny(), moq.It.isAny())).returns(async () => orderInfos);

      await manager.initializeConnection(imodelMock.object);

      const fakeField = createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ name: "does-not-exist" }) }] });
      await expect(manager.changeFieldPriority(imodelMock.object, a, fakeField, allFields)).to.be.rejectedWith("Field is not contained in visible fields.");
    });

    it("throws if given non-favorite afterField", async () => {
      const a = createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ name: "a" }) }] });
      const b = createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ name: "b" }) }] });
      const allFields = [a, b];

      const fieldInfos = getFieldsInfos(allFields);
      storageMock.setup(async (x) => x.loadProperties(moq.It.isAny(), moq.It.isAny())).returns(async () => new Set<PropertyFullName>(fieldInfos));

      const orderInfos = getFieldsOrderInfos(allFields);
      storageMock.setup(async (x) => x.loadPropertiesOrder(moq.It.isAny(), moq.It.isAny())).returns(async () => orderInfos);

      const nonFavoriteField = createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ name: "non-favorite" }) }] });
      const visibleFields = [...allFields, nonFavoriteField];
      await manager.initializeConnection(imodelMock.object);
      await expect(manager.changeFieldPriority(imodelMock.object, a, nonFavoriteField, visibleFields)).to.be.rejectedWith("Field has no property order information.");
    });

    it("does not query for base classes if it already has it cached", async () => {
      const a = createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ name: "a", classInfo: createTestECClassInfo({ name: "S:A" }) }) }] });
      const b = createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ name: "b", classInfo: createTestECClassInfo({ name: "S:B" }) }) }] });
      const allFields = [a, b];

      const classBaseClass = [
        { classFullName: "S:A", baseClassFullName: "S:A" },
        { classFullName: "S:B", baseClassFullName: "S:B" },
        { classFullName: "S:B", baseClassFullName: "S:A" },
      ];
      imodelMock.setup((x) => x.query(moq.It.isAnyString(), undefined, QueryRowFormat.UseJsPropertyNames)).returns(() => createAsyncIterator(classBaseClass));

      const fieldInfos = getFieldsInfos(allFields);
      storageMock.setup(async (x) => x.loadProperties(moq.It.isAny(), moq.It.isAny())).returns(async () => new Set<PropertyFullName>(fieldInfos));
      const orderInfos = getFieldsOrderInfos(allFields);
      const oldOrderInfo = [...orderInfos];
      storageMock.setup(async (x) => x.loadPropertiesOrder(moq.It.isAny(), moq.It.isAny())).returns(async () => orderInfos);

      await manager.initializeConnection(imodelMock.object);
      await manager.changeFieldPriority(imodelMock.object, a, b, allFields);
      expect(orderInfos[0]).to.eq(oldOrderInfo[1]); // b
      expect(orderInfos[1]).to.eq(oldOrderInfo[0]); // a

      await manager.changeFieldPriority(imodelMock.object, b, a, allFields);
      expect(orderInfos[0]).to.eq(oldOrderInfo[0]); // a
      expect(orderInfos[1]).to.eq(oldOrderInfo[1]); // b
      imodelMock.verify((x) => x.query(moq.It.isAnyString(), undefined, QueryRowFormat.UseJsPropertyNames), moq.Times.once());
    });

    it("does not change the order of irrelevant properties", async () => {
      /** Class hierarchy:
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
      const a1 = createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ name: "a1", classInfo: createTestECClassInfo({ name: "S:A" }) }) }] });
      const b1 = createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ name: "b1", classInfo: createTestECClassInfo({ name: "S:B" }) }) }] });
      const a2 = createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ name: "a2", classInfo: createTestECClassInfo({ name: "S:A" }) }) }] });
      const b2 = createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ name: "b2", classInfo: createTestECClassInfo({ name: "S:B" }) }) }] });
      const c = createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ name: "c", classInfo: createTestECClassInfo({ name: "S:C" }) }) }] });
      const allFields = [a1, b1, a2, b2, c];
      const visibleFields = [a1, a2, c]; // imitating a selection of a class C instance

      // data of table ECDbMeta.ClassHasAllBaseClasses
      const classBaseClass = [
        { classFullName: "S:A", baseClassFullName: "S:A" },
        { classFullName: "S:B", baseClassFullName: "S:B" },
        { classFullName: "S:B", baseClassFullName: "S:A" },
        { classFullName: "S:C", baseClassFullName: "S:C" },
        { classFullName: "S:C", baseClassFullName: "S:A" },
      ];
      imodelMock.setup((x) => x.query(moq.It.isAnyString(), undefined, QueryRowFormat.UseJsPropertyNames)).returns(() => createAsyncIterator(classBaseClass));

      const fieldInfos = getFieldsInfos(allFields);
      storageMock.setup(async (x) => x.loadProperties(moq.It.isAny(), moq.It.isAny())).returns(async () => new Set<PropertyFullName>(fieldInfos));
      const orderInfos = getFieldsOrderInfos(allFields);
      const oldOrderInfo = [...orderInfos];
      storageMock.setup(async (x) => x.loadPropertiesOrder(moq.It.isAny(), moq.It.isAny())).returns(async () => orderInfos);

      await manager.initializeConnection(imodelMock.object);
      await manager.changeFieldPriority(imodelMock.object, a1, c, visibleFields);

      expect(orderInfos[0]).to.eq(oldOrderInfo[1]); // b1
      expect(orderInfos[1]).to.eq(oldOrderInfo[2]); // a2
      expect(orderInfos[2]).to.eq(oldOrderInfo[4]); // c
      expect(orderInfos[3]).to.eq(oldOrderInfo[0]); // a1
      expect(orderInfos[4]).to.eq(oldOrderInfo[3]); // b2
    });

    it("does not change the order of irrelevant properties when moving up", async () => {
      /** Class hierarchy:
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
      const c = createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ name: "c", classInfo: createTestECClassInfo({ name: "S:C" }) }) }] });
      const b2 = createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ name: "b2", classInfo: createTestECClassInfo({ name: "S:B" }) }) }] });
      const a2 = createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ name: "a2", classInfo: createTestECClassInfo({ name: "S:A" }) }) }] });
      const b1 = createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ name: "b1", classInfo: createTestECClassInfo({ name: "S:B" }) }) }] });
      const a1 = createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ name: "a1", classInfo: createTestECClassInfo({ name: "S:A" }) }) }] });
      const allFields = [c, b2, a2, b1, a1];
      const visibleFields = [c, a2, a1]; // imitating a selection of a class C instance

      // data of table ECDbMeta.ClassHasAllBaseClasses
      const classBaseClass = [
        { classFullName: "S:A", baseClassFullName: "S:A" },
        { classFullName: "S:B", baseClassFullName: "S:B" },
        { classFullName: "S:B", baseClassFullName: "S:A" },
        { classFullName: "S:C", baseClassFullName: "S:C" },
        { classFullName: "S:C", baseClassFullName: "S:A" },
      ];
      imodelMock.setup((x) => x.query(moq.It.isAnyString(), undefined, QueryRowFormat.UseJsPropertyNames)).returns(() => createAsyncIterator(classBaseClass));

      const fieldInfos = getFieldsInfos(allFields);
      storageMock.setup(async (x) => x.loadProperties(moq.It.isAny(), moq.It.isAny())).returns(async () => new Set<PropertyFullName>(fieldInfos));
      const orderInfos = getFieldsOrderInfos(allFields);
      const oldOrderInfo = [...orderInfos];
      storageMock.setup(async (x) => x.loadPropertiesOrder(moq.It.isAny(), moq.It.isAny())).returns(async () => orderInfos);

      await manager.initializeConnection(imodelMock.object);
      await manager.changeFieldPriority(imodelMock.object, a1, c, visibleFields);

      expect(orderInfos[0]).to.eq(oldOrderInfo[0]); // c
      expect(orderInfos[1]).to.eq(oldOrderInfo[1]); // b2
      expect(orderInfos[2]).to.eq(oldOrderInfo[4]); // a1
      expect(orderInfos[3]).to.eq(oldOrderInfo[2]); // a2
      expect(orderInfos[4]).to.eq(oldOrderInfo[3]); // b1
    });

    it("does not change the order of irrelevant properties when moving to top", async () => {
      /** Class hierarchy:
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
      const c = createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ name: "c", classInfo: createTestECClassInfo({ name: "S:C" }) }) }] });
      const b2 = createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ name: "b2", classInfo: createTestECClassInfo({ name: "S:B" }) }) }] });
      const a2 = createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ name: "a2", classInfo: createTestECClassInfo({ name: "S:A" }) }) }] });
      const b1 = createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ name: "b1", classInfo: createTestECClassInfo({ name: "S:B" }) }) }] });
      const a1 = createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ name: "a1", classInfo: createTestECClassInfo({ name: "S:A" }) }) }] });
      const allFields = [c, b2, a2, b1, a1];
      const visibleFields = [c, a2, a1]; // imitating a selection of a class C instance

      // data of table ECDbMeta.ClassHasAllBaseClasses
      const classBaseClass = [
        { classFullName: "S:A", baseClassFullName: "S:A" },
        { classFullName: "S:B", baseClassFullName: "S:B" },
        { classFullName: "S:B", baseClassFullName: "S:A" },
        { classFullName: "S:C", baseClassFullName: "S:C" },
        { classFullName: "S:C", baseClassFullName: "S:A" },
      ];
      imodelMock.setup((x) => x.query(moq.It.isAnyString(), undefined, QueryRowFormat.UseJsPropertyNames)).returns(() => createAsyncIterator(classBaseClass));

      const fieldInfos = getFieldsInfos(allFields);
      storageMock.setup(async (x) => x.loadProperties(moq.It.isAny(), moq.It.isAny())).returns(async () => new Set<PropertyFullName>(fieldInfos));
      const orderInfos = getFieldsOrderInfos(allFields);
      const oldOrderInfo = [...orderInfos];
      storageMock.setup(async (x) => x.loadPropertiesOrder(moq.It.isAny(), moq.It.isAny())).returns(async () => orderInfos);

      await manager.initializeConnection(imodelMock.object);
      await manager.changeFieldPriority(imodelMock.object, a1, undefined, visibleFields);

      expect(orderInfos[0]).to.eq(oldOrderInfo[1]); // b2
      expect(orderInfos[1]).to.eq(oldOrderInfo[4]); // a1
      expect(orderInfos[2]).to.eq(oldOrderInfo[0]); // c
      expect(orderInfos[3]).to.eq(oldOrderInfo[2]); // a2
      expect(orderInfos[4]).to.eq(oldOrderInfo[3]); // b1
    });

    it("does not change non-visible primitive field order with respect to visible fields", async () => {
      /** Class hierarchy:
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

      const a = createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ name: "a", classInfo: createTestECClassInfo({ name: "S:A" }) }) }] });
      const b1 = createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ name: "b1", classInfo: createTestECClassInfo({ name: "S:B" }) }) }] });
      const prim = createTestSimpleContentField();
      const b2 = createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ name: "b2", classInfo: createTestECClassInfo({ name: "S:B" }) }) }] });
      const c = createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ name: "c", classInfo: createTestECClassInfo({ name: "S:C" }) }) }] });
      const allFields = [a, b1, prim, b2, c];
      const visibleFields = [a, c]; // imitating a selection of a class C instance

      // data of table ECDbMeta.ClassHasAllBaseClasses
      const classBaseClass = [
        { classFullName: "S:A", baseClassFullName: "S:A" },
        { classFullName: "S:B", baseClassFullName: "S:B" },
        { classFullName: "S:B", baseClassFullName: "S:A" },
        { classFullName: "S:C", baseClassFullName: "S:C" },
        { classFullName: "S:C", baseClassFullName: "S:A" },
      ];
      imodelMock.setup((x) => x.query(moq.It.isAnyString(), undefined, QueryRowFormat.UseJsPropertyNames)).returns(() => createAsyncIterator(classBaseClass));

      const fieldInfos = getFieldsInfos(allFields);
      storageMock.setup(async (x) => x.loadProperties(moq.It.isAny(), moq.It.isAny())).returns(async () => new Set<PropertyFullName>(fieldInfos));
      const orderInfos = getFieldsOrderInfos(allFields);
      const oldOrderInfo = [...orderInfos];
      storageMock.setup(async (x) => x.loadPropertiesOrder(moq.It.isAny(), moq.It.isAny())).returns(async () => orderInfos);

      await manager.initializeConnection(imodelMock.object);
      await manager.changeFieldPriority(imodelMock.object, a, c, visibleFields);

      expect(orderInfos[0]).to.eq(oldOrderInfo[2]); // prim
      expect(orderInfos[1]).to.eq(oldOrderInfo[4]); // c
      expect(orderInfos[2]).to.eq(oldOrderInfo[0]); // a
      expect(orderInfos[3]).to.eq(oldOrderInfo[1]); // b1
      expect(orderInfos[4]).to.eq(oldOrderInfo[3]); // b2
    });

    it("treats parent class as the primary class", async () => {
      /** Class hierarchy:
       *    A
       *   / \
       *  B   C
       * Moving a after C.A.a2:
       *  a1       C.A.a2
       *  b     -> a1
       *  C.A.a2   b
       */

      const a1 = createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ name: "a1", classInfo: createTestECClassInfo({ name: "S:A" }) }) }] });
      const a2 = createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ name: "a2", classInfo: createTestECClassInfo({ name: "S:A" }) }) }] });
      const b = createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ name: "b", classInfo: createTestECClassInfo({ name: "S:B" }) }) }] });
      const caa2 = createTestPropertiesContentField({ properties: a2.properties });

      const nestedMiddle = createTestNestedContentField({
        pathToPrimaryClass: [createTestRelatedClassInfo({
          sourceClassInfo: createTestECClassInfo({ name: "S:A" }),
          targetClassInfo: createTestECClassInfo({ name: "S:A" }),
        })],
        nestedFields: [caa2],
      });

      const nestedTop = createTestNestedContentField({
        pathToPrimaryClass: [createTestRelatedClassInfo({
          sourceClassInfo: createTestECClassInfo({ name: "S:A" }),
          targetClassInfo: createTestECClassInfo({ name: "S:C" }),
          isForwardRelationship: true,
        })],
        nestedFields: [nestedMiddle],
      });
      nestedTop.rebuildParentship();

      const allFields = [a1, b, caa2];
      const visibleFields = [a1, caa2]; // imitating a selection of a class C instance

      // data of table ECDbMeta.ClassHasAllBaseClasses
      const classBaseClass = [
        { classFullName: "S:A", baseClassFullName: "S:A" },
        { classFullName: "S:B", baseClassFullName: "S:B" },
        { classFullName: "S:B", baseClassFullName: "S:A" },
        { classFullName: "S:C", baseClassFullName: "S:C" },
        { classFullName: "S:C", baseClassFullName: "S:A" },
      ];
      imodelMock.setup((x) => x.query(moq.It.isAnyString(), undefined, QueryRowFormat.UseJsPropertyNames)).returns(() => createAsyncIterator(classBaseClass));

      const fieldInfos = getFieldsInfos(allFields);
      storageMock.setup(async (x) => x.loadProperties(moq.It.isAny(), moq.It.isAny())).returns(async () => new Set<PropertyFullName>(fieldInfos));
      const orderInfos = getFieldsOrderInfos(allFields);
      const oldOrderInfo = [...orderInfos];
      storageMock.setup(async (x) => x.loadPropertiesOrder(moq.It.isAny(), moq.It.isAny())).returns(async () => orderInfos);

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
