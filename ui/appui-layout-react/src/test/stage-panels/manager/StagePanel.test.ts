/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as sinon from "sinon";
import { StagePanelManager, StagePanelManagerProps } from "../../../appui-layout-react";

describe("StagePanelManager", () => {
  describe("resize", () => {
    it("should resize", () => {
      const sut = new StagePanelManager();
      const props: StagePanelManagerProps = {
        isCollapsed: false,
        size: 300,
      };
      const newProps = sut.resize(50, props);

      newProps.should.not.eq(props);
      newProps.size!.should.eq(350);
    });

    it("should not resize if current size is not set", () => {
      const sut = new StagePanelManager();
      const props: StagePanelManagerProps = {
        isCollapsed: false,
        size: undefined,
      };
      const newProps = sut.resize(50, props);

      newProps.should.eq(props);
    });

    it("should collapse when resizing", () => {
      const sut = new StagePanelManager();
      sinon.stub(sut, "shouldCollapse").returns(true);
      const props: StagePanelManagerProps = {
        isCollapsed: false,
        size: 200,
      };
      const newProps = sut.resize(50, props);

      newProps.should.not.eq(props);
      newProps.isCollapsed.should.eq(true);
    });

    it("should restore collapse when resizing", () => {
      const sut = new StagePanelManager();
      sinon.stub(sut, "shouldCollapse").returns(false);
      const props: StagePanelManagerProps = {
        isCollapsed: true,
        size: 200,
      };
      const newProps = sut.resize(50, props);

      newProps.should.not.eq(props);
      newProps.isCollapsed.should.eq(false);
    });

    it("should not modify props if size does not change", () => {
      const sut = new StagePanelManager();
      sinon.stub(sut, "maxSize").returns(200);
      const props: StagePanelManagerProps = {
        isCollapsed: true,
        size: 200,
      };
      const newProps = sut.resize(50, props);

      newProps.should.eq(props);
    });
  });

  describe("setSize", () => {
    it("should set size", () => {
      const sut = new StagePanelManager();
      const props: StagePanelManagerProps = {
        isCollapsed: false,
        size: undefined,
      };
      const newProps = sut.setSize(300, props);

      newProps.should.not.eq(props);
      newProps.size!.should.eq(300);
    });

    it("should limit to min size", () => {
      const sut = new StagePanelManager();
      sut.minSize = 100;
      const props: StagePanelManagerProps = {
        isCollapsed: false,
        size: undefined,
      };
      const newProps = sut.setSize(10, props);

      newProps.should.not.eq(props);
      newProps.size!.should.eq(100);
    });

    it("should limit to max size", () => {
      const sut = new StagePanelManager();
      sut.maxSize = 1000;
      const props: StagePanelManagerProps = {
        isCollapsed: false,
        size: undefined,
      };
      const newProps = sut.setSize(1100, props);

      newProps.should.not.eq(props);
      newProps.size!.should.eq(1000);
    });

    it("should not modify props if size does not change", () => {
      const sut = new StagePanelManager();
      const props: StagePanelManagerProps = {
        isCollapsed: false,
        size: 250,
      };
      const newProps = sut.setSize(250, props);

      newProps.should.eq(props);
    });
  });

  describe("shouldCollapse", () => {
    it("should return true if requested size is smaller than min size minus collapse offset", () => {
      const sut = new StagePanelManager();
      sut.collapseOffset = 50;
      sut.minSize = 150;
      const props: StagePanelManagerProps = {
        isCollapsed: false,
        size: 200,
      };
      const shouldCollapse = sut.shouldCollapse(-100, props);

      shouldCollapse.should.true;
    });

    it("should return true if panel is collapsed and resizeBy is smaller than collapse offset", () => {
      const sut = new StagePanelManager();
      sut.collapseOffset = 50;
      const props: StagePanelManagerProps = {
        isCollapsed: true,
        size: 160,
      };
      const shouldCollapse = sut.shouldCollapse(-10, props);

      shouldCollapse.should.true;
    });

    it("should return false if panel is collapsed and resizeBy is greater than collapse offset", () => {
      const sut = new StagePanelManager();
      sut.collapseOffset = 50;
      const props: StagePanelManagerProps = {
        isCollapsed: true,
        size: 160,
      };
      const shouldCollapse = sut.shouldCollapse(51, props);

      shouldCollapse.should.false;
    });

    it("should return false if size is not set", () => {
      const sut = new StagePanelManager();
      const props: StagePanelManagerProps = {
        isCollapsed: false,
        size: undefined,
      };
      const shouldCollapse = sut.shouldCollapse(51, props);

      shouldCollapse.should.false;
    });
  });
});
