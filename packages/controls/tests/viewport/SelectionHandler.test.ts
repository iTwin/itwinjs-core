/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import "@helpers/MockFrontendEnvironment";
import { expect } from "chai";
import * as moq from "@helpers/Mocks";
import * as spies from "@helpers/Spies";
import * as faker from "faker";
import { PromiseContainer } from "@helpers/Promises";
import { createRandomId } from "@helpers/random/Misc";
import { createRandomECInstanceKey } from "@helpers/random/EC";
import { createRandomECInstanceNodeKey } from "@helpers/random/Hierarchy";
import { createRandomDescriptor } from "@helpers/random/Content";
import { Id64Arg, Id64 } from "@bentley/bentleyjs-core";
import { ElementProps } from "@bentley/imodeljs-common";
import { IModelConnection, SelectionSet, SelectEventType, IModelApp } from "@bentley/imodeljs-frontend";
import { KeySet, DefaultContentDisplayTypes, Content, Item, SelectionInfo } from "@bentley/ecpresentation-common";
import {
  ECPresentation, ECPresentationManager,
  SelectionManager, SelectionChangeEventArgs, SelectionChangeType, SelectionChangeEvent,
} from "@bentley/ecpresentation-frontend";
import SelectionHandler from "@src/viewport/SelectionHandler";

describe("Viewport SelectionHandler", () => {

  let rulesetId: string;
  let handler: SelectionHandler;
  const presentationManagerMock = moq.Mock.ofType<ECPresentationManager>();
  const selectionManagerMock = moq.Mock.ofType<SelectionManager>();
  const imodelMock = moq.Mock.ofType<IModelConnection>();

  before(() => {
    IModelApp.startup();
    rulesetId = faker.random.word();
    ECPresentation.presentation = presentationManagerMock.object;
    ECPresentation.selection = selectionManagerMock.object;
  });
  after(() => {
    IModelApp.shutdown();
  });

  beforeEach(() => {
    presentationManagerMock.reset();

    const selectionChangeEvent = new SelectionChangeEvent();
    selectionManagerMock.reset();
    selectionManagerMock.setup((x) => x.selectionChange).returns(() => selectionChangeEvent);

    const imodelElementsMock = moq.Mock.ofType<IModelConnection.Elements>();
    imodelElementsMock.setup((x) => x.getProps(moq.It.isAny())).returns(async (ids: Id64Arg) => createElementProps(ids));

    const selectionSet = new SelectionSet(imodelMock.object);
    imodelMock.reset();
    imodelMock.setup((imodel) => imodel.selectionSet).returns(() => selectionSet);
    imodelMock.setup((imodel) => imodel.elements).returns(() => imodelElementsMock.object);

    handler = new SelectionHandler(imodelMock.object, rulesetId);
  });

  afterEach(() => {
    handler.dispose();
  });

  const createElementProps = (ids: Id64Arg): ElementProps[] => {
    return [...Id64.toIdSet(ids)].map((id: string) => ({
      id: new Id64(id),
      classFullName: `class_name_${id}`,
    }));
  };
  const createExtendedOptions = () => ({ RulesetId: rulesetId });

  describe("imodel", () => {

    it("returns imodel handler is created with", () => {
      expect(handler.imodel).to.eq(imodelMock.object);
    });

    it("sets a different imodel", () => {
      const newConnection = moq.Mock.ofType<IModelConnection>();
      handler.imodel = newConnection.object;
      expect(handler.imodel).to.eq(newConnection.object);
    });

  });

  describe("rulesetId", () => {

    it("returns rulesetId handler is created with", () => {
      expect(handler.rulesetId).to.eq(rulesetId);
    });

    it("sets a different rulesetId", () => {
      const newId = rulesetId + " (changed)";
      handler.rulesetId = newId;
      expect(handler.rulesetId).to.eq(newId);
    });

  });

  describe("reacting to unified selection changes", () => {

    let replaceSpy: any;
    let replaceCalled: PromiseContainer<void>;
    beforeEach(() => {
      replaceCalled = new PromiseContainer<void>();
      const origReplace = imodelMock.object.selectionSet.replace;
      imodelMock.object.selectionSet.replace = () => {
        origReplace.apply(imodelMock.object.selectionSet, arguments);
        replaceCalled.resolve();
      };
      replaceSpy = spies.spy.on(imodelMock.object.selectionSet, SelectionSet.prototype.replace.name);
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
      expect(replaceSpy).to.not.be.called();
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
      expect(replaceSpy).to.not.be.called();
    });

    it("replaces viewport selection with content of current unified selection", async () => {
      // the handler asks selection manager for overall selection
      const keys = new KeySet([createRandomECInstanceKey(), createRandomECInstanceNodeKey()]);
      selectionManagerMock.setup((x) => x.getSelection(imodelMock.object, 0)).returns(() => keys);

      // then it asks for content descriptor + content for that selection
      const selectionProviderName = faker.random.word();
      const selectionLevel = 0;
      const descriptor = createRandomDescriptor();
      descriptor.selectionInfo = {
        providerName: selectionProviderName,
        level: selectionLevel,
      };
      presentationManagerMock.setup((x) => x.getContentDescriptor(imodelMock.object, DefaultContentDisplayTypes.VIEWPORT,
        keys, descriptor.selectionInfo, createExtendedOptions())).returns(async () => descriptor);

      const content: Content = {
        descriptor,
        contentSet: [
          new Item([createRandomECInstanceKey(), createRandomECInstanceKey()], "", "", undefined, {}, {}, []),
          new Item([createRandomECInstanceKey()], "", "", undefined, {}, {}, []),
        ],
      };
      presentationManagerMock.setup((x) => x.getContentSetSize(imodelMock.object, descriptor, keys,
        createExtendedOptions())).returns(async () => content.contentSet.length);
      presentationManagerMock.setup((x) => x.getContent(imodelMock.object, descriptor, keys, undefined,
        createExtendedOptions())).returns(async () => content);

      // trigger the selection change
      const selectionChangeArgs: SelectionChangeEventArgs = {
        imodel: imodelMock.object,
        changeType: SelectionChangeType.Add,
        level: selectionLevel,
        source: selectionProviderName,
        timestamp: new Date(),
        keys: new KeySet(),
      };
      selectionManagerMock.target.selectionChange.raiseEvent(selectionChangeArgs, selectionManagerMock.object);

      // wait for event handler to finish
      await replaceCalled.promise;

      // verify viewport selection was changed with expected ids
      const ids = [
        content.contentSet[0].primaryKeys[0].id,
        content.contentSet[0].primaryKeys[1].id,
        content.contentSet[1].primaryKeys[0].id,
      ];
      expect(replaceSpy).to.be.called.with(ids);
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
      presentationManagerMock.setup((x) => x.getContentDescriptor(imodelMock.object, DefaultContentDisplayTypes.VIEWPORT,
        keys, selectionInfo, createExtendedOptions())).returns(async () => undefined);

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
      await replaceCalled.promise;

      // verify viewport selection was changed with expected ids
      expect(replaceSpy).to.be.called.with([]);
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
      presentationManagerMock.setup((x) => x.getContentDescriptor(imodelMock.object, DefaultContentDisplayTypes.VIEWPORT,
        keys, selectionInfo, createExtendedOptions())).returns(async () => undefined);

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
      await replaceCalled.promise;

      // ensure this didn't result in any more unified selection changes
      selectionManagerMock.verify((x) => x.addToSelection(moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny()), moq.Times.never());
      selectionManagerMock.verify((x) => x.replaceSelection(moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny()), moq.Times.never());
      selectionManagerMock.verify((x) => x.removeFromSelection(moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny()), moq.Times.never());
      selectionManagerMock.verify((x) => x.clearSelection(moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny()), moq.Times.never());
    });

  });

  describe("reacting to viewport selection changes", () => {

    let selectionManagerCalled: PromiseContainer<void>;
    beforeEach(() => {
      selectionManagerCalled = new PromiseContainer<void>();
      const defaultArgs = {
        imodel: imodelMock.object,
        level: 0,
        timestamp: new Date(),
        keys: new KeySet(),
      };
      const callback = (args: SelectionChangeEventArgs) => {
        selectionManagerMock.target.selectionChange.raiseEvent(args, selectionManagerMock.object);
        selectionManagerCalled.resolve();
      };
      selectionManagerMock.setup((x) => x.addToSelection(moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny()))
        .callback((source) => callback({ ...defaultArgs, changeType: SelectionChangeType.Add, source }));
      selectionManagerMock.setup((x) => x.replaceSelection(moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny()))
        .callback((source) => callback({ ...defaultArgs, changeType: SelectionChangeType.Replace, source }));
      selectionManagerMock.setup((x) => x.removeFromSelection(moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny()))
        .callback((source) => callback({ ...defaultArgs, changeType: SelectionChangeType.Remove, source }));
      selectionManagerMock.setup((x) => x.clearSelection(moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny()))
        .callback((source) => callback({ ...defaultArgs, changeType: SelectionChangeType.Clear, source }));
    });

    it("ignores selection changes to other imodels", async () => {
      const otherImodel = moq.Mock.ofType<IModelConnection>();
      imodelMock.target.selectionSet.onChanged.raiseEvent(otherImodel.object, SelectEventType.Clear);
      selectionManagerMock.verify((x) => x.clearSelection(moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny()), moq.Times.never());
    });

    it("handles adding to selection when viewport reports undefined ids added to selection", async () => {
      imodelMock.target.selectionSet.onChanged.raiseEvent(imodelMock.object, SelectEventType.Add, undefined);
      await selectionManagerCalled.promise;
      selectionManagerMock.verify((x) => x.addToSelection(moq.It.isAnyString(), imodelMock.object, [], 0, rulesetId), moq.Times.once());
    });

    it("clears unified selection when viewport selection is cleared", async () => {
      imodelMock.target.selectionSet.onChanged.raiseEvent(imodelMock.object, SelectEventType.Clear);
      await selectionManagerCalled.promise;
      selectionManagerMock.verify((x) => x.clearSelection(moq.It.isAnyString(), imodelMock.object, 0, rulesetId), moq.Times.once());
    });

    it("adds elements to unified selection when they're added to viewport's selection", async () => {
      const ids = [createRandomId(), createRandomId(), createRandomId()];
      const keys = createElementProps(ids);
      imodelMock.target.selectionSet.onChanged.raiseEvent(imodelMock.object, SelectEventType.Add, new Set(ids));
      await selectionManagerCalled.promise;
      selectionManagerMock.verify((x) => x.addToSelection(moq.It.isAnyString(), imodelMock.object, keys, 0, rulesetId), moq.Times.once());
    });

    it("replaces elements in unified selection when they're replaced in viewport's selection", async () => {
      const ids = [createRandomId(), createRandomId(), createRandomId()];
      const keys = createElementProps(ids);
      imodelMock.target.selectionSet.onChanged.raiseEvent(imodelMock.object, SelectEventType.Replace, new Set(ids));
      await selectionManagerCalled.promise;
      selectionManagerMock.verify((x) => x.replaceSelection(moq.It.isAnyString(), imodelMock.object, keys, 0, rulesetId), moq.Times.once());
    });

    it("removes elements from unified selection when they're removed from viewport's selection", async () => {
      const ids = [createRandomId(), createRandomId(), createRandomId()];
      const keys = createElementProps(ids);
      imodelMock.target.selectionSet.onChanged.raiseEvent(imodelMock.object, SelectEventType.Remove, new Set(ids));
      await selectionManagerCalled.promise;
      selectionManagerMock.verify((x) => x.removeFromSelection(moq.It.isAnyString(), imodelMock.object, keys, 0, rulesetId), moq.Times.once());
    });

    it("ignores unified selection changes while reacting to viewport selection changes", async () => {
      const selectionSetSpies = [
        spies.spy.on(imodelMock.target.selectionSet, SelectionSet.prototype.add.name),
        spies.spy.on(imodelMock.target.selectionSet, SelectionSet.prototype.addAndRemove.name),
        spies.spy.on(imodelMock.target.selectionSet, SelectionSet.prototype.emptyAll.name),
        spies.spy.on(imodelMock.target.selectionSet, SelectionSet.prototype.invert.name),
        spies.spy.on(imodelMock.target.selectionSet, SelectionSet.prototype.remove.name),
        spies.spy.on(imodelMock.target.selectionSet, SelectionSet.prototype.replace.name),
      ];
      const ids = [createRandomId()];
      imodelMock.target.selectionSet.onChanged.raiseEvent(imodelMock.object, SelectEventType.Add, new Set(ids));
      await selectionManagerCalled.promise;
      selectionSetSpies.forEach((spy) => expect(spy).to.not.be.called());
    });

  });

});
