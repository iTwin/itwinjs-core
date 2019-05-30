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
import {
  createRandomId, createRandomTransientId,
  createRandomECInstanceKey,
  createRandomECInstanceNodeKey,
  createRandomDescriptor,
  createRandomRuleset,
} from "@bentley/presentation-common/lib/test/_helpers/random";
import { ResolvablePromise } from "@bentley/presentation-common/lib/test/_helpers/Promises";
import { waitForAllAsyncs } from "@bentley/presentation-frontend/lib/test/_helpers/PendingAsyncsHelper";
import { Id64String, Id64, Id64Arg } from "@bentley/bentleyjs-core";
import { ElementProps, Code } from "@bentley/imodeljs-common";
import { IModelConnection, ViewState3d, NoRenderApp, HiliteSet, IModelApp } from "@bentley/imodeljs-frontend";
import {
  KeySet, DefaultContentDisplayTypes, SelectionInfo, Content, Item,
  RegisteredRuleset, DescriptorOverrides, ContentFlags, Ruleset,
} from "@bentley/presentation-common";
import {
  Presentation, PresentationManager, RulesetManager,
  SelectionManager, SelectionChangeEvent, SelectionChangeEventArgs, SelectionChangeType,
} from "@bentley/presentation-frontend";
import { TRANSIENT_ELEMENT_CLASSNAME } from "@bentley/presentation-frontend/lib/selection/SelectionManager";
import { ViewportComponent } from "@bentley/ui-components";
import { IUnifiedSelectionComponent } from "../../common/IUnifiedSelectionComponent";
import { viewWithUnifiedSelection, ViewportSelectionHandler } from "../../viewport/WithUnifiedSelection";

// tslint:disable-next-line: no-var-requires
const defaultRuleset = require("../../viewport/HiliteRules") as Ruleset;

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
    let hiliteSet: HiliteSet | undefined;
    imodelMock.setup((imodel) => imodel.hilited).returns((imodel) => {
      if (!hiliteSet)
        hiliteSet = new HiliteSet(imodel, false);
      return hiliteSet;
    });
    imodelMock.setup((imodel) => imodel.views).returns(() => viewsMock.object);
  });

  it("mounts", () => {
    mount(<PresentationViewport
      imodel={imodelMock.object}
      ruleset={faker.random.word()}
      viewDefinitionId={viewDefinitionId}
      selectionHandler={selectionHandlerMock.object}
    />);
  });

  it("uses data provider's imodel and rulesetId", () => {
    const rulesetId = faker.random.word();
    const component = shallow(<PresentationViewport
      imodel={imodelMock.object}
      ruleset={rulesetId}
      viewDefinitionId={viewDefinitionId}
      selectionHandler={selectionHandlerMock.object}
    />).instance() as any as IUnifiedSelectionComponent;

    expect(component.imodel).to.equal(imodelMock.object);
    expect(component.rulesetId).to.equal(rulesetId);
  });

  it("uses default ruleset if not provided", () => {
    const component = shallow(<PresentationViewport
      imodel={imodelMock.object}
      viewDefinitionId={viewDefinitionId}
      selectionHandler={selectionHandlerMock.object}
    />).instance() as any as IUnifiedSelectionComponent;
    expect(component.rulesetId).to.equal(defaultRuleset.id);
  });

  it("renders correctly", () => {
    expect(shallow(<PresentationViewport
      imodel={imodelMock.object}
      ruleset={faker.random.word()}
      viewDefinitionId={viewDefinitionId}
      selectionHandler={selectionHandlerMock.object}
    />)).to.matchSnapshot();
  });

  describe("selectionHandler", () => {

    it("creates default implementation when not provided through props", () => {
      const selectionManagerMock = moq.Mock.ofType<SelectionManager>();
      selectionManagerMock.setup((x) => x.selectionChange).returns(() => new SelectionChangeEvent());
      Presentation.selection = selectionManagerMock.object;

      const rulesetId = faker.random.word();

      const viewport = shallow(<PresentationViewport
        imodel={imodelMock.object}
        ruleset={rulesetId}
        viewDefinitionId={viewDefinitionId}
      />).instance() as any as IUnifiedSelectionComponent;

      expect(viewport.selectionHandler).to.not.be.undefined;
      expect(viewport.selectionHandler!.rulesetId).to.eq(rulesetId);
      expect(viewport.selectionHandler!.imodel).to.eq(imodelMock.object);
    });

    it("disposes when component unmounts", () => {
      const viewport = shallow(<PresentationViewport
        imodel={imodelMock.object}
        ruleset={faker.random.word()}
        viewDefinitionId={viewDefinitionId}
        selectionHandler={selectionHandlerMock.object}
      />);
      viewport.unmount();
      selectionHandlerMock.verify((x) => x.dispose(), moq.Times.once());
    });

    it("updates handler when component's props change", () => {
      const viewport = shallow(<PresentationViewport
        imodel={imodelMock.object}
        ruleset={faker.random.word()}
        viewDefinitionId={viewDefinitionId}
        selectionHandler={selectionHandlerMock.object}
      />);

      const imodelMock2 = moq.Mock.ofType<IModelConnection>();
      const rulesetId2 = faker.random.word();

      viewport.setProps({
        imodel: imodelMock2.object,
        ruleset: rulesetId2,
      });

      selectionHandlerMock.verify((x) => x.imodel = imodelMock2.object, moq.Times.once());
      selectionHandlerMock.verify((x) => x.ruleset = rulesetId2, moq.Times.once());
    });

    it("returns undefined handler when not mounted", () => {
      const viewport = shallow(<PresentationViewport
        imodel={imodelMock.object}
        ruleset={faker.random.word()}
        viewDefinitionId={viewDefinitionId}
        selectionHandler={selectionHandlerMock.object}
      />, { disableLifecycleMethods: true }).instance() as any as IUnifiedSelectionComponent;
      expect(viewport.selectionHandler).to.be.undefined;
    });

    it("handles missing handler when unmounts", () => {
      const viewport = shallow(<PresentationViewport
        imodel={imodelMock.object}
        ruleset={faker.random.word()}
        viewDefinitionId={viewDefinitionId}
        selectionHandler={selectionHandlerMock.object}
      />, { disableLifecycleMethods: true });
      viewport.unmount();
    });

    it("handles missing handler when updates", () => {
      const viewport = shallow(<PresentationViewport
        imodel={imodelMock.object}
        ruleset={faker.random.word()}
        viewDefinitionId={viewDefinitionId}
        selectionHandler={selectionHandlerMock.object}
      />, { disableLifecycleMethods: true });
      viewport.instance().componentDidUpdate!(viewport.props(), viewport.state()!);
    });

  });

});

describe("ViewportSelectionHandler", () => {

  let rulesetId: string;
  let handler: ViewportSelectionHandler;
  const presentationManagerMock = moq.Mock.ofType<PresentationManager>();
  const selectionManagerMock = moq.Mock.ofType<SelectionManager>();
  const imodelMock = moq.Mock.ofType<IModelConnection>();

  before(() => {
    NoRenderApp.startup();
    Presentation.presentation = presentationManagerMock.object;
    Presentation.selection = selectionManagerMock.object;
    rulesetId = faker.random.word();
    const defaultClassName = faker.random.word();
    classNameGenerator = () => defaultClassName;
  });

  after(() => {
    IModelApp.shutdown();
  });

  beforeEach(() => {
    presentationManagerMock.reset();

    const selectionChangeEvent = new SelectionChangeEvent();
    selectionManagerMock.reset();
    selectionManagerMock.setup((x) => x.selectionChange).returns(() => selectionChangeEvent);

    mockIModel(imodelMock);

    handler = new ViewportSelectionHandler(imodelMock.object, rulesetId);
  });

  afterEach(() => {
    handler.dispose();
  });

  describe("imodel", () => {

    it("returns imodel handler is created with", () => {
      expect(handler.imodel).to.eq(imodelMock.object);
    });

    it("does nothing when setting the same imodel", () => {
      selectionManagerMock.reset();
      handler.imodel = imodelMock.object;
      selectionManagerMock.verify((x) => x.setSyncWithIModelToolSelection(moq.It.isAny(), moq.It.isAny()), moq.Times.never());
    });

    it("sets a different imodel", () => {
      const newConnection = moq.Mock.ofType<IModelConnection>();
      mockIModel(newConnection);
      handler.imodel = newConnection.object;
      expect(handler.imodel).to.eq(newConnection.object);
    });

  });

  describe("ruleset", () => {

    it("returns rulesetId handler is created with", () => {
      expect(handler.rulesetId).to.eq(rulesetId);
    });

    it("sets ruleset to a string", () => {
      const newId = rulesetId + " (changed)";
      handler.ruleset = newId;
      expect(handler.rulesetId).to.eq(newId);
    });

    it("sets ruleset to an object", async () => {
      const rulesets = await Promise.all([0, 1].map(async () => createRandomRuleset()));
      const disposeSpies = [0, 1].map(() => sinon.spy());
      const registerPromises = [0, 1].map(() => new ResolvablePromise<RegisteredRuleset>());

      const rulesetsMock = moq.Mock.ofType<RulesetManager>();
      rulesetsMock.setup(async (x) => x.add(rulesets[0])).returns(async () => registerPromises[0]);
      rulesetsMock.setup(async (x) => x.add(rulesets[1])).returns(async () => registerPromises[1]);
      presentationManagerMock.setup((x) => x.rulesets()).returns(() => rulesetsMock.object);

      // verify setting to ruleset object registers it
      handler.ruleset = rulesets[0];
      expect(handler.rulesetId).to.eq(rulesets[0].id);
      rulesetsMock.verify(async (x) => x.add(rulesets[0]), moq.Times.once());
      await registerPromises[0].resolve(new RegisteredRuleset(rulesets[0], "0", disposeSpies[0]));

      // verify setting to a different ruleset, the old one is disposed
      handler.ruleset = rulesets[1];
      expect(handler.rulesetId).to.eq(rulesets[1].id);
      expect(disposeSpies[0]).to.be.calledOnce;
      rulesetsMock.verify(async (x) => x.add(rulesets[1]), moq.Times.once());
      // note: do not resolve the registration yet

      handler.dispose();
      expect(disposeSpies[1]).to.not.be.called;
      await registerPromises[1].resolve(new RegisteredRuleset(rulesets[1], "1", disposeSpies[1]));
      expect(disposeSpies[1]).to.be.calledOnce;
    });

  });

  describe("reacting to unified selection changes", () => {

    const hiliteSpies = {
      clear: sinon.spy(),
      elements: sinon.spy(),
      models: sinon.spy(),
      subcategories: sinon.spy(),
    };
    beforeEach(() => {
      hiliteSpies.clear = sinon.spy(imodelMock.target.hilited, "clear");
      hiliteSpies.elements = sinon.spy(imodelMock.target.hilited.elements, "addIds");
      hiliteSpies.models = sinon.spy(imodelMock.target.hilited.models, "addIds");
      hiliteSpies.subcategories = sinon.spy(imodelMock.target.hilited.subcategories, "addIds");
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
      selectionManagerMock.target.selectionChange.raiseEvent(selectionChangeArgs, selectionManagerMock.object);
    };

    it("ignores selection changes to other imodels", async () => {
      const otherImodel = moq.Mock.ofType<IModelConnection>();
      triggerSelectionChange({ imodel: otherImodel.object });
      selectionManagerMock.verify((x) => x.getSelection(imodelMock.object, moq.It.isAny()), moq.Times.never());
      expect(hiliteSpies.clear).to.not.be.called;
      expect(hiliteSpies.models).to.not.be.called;
      expect(hiliteSpies.subcategories).to.not.be.called;
      expect(hiliteSpies.elements).to.not.be.called;
    });

    it("ignores selection changes to selection levels other than 0", async () => {
      triggerSelectionChange({ selectionLevel: 1 });
      selectionManagerMock.verify((x) => x.getSelection(imodelMock.object, moq.It.isAny()), moq.Times.never());
      expect(hiliteSpies.clear).to.not.be.called;
      expect(hiliteSpies.models).to.not.be.called;
      expect(hiliteSpies.subcategories).to.not.be.called;
      expect(hiliteSpies.elements).to.not.be.called;
    });

    it("sets transient elements hilite when there's no content for unified selection", async () => {
      // the handler asks selection manager for overall selection
      const persistentKeys = [createRandomECInstanceKey(), createRandomECInstanceNodeKey()];
      const transientKey = { className: TRANSIENT_ELEMENT_CLASSNAME, id: createRandomTransientId() };
      const selectedKeys = new KeySet([...persistentKeys, transientKey]);
      selectionManagerMock.setup((x) => x.getSelection(imodelMock.object, 0)).returns(() => selectedKeys);

      // then it asks for content descriptor + content for that selection - return undefined
      // descriptor for 'no content'
      const selectionInfo: SelectionInfo = {
        providerName: faker.random.word(),
        level: 0,
      };
      presentationManagerMock.setup(async (x) => x.getContentDescriptor({ imodel: imodelMock.object, rulesetId },
        DefaultContentDisplayTypes.Viewport, moq.isKeySet(new KeySet(persistentKeys)), selectionInfo)).returns(async () => undefined);

      // trigger the selection change and wait for event handler to finish
      triggerSelectionChange();
      await waitForAllAsyncs([handler]);

      // verify viewport selection was changed with expected ids
      expect(hiliteSpies.clear).to.be.calledOnce;
      expect(hiliteSpies.elements).to.be.calledOnceWith([transientKey.id]);
    });

    it("sets element hilite from current unified selection", async () => {
      // the handler asks selection manager for overall selection
      const persistentKey = createRandomECInstanceKey();
      const selectedKeys = new KeySet([persistentKey]);
      selectionManagerMock.setup((x) => x.getSelection(imodelMock.object, 0)).returns(() => selectedKeys);

      // then it asks for content for that selection
      const overrides: DescriptorOverrides = {
        displayType: DefaultContentDisplayTypes.Viewport,
        contentFlags: ContentFlags.KeysOnly,
        hiddenFieldNames: [],
      };
      const expectedContent = new Content(createRandomDescriptor(), [
        new Item([createRandomECInstanceKey()], "", "", undefined, {}, {}, [], {}), // element
      ]);
      presentationManagerMock.setup(async (x) => x.getContent({ imodel: imodelMock.object, rulesetId, paging: undefined }, overrides, moq.isKeySet(new KeySet([persistentKey]))))
        .returns(async () => expectedContent);

      // trigger the selection change and wait for event handler to finish
      triggerSelectionChange();
      await waitForAllAsyncs([handler]);

      // verify viewport selection was changed with expected ids
      expect(hiliteSpies.clear).to.be.calledOnce;
      expect(hiliteSpies.elements).to.be.calledOnceWith([expectedContent.contentSet[0].primaryKeys[0].id]);
    });

    it("sets model hilite from current unified selection", async () => {
      // the handler asks selection manager for overall selection
      const persistentKey = createRandomECInstanceKey();
      const selectedKeys = new KeySet([persistentKey]);
      selectionManagerMock.setup((x) => x.getSelection(imodelMock.object, 0)).returns(() => selectedKeys);

      // then it asks for content for that selection
      const overrides: DescriptorOverrides = {
        displayType: DefaultContentDisplayTypes.Viewport,
        contentFlags: ContentFlags.KeysOnly,
        hiddenFieldNames: [],
      };
      const expectedContent = new Content(createRandomDescriptor(), [
        new Item([createRandomECInstanceKey()], "", "", undefined, {}, {}, [], { isModel: true }),
      ]);
      presentationManagerMock.setup(async (x) => x.getContent({ imodel: imodelMock.object, rulesetId, paging: undefined }, overrides, moq.isKeySet(new KeySet([persistentKey]))))
        .returns(async () => expectedContent);

      // trigger the selection change and wait for event handler to finish
      triggerSelectionChange();
      await waitForAllAsyncs([handler]);

      // verify viewport selection was changed with expected ids
      expect(hiliteSpies.clear).to.be.calledOnce;
      expect(hiliteSpies.models).to.be.calledOnceWith([expectedContent.contentSet[0].primaryKeys[0].id]);
    });

    it("sets subcategory hilite from current unified selection", async () => {
      // the handler asks selection manager for overall selection
      const persistentKey = createRandomECInstanceKey();
      const selectedKeys = new KeySet([persistentKey]);
      selectionManagerMock.setup((x) => x.getSelection(imodelMock.object, 0)).returns(() => selectedKeys);

      // then it asks for content for that selection
      const overrides: DescriptorOverrides = {
        displayType: DefaultContentDisplayTypes.Viewport,
        contentFlags: ContentFlags.KeysOnly,
        hiddenFieldNames: [],
      };
      const expectedContent = new Content(createRandomDescriptor(), [
        new Item([createRandomECInstanceKey()], "", "", undefined, {}, {}, [], { isSubCategory: true }),
      ]);
      presentationManagerMock.setup(async (x) => x.getContent({ imodel: imodelMock.object, rulesetId, paging: undefined }, overrides, moq.isKeySet(new KeySet([persistentKey]))))
        .returns(async () => expectedContent);

      // trigger the selection change and wait for event handler to finish
      triggerSelectionChange();
      await waitForAllAsyncs([handler]);

      // verify viewport selection was changed with expected ids
      expect(hiliteSpies.clear).to.be.calledOnce;
      expect(hiliteSpies.subcategories).to.be.calledOnceWith([expectedContent.contentSet[0].primaryKeys[0].id]);
    });

    it("sets mixed hilite from current unified selection", async () => {
      // the handler asks selection manager for overall selection
      const persistentKey = createRandomECInstanceKey();
      const transientKey = { className: TRANSIENT_ELEMENT_CLASSNAME, id: createRandomTransientId() };
      const selectedKeys = new KeySet([persistentKey, transientKey]);
      selectionManagerMock.setup((x) => x.getSelection(imodelMock.object, 0)).returns(() => selectedKeys);

      // then it asks for content for that selection
      const overrides: DescriptorOverrides = {
        displayType: DefaultContentDisplayTypes.Viewport,
        contentFlags: ContentFlags.KeysOnly,
        hiddenFieldNames: [],
      };
      const expectedContent = new Content(createRandomDescriptor(), [
        new Item([createRandomECInstanceKey()], "", "", undefined, {}, {}, [], { isModel: true }),
        new Item([createRandomECInstanceKey()], "", "", undefined, {}, {}, [], { isSubCategory: true }),
        new Item([createRandomECInstanceKey()], "", "", undefined, {}, {}, [], {}), // element
      ]);
      presentationManagerMock.setup(async (x) => x.getContent({ imodel: imodelMock.object, rulesetId, paging: undefined }, overrides, moq.isKeySet(new KeySet([persistentKey]))))
        .returns(async () => expectedContent);

      // trigger the selection change and wait for event handler to finish
      triggerSelectionChange();
      await waitForAllAsyncs([handler]);

      // verify viewport selection was changed with expected ids
      expect(hiliteSpies.clear).to.be.calledOnce;
      expect(hiliteSpies.models).to.be.calledOnceWith([expectedContent.contentSet[0].primaryKeys[0].id]);
      expect(hiliteSpies.subcategories).to.be.calledOnceWith([expectedContent.contentSet[1].primaryKeys[0].id]);
      expect(hiliteSpies.elements).to.be.calledOnceWith([transientKey.id, expectedContent.contentSet[2].primaryKeys[0].id]);
    });

    it("ignores intermediate unified selection changes", async () => {
      // the handler asks selection manager for overall selection
      const keys = new KeySet([createRandomECInstanceKey()]);
      selectionManagerMock.setup((x) => x.getSelection(imodelMock.object, 0)).returns(() => keys);

      const overrides: DescriptorOverrides = {
        displayType: DefaultContentDisplayTypes.Viewport,
        contentFlags: ContentFlags.KeysOnly,
        hiddenFieldNames: [],
      };

      // then it asks for content for that selection - return undefined
      const contentRequests = [1, 2].map(() => {
        const content = new ResolvablePromise<Content | undefined>();
        presentationManagerMock.setup(async (x) => x.getContent({ imodel: imodelMock.object, rulesetId, paging: undefined },
          overrides, moq.isKeySet(keys))).returns(async () => content);
        return content;
      });

      // trigger the selection change
      triggerSelectionChange({ sourceName: "initial" });

      // handler should now be waiting for the first content request to resolve - ensure
      // viewport selection was not replaced yet
      presentationManagerMock.verify(async (x) => x.getContent({ imodel: imodelMock.object, rulesetId, paging: undefined },
        overrides, moq.isKeySet(keys)), moq.Times.once());
      expect(hiliteSpies.clear).to.not.be.called;
      expect(hiliteSpies.models).to.not.be.called;
      expect(hiliteSpies.subcategories).to.not.be.called;
      expect(hiliteSpies.elements).to.not.be.called;

      // trigger some intermediate selection changes
      for (let i = 1; i <= 10; ++i)
        triggerSelectionChange({ sourceName: i.toString() });

      // ensure new content requests were not triggered
      presentationManagerMock.verify(async (x) => x.getContent({ imodel: imodelMock.object, rulesetId, paging: undefined },
        overrides, moq.isKeySet(keys)), moq.Times.once());

      // now resolve the first content request
      await contentRequests[0].resolve(new Content(createRandomDescriptor(), [
        new Item([createRandomECInstanceKey()], "", "", undefined, {}, {}, [], {}),
      ]));

      // ensure viewport selection change was made
      expect(hiliteSpies.clear).to.be.calledOnce;
      expect(hiliteSpies.elements).to.be.calledOnce;

      // ensure a new content request was made for the last selection change
      presentationManagerMock.verify(async (x) => x.getContent({ imodel: imodelMock.object, rulesetId, paging: undefined },
        overrides, moq.isKeySet(keys)), moq.Times.exactly(2));
      await contentRequests[1].resolve(new Content(createRandomDescriptor(), [
        new Item([createRandomECInstanceKey()], "", "", undefined, {}, {}, [], {}),
      ]));
      await waitForAllAsyncs([handler]);
      expect(hiliteSpies.clear).to.be.calledTwice;
      expect(hiliteSpies.elements).to.be.calledTwice;
    });

  });

});

const mockIModel = (mock: moq.IMock<IModelConnection>) => {
  const imodelElementsMock = moq.Mock.ofType<IModelConnection.Elements>();
  imodelElementsMock.setup(async (x) => x.getProps(moq.It.isAny())).returns(async (ids: Id64Arg) => createElementProps(ids));

  const hiliteSet = new HiliteSet(mock.object, false);
  mock.reset();
  mock.setup((imodel) => imodel.hilited).returns(() => hiliteSet);
  mock.setup((imodel) => imodel.elements).returns(() => imodelElementsMock.object);
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
