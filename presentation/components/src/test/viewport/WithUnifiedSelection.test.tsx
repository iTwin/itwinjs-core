/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/* tslint:disable:no-direct-imports */

import "@bentley/presentation-frontend/lib/test/_helpers/MockFrontendEnvironment";
import * as React from "react";
import { expect } from "chai";
import * as sinon from "sinon";
import { mount, shallow } from "enzyme";
import * as faker from "faker";
import * as moq from "@bentley/presentation-common/lib/test/_helpers/Mocks";
import { createRandomId, createRandomTransientId } from "@bentley/presentation-common/lib/test/_helpers/random";
import { ResolvablePromise } from "@bentley/presentation-common/lib/test/_helpers/Promises";
import { waitForAllAsyncs } from "@bentley/presentation-frontend/lib/test/_helpers/PendingAsyncsHelper";
import { Id64String, Id64, Id64Arg } from "@bentley/bentleyjs-core";
import { ElementProps, Code } from "@bentley/imodeljs-common";
import { IModelConnection, ViewState3d, NoRenderApp, HiliteSet as IModelHiliteSet, IModelApp, SelectionSet } from "@bentley/imodeljs-frontend";
import { KeySet } from "@bentley/presentation-common";
import {
  Presentation, SelectionManager, SelectionChangeEvent,
  SelectionChangeEventArgs, SelectionChangeType, HiliteSet, SelectionScopesManager,
} from "@bentley/presentation-frontend";
import { HILITE_RULESET } from "@bentley/presentation-frontend/lib/selection/HiliteSetProvider";
import { ViewportComponent } from "@bentley/ui-components";
import { IUnifiedSelectionComponent } from "../../common/IUnifiedSelectionComponent";
import { viewWithUnifiedSelection, ViewportSelectionHandler } from "../../viewport/WithUnifiedSelection";

// tslint:disable-next-line:variable-name naming-convention
const PresentationViewport = viewWithUnifiedSelection(ViewportComponent);

describe("Viewport withUnifiedSelection", () => {

  before(() => {
    NoRenderApp.startup();
    classNameGenerator = () => faker.random.word();
  });
  after(() => {
    IModelApp.shutdown();
  });

  let viewDefinitionId: Id64String;
  const imodelMock = moq.Mock.ofType<IModelConnection>();
  const selectionHandlerMock = moq.Mock.ofType<ViewportSelectionHandler>();

  beforeEach(() => {
    viewDefinitionId = createRandomId();
    selectionHandlerMock.reset();
    const viewsMock = moq.Mock.ofInstance<IModelConnection.Views>(new IModelConnection.Views(imodelMock.object));
    viewsMock.setup(async (views) => views.load(moq.It.isAny())).returns(async () => moq.Mock.ofType<ViewState3d>().object);
    imodelMock.reset();
    let hiliteSet: IModelHiliteSet | undefined;
    imodelMock.setup((imodel) => imodel.hilited).returns((imodel) => {
      if (!hiliteSet)
        hiliteSet = new IModelHiliteSet(imodel, false);
      return hiliteSet;
    });
    imodelMock.setup((imodel) => imodel.views).returns(() => viewsMock.object);
  });

  it("mounts", () => {
    mount(<PresentationViewport
      imodel={imodelMock.object}
      viewDefinitionId={viewDefinitionId}
      selectionHandler={selectionHandlerMock.object}
    />);
  });

  it("uses supplied imodel", () => {
    const component = shallow(<PresentationViewport
      imodel={imodelMock.object}
      viewDefinitionId={viewDefinitionId}
      selectionHandler={selectionHandlerMock.object}
    />).instance() as any as IUnifiedSelectionComponent;
    expect(component.imodel).to.equal(imodelMock.object);
  });

  it("uses HILITE_RULESET id", () => {
    const component = shallow(<PresentationViewport
      imodel={imodelMock.object}
      viewDefinitionId={viewDefinitionId}
      selectionHandler={selectionHandlerMock.object}
    />).instance() as any as IUnifiedSelectionComponent;
    expect(component.rulesetId).to.equal(HILITE_RULESET.id);
  });

  it("renders correctly", () => {
    expect(shallow(<PresentationViewport
      imodel={imodelMock.object}
      viewDefinitionId={viewDefinitionId}
      selectionHandler={selectionHandlerMock.object}
    />)).to.matchSnapshot();
  });

  describe("selectionHandler", () => {

    it("creates default implementation when not provided through props", () => {
      const selectionManagerMock = moq.Mock.ofType<SelectionManager>();
      selectionManagerMock.setup((x) => x.selectionChange).returns(() => new SelectionChangeEvent());
      Presentation.selection = selectionManagerMock.object;

      const viewport = shallow(<PresentationViewport
        imodel={imodelMock.object}
        viewDefinitionId={viewDefinitionId}
      />).instance() as any as IUnifiedSelectionComponent;

      expect(viewport.selectionHandler).to.not.be.undefined;
      expect(viewport.selectionHandler!.imodel).to.eq(imodelMock.object);
    });

    it("disposes when component unmounts", () => {
      const viewport = shallow(<PresentationViewport
        imodel={imodelMock.object}
        viewDefinitionId={viewDefinitionId}
        selectionHandler={selectionHandlerMock.object}
      />);
      viewport.unmount();
      selectionHandlerMock.verify((x) => x.dispose(), moq.Times.once());
    });

    it("updates handler when component's props change", () => {
      const viewport = shallow(<PresentationViewport
        imodel={imodelMock.object}
        viewDefinitionId={viewDefinitionId}
        selectionHandler={selectionHandlerMock.object}
      />);
      const imodelMock2 = moq.Mock.ofType<IModelConnection>();
      viewport.setProps({
        imodel: imodelMock2.object,
      });
      selectionHandlerMock.verify((x) => x.imodel = imodelMock2.object, moq.Times.once());
    });

    it("returns undefined handler when not mounted", () => {
      const viewport = shallow(<PresentationViewport
        imodel={imodelMock.object}
        viewDefinitionId={viewDefinitionId}
        selectionHandler={selectionHandlerMock.object}
      />, { disableLifecycleMethods: true }).instance() as any as IUnifiedSelectionComponent;
      expect(viewport.selectionHandler).to.be.undefined;
    });

    it("handles missing handler when unmounts", () => {
      const viewport = shallow(<PresentationViewport
        imodel={imodelMock.object}
        viewDefinitionId={viewDefinitionId}
        selectionHandler={selectionHandlerMock.object}
      />, { disableLifecycleMethods: true });
      viewport.unmount();
    });

    it("handles missing handler when updates", () => {
      const viewport = shallow(<PresentationViewport
        imodel={imodelMock.object}
        viewDefinitionId={viewDefinitionId}
        selectionHandler={selectionHandlerMock.object}
      />, { disableLifecycleMethods: true });
      viewport.instance().componentDidUpdate!(viewport.props(), viewport.state()!);
    });

  });

});

describe("ViewportSelectionHandler", () => {

  let handler: ViewportSelectionHandler;
  const imodelMock = moq.Mock.ofType<IModelConnection>();

  before(() => {
    NoRenderApp.startup();
    Presentation.selection = new SelectionManager({ scopes: moq.Mock.ofType<SelectionScopesManager>().object });
    const defaultClassName = faker.random.word();
    classNameGenerator = () => defaultClassName;
  });

  after(() => {
    IModelApp.shutdown();
  });

  beforeEach(() => {
    mockIModel(imodelMock);
    handler = new ViewportSelectionHandler(imodelMock.object);
  });

  afterEach(() => {
    handler.dispose();
  });

  describe("imodel", () => {

    it("returns imodel handler is created with", () => {
      expect(handler.imodel).to.eq(imodelMock.object);
    });

    it("does nothing when setting the same imodel", () => {
      const spy = sinon.spy(Presentation.selection, "setSyncWithIModelToolSelection");
      handler.imodel = imodelMock.object;
      expect(spy).to.not.be.called;
    });

    it("sets a different imodel", () => {
      const newConnection = moq.Mock.ofType<IModelConnection>();
      mockIModel(newConnection);
      handler.imodel = newConnection.object;
      expect(handler.imodel).to.eq(newConnection.object);
    });

  });

  describe("reacting to unified selection changes", () => {

    let getHiliteSet: sinon.SinonStub;
    const hiliteSpies = {
      clear: sinon.spy(),
      elements: sinon.spy(),
      models: sinon.spy(),
      subcategories: sinon.spy(),
      resetHistory: () => { },
    };
    const selectionSetSpies = {
      emptyAll: sinon.spy(),
      replace: sinon.spy(),
    };
    beforeEach(() => {
      getHiliteSet = sinon.stub(Presentation.selection, "getHiliteSet").resolves({});
      hiliteSpies.clear = sinon.spy(imodelMock.target.hilited, "clear");
      hiliteSpies.elements = sinon.spy(imodelMock.target.hilited.elements, "addIds");
      hiliteSpies.models = sinon.spy(imodelMock.target.hilited.models, "addIds");
      hiliteSpies.subcategories = sinon.spy(imodelMock.target.hilited.subcategories, "addIds");
      hiliteSpies.resetHistory = () => {
        hiliteSpies.clear.resetHistory();
        hiliteSpies.elements.resetHistory();
        hiliteSpies.models.resetHistory();
        hiliteSpies.subcategories.resetHistory();
      };
      selectionSetSpies.emptyAll = sinon.spy(imodelMock.target.selectionSet, "emptyAll");
      selectionSetSpies.replace = sinon.spy(imodelMock.target.selectionSet, "replace");
    });

    const triggerSelectionChange = ({ sourceName = "", selectionLevel = 0, imodel = imodelMock.object }: { sourceName?: string, selectionLevel?: number, imodel?: IModelConnection } = {}) => {
      const selectionChangeArgs: SelectionChangeEventArgs = {
        imodel,
        changeType: SelectionChangeType.Add,
        level: selectionLevel,
        source: sourceName,
        timestamp: new Date(),
        keys: new KeySet(),
      };
      Presentation.selection.selectionChange.raiseEvent(selectionChangeArgs, Presentation.selection);
    };

    it("ignores selection changes to other imodels", async () => {
      const otherImodel = moq.Mock.ofType<IModelConnection>();
      triggerSelectionChange({ imodel: otherImodel.object });
      expect(getHiliteSet).to.not.be.called;
      expect(hiliteSpies.clear).to.not.be.called;
      expect(hiliteSpies.models).to.not.be.called;
      expect(hiliteSpies.subcategories).to.not.be.called;
      expect(hiliteSpies.elements).to.not.be.called;
    });

    it("ignores selection changes to selection levels other than 0", async () => {
      triggerSelectionChange({ selectionLevel: 1 });
      expect(getHiliteSet).to.not.be.called;
      expect(hiliteSpies.clear).to.not.be.called;
      expect(hiliteSpies.models).to.not.be.called;
      expect(hiliteSpies.subcategories).to.not.be.called;
      expect(hiliteSpies.elements).to.not.be.called;
    });

    it("sets elements hilite", async () => {
      const id = createRandomTransientId();
      getHiliteSet.resetBehavior();
      getHiliteSet.resolves({
        elements: [id],
      });

      // trigger the selection change and wait for event handler to finish
      triggerSelectionChange();
      await waitForAllAsyncs([handler]);

      // verify hilite was changed with expected ids
      expect(hiliteSpies.clear).to.be.calledOnce;
      expect(hiliteSpies.elements).to.be.calledOnceWith([id]);

      // verify selection set was replaced
      expect(selectionSetSpies.emptyAll).to.be.calledOnce;
      expect(selectionSetSpies.replace).to.be.calledOnce;
    });

    it("sets models hilite", async () => {
      const id = createRandomId();
      getHiliteSet.resetBehavior();
      getHiliteSet.resolves({
        models: [id],
      });

      // trigger the selection change and wait for event handler to finish
      triggerSelectionChange();
      await waitForAllAsyncs([handler]);

      // verify hilite was changed with expected ids
      expect(hiliteSpies.clear).to.be.calledOnce;
      expect(hiliteSpies.models).to.be.calledOnceWith([id]);

      // verify selection set was cleared
      expect(selectionSetSpies.emptyAll).to.be.calledOnce;
    });

    it("sets subcategories hilite", async () => {
      const id = createRandomId();
      getHiliteSet.resetBehavior();
      getHiliteSet.resolves({
        subCategories: [id],
      });

      // trigger the selection change and wait for event handler to finish
      triggerSelectionChange();
      await waitForAllAsyncs([handler]);

      // verify hilite was changed with expected ids
      expect(hiliteSpies.clear).to.be.calledOnce;
      expect(hiliteSpies.subcategories).to.be.calledOnceWith([id]);

      // verify selection set was cleared
      expect(selectionSetSpies.emptyAll).to.be.calledOnce;
    });

    it("sets combined hilite", async () => {
      const modelId = createRandomId();
      const subCategoryId = createRandomId();
      const elementId = createRandomId();
      getHiliteSet.resetBehavior();
      getHiliteSet.resolves({
        models: [modelId],
        subCategories: [subCategoryId],
        elements: [elementId],
      });

      // trigger the selection change and wait for event handler to finish
      triggerSelectionChange();
      await waitForAllAsyncs([handler]);

      // verify hilite was changed with expected ids
      expect(hiliteSpies.clear).to.be.calledOnce;
      expect(hiliteSpies.models).to.be.calledOnceWith([modelId]);
      expect(hiliteSpies.subcategories).to.be.calledOnceWith([subCategoryId]);
      expect(hiliteSpies.elements).to.be.calledOnceWith([elementId]);

      // verify selection set was replaced
      expect(selectionSetSpies.emptyAll).to.be.called;
      expect(selectionSetSpies.replace).to.be.calledOnce;
    });

    it("ignores intermediate unified selection changes", async () => {
      getHiliteSet.resetBehavior();
      const hiliteSetRequests = [0, 1].map((callIndex) => {
        const result = new ResolvablePromise<HiliteSet>();
        getHiliteSet.onCall(callIndex).returns(result);
        return result;
      });

      // trigger the selection change
      triggerSelectionChange({ sourceName: "initial" });

      // handler should now be waiting for the first hilite set request to resolve
      expect(getHiliteSet).to.be.calledOnce;
      // ensure viewport selection was not replaced yet
      expect(hiliteSpies.clear).to.not.be.called;
      expect(hiliteSpies.models).to.not.be.called;
      expect(hiliteSpies.subcategories).to.not.be.called;
      expect(hiliteSpies.elements).to.not.be.called;

      // trigger some intermediate selection changes
      for (let i = 1; i <= 10; ++i)
        triggerSelectionChange({ sourceName: i.toString() });

      // ensure new hilite set requests were not triggered - we're still
      // waiting for the first one to resolve
      expect(getHiliteSet).to.be.calledOnce;

      // now resolve the first hilite set request
      await hiliteSetRequests[0].resolve({ elements: [createRandomId()] });

      // ensure viewport selection change was made
      expect(hiliteSpies.clear).to.be.calledOnce;
      expect(hiliteSpies.elements).to.be.calledOnce;
      hiliteSpies.resetHistory();

      // ensure a new content request was made for the last selection change
      expect(getHiliteSet).to.be.calledTwice;
      await hiliteSetRequests[1].resolve({ models: [createRandomId()] });
      await waitForAllAsyncs([handler]);
      expect(hiliteSpies.clear).to.be.calledOnce;
      expect(hiliteSpies.models).to.be.calledOnce;
    });

  });

});

const mockIModel = (mock: moq.IMock<IModelConnection>) => {
  const imodelElementsMock = moq.Mock.ofType<IModelConnection.Elements>();
  imodelElementsMock.setup(async (x) => x.getProps(moq.It.isAny())).returns(async (ids: Id64Arg) => createElementProps(ids));

  const hiliteSet = new IModelHiliteSet(mock.object, false);
  mock.reset();
  mock.setup((imodel) => imodel.hilited).returns(() => hiliteSet);
  mock.setup((imodel) => imodel.elements).returns(() => imodelElementsMock.object);

  const selectionSet = new SelectionSet(mock.object);
  mock.setup((imodel) => imodel.selectionSet).returns(() => selectionSet);
};

let classNameGenerator = () => faker.random.word();
const createElementProps = (ids: Id64Arg): ElementProps[] => {
  return [...Id64.toIdSet(ids)].map((id: Id64String): ElementProps => ({
    id,
    classFullName: classNameGenerator(),
    code: Code.createEmpty(),
    model: id,
  }));
};
