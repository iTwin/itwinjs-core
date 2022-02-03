/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as sinon from "sinon";
import type { NestedStagePanelsManagerProps, StagePanelsManagerProps} from "../../../appui-layout-react";
import {
  getDefaultStagePanelsManagerProps, NestedStagePanelsManager, StagePanelsManager,
  StagePanelType,
} from "../../../appui-layout-react";

interface CustomPanelsProps extends StagePanelsManagerProps {
  readonly isVisible: boolean;
}

interface CustomNestedProps extends NestedStagePanelsManagerProps {
  readonly panels: { readonly [id in "inner"]: StagePanelsManagerProps } & { readonly [id in "outer"]: CustomPanelsProps };
}

const getDefaultProps = (): CustomNestedProps => ({
  panels: {
    inner: getDefaultStagePanelsManagerProps(),
    outer: {
      ...getDefaultStagePanelsManagerProps(),
      isVisible: true,
    },
  },
});

describe("NestedStagePanelsManager", () => {
  describe("resize", () => {
    it("should resize", () => {
      const props = getDefaultProps();
      const sut = new NestedStagePanelsManager();
      const panelsManager = new StagePanelsManager();
      const newInnerProps = getDefaultStagePanelsManagerProps();
      sinon.stub(sut, "getPanelsManager").returns(panelsManager);
      sinon.stub(panelsManager, "resize").returns(newInnerProps);
      const newProps = sut.resize({ id: "inner", type: StagePanelType.Left }, 20, props);

      newProps.should.not.eq(props);
      newProps.panels.inner.should.eq(newInnerProps);
    });

    it("should not mofidy props if panels did not resize", () => {
      const props = getDefaultProps();
      const sut = new NestedStagePanelsManager();
      const panelsManager = new StagePanelsManager();
      sinon.stub(sut, "getPanelsManager").returns(panelsManager);
      sinon.stub(panelsManager, "resize").returns(props.panels.inner);
      const newProps = sut.resize({ id: "inner", type: StagePanelType.Left }, 20, props);

      newProps.should.eq(props);
    });
  });

  describe("setIsCollapsed", () => {
    it("should set size", () => {
      const props = getDefaultProps();
      const sut = new NestedStagePanelsManager();
      const panelsManager = new StagePanelsManager();
      const newInnerProps = getDefaultStagePanelsManagerProps();
      sinon.stub(sut, "getPanelsManager").returns(panelsManager);
      sinon.stub(panelsManager, "setIsCollapsed").returns(newInnerProps);
      const newProps = sut.setIsCollapsed({ id: "inner", type: StagePanelType.Left }, true, props);

      newProps.should.not.eq(props);
      newProps.panels.inner.should.eq(newInnerProps);
    });

    it("should not modify props if panels size was not set", () => {
      const props = getDefaultProps();
      const sut = new NestedStagePanelsManager();
      const panelsManager = new StagePanelsManager();
      sinon.stub(sut, "getPanelsManager").returns(panelsManager);
      sinon.stub(panelsManager, "setIsCollapsed").returns(props.panels.inner);
      const newProps = sut.setIsCollapsed({ id: "inner", type: StagePanelType.Left }, true, props);

      newProps.should.eq(props);
    });
  });

  describe("setSize", () => {
    it("should set size", () => {
      const props = getDefaultProps();
      const sut = new NestedStagePanelsManager();
      const panelsManager = new StagePanelsManager();
      const newInnerProps = getDefaultStagePanelsManagerProps();
      sinon.stub(sut, "getPanelsManager").returns(panelsManager);
      sinon.stub(panelsManager, "setSize").returns(newInnerProps);
      const newProps = sut.setSize({ id: "inner", type: StagePanelType.Left }, 20, props);

      newProps.should.not.eq(props);
      newProps.panels.inner.should.eq(newInnerProps);
    });

    it("should not modify props if panels size was not set", () => {
      const props = getDefaultProps();
      const sut = new NestedStagePanelsManager();
      const panelsManager = new StagePanelsManager();
      sinon.stub(sut, "getPanelsManager").returns(panelsManager);
      sinon.stub(panelsManager, "setSize").returns(props.panels.inner);
      const newProps = sut.setSize({ id: "inner", type: StagePanelType.Left }, 20, props);

      newProps.should.eq(props);
    });
  });

  describe("getPanelsManager", () => {
    it("should not recreate manager", () => {
      const sut = new NestedStagePanelsManager();
      const panelManager = sut.getPanelsManager(0);
      const panelManager1 = sut.getPanelsManager(0);

      panelManager.should.eq(panelManager1);
    });

    it("should return different manager based on stage panels id", () => {
      const sut = new NestedStagePanelsManager();
      const panelManager = sut.getPanelsManager(0);
      const panelManager1 = sut.getPanelsManager(1);

      panelManager.should.not.eq(panelManager1);
    });
  });
});
