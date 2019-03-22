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
  createRandomId,
  createRandomECInstanceKey,
  createRandomECInstanceNodeKey,
  createRandomDescriptor,
  createRandomRuleset,
} from "@bentley/presentation-common/lib/test/_helpers/random";
import { ResolvablePromise } from "@bentley/presentation-common/lib/test/_helpers/Promises";
import { waitForAllAsyncs } from "@bentley/presentation-frontend/lib/test/_helpers/PendingAsyncsHelper";
import { Id64String, Id64, Id64Arg } from "@bentley/bentleyjs-core";
import { ElementProps, Code } from "@bentley/imodeljs-common";
import { IModelConnection, ViewState3d, NoRenderApp, HilitedSet } from "@bentley/imodeljs-frontend";
import {
  KeySet, DefaultContentDisplayTypes, SelectionInfo, Content, Item,
  RegisteredRuleset, DescriptorOverrides, ContentFlags,
} from "@bentley/presentation-common";
import {
  Presentation, PresentationManager,
  SelectionManager, SelectionChangeEvent, SelectionChangeEventArgs, SelectionChangeType,
} from "@bentley/presentation-frontend";
import { ViewportComponent } from "@bentley/ui-components";
import { IUnifiedSelectionComponent } from "../../common/IUnifiedSelectionComponent";
import { viewWithUnifiedSelection, ViewportSelectionHandler } from "../../viewport/WithUnifiedSelection";
import RulesetManager from "@bentley/presentation-frontend/lib/RulesetManager";

// tslint:disable-next-line:variable-name naming-convention
const PresentationViewport = viewWithUnifiedSelection(ViewportComponent);

describe("Viewport withUnifiedSelection", () => {

  before(() => {
    NoRenderApp.startup();
    classNameGenerator = () => faker.random.word();
  });
  after(() => {
    NoRenderApp.shutdown();
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
    let hiliteSet: HilitedSet | undefined;
    imodelMock.setup((imodel) => imodel.hilited).returns((imodel) => {
      if (!hiliteSet)
        hiliteSet = new HilitedSet(imodel);
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
    NoRenderApp.shutdown();
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

    let setHiliteSpy: any;
    beforeEach(() => {
      setHiliteSpy = sinon.spy(imodelMock.target.hilited, "setHilite");
    });

    it("ignores selection changes to other imodels", async () => {
      const otherImodel = moq.Mock.ofType<IModelConnection>();
      const selectionChangeArgs: SelectionChangeEventArgs = {
        imodel: otherImodel.object,
        changeType: SelectionChangeType.Clear,
        level: 0,
        source: faker.random.word(),
        timestamp: new Date(),
        keys: new KeySet(),
      };
      selectionManagerMock.target.selectionChange.raiseEvent(selectionChangeArgs, selectionManagerMock.object);
      selectionManagerMock.verify((x) => x.getSelection(imodelMock.object, moq.It.isAny()), moq.Times.never());
      expect(setHiliteSpy).to.not.be.called;
    });

    it("ignores selection changes to selection levels other than 0", async () => {
      const selectionChangeArgs: SelectionChangeEventArgs = {
        imodel: imodelMock.object,
        changeType: SelectionChangeType.Clear,
        level: 1,
        source: faker.random.word(),
        timestamp: new Date(),
        keys: new KeySet(),
      };
      selectionManagerMock.target.selectionChange.raiseEvent(selectionChangeArgs, selectionManagerMock.object);
      selectionManagerMock.verify((x) => x.getSelection(imodelMock.object, moq.It.isAny()), moq.Times.never());
      expect(setHiliteSpy).to.not.be.called;
    });

    it("replaces viewport selection with content of current unified selection", async () => {
      // the handler asks selection manager for overall selection
      const keys = new KeySet([createRandomECInstanceKey(), createRandomECInstanceNodeKey()]);
      selectionManagerMock.setup((x) => x.getSelection(imodelMock.object, 0)).returns(() => keys);

      // then it asks for content for that selection
      const overrides: DescriptorOverrides = {
        displayType: DefaultContentDisplayTypes.VIEWPORT,
        contentFlags: ContentFlags.KeysOnly,
        hiddenFieldNames: [],
      };
      const expectedContent: Content = {
        descriptor: createRandomDescriptor(),
        contentSet: [
          new Item([createRandomECInstanceKey(), createRandomECInstanceKey()], "", "", undefined, {}, {}, []),
          new Item([createRandomECInstanceKey()], "", "", undefined, {}, {}, []),
        ],
      };
      presentationManagerMock.setup(async (x) => x.getContent({ imodel: imodelMock.object, rulesetId, paging: undefined }, overrides, keys))
        .returns(async () => expectedContent);

      // trigger the selection change
      const selectionChangeArgs: SelectionChangeEventArgs = {
        imodel: imodelMock.object,
        changeType: SelectionChangeType.Add,
        level: 0,
        source: "",
        timestamp: new Date(),
        keys: new KeySet(),
      };
      selectionManagerMock.target.selectionChange.raiseEvent(selectionChangeArgs, selectionManagerMock.object);

      // wait for event handler to finish
      await waitForAllAsyncs([handler]);

      // verify viewport selection was changed with expected ids
      const ids = [
        expectedContent.contentSet[0].primaryKeys[0].id,
        expectedContent.contentSet[0].primaryKeys[1].id,
        expectedContent.contentSet[1].primaryKeys[0].id,
      ];
      expect(setHiliteSpy).to.be.calledWith(ids);
    });

    it("replaces viewport selection with empty list when there's no content for unified selection", async () => {
      // the handler asks selection manager for overall selection
      const keys = new KeySet();
      selectionManagerMock.setup((x) => x.getSelection(imodelMock.object, 0)).returns(() => keys);

      // then it asks for content descriptor + content for that selection - return undefined
      // descriptor for 'no content'
      const selectionInfo: SelectionInfo = {
        providerName: faker.random.word(),
        level: 0,
      };
      presentationManagerMock.setup(async (x) => x.getContentDescriptor({ imodel: imodelMock.object, rulesetId },
        DefaultContentDisplayTypes.VIEWPORT, keys, selectionInfo)).returns(async () => undefined);

      // trigger the selection change
      const selectionChangeArgs: SelectionChangeEventArgs = {
        imodel: imodelMock.object,
        changeType: SelectionChangeType.Add,
        level: selectionInfo.level!,
        source: selectionInfo.providerName,
        timestamp: new Date(),
        keys: new KeySet(),
      };
      selectionManagerMock.target.selectionChange.raiseEvent(selectionChangeArgs, selectionManagerMock.object);

      // wait for event handler to finish
      await waitForAllAsyncs([handler]);

      // verify viewport selection was changed with expected ids
      expect(setHiliteSpy).to.be.calledWith([]);
    });

    it("ignores viewport selection changes while reacting to unified selection changes", async () => {
      // the handler asks selection manager for overall selection
      const keys = new KeySet();
      selectionManagerMock.setup((x) => x.getSelection(imodelMock.object, 0)).returns(() => keys);

      // then it asks for content descriptor + content for that selection - return undefined
      // descriptor for 'no content'
      const selectionInfo: SelectionInfo = {
        providerName: faker.random.word(),
        level: 0,
      };
      presentationManagerMock.setup(async (x) => x.getContentDescriptor({ imodel: imodelMock.object, rulesetId },
        DefaultContentDisplayTypes.VIEWPORT, keys, selectionInfo)).returns(async () => undefined);

      // trigger the selection change
      const selectionChangeArgs: SelectionChangeEventArgs = {
        imodel: imodelMock.object,
        changeType: SelectionChangeType.Add,
        level: selectionInfo.level!,
        source: selectionInfo.providerName,
        timestamp: new Date(),
        keys: new KeySet(),
      };
      selectionManagerMock.target.selectionChange.raiseEvent(selectionChangeArgs, selectionManagerMock.object);

      // wait for event handler to finish
      await waitForAllAsyncs([handler]);

      // ensure this didn't result in any more unified selection changes
      selectionManagerMock.verify((x) => x.addToSelection(moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny()), moq.Times.never());
      selectionManagerMock.verify((x) => x.replaceSelection(moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny()), moq.Times.never());
      selectionManagerMock.verify((x) => x.removeFromSelection(moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny()), moq.Times.never());
      selectionManagerMock.verify((x) => x.clearSelection(moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny()), moq.Times.never());
    });

    it("ignores intermediate unified selection changes", async () => {
      // the handler asks selection manager for overall selection
      const keys = new KeySet([createRandomECInstanceKey()]);
      selectionManagerMock.setup((x) => x.getSelection(imodelMock.object, 0)).returns(() => keys);

      const overrides: DescriptorOverrides = {
        displayType: DefaultContentDisplayTypes.VIEWPORT,
        contentFlags: ContentFlags.KeysOnly,
        hiddenFieldNames: [],
      };

      // then it asks for content for that selection - return undefined
      const contentRequests = [1, 2].map(() => {
        const content = new ResolvablePromise<Content | undefined>();
        presentationManagerMock.setup(async (x) => x.getContent({ imodel: imodelMock.object, rulesetId, paging: undefined },
          overrides, keys)).returns(async () => content);
        return content;
      });

      // trigger the selection change
      const selectionChangeArgs = (name: string): SelectionChangeEventArgs => ({
        imodel: imodelMock.object,
        changeType: SelectionChangeType.Add,
        level: 0,
        source: name,
        timestamp: new Date(),
        keys: new KeySet(),
      });
      selectionManagerMock.target.selectionChange.raiseEvent(selectionChangeArgs("initial"), selectionManagerMock.object);

      // handler should now be waiting for the first content request to resolve - ensure
      // viewport selection was not replaced yet
      presentationManagerMock.verify(async (x) => x.getContent({ imodel: imodelMock.object, rulesetId, paging: undefined },
        overrides, keys), moq.Times.once());
      expect(setHiliteSpy).to.not.be.called;

      // trigger some intermediate selection changes
      for (let i = 1; i <= 10; ++i)
        selectionManagerMock.target.selectionChange.raiseEvent(selectionChangeArgs(i.toString()), selectionManagerMock.object);

      // ensure new content requests were not triggered
      presentationManagerMock.verify(async (x) => x.getContent({ imodel: imodelMock.object, rulesetId, paging: undefined },
        overrides, keys), moq.Times.once());

      // now resolve the first content request
      await contentRequests[0].resolve(undefined);

      // ensure viewport selection change was made
      expect(setHiliteSpy).to.be.calledOnce;

      // ensure a new content request was made for the last selection change
      presentationManagerMock.verify(async (x) => x.getContent({ imodel: imodelMock.object, rulesetId, paging: undefined },
        overrides, keys), moq.Times.exactly(2));
      await contentRequests[1].resolve(undefined);
      await waitForAllAsyncs([handler]);
      expect(setHiliteSpy).to.be.calledTwice;
    });

  });

});

const mockIModel = (mock: moq.IMock<IModelConnection>) => {
  const imodelElementsMock = moq.Mock.ofType<IModelConnection.Elements>();
  imodelElementsMock.setup(async (x) => x.getProps(moq.It.isAny())).returns(async (ids: Id64Arg) => createElementProps(ids));

  const hiliteSet = new HilitedSet(mock.object);
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
