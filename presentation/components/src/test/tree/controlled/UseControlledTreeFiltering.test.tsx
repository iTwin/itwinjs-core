/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/* tslint:disable:no-direct-imports */

import { expect } from "chai";
import { renderHook } from "@testing-library/react-hooks";
import * as moq from "typemoq";
import { ITreeNodeLoaderWithProvider, TreeModelSource } from "@bentley/ui-components";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { NodePathElement } from "@bentley/presentation-common";
import { ResolvablePromise } from "@bentley/presentation-common/lib/test/_helpers/Promises";
import { FilteredPresentationTreeDataProvider } from "../../../tree/FilteredDataProvider";
import { useControlledTreeFiltering, IPresentationTreeDataProvider } from "../../../presentation-components";

describe("useControlledTreeFiltering", () => {
  interface HookProps {
    nodeLoader: ITreeNodeLoaderWithProvider<IPresentationTreeDataProvider>;
    modelSource: TreeModelSource;
    filter?: string;
    activeMatchIndex?: number;
  }
  const nodeLoaderMock = moq.Mock.ofType<ITreeNodeLoaderWithProvider<IPresentationTreeDataProvider>>();
  const modelSourceMock = moq.Mock.ofType<TreeModelSource>();
  const dataProviderMock = moq.Mock.ofType<IPresentationTreeDataProvider>();
  const imodelMock = moq.Mock.ofType<IModelConnection>();

  beforeEach(() => {
    nodeLoaderMock.reset();
    dataProviderMock.reset();
    imodelMock.reset();

    dataProviderMock.setup((x) => x.imodel).returns(() => imodelMock.object);
    dataProviderMock.setup((x) => x.rulesetId).returns(() => "rulesetId");
    nodeLoaderMock.setup((x) => x.getDataProvider()).returns(() => dataProviderMock.object);
  });

  it("does not start filtering if filter is not provided", () => {
    const hookProps = {
      nodeLoader: nodeLoaderMock.object,
      modelSource: modelSourceMock.object,
      filter: undefined,
      activeMatchIndex: undefined,
    };

    const { result } = renderHook(
      (props: HookProps) => useControlledTreeFiltering(props.nodeLoader, props.modelSource, props.filter, props.activeMatchIndex),
      { initialProps: hookProps },
    );
    expect(result.current).to.not.be.undefined;
    expect(result.current!.isFiltering).to.be.false;
  });

  it("starts filtering if filter is provided", async () => {
    const hookProps = {
      nodeLoader: nodeLoaderMock.object,
      modelSource: modelSourceMock.object,
      filter: "test",
      activeMatchIndex: 0,
    };
    const pathsResult1 = new ResolvablePromise<NodePathElement[]>();
    dataProviderMock.setup((x) => x.getFilteredNodePaths("test")).returns(async () => pathsResult1);

    const { result } = renderHook(
      (props: HookProps) => useControlledTreeFiltering(props.nodeLoader, props.modelSource, props.filter, props.activeMatchIndex),
      { initialProps: hookProps },
    );
    expect(result.current).to.not.be.undefined;
    expect(result.current!.isFiltering).to.be.true;

    await pathsResult1.resolve([]);

    expect(result.current).to.not.be.undefined;
    expect(result.current!.isFiltering).to.be.false;
    expect(result.current!.filteredNodeLoader).to.not.eq(nodeLoaderMock.object);
  });

  it("does not start new filtering request while previous is still in progress", async () => {
    const hookProps = {
      nodeLoader: nodeLoaderMock.object,
      modelSource: modelSourceMock.object,
      filter: "test",
      activeMatchIndex: undefined,
    };
    const pathsResult1 = new ResolvablePromise<NodePathElement[]>();
    const pathsResult2 = new ResolvablePromise<NodePathElement[]>();
    dataProviderMock.setup((x) => x.getFilteredNodePaths("first")).returns(async () => pathsResult1);
    dataProviderMock.setup((x) => x.getFilteredNodePaths("last")).returns(async () => pathsResult2);

    const { result, rerender } = renderHook(
      (props: HookProps) => useControlledTreeFiltering(props.nodeLoader, props.modelSource, props.filter, props.activeMatchIndex),
      { initialProps: hookProps },
    );
    dataProviderMock.verify((x) => x.getFilteredNodePaths(moq.It.isAnyString()), moq.Times.once());
    expect(result.current).to.not.be.undefined;
    expect(result.current!.isFiltering).to.be.true;

    // render with new filter and verify that new request was not started
    rerender({ ...hookProps, filter: "changed" });
    dataProviderMock.verify((x) => x.getFilteredNodePaths(moq.It.isAnyString()), moq.Times.once());
    expect(result.current).to.not.be.undefined;
    expect(result.current!.isFiltering).to.be.true;

    // render with new filter again and verify that new request was not started
    rerender({ ...hookProps, filter: "last" });
    dataProviderMock.verify((x) => x.getFilteredNodePaths(moq.It.isAnyString()), moq.Times.once());
    expect(result.current).to.not.be.undefined;
    expect(result.current!.isFiltering).to.be.true;

    // resolve first request and verify that new filtering request started
    await pathsResult1.resolve([]);
    dataProviderMock.verify((x) => x.getFilteredNodePaths(moq.It.isAnyString()), moq.Times.exactly(2));
    expect(result.current).to.not.be.undefined;
    expect(result.current!.isFiltering).to.be.true;

    // resolve second request and verify state
    await pathsResult2.resolve([]);
    dataProviderMock.verify((x) => x.getFilteredNodePaths(moq.It.isAnyString()), moq.Times.exactly(2));
    dataProviderMock.verify((x) => x.getFilteredNodePaths("test"), moq.Times.once());
    dataProviderMock.verify((x) => x.getFilteredNodePaths("last"), moq.Times.once());
    expect(result.current).to.not.be.undefined;
    expect(result.current!.isFiltering).to.be.false;
    expect(result.current!.filteredNodeLoader).to.not.be.undefined;
    const filteredProvider = result.current!.filteredNodeLoader!.getDataProvider();
    expect(filteredProvider).to.be.instanceOf(FilteredPresentationTreeDataProvider);
    expect((filteredProvider as FilteredPresentationTreeDataProvider).filter).to.be.eq("last");
  });

  it("clears filtering request still in progress", async () => {
    const hookProps = {
      nodeLoader: nodeLoaderMock.object,
      modelSource: modelSourceMock.object,
      filter: "test",
      activeMatchIndex: undefined,
    };
    const pathsResult = new ResolvablePromise<NodePathElement[]>();
    dataProviderMock.setup((x) => x.getFilteredNodePaths("first")).returns(async () => pathsResult);

    const { result, rerender } = renderHook(
      (props: HookProps) => useControlledTreeFiltering(props.nodeLoader, props.modelSource, props.filter, props.activeMatchIndex),
      { initialProps: hookProps },
    );

    dataProviderMock.verify((x) => x.getFilteredNodePaths(moq.It.isAnyString()), moq.Times.once());
    expect(result.current).to.not.be.undefined;
    expect(result.current!.isFiltering).to.be.true;

    // render without filter
    rerender({ ...hookProps, filter: "" });
    dataProviderMock.verify((x) => x.getFilteredNodePaths(moq.It.isAnyString()), moq.Times.once());
    expect(result.current).to.not.be.undefined;
    expect(result.current!.isFiltering).to.be.false;

    // resolve first request verify that filtering was not applied
    await pathsResult.resolve([]);
    dataProviderMock.verify((x) => x.getFilteredNodePaths(moq.It.isAnyString()), moq.Times.exactly(1));
    expect(result.current).to.not.be.undefined;
    expect(result.current!.isFiltering).to.be.false;
    expect(result.current!.filteredNodeLoader).to.be.deep.eq(nodeLoaderMock.object);
    expect(result.current!.matchesCount).to.be.undefined;
  });

  it("filters node loader with FilteredPresentationTreeDataProvider", async () => {
    const hookProps = {
      nodeLoader: nodeLoaderMock.object,
      modelSource: modelSourceMock.object,
      filter: "test",
      activeMatchIndex: undefined,
    };
    const pathsResult = new ResolvablePromise<NodePathElement[]>();
    dataProviderMock.setup((x) => x.getFilteredNodePaths(moq.It.isAny())).returns(async () => pathsResult);

    const { result, rerender } = renderHook(
      (props: HookProps) => useControlledTreeFiltering(props.nodeLoader, props.modelSource, props.filter, props.activeMatchIndex),
      { initialProps: hookProps },
    );

    await pathsResult.resolve([]);
    expect(result.current).to.not.be.undefined;
    expect(result.current!.isFiltering).to.be.false;

    const filteredNodeLoader = result.current!.filteredNodeLoader!;
    expect(filteredNodeLoader.getDataProvider()).to.be.instanceOf(FilteredPresentationTreeDataProvider);
    rerender({ ...hookProps, filter: "changed", nodeLoader: filteredNodeLoader });

    await pathsResult.resolve([]);
    expect(result.current).to.not.be.undefined;
    expect(result.current!.isFiltering).to.be.false;
    expect(result.current!.filteredNodeLoader).to.not.eq(filteredNodeLoader);

    // make sure that FilteredPresentationTreeDataProvider was not wrapped into another FilteredPresentationTreeDataProvider
    const provider = result.current.filteredNodeLoader!.getDataProvider();
    expect(provider).to.be.instanceOf(FilteredPresentationTreeDataProvider);
    expect((provider as FilteredPresentationTreeDataProvider).parentDataProvider).to.not.be.instanceOf(FilteredPresentationTreeDataProvider);
  });

});
