/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { render, cleanup } from "react-testing-library";
import * as React from "react";
import * as sinon from "sinon";
import { expect } from "chai";

import { Dialog, DialogButtonType } from "../../ui-core";
import TestUtils from "../TestUtils";
import { UiCore } from "../../ui-core/UiCore";
import { GlobalDialog } from "../../ui-core/dialog/Dialog";

describe("Dialog", () => {

  afterEach(cleanup);

  const createBubbledEvent = (type: string, props = {}) => {
    const event = new Event(type, { bubbles: true });
    Object.assign(event, props);
    return event;
  };

  before(async () => {
    await TestUtils.initializeUiCore();
  });

  describe("<GlobalDialog />", () => {
    it("should render", () => {
      render(<GlobalDialog opened={true} />);
    });
    it("should render multiple in same global container", () => {
      render(<GlobalDialog opened={true} />);
      render(<GlobalDialog opened={true} />);
    });
    it("should render with identifier", () => {
      render(<GlobalDialog opened={true} identifier="test" />);
    });
  });

  describe("renders", () => {
    it("should render", () => {
      render(<Dialog opened={true} />);
    });
  });

  describe("buttons", () => {
    it("should render with OK & Cancel buttons", () => {
      const component = render(<Dialog opened={true}
        buttonCluster={[
          { type: DialogButtonType.OK, onClick: () => { } },
          { type: DialogButtonType.Cancel, onClick: () => { } },
        ]} />);
      expect(component.getByText(UiCore.i18n.translate("UiCore:dialog.ok"))).to.exist;
      expect(component.getByText(UiCore.i18n.translate("UiCore:dialog.cancel"))).to.exist;
    });

    it("should render with Close button", () => {
      const component = render(<Dialog opened={true}
        buttonCluster={[
          { type: DialogButtonType.Close, onClick: () => { } },
        ]} />);
      expect(component.getByText(UiCore.i18n.translate("UiCore:dialog.close"))).to.exist;
    });

    it("should render with Yes, No & Retry buttons", () => {
      const component = render(<Dialog opened={true}
        buttonCluster={[
          { type: DialogButtonType.Yes, onClick: () => { } },
          { type: DialogButtonType.No, onClick: () => { } },
          { type: DialogButtonType.Retry, onClick: () => { } },
        ]} />);
      expect(component.getByText(UiCore.i18n.translate("UiCore:dialog.yes"))).to.exist;
      expect(component.getByText(UiCore.i18n.translate("UiCore:dialog.no"))).to.exist;
      expect(component.getByText(UiCore.i18n.translate("UiCore:dialog.retry"))).to.exist;
    });

    it("should render with custom button", () => {
      const component = render(<Dialog opened={true}
        buttonCluster={[
          { type: DialogButtonType.Close, onClick: () => { }, label: "XYZ" },
        ]} />);
      expect(component.getByText("XYZ")).to.exist;
    });
  });

  describe("movable and resizable", () => {
    it("should render with movable", () => {
      render(<Dialog opened={true} movable={true} />);
    });
    it("should move from pointer events", () => {
      const component = render(<Dialog opened={true} movable={true} height={400} width={400} />);
      const head = component.getByTestId("core-dialog-head");
      head.dispatchEvent(createBubbledEvent("pointerdown", { clientX: 200, clientY: 5 }));
      head.dispatchEvent(createBubbledEvent("pointermove", { clientX: 300, clientY: 50 }));
      head.dispatchEvent(createBubbledEvent("pointerup", { clientX: 300, clientY: 50 }));
      const container = component.getByTestId("core-dialog-container");
      expect(container.style.left).to.equal("100px");
      expect(container.style.top).to.equal("45px");
    });
    it("should not move from pointer events when movable is false", () => {
      const component = render(<Dialog opened={true} movable={false} height={400} width={400} />);
      const head = component.getByTestId("core-dialog-head");
      head.dispatchEvent(createBubbledEvent("pointerdown", { clientX: 200, clientY: 5 }));
      head.dispatchEvent(createBubbledEvent("pointermove", { clientX: 250, clientY: 25 }));
      head.dispatchEvent(createBubbledEvent("pointermove", { clientX: 300, clientY: 50 }));
      head.dispatchEvent(createBubbledEvent("pointerup", { clientX: 300, clientY: 50 }));
      const container = component.getByTestId("core-dialog-container");
      expect(container.style.left).to.equal("");
      expect(container.style.top).to.equal("");
    });
    it("should render with resizable", () => {
      render(<Dialog opened={true} resizable={true} />);
    });
    it("should not resize from pointer events on bottom right when resizable={false}", () => {
      const component = render(<Dialog opened={true} resizable={false} height={400} width={400} minHeight={200} minWidth={200} />);
      const bottomRightDragHandle = component.getByTestId("core-dialog-drag-bottom-right");
      bottomRightDragHandle.dispatchEvent(createBubbledEvent("pointerdown", { clientX: 400, clientY: 400 }));
      window.dispatchEvent(createBubbledEvent("pointermove", { clientX: 200, clientY: 200 }));
      window.dispatchEvent(createBubbledEvent("pointerup", { clientX: 200, clientY: 200 }));
      const container = component.getByTestId("core-dialog-container");
      expect(container.style.height).to.equal("400px");
      expect(container.style.width).to.equal("400px");
    });
    it("should resize from pointer events on bottom right", () => {
      const component = render(<Dialog opened={true} resizable={true} height={400} width={400} minHeight={200} minWidth={200} />);
      const bottomRightDragHandle = component.getByTestId("core-dialog-drag-bottom-right");
      bottomRightDragHandle.dispatchEvent(createBubbledEvent("pointerdown", { clientX: 400, clientY: 400 }));
      window.dispatchEvent(createBubbledEvent("pointermove", { clientX: 200, clientY: 200 }));
      window.dispatchEvent(createBubbledEvent("pointerup", { clientX: 200, clientY: 200 }));
      const container = component.getByTestId("core-dialog-container");
      expect(container.style.height).to.equal("200px");
      expect(container.style.width).to.equal("200px");
    });
    it("should resize relative to top right corner from pointer events on bottom right when both resizable and movable", () => {
      const component = render(<Dialog opened={true} resizable={true} movable={true} height={400} width={400} minHeight={200} minWidth={200} />);
      const bottomRightDragHandle = component.getByTestId("core-dialog-drag-bottom-right");
      bottomRightDragHandle.dispatchEvent(createBubbledEvent("pointerdown", { clientX: 400, clientY: 400 }));
      window.dispatchEvent(createBubbledEvent("pointermove", { clientX: 200, clientY: 200 }));
      window.dispatchEvent(createBubbledEvent("pointerup", { clientX: 200, clientY: 200 }));
      const container = component.getByTestId("core-dialog-container");
      expect(container.style.height).to.equal("200px");
      expect(container.style.width).to.equal("200px");
    });
    it("should resize to minWidth and minHeight", () => {
      const component = render(<Dialog opened={true} resizable={true} minHeight={200} minWidth={200} />);
      const bottomRightDragHandle = component.getByTestId("core-dialog-drag-bottom-right");
      bottomRightDragHandle.dispatchEvent(createBubbledEvent("pointerdown", { clientX: 400, clientY: 400 }));
      window.dispatchEvent(createBubbledEvent("pointermove", { clientX: 100, clientY: 100 }));
      window.dispatchEvent(createBubbledEvent("pointerup", { clientX: 100, clientY: 100 }));
      const container = component.getByTestId("core-dialog-container");
      expect(container.style.height).to.equal("200px");
      expect(container.style.width).to.equal("200px");
    });
    it("should resize to maxWidth and maxHeight when defined", () => {
      const component = render(<Dialog opened={true} resizable={true} height={200} width={200} maxWidth={350} maxHeight={350} />);
      const bottomRightDragHandle = component.getByTestId("core-dialog-drag-bottom-right");
      bottomRightDragHandle.dispatchEvent(createBubbledEvent("pointerdown", { clientX: 200, clientY: 400 }));
      window.dispatchEvent(createBubbledEvent("pointermove", { clientX: 400, clientY: 400 }));
      window.dispatchEvent(createBubbledEvent("pointerup", { clientX: 400, clientY: 400 }));
      const container = component.getByTestId("core-dialog-container");
      expect(container.style.height).to.equal("350px");
      expect(container.style.width).to.equal("350px");
    });
    it("should resize from pointer events on bottom", () => {
      const component = render(<Dialog opened={true} resizable={true} height={400} width={400} minHeight={100} minWidth={100} />);
      const bottomRightDragHandle = component.getByTestId("core-dialog-drag-bottom");
      bottomRightDragHandle.dispatchEvent(createBubbledEvent("pointerdown", { clientX: 400, clientY: 400 }));
      window.dispatchEvent(createBubbledEvent("pointermove", { clientX: 405, clientY: 200 }));
      window.dispatchEvent(createBubbledEvent("pointerup", { clientX: 405, clientY: 200 }));
    });
    it("should resize from pointer events on right", () => {
      const component = render(<Dialog opened={true} resizable={true} height={400} width={400} minHeight={100} minWidth={100} />);
      const bottomRightDragHandle = component.getByTestId("core-dialog-drag-right");
      bottomRightDragHandle.dispatchEvent(createBubbledEvent("pointerdown", { clientX: 400, clientY: 400 }));
      window.dispatchEvent(createBubbledEvent("pointermove", { clientX: 200, clientY: 405 }));
      window.dispatchEvent(createBubbledEvent("pointerup", { clientX: 200, clientY: 405 }));
    });
  });

  describe("keyboard support", () => {
    it("should close on Esc key", () => {
      const spyOnEscape = sinon.spy();
      const component = render(<Dialog opened={true} onEscape={spyOnEscape} />);

      component.baseElement.dispatchEvent(new KeyboardEvent("keyup", { key: "Escape" }));
      expect(spyOnEscape).to.be.calledOnce;
    });
    it("should not respond to other keyboard input", () => {
      const spyOnEscape = sinon.spy();
      const component = render(<Dialog opened={true} onEscape={spyOnEscape} />);

      component.baseElement.dispatchEvent(new KeyboardEvent("keyup"));
      expect(spyOnEscape).to.not.be.called;
    });
  });

});
