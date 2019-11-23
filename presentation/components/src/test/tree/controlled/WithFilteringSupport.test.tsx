/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/* tslint:disable:no-direct-imports */

import * as React from "react";
import { mount } from "enzyme";
import { expect } from "chai";
import sinon from "sinon";
import * as moq from "typemoq";
import {
  ControlledTree, TreeModelSource, TreeEvents, SelectionMode, TreeModel, UiComponents,
  VisibleTreeNodes, MutableTreeModel, ITreeNodeLoaderWithProvider,
} from "@bentley/ui-components";
import { BeUiEvent } from "@bentley/bentleyjs-core";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { I18N } from "@bentley/imodeljs-i18n";
import { NodePathElement } from "@bentley/presentation-common";
import { ResolvablePromise } from "@bentley/presentation-common/lib/test/_helpers/Promises";
import { controlledTreeWithFilteringSupport } from "../../../tree/controlled/WithFilteringSupport";
import { controlledTreeWithModelSource } from "../../../tree/controlled/WithModelSource";
import { IPresentationTreeDataProvider } from "../../../tree/IPresentationTreeDataProvider";

// tslint:disable-next-line:variable-name naming-convention
const PresentationTree = controlledTreeWithFilteringSupport(controlledTreeWithModelSource(ControlledTree));

describe("ControlledTree withFilteringSupport", () => {
  before(async () => {
    await UiComponents.initialize(new I18N());
  });

  const modelSourceMock = moq.Mock.ofType<TreeModelSource>();
  const treeEventMock = moq.Mock.ofType<TreeEvents>();
  const dataProviderMock = moq.Mock.ofType<IPresentationTreeDataProvider>();
  const nodeLoaderMock = moq.Mock.ofType<ITreeNodeLoaderWithProvider<IPresentationTreeDataProvider>>();
  const imodelMock = moq.Mock.ofType<IModelConnection>();
  const visibleNodes: VisibleTreeNodes = {
    getAtIndex: () => undefined,
    getNumNodes: () => 0,
    getNumRootNodes: () => 0,
    getModel: () => new MutableTreeModel(),
    [Symbol.iterator]: () => [][Symbol.iterator](),
  };
  let filteredPathsPromise: ResolvablePromise<NodePathElement[]>;

  beforeEach(() => {
    modelSourceMock.reset();
    treeEventMock.reset();
    dataProviderMock.reset();
    nodeLoaderMock.reset();
    imodelMock.reset();

    filteredPathsPromise = new ResolvablePromise<NodePathElement[]>();
    modelSourceMock.setup((x) => x.onModelChanged).returns(() => new BeUiEvent<TreeModel>());
    modelSourceMock.setup((x) => x.getVisibleNodes()).returns(() => visibleNodes);
    nodeLoaderMock.setup((x) => x.getDataProvider()).returns(() => dataProviderMock.object);
    dataProviderMock.setup((x) => x.imodel).returns(() => imodelMock.object);
    dataProviderMock.setup((x) => x.rulesetId).returns(() => "TestRuleset");
    dataProviderMock.setup((x) => x.getFilteredNodePaths(moq.It.isAny())).returns(async () => filteredPathsPromise);
  });

  it("mounts without filter", () => {
    mount(<PresentationTree
      modelSource={modelSourceMock.object}
      nodeLoader={nodeLoaderMock.object}
      treeEvents={treeEventMock.object}
      selectionMode={SelectionMode.Single}
    />);
  });

  it("mounts with filter", async () => {
    mount(<PresentationTree
      modelSource={modelSourceMock.object}
      nodeLoader={nodeLoaderMock.object}
      treeEvents={treeEventMock.object}
      selectionMode={SelectionMode.Single}
      filter="test"
    />);

    await filteredPathsPromise.resolve([]);
  });

  it("calls onFilterApplied", async () => {
    const spy = sinon.spy();
    const node = mount(<PresentationTree
      modelSource={modelSourceMock.object}
      nodeLoader={nodeLoaderMock.object}
      treeEvents={treeEventMock.object}
      selectionMode={SelectionMode.Single}
      filter="test"
      onFilterApplied={spy}
    />);
    await filteredPathsPromise.resolve([]);
    expect(spy).to.be.calledOnceWith("test");
    spy.resetHistory();

    node.setProps({ filter: "changed" });
    await filteredPathsPromise.resolve([]);
    expect(spy).to.be.calledOnceWith("changed");
  });

  it("calls onMatchesCounted", async () => {
    const spy = sinon.spy();
    mount(<PresentationTree
      modelSource={modelSourceMock.object}
      nodeLoader={nodeLoaderMock.object}
      treeEvents={treeEventMock.object}
      selectionMode={SelectionMode.Single}
      filter="test"
      onMatchesCounted={spy}
    />);
    await filteredPathsPromise.resolve([]);
    expect(spy).to.be.calledOnceWith(0);
  });

  it("calls onNodeLoaderChanged", async () => {
    const spy = sinon.spy();
    mount(<PresentationTree
      modelSource={modelSourceMock.object}
      nodeLoader={nodeLoaderMock.object}
      treeEvents={treeEventMock.object}
      selectionMode={SelectionMode.Single}
      onNodeLoaderChanged={spy}
      filter={"test"}
    />);
    await filteredPathsPromise.resolve([]);
    expect(spy).to.be.calledTwice;
  });

});
