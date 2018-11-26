/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect, assert } from "chai";
import { mount } from "enzyme";
import * as React from "react";
import { Orientation } from "@bentley/ui-core/lib/enums/Orientation";
import TestUtils from "../../../TestUtils";
import { StructPropertyValueRenderer } from "../../../../properties/renderers/value/StructPropertyValueRenderer";
import { PropertyContainerType } from "../../../../properties/ValueRendererManager";
import { TableNonPrimitiveValueRenderer } from "../../../../properties/renderers/value/table/NonPrimitiveValueRenderer";

describe("StructPropertyValueRenderer", () => {
  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  describe("render", () => {
    it("renders struct property", async () => {
      const renderer = new StructPropertyValueRenderer();
      const structProperty = TestUtils.createStructProperty("NameStruct");

      const element = await renderer.render(structProperty);
      const elementMount = mount(<div>{element}</div>);

      expect(elementMount.text()).to.be.eq("{struct}");
    });

    it("renders default way when provided with empty context", async () => {
      const renderer = new StructPropertyValueRenderer();
      const structProperty = TestUtils.createStructProperty("NameStruct");

      const element = await renderer.render(structProperty, {});
      const elementMount = mount(<div>{element}</div>);

      expect(elementMount.text()).to.be.eq("{struct}");
    });

    it("renders struct with Table renderer if container type is Table", async () => {
      const renderer = new StructPropertyValueRenderer();
      const structProperty = TestUtils.createStructProperty("NameStruct");

      const element = await renderer.render(structProperty, { containerType: PropertyContainerType.Table, orientation: Orientation.Vertical });
      const elementMount = mount(<div>{element}</div>);

      expect(elementMount.find(TableNonPrimitiveValueRenderer).exists()).to.be.true;
    });

    it("defaults to horizontal orientation when rendering for a table without specified orientation", async () => {
      const renderer = new StructPropertyValueRenderer();
      const structProperty = TestUtils.createStructProperty("NameStruct");

      const element = await renderer.render(structProperty, { containerType: PropertyContainerType.Table });
      const elementMount = mount(<div>{element}</div>);

      const dialogContentsMount = mount(<div>{elementMount.find(TableNonPrimitiveValueRenderer).prop("dialogContents")}</div>);

      expect(dialogContentsMount.childAt(0).prop("orientation")).to.be.eq(Orientation.Horizontal);
    });

    it("throws when trying to render primitive property", async () => {
      const renderer = new StructPropertyValueRenderer();
      const stringProperty = TestUtils.createPrimitiveStringProperty("Label", "Test property");

      await renderer.render(stringProperty)
        .then(() => { assert.fail(undefined, undefined, "Function did not throw"); })
        .catch(async () => Promise.resolve());
    });
  });

  describe("canRender", () => {
    it("returns true for an struct property", () => {
      const renderer = new StructPropertyValueRenderer();
      const structProperty = TestUtils.createStructProperty("NameStruct");

      expect(renderer.canRender(structProperty)).to.be.true;
    });

    it("returns false for array and struct property", () => {
      const renderer = new StructPropertyValueRenderer();
      const stringProperty = TestUtils.createPrimitiveStringProperty("Label", "Test property");
      const arrayProperty = TestUtils.createArrayProperty("LabelArray");

      expect(renderer.canRender(stringProperty)).to.be.false;
      expect(renderer.canRender(arrayProperty)).to.be.false;
    });
  });
});
