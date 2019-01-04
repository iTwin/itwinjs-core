/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { mount } from "enzyme";
import * as React from "react";
import { Orientation } from "@bentley/ui-core";
import TestUtils from "../../../TestUtils";
import { PropertyContainerType } from "../../../../properties/ValueRendererManager";
import { ArrayPropertyValueRenderer } from "../../../../properties/renderers/value/ArrayPropertyValueRenderer";
import { TableNonPrimitiveValueRenderer } from "../../../../properties/renderers/value/table/NonPrimitiveValueRenderer";

describe("ArrayPropertyValueRenderer", () => {
  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  describe("render", () => {
    it("renders non empty array property", () => {
      const renderer = new ArrayPropertyValueRenderer();
      const stringProperty = TestUtils.createPrimitiveStringProperty("Label", "Test property");
      const arrayProperty = TestUtils.createArrayProperty("LabelArray", [stringProperty]);

      const element = renderer.render(arrayProperty);
      const elementMount = mount(<div>{element}</div>);

      expect(elementMount.text()).to.be.eq("string[1]");
    });

    it("renders empty array property", () => {
      const renderer = new ArrayPropertyValueRenderer();
      const arrayProperty = TestUtils.createArrayProperty("LabelArray");

      const element = renderer.render(arrayProperty);
      const elementMount = mount(<div>{element}</div>);

      expect(elementMount.text()).to.be.eq("string[]");
    });

    it("renders default way if empty context is provided", () => {
      const renderer = new ArrayPropertyValueRenderer();
      const arrayProperty = TestUtils.createArrayProperty("LabelArray");

      const element = renderer.render(arrayProperty, {});
      const elementMount = mount(<div>{element}</div>);

      expect(elementMount.text()).to.be.eq("string[]");
    });

    it("renders array with Table renderer if container type is Table", () => {
      const renderer = new ArrayPropertyValueRenderer();
      const arrayProperty = TestUtils.createArrayProperty("LabelArray");

      const element = renderer.render(arrayProperty, { containerType: PropertyContainerType.Table, orientation: Orientation.Vertical });
      const elementMount = mount(<div>{element}</div>);

      expect(elementMount.find(TableNonPrimitiveValueRenderer).exists()).to.be.true;
    });

    it("defaults to horizontal orientation when rendering for a table without specified orientation", () => {
      const renderer = new ArrayPropertyValueRenderer();
      const arrayProperty = TestUtils.createArrayProperty("LabelArray");

      const element = renderer.render(arrayProperty, { containerType: PropertyContainerType.Table });
      const elementMount = mount(<div>{element}</div>);

      const dialogContentsMount = mount(<div>{elementMount.find(TableNonPrimitiveValueRenderer).prop("dialogContents")}</div>);

      expect(dialogContentsMount.childAt(0).prop("orientation")).to.be.eq(Orientation.Horizontal);
    });

    it("throws when trying to render primitive property", () => {
      const renderer = new ArrayPropertyValueRenderer();
      const stringProperty = TestUtils.createPrimitiveStringProperty("Label", "Test property");
      expect(() => renderer.render(stringProperty)).to.throw;
    });
  });

  describe("canRender", () => {
    it("returns true for an array property", () => {
      const renderer = new ArrayPropertyValueRenderer();
      const arrayProperty = TestUtils.createArrayProperty("LabelArray");
      expect(renderer.canRender(arrayProperty)).to.be.true;
    });

    it("returns false for primitive and struct property", () => {
      const renderer = new ArrayPropertyValueRenderer();
      const stringProperty = TestUtils.createPrimitiveStringProperty("Label", "Test property");
      const structProperty = TestUtils.createStructProperty("NameStruct");
      expect(renderer.canRender(stringProperty)).to.be.false;
      expect(renderer.canRender(structProperty)).to.be.false;
    });
  });
});
