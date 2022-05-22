/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as sinon from "sinon";
import { fireEvent, render } from "@testing-library/react";
import * as React from "react";
import { Provider } from "react-redux";
import { UiFramework } from "../../appui-react";
import { FrameworkVersion } from "../../appui-react/hooks/useFrameworkVersion";
import { ToolWidgetComposer } from "../../appui-react/widgets/ToolWidgetComposer";
import { BackstageAppButton } from "../../appui-react/widgets/BackstageAppButton";
import TestUtils, { mount, storageMock } from "../TestUtils";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import { expect } from "chai";

describe("FrameworkAccuDraw localStorage Wrapper", () => {

  const localStorageToRestore = Object.getOwnPropertyDescriptor(window, "localStorage")!;
  const localStorageMock = storageMock();

  before(async () => {
    Object.defineProperty(window, "localStorage", {
      get: () => localStorageMock,
    });
  });

  after(() => {
    Object.defineProperty(window, "localStorage", localStorageToRestore);
  });

  describe("ToolWidgetComposer", () => {
    before(async () => {
      await TestUtils.initializeUiFramework();
      await NoRenderApp.startup();
    });

    after(async () => {
      TestUtils.terminateUiFramework();
      await IModelApp.shutdown();
    });

    it("ToolWidgetComposer should render", () => {
      mount(<ToolWidgetComposer />);
    });

    it("ToolWidgetComposer should render correctly", () => {
      shallow(<ToolWidgetComposer />).should.matchSnapshot();
    });

    it("ToolWidgetComposer with should render", () => {
      shallow(<ToolWidgetComposer cornerItem={<BackstageAppButton icon="icon-test" />} />).should.matchSnapshot();
    });

    it("BackstageAppButtonProps should render", () => {
      const wrapper = mount(<BackstageAppButton icon={"icon-home"} />);
      wrapper.setProps({ icon: "icon-bentley" });
    });

    it("BackstageAppButtonProps should update with default icon", () => {
      const wrapper = mount(<BackstageAppButton icon={"icon-test"} />);
      wrapper.setProps({ icon: undefined });
    });

    it("BackstageAppButton should render in 2.0 mode", () => {
      mount(
        <Provider store={TestUtils.store} >
          <FrameworkVersion>
            <BackstageAppButton icon={"icon-test"} />
          </FrameworkVersion>
        </Provider>);
    });

    it("BackstageAppButton should render in 2.0 mode", () => {
      const spy = sinon.spy();
      const component = render(
        <Provider store={TestUtils.store} >
          <FrameworkVersion>
            <BackstageAppButton icon={"icon-test"} execute={spy} label="Hello" />
          </FrameworkVersion>
        </Provider>);
      const button = component.getByTitle("Hello");
      const icon = component.container.querySelector("i.icon.icon-test");
      expect(icon).not.to.be.null;
      fireEvent.click(button);
      spy.called.should.true;
    });

    it("BackstageAppButton should render with defaults in 2.0 mode", () => {
      const spy = sinon.spy(UiFramework.backstageManager, "toggle");
      const component = render(
        <Provider store={TestUtils.store} >
          <FrameworkVersion>
            <BackstageAppButton />
          </FrameworkVersion>
        </Provider>);
      const button = component.container.querySelector("button");
      fireEvent.click(button!);
      spy.called.should.true;
    });

    it("BackstageAppButton should render in 1.0 mode", async () => {
      UiFramework.setUiVersion("1");
      await TestUtils.flushAsyncOperations();
      mount(
        <Provider store={TestUtils.store} >
          <FrameworkVersion>
            <BackstageAppButton icon={"icon-test"} />
          </FrameworkVersion>
        </Provider>
      );
      UiFramework.setUiVersion("2");
    });

  });
});
