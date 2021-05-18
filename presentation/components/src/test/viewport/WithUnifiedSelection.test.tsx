/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "@bentley/presentation-frontend/lib/test/_helpers/MockFrontendEnvironment";
import { expect } from "chai";
import { mount, shallow } from "enzyme";
import * as faker from "faker";
import * as React from "react";
import * as sinon from "sinon";
import { Id64, Id64Arg, Id64String } from "@bentley/bentleyjs-core";
import { Code, ElementProps } from "@bentley/imodeljs-common";
import { IModelApp, IModelConnection, HiliteSet as IModelHiliteSet, NoRenderApp, SelectionSet, ViewState3d } from "@bentley/imodeljs-frontend";
import { KeySet } from "@bentley/presentation-common";
import * as moq from "@bentley/presentation-common/lib/test/_helpers/Mocks";
import { waitForAllAsyncs } from "@bentley/presentation-common/lib/test/_helpers/PendingAsyncsHelper";
import { ResolvablePromise } from "@bentley/presentation-common/lib/test/_helpers/Promises";
import { createRandomECInstanceKey, createRandomId } from "@bentley/presentation-common/lib/test/_helpers/random";
import {
  HiliteSet, Presentation, SelectionChangeEvent, SelectionChangeEventArgs, SelectionChangeType, SelectionManager, SelectionScopesManager,
} from "@bentley/presentation-frontend";
import { ViewportComponent } from "@bentley/ui-components";
import { IUnifiedSelectionComponent, viewWithUnifiedSelection } from "../../presentation-components";
import { ViewportSelectionHandler } from "../../presentation-components/viewport/WithUnifiedSelection";

// eslint-disable-next-line @typescript-eslint/naming-convention
const PresentationViewport = viewWithUnifiedSelection(ViewportComponent);

describe("Viewport withUnifiedSelection", () => {

  before(async () => {
    if (IModelApp.initialized)
      await IModelApp.shutdown();
    await NoRenderApp.startup();
    classNameGenerator = () => faker.random.word();
  });

  after(async () => {
    await IModelApp.shutdown();
  });

  let viewDefinitionId: Id64String;
  const imodelMock = moq.Mock.ofType<IModelConnection>();
  const selectionHandlerMock = moq.Mock.ofType<ViewportSelectionHandler>();

  beforeEach(() => {
    viewDefinitionId = createRandomId();

    selectionHandlerMock.reset();
    imodelMock.reset();
    mockIModel(imodelMock);

    const viewsMock = moq.Mock.ofInstance<IModelConnection.Views>(new IModelConnection.Views(imodelMock.object));
    viewsMock.setup(async (views) => views.load(moq.It.isAny())).returns(async () => moq.Mock.ofType<ViewState3d>().object);
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
      selectionManagerMock.setup((x) => x.suspendIModelToolSelectionSync(imodelMock.object)).returns(() => ({ dispose: () => { } }));
      selectionManagerMock.setup(async (x) => x.getHiliteSet(imodelMock.object)).returns(async () => ({ }));
      Presentation.setSelectionManager(selectionManagerMock.object);

      const viewport = shallow(<PresentationViewport
        imodel={imodelMock.object}
        viewDefinitionId={viewDefinitionId}
      />).instance() as any as IUnifiedSelectionComponent;

      expect(viewport.selectionHandler).to.not.be.undefined;
      expect(viewport.selectionHandler!.imodel).to.eq(imodelMock.object);
    });

    it("applies current selection after mounting", () => {
      const viewport = shallow(<PresentationViewport
        imodel={imodelMock.object}
        viewDefinitionId={viewDefinitionId}
        selectionHandler={selectionHandlerMock.object}
      />).instance() as any as IUnifiedSelectionComponent;
      expect(viewport.selectionHandler).to.not.be.undefined;
      selectionHandlerMock.verify(async (x) => x.applyCurrentSelection(), moq.Times.once());
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
  let getHiliteSet: sinon.SinonStub<[IModelConnection], Promise<HiliteSet>>;

  before(async () => {
    await NoRenderApp.startup();
    const defaultClassName = faker.random.word();
    classNameGenerator = () => defaultClassName;
  });

  after(async () => {
    await IModelApp.shutdown();
  });

  beforeEach(() => {
    mockIModel(imodelMock);
    Presentation.setSelectionManager(new SelectionManager({ scopes: moq.Mock.ofType<SelectionScopesManager>().object }));

    getHiliteSet = sinon.stub(Presentation.selection, "getHiliteSet").resolves({});
    handler = new ViewportSelectionHandler({ imodel: imodelMock.object });
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

    interface HiliteSpies {
      clear: sinon.SinonSpy<[], void>;
      elements: sinon.SinonSpy<[Id64Arg], void>;
      models: sinon.SinonSpy<[Id64Arg], void>;
      subcategories: sinon.SinonSpy<[Id64Arg], void>;
      resetHistory: () => void;
    }

    interface SelectionSetSpies {
      emptyAll: sinon.SinonSpy<[], void>;
      replace: sinon.SinonSpy<[Id64Arg], void>;
      onChanged: sinon.SinonSpy<any[], any>;
      resetHistory: () => void;
    }

    let spies: { hilite: HiliteSpies, selectionSet: SelectionSetSpies };

    beforeEach(() => {
      // ensure there's something in the selection set
      imodelMock.target.selectionSet.replace(createRandomId());
      spies = createIModelSpies(imodelMock);
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

    it("applies hilite on current selection", async () => {
      const instanceKey = createRandomECInstanceKey();
      Presentation.selection.addToSelection("test", imodelMock.object, new KeySet([instanceKey]));
      await waitForAllAsyncs([handler]);
      spies.hilite.resetHistory();
      spies.selectionSet.resetHistory();

      getHiliteSet.resetBehavior();
      getHiliteSet.resolves({
        elements: [instanceKey.id],
      });

      await handler.applyCurrentSelection();
      await waitForAllAsyncs([handler]);

      // verify hilite was changed with expected ids
      expect(spies.hilite.clear).to.be.calledOnce;
      expect(spies.hilite.elements).to.be.calledOnceWith([instanceKey.id]);

      // verify selection set was replaced
      expect(spies.selectionSet.emptyAll).to.not.be.called;
      expect(spies.selectionSet.replace).to.be.calledOnceWith([instanceKey.id]);
      expect(spies.selectionSet.onChanged).to.be.calledOnce;
    });

    it("ignores selection changes to other imodels", async () => {
      const otherImodel = moq.Mock.ofType<IModelConnection>();
      triggerSelectionChange({ imodel: otherImodel.object });
      expect(getHiliteSet).to.not.be.called;
      expect(spies.hilite.clear).to.not.be.called;
      expect(spies.hilite.models).to.not.be.called;
      expect(spies.hilite.subcategories).to.not.be.called;
      expect(spies.hilite.elements).to.not.be.called;
    });

    it("applies hilite on current selection after changing target imodel", async () => {
      const otherIModelMock = moq.Mock.ofType<IModelConnection>();
      mockIModel(otherIModelMock);
      const instanceKey = createRandomECInstanceKey();
      Presentation.selection.addToSelection("test", otherIModelMock.object, new KeySet([instanceKey]));

      getHiliteSet.resetBehavior();
      getHiliteSet.resolves({
        elements: [instanceKey.id],
      });
      spies = createIModelSpies(otherIModelMock);

      handler.imodel = otherIModelMock.object;
      await waitForAllAsyncs([handler]);

      // verify hilite was changed with expected ids
      expect(spies.hilite.clear).to.be.calledOnce;
      expect(spies.hilite.elements).to.be.calledOnceWith([instanceKey.id]);

      // verify selection set was replaced
      expect(spies.selectionSet.emptyAll).to.not.be.called;
      expect(spies.selectionSet.replace).to.be.calledOnceWith([instanceKey.id]);
      expect(spies.selectionSet.onChanged).to.be.calledOnce;
    });

    it("ignores selection changes to selection levels other than 0", async () => {
      triggerSelectionChange({ selectionLevel: 1 });
      expect(getHiliteSet).to.not.be.called;
      expect(spies.hilite.clear).to.not.be.called;
      expect(spies.hilite.models).to.not.be.called;
      expect(spies.hilite.subcategories).to.not.be.called;
      expect(spies.hilite.elements).to.not.be.called;
    });

    it("clears selection set when hilite list is empty", async () => {
      getHiliteSet.resetBehavior();
      getHiliteSet.resolves({});

      // trigger the selection change and wait for event handler to finish
      triggerSelectionChange();
      await waitForAllAsyncs([handler]);

      // verify selection set was replaced
      expect(spies.selectionSet.emptyAll).to.be.calledOnce;
      expect(spies.selectionSet.replace).to.not.be.called;
      expect(spies.selectionSet.onChanged).to.be.calledOnce;
    });

    it("sets elements hilite", async () => {
      const id = createRandomId();
      getHiliteSet.resetBehavior();
      getHiliteSet.resolves({
        elements: [id],
      });

      // trigger the selection change and wait for event handler to finish
      triggerSelectionChange();
      await waitForAllAsyncs([handler]);

      // verify hilite was changed with expected ids
      expect(spies.hilite.clear).to.be.calledOnce;
      expect(spies.hilite.elements).to.be.calledOnceWith([id]);

      // verify selection set was replaced
      expect(spies.selectionSet.emptyAll).to.not.be.called;
      expect(spies.selectionSet.replace).to.be.calledOnceWith([id]);
      expect(spies.selectionSet.onChanged).to.be.calledOnce;
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
      expect(spies.hilite.clear).to.be.calledOnce;
      expect(spies.hilite.models).to.be.calledOnceWith([id]);

      // verify selection set was cleared
      expect(spies.selectionSet.emptyAll).to.be.calledOnce;
      expect(spies.selectionSet.onChanged).to.be.calledOnce;
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
      expect(spies.hilite.clear).to.be.calledOnce;
      expect(spies.hilite.subcategories).to.be.calledOnceWith([id]);

      // verify selection set was cleared
      expect(spies.selectionSet.emptyAll).to.be.calledOnce;
      expect(spies.selectionSet.onChanged).to.be.calledOnce;
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
      expect(spies.hilite.clear).to.be.calledOnce;
      expect(spies.hilite.models).to.be.calledOnceWith([modelId]);
      expect(spies.hilite.subcategories).to.be.calledOnceWith([subCategoryId]);
      expect(spies.hilite.elements).to.be.calledOnceWith([elementId]);

      // verify selection set was replaced
      expect(spies.selectionSet.emptyAll).to.not.be.called;
      expect(spies.selectionSet.replace).to.be.calledOnceWith([elementId]);
    });

    it("ignores intermediate unified selection changes", async () => {
      getHiliteSet.resetBehavior();
      const hiliteSetRequests = [0, 1].map((callIndex) => {
        const result = new ResolvablePromise<HiliteSet>();
        getHiliteSet.onCall(callIndex).returns(result as any); // wants Promise<Hilite>, missing catch(), finally(), [Symbol.toStringTag].
        return result;
      });

      // trigger the selection change
      triggerSelectionChange({ sourceName: "initial" });

      // handler should now be waiting for the first hilite set request to resolve
      expect(getHiliteSet).to.be.calledOnce;
      // ensure viewport selection was not replaced yet
      expect(spies.hilite.clear).to.not.be.called;
      expect(spies.hilite.models).to.not.be.called;
      expect(spies.hilite.subcategories).to.not.be.called;
      expect(spies.hilite.elements).to.not.be.called;

      // trigger some intermediate selection changes
      for (let i = 1; i <= 10; ++i)
        triggerSelectionChange({ sourceName: i.toString() });

      // ensure new hilite set requests were not triggered - we're still
      // waiting for the first one to resolve
      expect(getHiliteSet).to.be.calledOnce;

      // now resolve the first hilite set request
      await hiliteSetRequests[0].resolve({ elements: [createRandomId()] });

      // ensure viewport selection change was made
      expect(spies.hilite.clear).to.be.calledOnce;
      expect(spies.hilite.elements).to.be.calledOnce;
      spies.hilite.resetHistory();

      // ensure a new content request was made for the last selection change
      expect(getHiliteSet).to.be.calledTwice;
      await hiliteSetRequests[1].resolve({ models: [createRandomId()] });
      await waitForAllAsyncs([handler]);
      expect(spies.hilite.clear).to.be.calledOnce;
      expect(spies.hilite.models).to.be.calledOnce;
    });

  });

});

const createIModelSpies = (mock: moq.IMock<IModelConnection>) => {
  const hilite = {
    clear: sinon.spy(mock.target.hilited, "clear"),
    elements: sinon.spy(mock.target.hilited.elements, "addIds"),
    models: sinon.spy(mock.target.hilited.models, "addIds"),
    subcategories: sinon.spy(mock.target.hilited.subcategories, "addIds"),
    resetHistory: () => {
      hilite.clear.resetHistory();
      hilite.elements.resetHistory();
      hilite.models.resetHistory();
      hilite.subcategories.resetHistory();
    },
  };

  const selectionSet = {
    emptyAll: sinon.spy(mock.target.selectionSet, "emptyAll"),
    replace: sinon.spy(mock.target.selectionSet, "replace"),
    onChanged: sinon.spy(),
    resetHistory: () => {
      selectionSet.emptyAll.resetHistory();
      selectionSet.replace.resetHistory();
      selectionSet.onChanged.resetHistory();
    },
  };

  mock.target.selectionSet.onChanged.addListener(selectionSet.onChanged);

  return { hilite, selectionSet };
};

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
