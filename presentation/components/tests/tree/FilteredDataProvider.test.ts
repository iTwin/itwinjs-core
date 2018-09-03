/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as moq from "@bentley/presentation-common/tests/_helpers/Mocks";
import * as faker from "faker";
import { createRandomTreeNodeItem } from "../_helpers/UiComponents";
import { createRandomECInstanceNodeKey, createRandomNodePathElement } from "@bentley/presentation-common/tests/_helpers/random";
import { NodePathElement } from "@bentley/presentation-common";
import { PageOptions } from "@bentley/ui-components";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import FilteredPresentationTreeDataProvider from "../../lib/tree/FilteredDataProvider";
import IPresentationTreeDataProvider from "../../lib/tree/IPresentationTreeDataProvider";
import { createTreeNodeItem } from "../../lib/tree/Utils";

describe("FilteredTreeDataProvider", () => {

    /*
    A-1
      A-1-1
    A-2
      A-2-1
      A-2-2
        A-2-2-1
    */
    const nodePaths: NodePathElement[] = [];

    nodePaths[0] = createRandomNodePathElement();
    nodePaths[0].node.label = "A-1";

    nodePaths[1] = createRandomNodePathElement();
    nodePaths[1].node.label = "A-2";

    nodePaths[0].children = [];
    nodePaths[0].children[0] = createRandomNodePathElement();
    nodePaths[0].children[0].node.label = "A-1-1";

    nodePaths[1].children = [];
    nodePaths[1].children[0] = createRandomNodePathElement();
    nodePaths[1].children[0].node.label = "A-2-1";

    nodePaths[1].children[1] = createRandomNodePathElement();
    nodePaths[1].children[1].node.label = "A-2-2";

    nodePaths[1].children[1].children = [];
    nodePaths[1].children[1].children[0] = createRandomNodePathElement();
    nodePaths[1].children[1].children[0].node.label = "A-2-2-1";

    let provider: FilteredPresentationTreeDataProvider;
    let filter: string;
    const parentProviderMock = moq.Mock.ofType<IPresentationTreeDataProvider>();
    const imodelMock = moq.Mock.ofType<IModelConnection>();
    const pageOptions: PageOptions = { size: 0, start: 0 };

    beforeEach(() => {
        parentProviderMock.reset();
        filter = faker.random.word();
        provider = new FilteredPresentationTreeDataProvider(parentProviderMock.object, filter, nodePaths);
    });

    describe("filter", () => {

        it("returns filter with which it was initialized", () => {
            expect(provider.filter).to.be.equal(filter);
        });

    });

    describe("rulesetId", () => {

        it("returns rulesetId of the parent data provider", () => {
            const expectedRulesetId = faker.random.word();
            parentProviderMock.setup((x) => x.rulesetId)
                .returns(() => expectedRulesetId)
                .verifiable();
            expect(provider.rulesetId).to.eq(expectedRulesetId);
            parentProviderMock.verifyAll();
        });

    });

    describe("connection", () => {

        it("returns connection of the parent data provider", () => {
            parentProviderMock.setup((x) => x.connection)
                .returns(() => imodelMock.object)
                .verifiable();
            expect(provider.connection).to.eq(imodelMock.object);
            parentProviderMock.verifyAll();
        });

    });

    describe("getRootNodes", () => {

        it("return root nodes", async () => {
            const result = await provider.getRootNodes(pageOptions);
            expect(result).to.matchSnapshot();
        });

    });

    describe("getRootNodesCount", () => {

        it("returns root nodes count", async () => {
            const result = await provider.getRootNodesCount();
            expect(result).to.equal(nodePaths.length);
        });

    });

    describe("getChildNodes", () => {

        it("returns child nodes", async () => {
            const parentNode = createTreeNodeItem(nodePaths[1].node);

            const result = await provider.getChildNodes(parentNode, pageOptions);
            expect(result).to.matchSnapshot();
        });

    });

    describe("getChildNodesCount", () => {

        it("returns child node count", async () => {
            const parentNode = createTreeNodeItem(nodePaths[1].node);

            const result = await provider.getChildNodesCount(parentNode);
            expect(result).to.equal(nodePaths[1].children.length);
        });

    });

    describe("getFilteredNodePaths", () => {

        it("calls parent data provider", async () => {
            parentProviderMock.setup((x) => x.getFilteredNodePaths(filter))
                .returns(async () => nodePaths)
                .verifiable();

            const result = await provider.getFilteredNodePaths(filter);
            expect(result).to.equal(nodePaths);
            parentProviderMock.verifyAll();
        });

    });

    describe("getNodeKey", () => {

        it("returns node key", () => {
            const key = createRandomECInstanceNodeKey();
            const treeNode = createRandomTreeNodeItem(key);

            const result = provider.getNodeKey(treeNode);
            expect(result).to.deep.equal(key);
        });

    });

    describe("getAllNodeIds", () => {

        it("returns all ids for all nodes", () => {
            const allNodeIds = provider.getAllNodeIds();
            expect(allNodeIds).to.matchSnapshot();
        });

    });

});
