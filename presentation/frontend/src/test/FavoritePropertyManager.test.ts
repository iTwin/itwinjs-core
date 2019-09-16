/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/* tslint:disable:no-direct-imports */

import { expect } from "chai";
import sinon from "sinon";
import {
  createRandomNestedContentField, createRandomPropertiesField, createRandomPrimitiveField,
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
    primitiveField = createRandomPrimitiveField();
    nestedContentField = createRandomNestedContentField([propertyField1, propertyField2, primitiveField]);
  });

  beforeEach(() => {
    manager = new FavoritePropertyManager();
  });

  describe("has", () => {

    it("returns false for not favorited property field", () => {
      expect(manager.has(propertyField1)).to.be.false;
    });

    it("returns true for favorited property field", () => {
      manager.add(propertyField1);
      expect(manager.has(propertyField1)).to.be.true;
    });

    it("returns true for nested content field if it contains favorite property", () => {
      manager.add(propertyField1);
      expect(manager.has(nestedContentField)).to.be.true;
    });

    it("returns true for primitive fields that are not nested", () => {
      const field = createRandomPrimitiveField();
      manager.add(field);
      expect(manager.has(field)).to.be.true;
    });

  });

  describe("add", () => {

    it("adds all properties from root field", async () => {
      manager.add(nestedContentField);
      expect(manager.has(propertyField1)).to.be.true;
      expect(manager.has(propertyField2)).to.be.true;
      expect(manager.has(primitiveField)).to.be.true;
    });

    it("raises onFavoritesChanged event", () => {
      const s = sinon.spy(manager.onFavoritesChanged, "raiseEvent");
      manager.add(nestedContentField);
      expect(s).to.be.calledOnce;
    });

    it("does not raise onFavoritesChanged event if property is alredy favorite", () => {
      manager.add(propertyField1);

      const s = sinon.spy(manager.onFavoritesChanged, "raiseEvent");
      manager.add(propertyField1);
      expect(s).to.be.not.called;
    });

  });

  describe("remove", () => {

    it("removes single property field", () => {
      manager.add(propertyField1);

      manager.remove(propertyField1);
      expect(manager.has(propertyField1)).to.be.false;
    });

    it("removes all properties under root field", () => {
      manager.add(nestedContentField);

      manager.remove(nestedContentField);
      expect(manager.has(propertyField1)).to.be.false;
      expect(manager.has(propertyField2)).to.be.false;
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
