/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { renderHook } from "@testing-library/react-hooks";
import * as moq from "typemoq";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { PresentationManager, Presentation } from "@bentley/presentation-frontend";
import { BeEvent } from "@bentley/bentleyjs-core";
import { TreeNodeItem, TreeDataChangesListener } from "@bentley/ui-components";
import { IPresentationTreeDataProvider } from "../../../presentation-components";
import { usePresentationNodeLoader, PresentationNodeLoaderProps } from "../../../tree/controlled/TreeHooks";

describe("usePresentationNodeLoader", () => {
  const imodelMock = moq.Mock.ofType<IModelConnection>();
  const presentationManagerMock = moq.Mock.ofType<PresentationManager>();
  const initialProps = {
    imodel: imodelMock.object,
    rulesetId: "test",
    pageSize: 5,
  };

  beforeEach(() => {
    presentationManagerMock.reset();
    Presentation.presentation = presentationManagerMock.object;
  });

  it("creates node loader", () => {
    const { result } = renderHook(
      (props: PresentationNodeLoaderProps) => usePresentationNodeLoader(props),
      { initialProps },
    );

    expect(result.current).to.not.be.undefined;
  });

  it("creates new nodeLoader when imodel changes", () => {
    const { result, rerender } = renderHook(
      (props: PresentationNodeLoaderProps) => usePresentationNodeLoader(props),
      { initialProps },
    );
    const oldNodeLoader = result.current;

    const newImodelMock = moq.Mock.ofType<IModelConnection>();
    rerender({ ...initialProps, imodel: newImodelMock.object });

    expect(result.current).to.not.eq(oldNodeLoader);
  });

  it("creates new nodeLoader when rulesetId changes", () => {
    const { result, rerender } = renderHook(
      (props: PresentationNodeLoaderProps) => usePresentationNodeLoader(props),
      { initialProps },
    );
    const oldNodeLoader = result.current;

    rerender({ ...initialProps, rulesetId: "changed" });

    expect(result.current).to.not.eq(oldNodeLoader);
  });

  it("creates new nodeLoader when pageSize changes", () => {
    const { result, rerender } = renderHook(
      (props: PresentationNodeLoaderProps) => usePresentationNodeLoader(props),
      { initialProps },
    );
    const oldNodeLoader = result.current;

    rerender({ ...initialProps, pageSize: 20 });

    expect(result.current).to.not.eq(oldNodeLoader);
  });

  it("starts preloading hierarchy", () => {
    presentationManagerMock.setup((x) => x.loadHierarchy(moq.It.isAny())).verifiable(moq.Times.once());
    renderHook(
      (props: PresentationNodeLoaderProps) => usePresentationNodeLoader(props),
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
      getFilteredNodePaths: async () => [],
      getNodeKey: (node: TreeNodeItem) => (node as any).__key,
      getNodesCount: async () => 0,
      getNodes: async () => [],
      loadHierarchy: async () => { },
    };
    const { result } = renderHook(
      (props: PresentationNodeLoaderProps) => usePresentationNodeLoader(props),
      { initialProps: { ...initialProps, dataProvider } },
    );
    expect(result.current.getDataProvider()).to.be.eq(dataProvider);
  });

});
