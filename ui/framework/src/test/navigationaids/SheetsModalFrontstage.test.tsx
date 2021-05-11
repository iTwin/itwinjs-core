/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import * as moq from "typemoq";
import { fireEvent, render } from "@testing-library/react";
import { IModelConnection, MockRender } from "@bentley/imodeljs-frontend";
import { CardContainer, CardInfo, FrontstageManager, SheetCard, SheetData, SheetsModalFrontstage } from "../../ui-framework";
import TestUtils, { mount } from "../TestUtils";

describe("SheetsModalFrontstage", () => {
  let modal: SheetsModalFrontstage;

  before(async () => {
    await TestUtils.initializeUiFramework();
    await MockRender.App.startup();
  });

  after(async () => {
    await MockRender.App.shutdown();
    TestUtils.terminateUiFramework();
  });

  const connection = moq.Mock.ofType<IModelConnection>();

  describe("SheetModalFrontstage", () => {
    it("constructs correctly", () => {
      modal = new SheetsModalFrontstage(new Array<SheetData>({
        name: "Name",
        viewId: "viewId",
      }), connection.object, 0);
    });

    it("contains readable content", () => {
      const content = modal.content;
      expect(content).to.not.be.null;
    });

    it("contains app bar content", () => {
      const content = modal.appBarRight;
      expect(content).to.not.be.null;
    });

    it("SheetCard onClick selects the card", () => {
      modal = new SheetsModalFrontstage(new Array<SheetData>({
        name: "Name",
        viewId: "viewId",
      }), connection.object, 0);

      const content = modal.content;
      const wrapper = mount(content as React.ReactElement<any>);
      const onCardSelected = sinon.spy();
      const removeListener = CardContainer.onCardSelectedEvent.addListener(onCardSelected);
      wrapper.find("div.uifw-sheet-card").simulate("click");
      expect(onCardSelected.called).to.be.true;
      removeListener();
    });
  });

  describe("CardContainer React Testing", () => {
    it("search box calls onValueChanged after 250ms delay", async () => {
      const fakeTimers = sinon.useFakeTimers();
      modal = new SheetsModalFrontstage(new Array<SheetData>({
        name: "Name",
        viewId: "viewId",
      }), connection.object, 0);

      const content = modal.appBarRight;
      const wrapper = render(content as React.ReactElement<any>);
      const onChange = sinon.spy();
      const removeListener = FrontstageManager.onModalFrontstageChangedEvent.addListener(onChange);
      const input = wrapper.container.querySelector ("input");
      expect (input).not.to.be.null;
      fireEvent.change(input!, { target: { value: "search value" } });
      await fakeTimers.tickAsync(500);
      expect(onChange.called).to.be.true;
      removeListener();
      fakeTimers.restore();
      wrapper.unmount();
    });
  });

  describe("CardContainer", () => {
    it("renders correctly", () => {
      shallow(<CardContainer
        cards={new Array<CardInfo>({ index: 0, label: "", iconSpec: "", viewId: "", isActive: false })}
        searchValue={"Test"}
        connection={connection.object} />);

      shallow(<CardContainer
        cards={new Array<CardInfo>({ index: 0, label: "Test", iconSpec: "", viewId: "", isActive: false })}
        searchValue={""}
        connection={connection.object} />);

      shallow(<CardContainer
        cards={new Array<CardInfo>({ index: 0, label: "Test", iconSpec: "", viewId: "", isActive: false })}
        searchValue={"Testing"}
        connection={connection.object} />);

      shallow(<CardContainer
        cards={new Array<CardInfo>({ index: 0, label: "Testing", iconSpec: "", viewId: "", isActive: false })}
        searchValue={"Test"}
        connection={connection.object} />);
    });
  });

  describe("SheetCard", () => {
    it("handles card selection", () => {
      const onClick = sinon.spy();
      const card = shallow(<SheetCard label="" iconSpec="" onClick={onClick} isActive={false} index={0} />);
      card.simulate("click");
      expect(onClick.called).to.be.true;
    });

    it("handles mouse down and leave", () => {
      const card = shallow(<SheetCard label="" iconSpec="" onClick={() => { }} isActive={false} index={0} />);
      card.simulate("mouseLeave");
      card.simulate("mouseDown");
      card.update();
      expect(card.find("div.is-pressed").length).to.eq(1);
      card.simulate("mouseLeave");
      card.update();
      expect(card.find("div.is-pressed").length).to.eq(0);
    });
  });
});
