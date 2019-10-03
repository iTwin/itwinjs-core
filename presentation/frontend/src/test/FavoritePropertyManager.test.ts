/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/* tslint:disable:no-direct-imports */

import { expect } from "chai";
import sinon from "sinon";
import {
  createRandomNestedContentField, createRandomPropertiesField, createRandomPrimitiveField, createRandomPropertyJSON,
} from "@bentley/presentation-common/lib/test/_helpers/random";
import { Field, PropertiesField, NestedContentField } from "@bentley/presentation-common";
import { FavoritePropertyManager } from "../FavoritePropertyManager";

describe("FavoritePropertyManager", () => {

  let manager: FavoritePropertyManager;
  let propertyField1: PropertiesField;
  let propertyField2: PropertiesField;
  let primitiveField: Field;
  let nestedContentField: NestedContentField;

  before(() => {
    propertyField1 = createRandomPropertiesField();
    propertyField2 = createRandomPropertiesField();
    propertyField2.properties = propertyField1.properties;
    primitiveField = createRandomPrimitiveField();
    nestedContentField = createRandomNestedContentField([createRandomPropertiesField()]);
  });

  beforeEach(() => {
    manager = new FavoritePropertyManager();
  });

  describe("has", () => {

    it("handles property fields", () => {
      expect(manager.has(propertyField1)).to.be.false;
      expect(manager.has(propertyField2)).to.be.false;
      manager.add(propertyField1);
      expect(manager.has(propertyField1)).to.be.true;
      expect(manager.has(propertyField2)).to.be.true;
    });

    it("handles nested content fields", () => {
      expect(manager.has(nestedContentField)).to.be.false;
      manager.add(nestedContentField);
      expect(manager.has(nestedContentField)).to.be.true;
    });

    it("returns true for primitive fields", () => {
      expect(manager.has(primitiveField)).to.be.false;
      manager.add(primitiveField);
      expect(manager.has(primitiveField)).to.be.true;
      expect(manager.has(createRandomPrimitiveField())).to.be.false;
    });

  });

  describe("add", () => {

    it("adds all properties from properties field", async () => {
      const p1 = createRandomPropertyJSON();
      const p2 = createRandomPropertyJSON();
      const p3 = createRandomPropertyJSON();
      propertyField1.properties = [p1, p2];
      manager.add(propertyField1);

      propertyField2.properties = [];
      expect(manager.has(propertyField2)).to.be.false;

      propertyField2.properties = [p3];
      expect(manager.has(propertyField2)).to.be.false;

      propertyField2.properties = [p2];
      expect(manager.has(propertyField2)).to.be.true;

      propertyField2.properties = [p1];
      expect(manager.has(propertyField2)).to.be.true;

      propertyField2.properties = [p1, p2, p3];
      expect(manager.has(propertyField2)).to.be.true;
    });

    it("raises onFavoritesChanged event", () => {
      const s = sinon.spy(manager.onFavoritesChanged, "raiseEvent");
      manager.add(nestedContentField);
      expect(s).to.be.calledOnce;
    });

    it("does not raise onFavoritesChanged event if property is already favorite", () => {
      manager.add(propertyField1);

      const s = sinon.spy(manager.onFavoritesChanged, "raiseEvent");
      manager.add(propertyField1);
      expect(s).to.be.not.called;
    });

  });

  describe("remove", () => {

    it("removes all properties from properties field", async () => {
      const p1 = createRandomPropertyJSON();
      const p2 = createRandomPropertyJSON();
      const p3 = createRandomPropertyJSON();
      propertyField1.properties = [p1, p2];
      manager.add(propertyField1);

      propertyField2.properties = [];
      manager.remove(propertyField2);
      expect(manager.has(propertyField1)).to.be.true;

      propertyField2.properties = [p2, p3];
      manager.remove(propertyField2);
      expect(manager.has(propertyField1)).to.be.true;

      propertyField2.properties = [p1];
      manager.remove(propertyField2);
      expect(manager.has(propertyField1)).to.be.false;
    });

    it("removes nested content field", () => {
      manager.add(nestedContentField);
      expect(manager.has(nestedContentField)).to.be.true;
      manager.remove(nestedContentField);
      expect(manager.has(nestedContentField)).to.be.false;
    });

    it("removes primitive field", () => {
      manager.add(primitiveField);
      expect(manager.has(primitiveField)).to.be.true;
      manager.remove(primitiveField);
      expect(manager.has(primitiveField)).to.be.false;
    });

    it("raises onFavoritesChanged event", () => {
      manager.add(nestedContentField);

      const s = sinon.spy(manager.onFavoritesChanged, "raiseEvent");
      manager.remove(nestedContentField);
      expect(s).to.be.calledOnce;
    });

    it("does not raise onFavoritesChanged event if property is not favorite", () => {
      const s = sinon.spy(manager.onFavoritesChanged, "raiseEvent");
      manager.remove(propertyField1);
      expect(s).to.be.not.called;
    });

  });
});
