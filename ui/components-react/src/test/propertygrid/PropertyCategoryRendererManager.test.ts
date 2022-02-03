/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import type * as React from "react";
import sinon from "sinon";
import type { MutableGridCategory } from "../../components-react/propertygrid/internal/flat-items/MutableGridCategory";
import { PropertyCategoryRendererManager } from "../../components-react/propertygrid/PropertyCategoryRendererManager";
import { FlatGridTestUtils } from "./component/internal/flat-items/FlatGridTestUtils";

describe("PropertyCategoryRendererManager", () => {
  const TestComponent: React.FC = () => null;

  function createCategoryItem(name: string, renderer: string): MutableGridCategory {
    const categoryItem = FlatGridTestUtils.createMockGridCategory(name);
    sinon.replaceGetter(
      categoryItem,
      "derivedCategory",
      () => ({ name, label: name, expand: false, renderer: { name: renderer } }),
    );
    return categoryItem as unknown as MutableGridCategory;
  }

  describe("addRenderer", () => {
    it("registers category renderer factory", () => {
      const manager = new PropertyCategoryRendererManager();
      const categoryItem = createCategoryItem("test_category", "test_renderer");

      manager.addRenderer("test_renderer", () => TestComponent);

      expect(manager.getCategoryComponent(categoryItem)).to.be.equal(TestComponent);
    });

    it("fails to implicitly override category renderer", () => {
      const manager = new PropertyCategoryRendererManager();

      manager.addRenderer("test_renderer", () => TestComponent);
      expect(() => { manager.addRenderer("test_renderer", () => TestComponent); }).to.throw();
    });

    it("succeeds in overriding a category renderer when requested specifically", () => {
      const manager = new PropertyCategoryRendererManager();
      const categoryItem = createCategoryItem("test_category", "test_renderer");

      manager.addRenderer("test_renderer", () => TestComponent);
      const TestComponent2: React.FC = () => null;
      manager.addRenderer("test_renderer", () => TestComponent2, true);

      expect(manager.getCategoryComponent(categoryItem)).to.be.equal(TestComponent2);
    });
  });

  describe("removeRenderer", () => {
    it("unregisters category renderer", () => {
      const manager = new PropertyCategoryRendererManager();
      const categoryItem = createCategoryItem("test_category", "test_renderer");

      manager.addRenderer("test_renderer", () => TestComponent);
      manager.removeRenderer("test_renderer");

      expect(manager.getCategoryComponent(categoryItem)).to.be.undefined;
    });
  });

  describe("getRenderer", () => {
    it("returns `undefined` when category item does not have custom renderer", () => {
      const manager = new PropertyCategoryRendererManager();
      const categoryItem = FlatGridTestUtils.createMockGridCategory("test_category");

      manager.addRenderer("test_renderer", () => TestComponent);

      expect(manager.getCategoryComponent(categoryItem)).to.be.undefined;
    });

    it("returns `undefined` when category renderer factory returns `undefined`", () => {
      const manager = new PropertyCategoryRendererManager();
      const categoryItem = createCategoryItem("test_category", "test_renderer");

      manager.addRenderer("test_renderer", () => undefined);

      expect(manager.getCategoryComponent(categoryItem)).to.be.undefined;
    });

    it("returns `undefined` when matching category renderer is not found", () => {
      const manager = new PropertyCategoryRendererManager();
      const categoryItem = createCategoryItem("test_category", "test_renderer");

      manager.addRenderer("other_test_renderer", () => TestComponent);

      expect(manager.getCategoryComponent(categoryItem)).to.be.undefined;
    });

    it("returns matching category rendering component", () => {
      const manager = new PropertyCategoryRendererManager();
      const categoryItem = createCategoryItem("test_category", "test_renderer");

      manager.addRenderer("test_renderer", () => TestComponent);

      expect(manager.getCategoryComponent(categoryItem)).to.be.equal(TestComponent);
    });
  });
});
