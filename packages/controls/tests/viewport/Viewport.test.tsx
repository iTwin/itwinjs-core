/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import "@helpers/MockFrontendEnvironment";
import * as React from "react";
import { expect } from "chai";
import { mount, shallow } from "enzyme";
import * as faker from "faker";
import * as moq from "@helpers/Mocks";
import { IModelConnection, SelectionSet, ViewState3d, IModelApp } from "@bentley/imodeljs-frontend";
import { ECPresentation, SelectionManager, SelectionChangeEvent } from "@bentley/ecpresentation-frontend/lib";
import ViewportSelectionHandler from "@src/viewport/SelectionHandler";
import Viewport from "@src/viewport/Viewport";
import { createRandomId } from "@helpers/random/Misc";
import "@helpers/Snapshots";

describe("Viewport", () => {

  before(() => {
    IModelApp.startup();
  });
  after(() => {
    IModelApp.shutdown();
  });

  const viewDefinitionId = createRandomId();
  const imodelMock = moq.Mock.ofType<IModelConnection>();
  const selectionHandlerMock = moq.Mock.ofType<ViewportSelectionHandler>();
  beforeEach(() => {
    const viewsMock = moq.Mock.ofInstance<IModelConnection.Views>(new IModelConnection.Views(imodelMock.object));
    viewsMock.setup((views) => views.load(moq.It.isAny())).returns(async () => moq.Mock.ofType<ViewState3d>().object);
    selectionHandlerMock.reset();
    imodelMock.reset();
    imodelMock.setup((imodel) => imodel.selectionSet).returns((imodel) => new SelectionSet(imodel));
    imodelMock.setup((imodel) => imodel.views).returns(() => viewsMock.object);
  });

  it("mounts", () => {
    mount(<Viewport
      imodel={imodelMock.object}
      rulesetId={faker.random.word()}
      viewDefinitionId={viewDefinitionId}
      selectionHandler={ selectionHandlerMock.object }
    />);
  });

  it("renders correctly", () => {
    expect(shallow(<Viewport
      imodel={imodelMock.object}
      rulesetId={faker.random.word()}
      viewDefinitionId={viewDefinitionId}
      selectionHandler={selectionHandlerMock.object}
    />)).to.matchSnapshot();
  });

  describe("selectionHandler", () => {

    it("creates default implementation when not provided through props", () => {
      const selectionManagerMock = moq.Mock.ofType<SelectionManager>();
      selectionManagerMock.setup((x) => x.selectionChange).returns(() => new SelectionChangeEvent());
      ECPresentation.selection = selectionManagerMock.object;

      const rulesetId = faker.random.word();

      const viewport = shallow(<Viewport
        imodel={imodelMock.object}
        rulesetId={rulesetId}
        viewDefinitionId={viewDefinitionId}
      />).instance() as Viewport;

      expect(viewport.selectionHandler.rulesetId).to.eq(rulesetId);
      expect(viewport.selectionHandler.imodel).to.eq(imodelMock.object);
    });

    it("throws when trying to access on component that's not mounted", () => {
      const viewport = shallow(<Viewport
        imodel={imodelMock.object}
        rulesetId={faker.random.word()}
        viewDefinitionId={viewDefinitionId}
        selectionHandler={selectionHandlerMock.object}
      />, { disableLifecycleMethods: true }).instance() as Viewport;
      expect(() => viewport.selectionHandler).to.throw();
    });

    it("disposes when component unmounts", () => {
      const viewport = shallow(<Viewport
        imodel={imodelMock.object}
        rulesetId={faker.random.word()}
        viewDefinitionId={viewDefinitionId}
        selectionHandler={selectionHandlerMock.object}
      />);
      viewport.unmount();
      selectionHandlerMock.verify((x) => x.dispose(), moq.Times.once());
    });

    it("handles missing handler when unmounts", () => {
      const viewport = shallow(<Viewport
        imodel={imodelMock.object}
        rulesetId={faker.random.word()}
        viewDefinitionId={viewDefinitionId}
        selectionHandler={selectionHandlerMock.object}
      />, { disableLifecycleMethods: true });
      viewport.unmount();
    });

    it("updates handler when component's props change", () => {
      const viewport = shallow(<Viewport
        imodel={imodelMock.object}
        rulesetId={faker.random.word()}
        viewDefinitionId={viewDefinitionId}
        selectionHandler={selectionHandlerMock.object}
      />);

      const imodelMock2 = moq.Mock.ofType<IModelConnection>();
      const rulesetId2 = faker.random.word();

      viewport.setProps({
        imodel: imodelMock2.object,
        rulesetId: rulesetId2,
      });

      selectionHandlerMock.verify((x) => x.imodel = imodelMock2.object, moq.Times.once());
      selectionHandlerMock.verify((x) => x.rulesetId = rulesetId2, moq.Times.once());
    });

    it("handles missing handler when updates", () => {
      const viewport = shallow(<Viewport
        imodel={imodelMock.object}
        rulesetId={faker.random.word()}
        viewDefinitionId={viewDefinitionId}
        selectionHandler={selectionHandlerMock.object}
      />, { disableLifecycleMethods: true });
      viewport.instance().componentDidUpdate!(viewport.props(), viewport.state());
    });

  });

});
