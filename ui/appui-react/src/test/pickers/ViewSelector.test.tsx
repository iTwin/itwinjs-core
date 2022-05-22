/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { shallow } from "enzyme";
import * as React from "react";
import * as moq from "typemoq";
import { IModelConnection } from "@itwin/core-frontend";
import { FrameworkVersion, UiFramework, ViewSelector } from "../../appui-react";
import TestUtils, { mount } from "../TestUtils";
import { Provider } from "react-redux";

// cSpell:ignore Spatials

describe("ViewSelector", () => {
  const imodelMock = moq.Mock.ofType<IModelConnection>();
  const imodelMock2 = moq.Mock.ofType<IModelConnection>();

  before(async () => {
    await TestUtils.initializeUiFramework();
    UiFramework.setUiVersion("1");
    await TestUtils.flushAsyncOperations();
  });

  after(async () => {
  // restore to default "2" setting
    UiFramework.setUiVersion("2");
    await TestUtils.flushAsyncOperations();
    TestUtils.terminateUiFramework();
  });

  it("should render correctly", () => {
    const wrapper = shallow(
      <Provider store={TestUtils.store}>
        <FrameworkVersion>
          <ViewSelector imodel={imodelMock.object} />
        </FrameworkVersion>
      </Provider>
    );
    wrapper.should.matchSnapshot();
  });

  it("should set Show settings by ViewSelector.updateShowSettings", () => {
    const wrapper = mount(
      <Provider store={TestUtils.store}>
        <FrameworkVersion>
          <ViewSelector imodel={imodelMock.object} listenForShowUpdates={true} />
        </FrameworkVersion>
      </Provider>
    );
    const vs = wrapper.find(ViewSelector);
    expect(vs).to.not.be.undefined;

    expect(vs.state("showSpatials")).to.be.true;
    expect(vs.state("showDrawings")).to.be.true;
    expect(vs.state("showSheets")).to.be.true;
    expect(vs.state("showUnknown")).to.be.true;

    ViewSelector.updateShowSettings(false, false, false, false);

    expect(vs.state("showSpatials")).to.be.false;
    expect(vs.state("showDrawings")).to.be.false;
    expect(vs.state("showSheets")).to.be.false;
    expect(vs.state("showUnknown")).to.be.false;
  });

  it("should trigger componentDidUpdate processing", async () => {
    const wrapper = mount(
      <Provider store={TestUtils.store}>
        <FrameworkVersion>
          <ViewSelector imodel={imodelMock.object} />
        </FrameworkVersion>
      </Provider>
    );
    wrapper.setProps({ imodel: imodelMock2.object });
    await TestUtils.flushAsyncOperations();
  });

});
