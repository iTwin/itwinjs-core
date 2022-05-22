/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { ReactWrapper, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { BadgeType } from "@itwin/appui-abstract";
import { WithOnOutsideClickProps } from "@itwin/core-react";
import { Item } from "@itwin/appui-layout-react";
import { fireEvent, render } from "@testing-library/react";
import { BaseItemState, PopupButton, SyncUiEventDispatcher } from "../../appui-react";
/* eslint-disable deprecation/deprecation */
import TestUtils, { mount } from "../TestUtils";

// cSpell:ignore buttonstate

describe("<PopupButton />", async () => {
  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  it("should render", async () => {
    const renderedComponent = render(<PopupButton iconSpec="icon-arrow-down" label="Popup-Test">
      <div style={{ width: "200px", height: "100px" }}>
        hello world!
      </div>
    </PopupButton>);
    expect(renderedComponent).not.to.be.undefined;
    const popupButton = renderedComponent.getByTitle("Popup-Test");
    expect(popupButton).not.to.be.undefined;
    fireEvent.click(popupButton);
    await TestUtils.flushAsyncOperations();
  });

  it("should render with many props", async () => {
    const renderedComponent = render(<PopupButton iconSpec="icon-arrow-down" labelKey="Sample:test.key"
      isVisible={true} isEnabled={true} isActive={true} isPressed={true} badgeType={BadgeType.New}>
      <div style={{ width: "200px", height: "100px" }}>
        hello world!
      </div>
    </PopupButton>);
    expect(renderedComponent).not.to.be.undefined;
    const popupButton = renderedComponent.getByTitle("test.key");
    expect(popupButton).not.to.be.undefined;
  });

  it("should render with label func", async () => {
    const renderedComponent = render(<PopupButton iconSpec="icon-arrow-down" label={() => "Test Label"}>
      <div style={{ width: "200px", height: "100px" }}>
        hello world!
      </div>
    </PopupButton>);
    expect(renderedComponent).not.to.be.undefined;
    const popupButton = renderedComponent.getByTitle("Test Label");
    expect(popupButton).not.to.be.undefined;
  });

  it("should not render if isVisible is false", async () => {
    const renderedComponent = render(<PopupButton iconSpec="icon-arrow-down" label="Popup-Test" isVisible={false} >
      <div style={{ width: "200px", height: "100px" }}>
        hello world!
      </div>
    </PopupButton>);
    expect(renderedComponent).not.to.be.undefined;
    const popupButton = renderedComponent.queryByTitle("Popup-Test");
    expect(popupButton).to.be.null;
  });

  it("should open popup", async () => {
    const spy = sinon.spy();
    const sut = mount<PopupButton>(<PopupButton iconSpec="icon-arrow-down" label="Popup-Test" onExpanded={spy}>
      <div style={{ width: "200px", height: "100px" }}>
        hello world!
      </div>
    </PopupButton>);

    const item = sut.find(Item);
    item.prop("onClick")!();

    expect(spy.calledOnce).to.be.true;
    expect(sut.state().isPressed).to.be.true;
  });

  it("sync event should trigger stateFunc", () => {
    const testEventId = "test-buttonstate";
    let stateFunctionCalled = false;
    const testStateFunc = (state: Readonly<BaseItemState>): BaseItemState => {
      stateFunctionCalled = true;
      return { ...state, isActive: true };
    };

    const renderedComponent = render(<PopupButton iconSpec="icon-arrow-down" stateSyncIds={[testEventId]} stateFunc={testStateFunc}>
      <div style={{ width: "200px", height: "100px" }}>
        hello world!
      </div>
    </PopupButton>);
    expect(renderedComponent).not.to.be.undefined;
    expect(stateFunctionCalled).to.eq(false);
    SyncUiEventDispatcher.dispatchImmediateSyncUiEvent(testEventId);
    expect(stateFunctionCalled).to.eq(true);
  });

  it("should invoke children as render prop", () => {
    const sut = shallow<PopupButton>(<PopupButton>
      {() => <div />}
    </PopupButton>);
    sut.setState({ isPressed: true });
    sut.dive().should.matchSnapshot();
  });

  it("should close panel with render prop arg", () => {
    const sut = mount<PopupButton>(<PopupButton>
      {({ closePanel }) => <button onClick={closePanel} id="btn" />}
    </PopupButton>);
    sut.setState({ isPressed: true });

    const btn = sut.find("#btn");
    btn.simulate("click");

    (sut.state().isPressed === false).should.true;
  });

  it("should render with no padding", () => {
    const sut = shallow<PopupButton>(<PopupButton noPadding>
      <div />
    </PopupButton>);
    sut.setState({ isPressed: true });
    sut.dive().should.matchSnapshot();
  });

  it("should minimize on outside click", () => {
    const sut = mount<PopupButton>(<PopupButton noPadding>
      <div />
    </PopupButton>);
    sut.setState({ isPressed: true });
    const divWithOnOutsideClick = sut.findWhere((w) => {
      return w.name() === "WithOnOutsideClick";
    }) as ReactWrapper<WithOnOutsideClickProps>;

    const event = new MouseEvent("");
    sinon.stub(event, "target").get(() => document.createElement("div"));
    divWithOnOutsideClick.prop("onOutsideClick")!(event);

    expect(sut.state().isPressed).to.be.false;
  });

  it("should not minimize on outside click", () => {
    const sut = mount<PopupButton>(<PopupButton noPadding>
      <div />
    </PopupButton>);
    sut.setState({ isPressed: true });
    const spy = sinon.spy(sut.instance(), "minimize");
    const divWithOnOutsideClick = sut.findWhere((w) => {
      return w.name() === "WithOnOutsideClick";
    }) as ReactWrapper<WithOnOutsideClickProps>;

    const event = new MouseEvent("");
    divWithOnOutsideClick.prop("onOutsideClick")!(event);

    expect(spy.called).to.be.false;
  });

  it("should minimize on Escape down", () => {
    const sut = mount<PopupButton>(<PopupButton noPadding>
      <div />
    </PopupButton>);
    sut.setState({ isPressed: true });
    const spy = sinon.spy(sut.instance(), "minimize");
    const item = sut.find(Item);

    item.simulate("keyDown", { key: "Escape" });

    expect(spy.called).to.be.true;
  });
});
