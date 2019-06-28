/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/* tslint:disable:no-direct-imports */

import * as React from "react";
import { expect } from "chai";
import * as sinon from "sinon";
import { shallow, ShallowWrapper } from "enzyme";
import * as faker from "faker";
import * as moq from "@bentley/presentation-common/lib/test/_helpers/Mocks";
import { waitForPendingAsyncs } from "@bentley/presentation-common/lib/test/_helpers/PendingAsyncsHelper";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { Tree, ActiveMatchInfo } from "@bentley/ui-components";
import { treeWithFilteringSupport, TreeWithFilteringSupportProps } from "../../tree/WithFilteringSupport";
import { FilteredPresentationTreeDataProvider } from "../../tree/FilteredDataProvider";
import { IPresentationTreeDataProvider } from "../../tree/IPresentationTreeDataProvider";
import { ResolvablePromise } from "@bentley/presentation-common/lib/test/_helpers/Promises";
import { NodePathElement } from "@bentley/presentation-common";

// tslint:disable-next-line:variable-name naming-convention
const FilteredTree = treeWithFilteringSupport(Tree);
interface State {
  filteredDataProvider?: FilteredPresentationTreeDataProvider;
  inProgress?: {
    rulesetId: string;
    imodel: IModelConnection;
    filter: string;
  };
}

describe("Tree withFilteringSupport", () => {

  let testRulesetId: string;
  let tree: ShallowWrapper<TreeWithFilteringSupportProps, State, any>;
  const imodelMock = moq.Mock.ofType<IModelConnection>();
  const dataProviderMock = moq.Mock.ofType<IPresentationTreeDataProvider>();

  beforeEach(() => {
    testRulesetId = faker.random.word();
    setupDataProvider(dataProviderMock, imodelMock.object, testRulesetId);
  });

  const setupDataProvider = (providerMock: moq.IMock<IPresentationTreeDataProvider>, imodel: IModelConnection, rulesetId: string) => {
    providerMock.reset();
    providerMock.setup((x) => x.imodel).returns(() => imodel!);
    providerMock.setup((x) => x.rulesetId).returns(() => rulesetId!);
    providerMock.setup((x) => x.getFilteredNodePaths(moq.It.isAnyString())).returns(async () => []);
  };

  describe("componentDidMount", () => {

    it("starts filtering when filter is not empty", async () => {
      const onFilterApplied = sinon.spy();
      tree = shallow(
        <FilteredTree
          dataProvider={dataProviderMock.object}
          filter="test"
          onFilterApplied={onFilterApplied}
        />);
      expect(tree.state().inProgress).to.deep.eq({ imodel: imodelMock.object, rulesetId: testRulesetId, filter: "test" });
      await waitForPendingAsyncs(tree.instance());
      expect(tree.state().inProgress).to.be.undefined;
      expect(tree.state().filteredDataProvider).to.not.be.undefined;
      expect(tree.state().filteredDataProvider instanceof FilteredPresentationTreeDataProvider).to.be.true;
      expect(onFilterApplied).to.be.calledOnceWith("test");
    });

    it("does not start filtering if filter is empty", async () => {
      const onFilterApplied = sinon.spy();
      tree = shallow(
        <FilteredTree
          dataProvider={dataProviderMock.object}
          filter=""
          onFilterApplied={onFilterApplied}
        />);
      expect(tree.state().inProgress).to.be.undefined;
      await waitForPendingAsyncs(tree.instance());
      expect(tree.state().inProgress).to.be.undefined;
      expect(tree.state().filteredDataProvider).to.be.undefined;
      expect(onFilterApplied).to.not.be.called;
    });

  });

  describe("componentDidUpdate", () => {

    it("starts filtering when filter set on clear state", async () => {
      const onFilterApplied = sinon.spy();
      tree = shallow(
        <FilteredTree
          dataProvider={dataProviderMock.object}
          onFilterApplied={onFilterApplied}
        />);
      await waitForPendingAsyncs(tree.instance());
      expect(tree.state().inProgress).to.be.undefined;
      expect(tree.state().filteredDataProvider).to.be.undefined;

      tree.setProps({ filter: "changed" });
      expect(tree.state().inProgress).to.not.be.undefined;
      await waitForPendingAsyncs(tree.instance());
      expect(tree.state().inProgress).to.be.undefined;
      expect(tree.state().filteredDataProvider).to.not.be.undefined;
      expect(onFilterApplied).to.be.calledOnceWith("changed", tree.state().filteredDataProvider);
    });

    it("starts filtering when filter set while another filter is applied", async () => {
      const onFilterApplied = sinon.spy();
      tree = shallow(
        <FilteredTree
          dataProvider={dataProviderMock.object}
          onFilterApplied={onFilterApplied}
          filter="test"
        />);
      await waitForPendingAsyncs(tree.instance());
      expect(tree.state().inProgress).to.be.undefined;
      expect(tree.state().filteredDataProvider).to.not.be.undefined;

      onFilterApplied.resetHistory();

      tree.setProps({ filter: "changed" });
      expect(tree.state().inProgress).to.not.be.undefined;
      await waitForPendingAsyncs(tree.instance());
      expect(tree.state().inProgress).to.be.undefined;
      expect(tree.state().filteredDataProvider).to.not.be.undefined;
      expect(onFilterApplied).to.be.calledOnceWith("changed", tree.state().filteredDataProvider);
    });

    it("clears filtering when filter set while another filter is applied", async () => {
      const onFilterApplied = sinon.spy();
      tree = shallow(
        <FilteredTree
          dataProvider={dataProviderMock.object}
          onFilterApplied={onFilterApplied}
          filter="test"
        />);
      await waitForPendingAsyncs(tree.instance());
      expect(tree.state().inProgress).to.be.undefined;
      expect(tree.state().filteredDataProvider).to.not.be.undefined;

      onFilterApplied.resetHistory();

      tree.setProps({ filter: undefined });
      expect(tree.state().inProgress).to.be.undefined;
      await waitForPendingAsyncs(tree.instance());
      expect(tree.state().inProgress).to.be.undefined;
      expect(tree.state().filteredDataProvider).to.be.undefined;
      expect(onFilterApplied).to.not.be.called;
    });

    it("starts filtering when filter set while another filter is in progress", async () => {
      const onFilterApplied = sinon.spy();
      tree = shallow(
        <FilteredTree
          dataProvider={dataProviderMock.object}
          onFilterApplied={onFilterApplied}
          filter="test"
        />);
      expect(tree.state().inProgress).to.not.be.undefined;
      expect(tree.state().inProgress!.filter).to.eq("test");
      expect(tree.state().filteredDataProvider).to.be.undefined;

      tree.setProps({ filter: "changed" });
      expect(tree.state().inProgress).to.not.be.undefined;
      expect(tree.state().inProgress!.filter).to.eq("changed");
      expect(tree.state().filteredDataProvider).to.be.undefined;

      await waitForPendingAsyncs(tree.instance());
      expect(tree.state().inProgress).to.be.undefined;
      expect(tree.state().filteredDataProvider).to.not.be.undefined;
      expect(onFilterApplied).to.be.calledOnceWith("changed", tree.state().filteredDataProvider);
    });

    it("starts filtering when filter set while another filter is in progress", async () => {
      const onFilterApplied = sinon.spy();
      tree = shallow(
        <FilteredTree
          dataProvider={dataProviderMock.object}
          onFilterApplied={onFilterApplied}
          filter="test"
        />);
      expect(tree.state().inProgress).to.not.be.undefined;
      expect(tree.state().inProgress!.filter).to.eq("test");
      expect(tree.state().filteredDataProvider).to.be.undefined;

      tree.setProps({ filter: "" });
      expect(tree.state().inProgress).to.be.undefined;
      expect(tree.state().filteredDataProvider).to.be.undefined;

      await waitForPendingAsyncs(tree.instance());
      expect(tree.state().inProgress).to.be.undefined;
      expect(tree.state().filteredDataProvider).to.be.undefined;
      expect(onFilterApplied).to.not.be.called;
    });

  });

  describe("loadDataProvider", () => {

    it("does not start a new request while previous one is still pending", async () => {
      const pathsResult1 = new ResolvablePromise<NodePathElement[]>();
      const pathsResult2 = new ResolvablePromise<NodePathElement[]>();
      const slowDataProvider = moq.Mock.ofType<IPresentationTreeDataProvider>();
      slowDataProvider.setup((x) => x.imodel).returns(() => imodelMock.object);
      slowDataProvider.setup((x) => x.rulesetId).returns(() => testRulesetId);
      slowDataProvider.setup((x) => x.getFilteredNodePaths(moq.It.isAnyString())).returns(async () => pathsResult1);
      slowDataProvider.setup((x) => x.getFilteredNodePaths(moq.It.isAnyString())).returns(async () => pathsResult2);

      const onFilterApplied = sinon.spy();
      const onMatchesCounted = sinon.spy();

      tree = shallow(
        <FilteredTree
          dataProvider={slowDataProvider.object}
          filter="test"
          onFilterApplied={onFilterApplied}
          onMatchesCounted={onMatchesCounted}
        />);
      // expect the request to be started
      slowDataProvider.verify((x) => x.getFilteredNodePaths(moq.It.isAnyString()), moq.Times.once());
      expect(tree.state().inProgress!.filter).to.eq("test");
      expect(tree.state().filteredDataProvider).to.be.undefined;
      expect(onFilterApplied).to.not.be.called;
      expect(onMatchesCounted).to.not.be.called;

      // change the filter and expect another request to _not_ be started
      tree.setProps({ filter: "changed 1" });
      slowDataProvider.verify((x) => x.getFilteredNodePaths(moq.It.isAnyString()), moq.Times.once());
      expect(tree.state().inProgress!.filter).to.eq("changed 1");
      expect(tree.state().filteredDataProvider).to.be.undefined;
      expect(onFilterApplied).to.not.be.called;
      expect(onMatchesCounted).to.not.be.called;

      // change the filter again and expect another request to _not_ be started
      tree.setProps({ filter: "changed 2" });
      slowDataProvider.verify((x) => x.getFilteredNodePaths(moq.It.isAnyString()), moq.Times.once());
      expect(tree.state().inProgress!.filter).to.eq("changed 2");
      expect(tree.state().filteredDataProvider).to.be.undefined;
      expect(onFilterApplied).to.not.be.called;
      expect(onMatchesCounted).to.not.be.called;

      // resolve the request and verify a new request for the latest filter (skipping the intermediate one) has been started
      await pathsResult1.resolve([]);
      slowDataProvider.verify((x) => x.getFilteredNodePaths(moq.It.isAnyString()), moq.Times.exactly(2));
      slowDataProvider.verify((x) => x.getFilteredNodePaths("changed 2"), moq.Times.once());
      expect(tree.state().inProgress!.filter).to.eq("changed 2");
      expect(tree.state().filteredDataProvider).to.be.undefined;
      expect(onFilterApplied).to.not.be.called;
      expect(onMatchesCounted).to.not.be.called;

      // resolve the last request and verify state
      await pathsResult2.resolve([]);
      await waitForPendingAsyncs(tree.instance());
      slowDataProvider.verify((x) => x.getFilteredNodePaths(moq.It.isAnyString()), moq.Times.exactly(2));
      expect(tree.state().inProgress).to.be.undefined;
      expect(tree.state().filteredDataProvider).to.not.be.undefined;
      expect(onFilterApplied).to.be.calledOnceWith("changed 2", tree.state().filteredDataProvider);
      expect(onMatchesCounted).to.be.calledOnceWith(0);
    });

    it("clears filter while previous filtering request is still pending", async () => {
      const pathsResult = new ResolvablePromise<NodePathElement[]>();
      const slowDataProvider = moq.Mock.ofType<IPresentationTreeDataProvider>();
      slowDataProvider.setup((x) => x.imodel).returns(() => imodelMock.object);
      slowDataProvider.setup((x) => x.rulesetId).returns(() => testRulesetId);
      slowDataProvider.setup((x) => x.getFilteredNodePaths(moq.It.isAnyString())).returns(async () => pathsResult);

      const onFilterApplied = sinon.spy();
      const onMatchesCounted = sinon.spy();

      tree = shallow(
        <FilteredTree
          dataProvider={slowDataProvider.object}
          filter="test"
          onFilterApplied={onFilterApplied}
          onMatchesCounted={onMatchesCounted}
        />);
      // expect the request to be started
      slowDataProvider.verify((x) => x.getFilteredNodePaths(moq.It.isAnyString()), moq.Times.once());
      expect(tree.state().inProgress!.filter).to.eq("test");
      expect(tree.state().filteredDataProvider).to.be.undefined;
      expect(onFilterApplied).to.not.be.called;
      expect(onMatchesCounted).to.not.be.called;

      // clear the filter and expect the state to be cleared immediately
      tree.setProps({ filter: undefined });
      slowDataProvider.verify((x) => x.getFilteredNodePaths(moq.It.isAnyString()), moq.Times.once());
      expect(tree.state().inProgress).to.be.undefined;
      expect(tree.state().filteredDataProvider).to.be.undefined;
      expect(onFilterApplied).to.not.be.called;
      expect(onMatchesCounted).to.not.be.called;

      // resolve the request and verify the filter didn't get applied
      await pathsResult.resolve([]);
      slowDataProvider.verify((x) => x.getFilteredNodePaths(moq.It.isAnyString()), moq.Times.once());
      expect(tree.state().inProgress).to.be.undefined;
      expect(tree.state().filteredDataProvider).to.be.undefined;
      expect(onFilterApplied).to.not.be.called;
      expect(onMatchesCounted).to.not.be.called;
    });

  });

  describe("render", () => {

    beforeEach(async () => {
      tree = shallow(
        <FilteredTree
          dataProvider={dataProviderMock.object}
        />,
        { disableLifecycleMethods: true },
      );
      await waitForPendingAsyncs(tree.instance());
    });

    it("renders with overlay if `state.inProgress` is set", () => {
      tree.setState({ inProgress: { imodel: imodelMock.object, rulesetId: testRulesetId, filter: "test" } });
      expect(tree.instance().render()).to.matchSnapshot();
    });

    it("renders without overlay if `state.inProgress = undefined`", async () => {
      tree.setState({ inProgress: undefined });
      expect(tree.instance().render()).to.matchSnapshot();
    });

    it("renders with highlightingProps only if filter is set", async () => {
      const filteredDataProviderMock = moq.Mock.ofType<FilteredPresentationTreeDataProvider>();
      filteredDataProviderMock.setup((x) => x.getActiveMatch(moq.It.isAny())).returns(() => ({ nodeId: "test", matchIndex: 0 }));

      tree.setProps({ activeMatchIndex: 6, filter: undefined });
      tree.setState({ filteredDataProvider: filteredDataProviderMock.object });
      expect(tree.shallow().find(Tree).props().nodeHighlightingProps).to.be.undefined;

      tree.setProps({ activeMatchIndex: 6, filter: "" });
      expect(tree.shallow().find(Tree).props().nodeHighlightingProps).to.be.undefined;
    });

    it("renders with full highlightingProps", async () => {
      const filteredDataProviderMock = moq.Mock.ofType<FilteredPresentationTreeDataProvider>();
      const activeMatch: ActiveMatchInfo = { nodeId: "test", matchIndex: 0 };
      filteredDataProviderMock.setup((x) => x.getActiveMatch(moq.It.isAny())).returns(() => activeMatch);

      tree.setProps({ filter: "filter", activeMatchIndex: 6 });
      tree.setState({ filteredDataProvider: filteredDataProviderMock.object });

      expect(tree.shallow().find(Tree).props().nodeHighlightingProps).to.deep.eq({
        searchText: "filter",
        activeMatch,
      });
    });

  });

});
