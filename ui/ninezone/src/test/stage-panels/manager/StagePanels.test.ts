/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as sinon from "sinon";
import {
  getDefaultStagePanelManagerProps, getDefaultStagePanelsManagerProps, StagePanelManager, StagePanelManagerProps, StagePanelsManager, StagePanelsManagerProps,
  StagePanelType,
} from "../../../appui-layout-react";

interface CustomPanel extends StagePanelManagerProps {
  customProp: string;
}

interface CustomPanels extends StagePanelsManagerProps {
  readonly bottom: CustomPanel;
}

describe("StagePanelsManager", () => {
  describe("getPanel", () => {
    it("should return bottom panel", () => {
      const props = getDefaultStagePanelsManagerProps();
      const panel = StagePanelsManager.getPanel(StagePanelType.Bottom, props);
      panel.should.eq(props.bottom);
    });

    it("should return left panel", () => {
      const props = getDefaultStagePanelsManagerProps();
      const panel = StagePanelsManager.getPanel(StagePanelType.Left, props);
      panel.should.eq(props.left);
    });

    it("should return right panel", () => {
      const props = getDefaultStagePanelsManagerProps();
      const panel = StagePanelsManager.getPanel(StagePanelType.Right, props);
      panel.should.eq(props.right);
    });

    it("should return top panel", () => {
      const props = getDefaultStagePanelsManagerProps();
      const panel = StagePanelsManager.getPanel(StagePanelType.Top, props);
      panel.should.eq(props.top);
    });

    it("should throw for unknown panel type", () => {
      const props = getDefaultStagePanelsManagerProps();
      (() => StagePanelsManager.getPanel(10, props)).should.throw();
    });

    it("should return bottom panel of custom type", () => {
      const props: CustomPanels = {
        ...getDefaultStagePanelsManagerProps(),
        bottom: {
          ...getDefaultStagePanelManagerProps(),
          customProp: "custompropvalue",
        },
      };
      const panel = StagePanelsManager.getPanel(StagePanelType.Bottom, props);
      panel.customProp.should.eq("custompropvalue");
    });

    it("should return left panel of custom type", () => {
      const panel = StagePanelsManager.getPanel(StagePanelType.Left, {
        ...getDefaultStagePanelsManagerProps(),
        left: {
          ...getDefaultStagePanelManagerProps(),
          asd: "dsa",
        },
      });
      panel.asd.should.eq("dsa");
    });

    it("should return top panel of custom type", () => {
      const panel = StagePanelsManager.getPanel(StagePanelType.Top, {
        ...getDefaultStagePanelsManagerProps(),
        top: {
          ...getDefaultStagePanelManagerProps(),
          x: 5,
          y: 10,
        },
      });
      panel.x.should.eq(5);
      panel.y.should.eq(10);
    });

    it("should return right panel of custom type", () => {
      const x = [1, 2];
      const panel = StagePanelsManager.getPanel(StagePanelType.Right, {
        ...getDefaultStagePanelsManagerProps(),
        right: {
          ...getDefaultStagePanelManagerProps(),
          x,
        },
      });
      panel.x.should.eq(x);
    });

    it("should throw if panel type is unknown", () => {
      (() => StagePanelsManager.getPanel(10, getDefaultStagePanelsManagerProps())).should.throw();
    });
  });

  describe("resize", () => {
    it("should resize", () => {
      const sut = new StagePanelsManager();
      const panelManager = new StagePanelManager();
      const resizeProps: StagePanelManagerProps = {
        ...getDefaultStagePanelManagerProps(),
        size: 77,
      };
      sinon.stub(sut, "getPanelManager").returns(panelManager);
      sinon.stub(panelManager, "resize").returns(resizeProps);
      const props = getDefaultStagePanelsManagerProps();
      const newProps = sut.resize(StagePanelType.Left, 20, props);

      newProps.should.not.eq(props);
      newProps.left.should.not.eq(props.left);

      newProps.bottom.should.eq(props.bottom);
      newProps.left.should.eq(resizeProps);
      newProps.right.should.eq(props.right);
      newProps.top.should.eq(props.top);
    });

    it("should not modify props if panel is not resized", () => {
      const props = getDefaultStagePanelsManagerProps();
      const sut = new StagePanelsManager();
      const panelManager = new StagePanelManager();
      sinon.stub(sut, "getPanelManager").returns(panelManager);
      sinon.stub(panelManager, "resize").returns(props.left);
      const newProps = sut.resize(StagePanelType.Left, 20, props);

      newProps.should.eq(props);
      newProps.bottom.should.eq(props.bottom);
      newProps.left.should.eq(props.left);
      newProps.right.should.eq(props.right);
      newProps.top.should.eq(props.top);
    });
  });

  describe("setIsCollapsed", () => {
    it("should set is collapsed", () => {
      const sut = new StagePanelsManager();
      const panelManager = new StagePanelManager();
      const setIsCollapsedProps: StagePanelManagerProps = {
        ...getDefaultStagePanelManagerProps(),
        isCollapsed: true,
      };
      sinon.stub(sut, "getPanelManager").returns(panelManager);
      sinon.stub(panelManager, "setIsCollapsed").returns(setIsCollapsedProps);
      const props = getDefaultStagePanelsManagerProps();
      const newProps = sut.setIsCollapsed(StagePanelType.Left, true, props);

      newProps.should.not.eq(props);
      newProps.left.should.not.eq(props.left);

      newProps.bottom.should.eq(props.bottom);
      newProps.left.should.eq(setIsCollapsedProps);
      newProps.right.should.eq(props.right);
      newProps.top.should.eq(props.top);
    });

    it("should not modify props if panel size was not set", () => {
      const props = getDefaultStagePanelsManagerProps();
      const sut = new StagePanelsManager();
      const panelManager = new StagePanelManager();
      sinon.stub(sut, "getPanelManager").returns(panelManager);
      sinon.stub(panelManager, "setIsCollapsed").returns(props.left);
      const newProps = sut.setIsCollapsed(StagePanelType.Left, true, props);

      newProps.should.eq(props);
      newProps.bottom.should.eq(props.bottom);
      newProps.left.should.eq(props.left);
      newProps.right.should.eq(props.right);
      newProps.top.should.eq(props.top);
    });
  });

  describe("setSize", () => {
    it("should setSize", () => {
      const sut = new StagePanelsManager();
      const panelManager = new StagePanelManager();
      const setSizeProps: StagePanelManagerProps = {
        ...getDefaultStagePanelManagerProps(),
        size: 77,
      };
      sinon.stub(sut, "getPanelManager").returns(panelManager);
      sinon.stub(panelManager, "setSize").returns(setSizeProps);
      const props = getDefaultStagePanelsManagerProps();
      const newProps = sut.setSize(StagePanelType.Left, 20, props);

      newProps.should.not.eq(props);
      newProps.left.should.not.eq(props.left);

      newProps.bottom.should.eq(props.bottom);
      newProps.left.should.eq(setSizeProps);
      newProps.right.should.eq(props.right);
      newProps.top.should.eq(props.top);
    });

    it("should not modify props if panel size was not set", () => {
      const props = getDefaultStagePanelsManagerProps();
      const sut = new StagePanelsManager();
      const panelManager = new StagePanelManager();
      sinon.stub(sut, "getPanelManager").returns(panelManager);
      sinon.stub(panelManager, "setSize").returns(props.left);
      const newProps = sut.setSize(StagePanelType.Left, 200, props);

      newProps.should.eq(props);
      newProps.bottom.should.eq(props.bottom);
      newProps.left.should.eq(props.left);
      newProps.right.should.eq(props.right);
      newProps.top.should.eq(props.top);
    });
  });

  describe("getPanelManager", () => {
    it("should return panel manager", () => {
      const sut = new StagePanelsManager();
      const panelManager = sut.getPanelManager(StagePanelType.Left);

      panelManager.should.exist;
    });

    it("should not recreate panel manager", () => {
      const sut = new StagePanelsManager();
      const panelManager = sut.getPanelManager(StagePanelType.Left);
      const panelManager1 = sut.getPanelManager(StagePanelType.Left);

      panelManager.should.eq(panelManager1);
    });

    it("should return different manager based on panel type", () => {
      const sut = new StagePanelsManager();
      const panelManager = sut.getPanelManager(StagePanelType.Left);
      const panelManager1 = sut.getPanelManager(StagePanelType.Right);

      panelManager.should.not.eq(panelManager1);
    });
  });
});
