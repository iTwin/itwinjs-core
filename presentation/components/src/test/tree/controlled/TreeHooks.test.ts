/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as moq from "typemoq";
import * as sinon from "sinon";
import { renderHook } from "@testing-library/react-hooks";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { PresentationManager, Presentation } from "@bentley/presentation-frontend";
import { BeEvent, IDisposable } from "@bentley/bentleyjs-core";
import { TreeNodeItem, TreeDataChangesListener } from "@bentley/ui-components";
import { IPresentationTreeDataProvider } from "../../../presentation-components";
import { usePresentationTreeNodeLoader, PresentationTreeNodeLoaderProps } from "../../../presentation-components/tree/controlled/TreeHooks";

describe("usePresentationNodeLoader", () => {
  const imodelMock = moq.Mock.ofType<IModelConnection>();
  const presentationManagerMock = moq.Mock.ofType<PresentationManager>();
  const initialProps = {
    imodel: imodelMock.object,
    ruleset: "test",
    pageSize: 5,
  };

  beforeEach(() => {
    presentationManagerMock.reset();
    Presentation.setPresentationManager(presentationManagerMock.object);
  });

  afterEach(() => {
    Presentation.terminate();
  });

  it("creates node loader", () => {
    const { result } = renderHook(
      (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
      { initialProps },
    );

    expect(result.current).to.not.be.undefined;
  });

  it("creates new nodeLoader when imodel changes", () => {
    const { result, rerender } = renderHook(
      (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
      { initialProps },
    );
    const oldNodeLoader = result.current;

    const newImodelMock = moq.Mock.ofType<IModelConnection>();
    rerender({ ...initialProps, imodel: newImodelMock.object });

    expect(result.current).to.not.eq(oldNodeLoader);
  });

  it("creates new nodeLoader when rulesetId changes", () => {
    const { result, rerender } = renderHook(
      (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
      { initialProps },
    );
    const oldNodeLoader = result.current;

    rerender({ ...initialProps, ruleset: "changed" });

    expect(result.current).to.not.eq(oldNodeLoader);
  });

  it("creates new nodeLoader when pageSize changes", () => {
    const { result, rerender } = renderHook(
      (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
      { initialProps },
    );
    const oldNodeLoader = result.current;

    rerender({ ...initialProps, pageSize: 20 });

    expect(result.current).to.not.eq(oldNodeLoader);
  });

  it("starts preloading hierarchy", () => {
    presentationManagerMock.setup((x) => x.loadHierarchy(moq.It.isAny())).verifiable(moq.Times.once());
    renderHook(
      (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
      { initialProps: { ...initialProps, preloadingEnabled: true } },
    );
    presentationManagerMock.verifyAll();
  });

  it("uses supplied dataProvider", () => {
    // dispatch function from useState hook does not work with mocked object because it is function
    const dataProvider: IPresentationTreeDataProvider = {
      imodel: imodelMock.object,
      rulesetId: "",
      onTreeNodeChanged: new BeEvent<TreeDataChangesListener>(),
      dispose: () => { },
      getFilteredNodePaths: async () => [],
      getNodeKey: (node: TreeNodeItem) => (node as any).__key,
      getNodesCount: async () => 0,
      getNodes: async () => [],
      loadHierarchy: async () => { },
    };
    const { result } = renderHook(
      (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
      { initialProps: { ...initialProps, dataProvider } },
    );
    expect(result.current.dataProvider).to.be.eq(dataProvider);
  });

  it("uses supplied disposable dataProvider and disposes it on unmount", () => {
    // dispatch function from useState hook does not work with mocked object because it is function
    const dataProvider: IPresentationTreeDataProvider & IDisposable = {
      imodel: imodelMock.object,
      rulesetId: "",
      onTreeNodeChanged: new BeEvent<TreeDataChangesListener>(),
      getFilteredNodePaths: async () => [],
      getNodeKey: (node: TreeNodeItem) => (node as any).__key,
      getNodesCount: async () => 0,
      getNodes: async () => [],
      loadHierarchy: async () => { },
      dispose: sinon.spy(),
    };
    const { result, unmount } = renderHook(
      (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
      { initialProps: { ...initialProps, dataProvider } },
    );
    expect(result.current.dataProvider).to.be.eq(dataProvider);
    expect(dataProvider.dispose).to.not.be.called;
    unmount();
    expect(dataProvider.dispose).to.be.calledOnce;
  });

});
