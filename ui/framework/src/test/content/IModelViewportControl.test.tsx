/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// TODO - once we figure out how to mock all data need to construct a UnifiedSelection Viewport
// import * as React from "react";
// import { mount } from "enzyme";
// import { expect } from "chai";
//
// import { IModelViewportControl, ConfigurableCreateInfo } from "../../ui-framework";
// import TestUtils from "../TestUtils";
//
// describe("IModelViewportControl", () => {
//   before(async () => {
//     await TestUtils.initializeUiFramework();
//   });
//
//   after(() => {
//     TestUtils.terminateUiFramework();
//   });
//
//  before we can test UnifiedSelection Viewport control we must make sure Presentation Manager is initialized.
//  describe("Requires Presentation", () => {
//    const shutdownIModelApp = () => {
//      if (IModelApp.initialized)
//        IModelApp.shutdown();
//    };
//
//    beforeEach(() => {
//      shutdownIModelApp();
//      NoRenderApp.startup();
//      Presentation.terminate();
//    });
//
//    const viewMock = moq.Mock.ofType<ViewState3d>();
//
//    it("IModelViewport should instantiate when connection and viewState are defined", async () => {
//      Presentation.initialize();
//      await TestUtils.initializeUiFramework();
//
//      const connection = moq.Mock.ofType<IModelConnection>();
//      const ss = new SelectionSet(connection.object);
//      connection.setup((x) => x.selectionSet).returns(() => ss);
//
//      // hacks to avoid instantiating the whole core..
//      (IModelApp as any)._viewManager = {
//        onSelectionSetChanged: sinon.stub(),
//      };
//
//      const options = { viewState: () => viewMock.object, iModelConnection: connection.object };
//      const info = new ConfigurableCreateInfo("imodelViewId", "uniqueId", "idString");
//      const vpControl = new IModelViewportControl(info, options);
//      expect(vpControl).not.to.be.null;
//      const reactElement = vpControl.reactNode;
//      expect(reactElement).not.to.be.null;
//      const wrapper = mount(reactElement as React.ReactElement);
//
//      // tslint:disable-next-line: no-console
//      console.log(wrapper.debug());
//      // const mockVp = wrapper.find(MockIModelViewport);
//      // expect(mockVp).to.not.be.undefined;
//
//      wrapper.unmount();
//
//      TestUtils.terminateUiFramework();
//      Presentation.terminate();
//      shutdownIModelApp();
//    });
//  });
// });
