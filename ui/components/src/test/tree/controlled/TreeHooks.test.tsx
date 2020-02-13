/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import sinon from "sinon";
import * as moq from "typemoq";
import { renderHook } from "@testing-library/react-hooks";
import { BeUiEvent } from "@bentley/bentleyjs-core";
import { useVisibleTreeNodes, usePagedNodeLoader, useModelSource, useNodeLoader } from "../../../ui-components/tree/controlled/TreeHooks";
import { VisibleTreeNodes, TreeModel, MutableTreeModel } from "../../../ui-components/tree/controlled/TreeModel";
import { TreeModelSource, TreeModelChanges } from "../../../ui-components/tree/controlled/TreeModelSource";
import { TreeDataProviderRaw, TreeDataProvider } from "../../../ui-components/tree/TreeDataProvider";

describe("useVisibleTreeNodes", () => {
  const modelSourceMock = moq.Mock.ofType<TreeModelSource>();
  let onModelChangeEvent: BeUiEvent<[TreeModel, TreeModelChanges]>;
  const testVisibleNodes: VisibleTreeNodes = {
    getAtIndex: () => undefined,
    getModel: () => new MutableTreeModel(),
    getNumNodes: () => 0,
    getNumRootNodes: () => 0,
    [Symbol.iterator]: () => [][Symbol.iterator](),
  };

  beforeEach(() => {
    modelSourceMock.reset();
    onModelChangeEvent = new BeUiEvent<[TreeModel, TreeModelChanges]>();

    modelSourceMock.setup((x) => x.onModelChanged).returns(() => onModelChangeEvent);
    modelSourceMock.setup((x) => x.getVisibleNodes()).returns(() => testVisibleNodes);
  });

  it("subscribes to onModelChange event and returns visible nodes", () => {
    const spy = sinon.spy(onModelChangeEvent, "addListener");
    const { result } = renderHook(
      (props: { modelSource: TreeModelSource }) => useVisibleTreeNodes(props.modelSource),
      { initialProps: { modelSource: modelSourceMock.object } },
    );

    expect(result.current).to.not.be.undefined;
    expect(spy).to.have.been.calledOnce;
  });

  it("resubscribes to onModelChangeEvent when model source changes", () => {
    const firstModelEventAddSpy = sinon.spy(onModelChangeEvent, "addListener");
    const firstModelEventRemoveSpy = sinon.spy(onModelChangeEvent, "removeListener");
    const { rerender } = renderHook(
      (props: { modelSource: TreeModelSource }) => useVisibleTreeNodes(props.modelSource),
      { initialProps: { modelSource: modelSourceMock.object } },
    );
    expect(firstModelEventAddSpy).to.have.been.calledOnce;

    const newOnModelChangeEvent = new BeUiEvent<[TreeModel, TreeModelChanges]>();
    const newModelEventAddSpy = sinon.spy(newOnModelChangeEvent, "addListener");
    const newModelSourceMock = moq.Mock.ofType<TreeModelSource>();
    newModelSourceMock.setup((x) => x.onModelChanged).returns(() => newOnModelChangeEvent);

    rerender({ modelSource: newModelSourceMock.object });

    expect(firstModelEventRemoveSpy).to.have.been.calledOnce;
    expect(newModelEventAddSpy).to.have.been.calledOnce;
  });

});

describe("useNodeLoader", () => {
  const dataProviderMock: TreeDataProviderRaw = [];
  const modelSourceMock = moq.Mock.ofType<TreeModelSource>();

  it("creates NodeLoader", () => {
    const { result } = renderHook(
      (props: { dataProvider: TreeDataProvider, modelSource: TreeModelSource }) => useNodeLoader(props.dataProvider, props.modelSource),
      { initialProps: { dataProvider: dataProviderMock, modelSource: modelSourceMock.object } },
    );

    expect(result.current).to.not.be.undefined;
  });

  it("returns same NodeLoader if data provider does not changes", () => {
    const { result, rerender } = renderHook(
      (props: { dataProvider: TreeDataProvider, modelSource: TreeModelSource }) => useNodeLoader(props.dataProvider, props.modelSource),
      { initialProps: { dataProvider: dataProviderMock, modelSource: modelSourceMock.object } },
    );
    const nodeLoader = result.current;
    rerender();

    expect(result.current).to.be.eq(nodeLoader);
  });

  it("disposes NodeLoader on unmount", () => {
    const { result, unmount } = renderHook(
      (props: { dataProvider: TreeDataProvider, modelSource: TreeModelSource }) => useNodeLoader(props.dataProvider, props.modelSource),
      { initialProps: { dataProvider: dataProviderMock, modelSource: modelSourceMock.object } },
    );
    const spy = sinon.spy(result.current, "dispose");
    unmount();

    expect(spy).to.be.called;
  });

  it("creates new NodeLoader when data provider changes", () => {
    const { result, rerender } = renderHook(
      (props: { dataProvider: TreeDataProvider, modelSource: TreeModelSource }) => useNodeLoader(props.dataProvider, props.modelSource),
      { initialProps: { dataProvider: dataProviderMock, modelSource: modelSourceMock.object } },
    );

    const firstNodeLoader = result.current;
    const disposeSpy = sinon.spy(firstNodeLoader, "dispose");
    const newDataProviderMock: TreeDataProviderRaw = [];
    rerender({ dataProvider: newDataProviderMock, modelSource: modelSourceMock.object });

    expect(result.current).to.not.be.deep.eq(firstNodeLoader);
    expect(disposeSpy).to.be.called;
  });

});

describe("usePagedNodeLoader", () => {
  const dataProviderMock: TreeDataProviderRaw = [];
  const modelSourceMock = moq.Mock.ofType<TreeModelSource>();

  it("creates PagedNodeLoader", () => {
    const { result } = renderHook(
      (props: { dataProvider: TreeDataProvider, modelSource: TreeModelSource, pageSize: number }) => usePagedNodeLoader(props.dataProvider, props.pageSize, props.modelSource),
      { initialProps: { dataProvider: dataProviderMock, pageSize: 10, modelSource: modelSourceMock.object } },
    );

    expect(result.current).to.not.be.undefined;
  });

  it("returns same PagedNodeLoader if dependencies do not changes", () => {
    const { result, rerender } = renderHook(
      (props: { dataProvider: TreeDataProvider, modelSource: TreeModelSource, pageSize: number }) => usePagedNodeLoader(props.dataProvider, props.pageSize, props.modelSource),
      { initialProps: { dataProvider: dataProviderMock, pageSize: 10, modelSource: modelSourceMock.object } },
    );
    const nodeLoader = result.current;
    rerender();

    expect(result.current).to.be.eq(nodeLoader);
  });

  it("disposes PagedNodeLoader on unmount", () => {
    const { result, unmount } = renderHook(
      (props: { dataProvider: TreeDataProvider, modelSource: TreeModelSource, pageSize: number }) => usePagedNodeLoader(props.dataProvider, props.pageSize, props.modelSource),
      { initialProps: { dataProvider: dataProviderMock, pageSize: 10, modelSource: modelSourceMock.object } },
    );
    const spy = sinon.spy(result.current, "dispose");
    unmount();

    expect(spy).to.be.called;
  });

  it("creates new PagedNodeLoader when data provider changes", () => {
    const { result, rerender } = renderHook(
      (props: { dataProvider: TreeDataProvider, modelSource: TreeModelSource, pageSize: number }) => usePagedNodeLoader(props.dataProvider, props.pageSize, props.modelSource),
      { initialProps: { dataProvider: dataProviderMock, pageSize: 10, modelSource: modelSourceMock.object } },
    );

    const firstNodeLoader = result.current;
    const disposeSpy = sinon.spy(firstNodeLoader, "dispose");
    const newDataProviderMock: TreeDataProviderRaw = [];
    rerender({ dataProvider: newDataProviderMock, pageSize: 10, modelSource: modelSourceMock.object });

    expect(result.current).to.not.be.deep.eq(firstNodeLoader);
    expect(disposeSpy).to.be.called;
  });

  it("creates new PagedNodeLoader when page size changes", () => {
    const { result, rerender } = renderHook(
      (props: { dataProvider: TreeDataProvider, modelSource: TreeModelSource, pageSize: number }) => usePagedNodeLoader(props.dataProvider, props.pageSize, props.modelSource),
      { initialProps: { dataProvider: dataProviderMock, pageSize: 10, modelSource: modelSourceMock.object } },
    );

    const firstNodeLoader = result.current;
    rerender({ dataProvider: dataProviderMock, pageSize: 20, modelSource: modelSourceMock.object });

    expect(result.current).to.not.be.deep.eq(firstNodeLoader!);
  });

});

describe("useModelSource", () => {
  const dataProviderMock: TreeDataProviderRaw = [];

  it("creates model source", () => {
    const { result } = renderHook(
      (props: { dataProvider: TreeDataProvider }) => useModelSource(props.dataProvider),
      { initialProps: { dataProvider: dataProviderMock } },
    );

    expect(result.current).to.not.be.undefined;
  });

});
