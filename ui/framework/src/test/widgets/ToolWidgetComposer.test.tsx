/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import { FrameworkVersion } from "../../appui-react/hooks/useFrameworkVersion";
import { BackstageAppButton, ToolWidgetComposer } from "../../appui-react/widgets/ToolWidgetComposer";
import TestUtils, { mount, storageMock } from "../TestUtils";

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
    });

    after(() => {
      TestUtils.terminateUiFramework();
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
        <FrameworkVersion version="2">
          <BackstageAppButton icon={"icon-test"} />
        </FrameworkVersion>);
    });

    it("BackstageAppButton should render in 1.0 mode", () => {
      mount(
        <FrameworkVersion version="1">
          <BackstageAppButton icon={"icon-test"} />
        </FrameworkVersion>);
    });

  });
});
