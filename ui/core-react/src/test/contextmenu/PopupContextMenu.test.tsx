/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import { render } from "@testing-library/react";
import { RelativePosition } from "@itwin/appui-abstract";
import { PopupContextMenu } from "../../core-react";

describe("PopupContextMenu", () => {
  it("renders correctly", () => {
    const component = render(<PopupContextMenu isOpen={true} />);
    expect(component.getByTestId("core-popup")).to.exist;
    expect(component.getByTestId("core-context-menu-root")).to.exist;
  });

  describe("direction", () => {
    it("should render bottom by default", () => {
      const component = render(<PopupContextMenu isOpen={true} />);
      const contextMenu = component.getByTestId("core-context-menu-root");
      expect(contextMenu.querySelector(".core-context-menu-bottom")).not.to.be.null;
    });
    it("should render top left", () => {
      const component = render(<PopupContextMenu isOpen={true} position={RelativePosition.TopLeft} />);
      const contextMenu = component.getByTestId("core-context-menu-root");
      expect(contextMenu.querySelector(".core-context-menu-top")).not.to.be.null;
      expect(contextMenu.querySelector(".core-context-menu-right")).not.to.be.null;
    });
    it("should render top", () => {
      const component = render(<PopupContextMenu isOpen={true} position={RelativePosition.Top} />);
      const contextMenu = component.getByTestId("core-context-menu-root");
      expect(contextMenu.querySelector(".core-context-menu-top")).not.to.be.null;
    });
    it("should render top right", () => {
      const component = render(<PopupContextMenu isOpen={true} position={RelativePosition.TopRight} />);
      const contextMenu = component.getByTestId("core-context-menu-root");
      expect(contextMenu.querySelector(".core-context-menu-top")).not.to.be.null;
      expect(contextMenu.querySelector(".core-context-menu-left")).not.to.be.null;
    });
    it("should render left", () => {
      const component = render(<PopupContextMenu isOpen={true} position={RelativePosition.Left} />);
      const contextMenu = component.getByTestId("core-context-menu-root");
      expect(contextMenu.querySelector(".core-context-menu-left")).not.to.be.null;
    });
    it("should render right", () => {
      const component = render(<PopupContextMenu isOpen={true} position={RelativePosition.Right} />);
      const contextMenu = component.getByTestId("core-context-menu-root");
      expect(contextMenu.querySelector(".core-context-menu-right")).not.to.be.null;
    });
    it("should render bottom left", () => {
      const component = render(<PopupContextMenu isOpen={true} position={RelativePosition.BottomLeft} />);
      const contextMenu = component.getByTestId("core-context-menu-root");
      expect(contextMenu.querySelector(".core-context-menu-bottom")).not.to.be.null;
      expect(contextMenu.querySelector(".core-context-menu-right")).not.to.be.null;
    });
    it("should render bottom", () => {
      const component = render(<PopupContextMenu isOpen={true} position={RelativePosition.Bottom} />);
      const contextMenu = component.getByTestId("core-context-menu-root");
      expect(contextMenu.querySelector(".core-context-menu-bottom")).not.to.be.null;
    });
    it("should render bottom right", () => {
      const component = render(<PopupContextMenu isOpen={true} position={RelativePosition.BottomRight} />);
      const contextMenu = component.getByTestId("core-context-menu-root");
      expect(contextMenu.querySelector(".core-context-menu-bottom")).not.to.be.null;
      expect(contextMenu.querySelector(".core-context-menu-left")).not.to.be.null;
    });
  });

});
