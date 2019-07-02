/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Observable } from "rxjs/internal/Observable";
import { Subscription } from "rxjs/internal/Subscription";
import { throwError } from "rxjs/internal/observable/throwError";
import { from } from "rxjs/internal/observable/from";
import { of } from "rxjs/internal/observable/of";
import { initializeTree, TestTreeDataProvider } from "./TestDataFactories";
import { ResolvablePromise } from "../test-helpers/misc";
import { makeObservableCallback, onCancelation, NodeSet, PendingNodeTracker, NodeLoadingOrchestrator, NodeKey } from "../../ui-components/tree/NodeLoadingOrchestrator";
import { BeInspireTreeNode, BeInspireTree, toNodes, toNode } from "../../ui-components/tree/component/BeInspireTree";
import { TreeNodeItem } from "../../ui-components";
import { Tree } from "../../ui-components/tree/component/Tree";
import sinon from "sinon";

describe("NodeLoadingOrchestrator", () => {
  const onLoadProgress = sinon.stub();
  const onLoadCanceled = sinon.stub();
  const onLoadFinished = sinon.stub();

  beforeEach(() => {
    onLoadProgress.reset();
    onLoadCanceled.reset();
    onLoadFinished.reset();
  });

  function initializeOrchestrator(model: BeInspireTree<TreeNodeItem>): NodeLoadingOrchestrator {
    return new NodeLoadingOrchestrator(model, { onLoadProgress, onLoadCanceled, onLoadFinished });
  }

  /** Expects observable to emit nodes in a specific order. The order is defined by the sequence of groups of emitted node ids, e.g. `[[0], [1, 2]]`. */
  async function expectSequence(observable: Observable<Array<BeInspireTreeNode<TreeNodeItem>>>, expectedSequence: number[][]): Promise<void> {
    const actualSequence: string[][] = [];
    const subscription = observable.subscribe({
      next: (loadedNodes) => {
        loadedNodes.forEach((node) => expect(node.payload).to.not.be.undefined);
        actualSequence.push(loadedNodes.map((node) => node.id!));
      },
      complete: () => {
        expect(actualSequence).to.eql(expectedSequence.map((ids) => ids.map((id) => id.toString())));
      },
    });
    return waitForUnsubscription(subscription);
  }

  /** Returns a promise which is resolved when the input subscription is disposed. */
  async function waitForUnsubscription(subscription: Subscription): Promise<void> {
    const promise = new ResolvablePromise<void>();
    subscription.add(() => promise.resolve());
    return promise;
  }

  describe("prepareNodes", () => {
    describe("returned observable", () => {
      it("does not restart on new subscriptions", async () => {
        const tree = await initializeTree([{ id: 0 }, { id: 1 }]);
        const orchestrator = initializeOrchestrator(tree);
        const observable = orchestrator.prepareNodes([tree.nodes()[0], tree.nodes()[1]]);

        // Subscribe for the initial synchronous emission
        observable
          .subscribe((loadedNodes) => {
            expect(loadedNodes.length).to.eq(1);
            expect(loadedNodes[0].id).to.eq("0");
          })
          .unsubscribe();

        // Subscribe until observable completes
        await expectSequence(observable, [[1]]);

        // Late subscription after observable has completed
        const lateSubscriber = {
          next: sinon.fake(),
          error: sinon.fake(),
          complete: sinon.fake(),
        };
        observable.subscribe(lateSubscriber);
        expect(lateSubscriber.next).to.not.have.been.called;
        expect(lateSubscriber.error).to.not.have.been.called;
        expect(lateSubscriber.complete).to.have.been.calledOnce;
      });

      describe("when no nodes need to be loaded", () => {
        let tree: BeInspireTree<TreeNodeItem>;
        let orchestrator: NodeLoadingOrchestrator;
        let preparedNodes: Observable<Array<BeInspireTreeNode<TreeNodeItem>>>;

        beforeEach(async () => {
          tree = await initializeTree([{ id: 0 }, { id: 1 }, { id: 2 }]);
          await tree.requestNodeLoad(undefined, 1);
          orchestrator = initializeOrchestrator(tree);
          preparedNodes = orchestrator.prepareNodes(tree.nodes().slice(0, 2));
        });

        it("emits already loaded nodes", async () => {
          await expectSequence(preparedNodes, [[0, 1]]);
        });

        it("does not call load progression callbacks", (done) => {
          preparedNodes.subscribe().add(() => {
            // Check expections when subscription is disposed
            expect(onLoadProgress).to.not.have.been.called;
            expect(onLoadCanceled).to.not.have.been.called;
            expect(onLoadFinished).to.not.have.been.called;
            done();
          });
        });
      });

      describe("when some nodes need to be loaded", () => {
        let tree: BeInspireTree<TreeNodeItem>;
        let orchestrator: NodeLoadingOrchestrator;
        let preparedNodes: Observable<Array<BeInspireTreeNode<TreeNodeItem>>>;

        beforeEach(async () => {
          tree = await initializeTree([{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]);
          await tree.requestNodeLoad(undefined, 1);
          // Nodes 0 and 1 are now loaded

          orchestrator = initializeOrchestrator(tree);
          preparedNodes = orchestrator.prepareNodes(tree.nodes().slice(0, 4));
        });

        it("emits already loaded nodes, then loads and emits the rest", async () => {
          await expectSequence(preparedNodes, [[0, 1], [2], [3]]);
        });

        it("reports load progress", async () => {
          const subscriber = sinon.stub();
          await waitForUnsubscription(preparedNodes.subscribe(subscriber));
          expect(onLoadProgress).to.have.been.calledBefore(subscriber);
          const progressCalls = onLoadProgress.getCalls();
          expect(progressCalls.length).to.eq(4);
          expect(progressCalls[0]).to.have.been.calledWithExactly(0, 2, sinon.match.func);
          expect(progressCalls[1]).to.have.been.calledWithExactly(0, 2, sinon.match.func);
          expect(progressCalls[2]).to.have.been.calledWithExactly(1, 2, sinon.match.func);
          expect(progressCalls[3]).to.have.been.calledWithExactly(2, 2, sinon.match.func);
          expect(onLoadCanceled).to.not.have.been.called;
          expect(onLoadFinished).to.have.been.calledOnce;
        });

        it("does not start loading nodes if canceled at first progress report", async () => {
          onLoadProgress.onFirstCall().callsArg(2);
          await waitForUnsubscription(preparedNodes.subscribe());
          expect(onLoadProgress).to.have.been.calledOnce;
          expect(onLoadCanceled).to.have.been.calledOnce;
          expect(onLoadFinished).to.not.have.been.called;
          expect(tree.nodes()[2].payload).to.be.undefined;
        });

        it("cancels loading if canceled at second progress report", async () => {
          onLoadProgress.onSecondCall().callsArg(2);
          await waitForUnsubscription(preparedNodes.subscribe());
          expect(onLoadProgress).to.have.been.calledTwice;
          expect(onLoadCanceled).to.have.been.calledOnce;
          expect(onLoadFinished).to.not.have.been.called;
          expect(tree.nodes()[2].payload).to.be.undefined;
        });
      });

      describe("when all requested nodes need loading", () => {
        it("emits empty list followed by loaded nodes", async () => {
          const tree = await initializeTree([{ id: 0 }, { id: 1 }]);
          const orchestrator = initializeOrchestrator(tree);
          const preparedNodes = orchestrator.prepareNodes([tree.nodes()[1]]);
          await expectSequence(preparedNodes, [[], [1]]);
        });
      });

      describe("when multiple observables are active simultaneously", () => {
        it("reports cancelation once", async () => {
          const tree = await initializeTree([{ id: 0 }, { id: 1 }, { id: 2 }]);
          const orchestrator = initializeOrchestrator(tree);
          const preparedNodes1 = orchestrator.prepareNodes(tree.nodes());
          const preparedNodes2 = orchestrator.prepareNodes(tree.nodes());

          onLoadProgress.onSecondCall().callsFake(() => {
            onLoadProgress.onThirdCall().callsArg(2);
            preparedNodes2.subscribe();
          });

          await waitForUnsubscription(preparedNodes1.subscribe());
          expect(onLoadProgress).to.have.been.calledThrice;
          expect(onLoadCanceled).to.have.been.calledOnce;
          expect(onLoadFinished).to.not.have.been.called;
          expect(tree.nodes()[2].payload).to.be.undefined;
        });

        it("does not mixup loaded nodes between the observables", async () => {
          const tree = await initializeTree([{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }]);
          const orchestrator = initializeOrchestrator(tree);
          const preparedNodes1 = orchestrator.prepareNodes(tree.nodes().slice(0, 3));
          const preparedNodes2 = orchestrator.prepareNodes(tree.nodes().slice(1, 4));

          const promises: Array<Promise<void>> = [];
          promises.push(expectSequence(preparedNodes1, [[0], [1], [2]]));
          promises.push(expectSequence(preparedNodes2, [[], [1], [2], [3]]));
          await Promise.all(promises);
        });
      });

      it("emits whole pages when page size is greater than one", async () => {
        const tree = await initializeTree([{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }], 2);
        const orchestrator = initializeOrchestrator(tree);
        const preparedNodes = orchestrator.prepareNodes(tree.nodes());
        await expectSequence(preparedNodes, [[0, 1], [2, 3]]);
      });

      it("emits empty array and completes when empty array is passed", async () => {
        const tree = await initializeTree([{ id: 0 }, { id: 1 }]);
        const orchestrator = initializeOrchestrator(tree);
        const preparedNodes = orchestrator.prepareNodes([]);
        await expectSequence(preparedNodes, [[]]);
      });
    });
  });

  describe("prepareNodesBetween", () => {
    describe("returned observable", () => {
      it("does not emit the bottom node's children", async () => {
        const tree = await initializeTree([{ id: 0 }, { id: 1 }, { id: 2, children: [{ id: 3 }] }]);
        await tree.requestNodeLoad(undefined, 2);
        const orchestrator = initializeOrchestrator(tree);
        const preparedNodes = orchestrator.prepareNodesBetween(tree.nodes()[0], tree.nodes()[2]);
        await expectSequence(preparedNodes, [[0, 2], [1]]);
      });

      it("does not restart on new subscriptions", async () => {
        const tree = await initializeTree([{ id: 0 }, { id: 1 }, { id: 2 }]);
        await tree.requestNodeLoad(undefined, 2);
        const orchestrator = initializeOrchestrator(tree);
        const observable = orchestrator.prepareNodesBetween(tree.nodes()[0], tree.nodes()[2]);

        // Subscribe for the initial synchronous emission
        observable
          .subscribe((loadedNodes) => {
            expect(loadedNodes.length).to.eq(2);
            expect(loadedNodes[0].id).to.eq("0");
            expect(loadedNodes[1].id).to.eq("2");
          })
          .unsubscribe();

        // Subscribe until observable completes
        await expectSequence(observable, [[1]]);

        // Late subscription after observable has completed
        const lateSubscriber = {
          next: sinon.fake(),
          error: sinon.fake(),
          complete: sinon.fake(),
        };
        observable.subscribe(lateSubscriber);
        expect(lateSubscriber.next).to.not.have.been.called;
        expect(lateSubscriber.error).to.not.have.been.called;
        expect(lateSubscriber.complete).to.have.been.calledOnce;
      });

      describe("when no nodes need to be loaded", () => {
        let tree: BeInspireTree<TreeNodeItem>;
        let orchestrator: NodeLoadingOrchestrator;
        let preparedNodes: Observable<Array<BeInspireTreeNode<TreeNodeItem>>>;

        beforeEach(async () => {
          tree = await initializeTree([{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }]);
          await tree.requestNodeLoad(undefined, 1);
          await tree.requestNodeLoad(undefined, 2);
          orchestrator = initializeOrchestrator(tree);
          preparedNodes = orchestrator.prepareNodesBetween(tree.nodes()[0], tree.nodes()[2]);
        });

        it("emits already loaded nodes", async () => {
          await expectSequence(preparedNodes, [[0, 1, 2]]);
        });

        it("does not call load progression callbacks", (done) => {
          preparedNodes.subscribe().add(() => {
            expect(onLoadProgress).to.not.have.been.called;
            expect(onLoadCanceled).to.not.have.been.called;
            expect(onLoadFinished).to.not.have.been.called;
            done();
          });
        });
      });

      describe("when some root nodes need to be loaded", () => {
        let tree: BeInspireTree<TreeNodeItem>;
        let orchestrator: NodeLoadingOrchestrator;
        let preparedNodes: Observable<Array<BeInspireTreeNode<TreeNodeItem>>>;

        beforeEach(async () => {
          tree = await initializeTree([{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]);
          await tree.requestNodeLoad(undefined, 3);
          orchestrator = initializeOrchestrator(tree);
          preparedNodes = orchestrator.prepareNodesBetween(tree.nodes()[0], tree.nodes()[3]);
        });

        it("emits already loaded nodes, then loads and emits the rest", async () => {
          await expectSequence(preparedNodes, [[0, 3], [1], [2]]);
        });

        it("reports load progress", async () => {
          const subscriber = sinon.stub();
          await waitForUnsubscription(preparedNodes.subscribe(subscriber));
          expect(onLoadProgress).to.have.been.calledBefore(subscriber);
          const progressCalls = onLoadProgress.getCalls();
          expect(progressCalls.length).to.eq(4);
          expect(progressCalls[0]).to.have.been.calledWithExactly(0, 2, sinon.match.func);
          expect(progressCalls[1]).to.have.been.calledWithExactly(0, 2, sinon.match.func);
          expect(progressCalls[2]).to.have.been.calledWithExactly(1, 2, sinon.match.func);
          expect(progressCalls[3]).to.have.been.calledWithExactly(2, 2, sinon.match.func);
          expect(onLoadCanceled).to.not.have.been.called;
          expect(onLoadFinished).to.have.been.calledOnce;
        });

        it("does not start loading nodes if canceled at first progress report", async () => {
          onLoadProgress.onFirstCall().callsArg(2);
          await waitForUnsubscription(preparedNodes.subscribe());
          expect(onLoadProgress).to.have.been.calledOnce;
          expect(onLoadCanceled).to.have.been.calledOnce;
          expect(onLoadFinished).to.not.have.been.called;
          expect(tree.nodes()[1].payload).to.be.undefined;
        });

        it("cancels loading if canceled at second progress report", async () => {
          onLoadProgress.onSecondCall().callsArg(2);
          await waitForUnsubscription(preparedNodes.subscribe());
          expect(onLoadProgress).to.have.been.calledTwice;
          expect(onLoadCanceled).to.have.been.calledOnce;
          expect(onLoadFinished).to.not.have.been.called;
          expect(tree.nodes()[1].payload).to.be.undefined;
        });
      });

      describe("when nodes are passed in reverse order", () => {
        it("does not emit the bottom node's children", async () => {
          const tree = await initializeTree([{ id: 0 }, { id: 1, children: [{ id: 2 }] }]);
          await tree.requestNodeLoad(undefined, 1);
          const orchestrator = initializeOrchestrator(tree);
          const preparedNodes = orchestrator.prepareNodesBetween(tree.nodes()[1], tree.nodes()[0]);
          await expectSequence(preparedNodes, [[0, 1]]);
        });
      });

      describe("when multiple observables are active simultaneously", () => {
        let tree: BeInspireTree<TreeNodeItem>;
        let orchestrator: NodeLoadingOrchestrator;
        let preparedNodes1: Observable<Array<BeInspireTreeNode<TreeNodeItem>>>;
        let preparedNodes2: Observable<Array<BeInspireTreeNode<TreeNodeItem>>>;

        beforeEach(async () => {
          tree = await initializeTree([{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }]);
          await tree.requestNodeLoad(undefined, 1);
          await tree.requestNodeLoad(undefined, 3);
          await tree.requestNodeLoad(undefined, 5);
          orchestrator = initializeOrchestrator(tree);
          preparedNodes1 = orchestrator.prepareNodesBetween(tree.nodes()[0], tree.nodes()[3]);
          preparedNodes2 = orchestrator.prepareNodesBetween(tree.nodes()[1], tree.nodes()[5]);
        });

        it("reports cancelation once", async () => {
          onLoadProgress.onSecondCall().callsFake(() => {
            onLoadProgress.onThirdCall().callsArg(2);
            preparedNodes2.subscribe();
          });
          await waitForUnsubscription(preparedNodes1.subscribe());
          expect(onLoadProgress).to.have.been.calledThrice;
          expect(onLoadCanceled).to.have.been.calledOnce;
          expect(onLoadFinished).to.not.have.been.called;
          expect(tree.nodes()[2].payload).to.be.undefined;
        });

        it("does not mixup loaded nodes between the observables", async () => {
          const promises: Array<Promise<void>> = [];
          promises.push(expectSequence(preparedNodes1, [[0, 1, 3], [2]]));
          promises.push(expectSequence(preparedNodes2, [[1, 3, 5], [2], [4]]));
          await Promise.all(promises);
        });
      });
    });

    describe("when child nodes need to be prepared recursively", () => {
      it("emits all loaded descendants and recursively loads not loaded nodes", async () => {
        const dataProvider = new TestTreeDataProvider([
          {
            id: "0",
            autoExpand: true,
            children: [
              {
                id: "1",
                autoExpand: true,
                children: [
                  { id: "2" },
                  {
                    id: "3",
                    autoExpand: true,
                    children: [{ id: "4" }],
                  }],
              },
              {
                id: "5",
                autoExpand: true,
                children: [{ id: "6" }],
              },
            ],
          },
          { id: "7" },
        ]);
        const tree = new BeInspireTree({
          dataProvider,
          mapPayloadToInspireNodeConfig: Tree.inspireNodeFromTreeNodeItem,
          pageSize: 1,
        });
        await tree.ready;
        await tree.requestNodeLoad(undefined, 1);
        const orchestrator = initializeOrchestrator(tree);
        const preparedNodes = orchestrator.prepareNodesBetween(tree.nodes()[0], tree.nodes()[1]);

        await expectSequence(preparedNodes, [[0, 1, 2, 7], [3, 4], [5, 6]]);
      });
    });
  });

  describe("preparePendingNodes", () => {
    describe("returned observable", () => {
      let tree: BeInspireTree<TreeNodeItem>;
      let orchestrator: NodeLoadingOrchestrator;

      beforeEach(async () => {
        tree = await initializeTree([{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }]);
        orchestrator = initializeOrchestrator(tree);
      });

      it("emits pending nodes once they are loaded", async () => {
        orchestrator.prepareNodes([tree.nodes()[1]]).subscribe();
        orchestrator.prepareNodes([tree.nodes()[2]]).subscribe();
        const preparedNodes = orchestrator.preparePendingNodes();
        await expectSequence(preparedNodes, [[1], [2]]);
      });

      it("does not emit nodes that have been requested to load after the call", async () => {
        await tree.requestNodeLoad(undefined, 3);
        orchestrator.prepareNodes([tree.nodes()[1]]).subscribe();
        const observable = orchestrator.preparePendingNodes();
        orchestrator.prepareNodesBetween(tree.nodes()[0], tree.nodes()[3]).subscribe();
        await expectSequence(observable, [[1]]);
      });

      it("does not repeat nodes", async () => {
        orchestrator.prepareNodes([tree.nodes()[1]]).subscribe();
        orchestrator.prepareNodes([tree.nodes()[2]]).subscribe();
        orchestrator.prepareNodes([tree.nodes()[2]]).subscribe();
        orchestrator.prepareNodes([tree.nodes()[1]]).subscribe();
        const preparedNodes = orchestrator.preparePendingNodes();
        await expectSequence(preparedNodes, [[1], [2]]);
      });
    });
  });

  describe("prepareLoadedNodes", () => {
    it("emits loaded nodes and completes", async () => {
      const tree = await initializeTree([{ id: 0 }, { id: 1 }, { id: 2 }]);
      await tree.requestNodeLoad(undefined, 1);
      const orchestrator = initializeOrchestrator(tree);
      const preparedNodes = orchestrator.prepareLoadedNodes();
      await expectSequence(preparedNodes, [[0, 1]]);
    });
  });
});

/** Expects iterable to yield values in the order they are present in the input array. */
function expectIterable<T>(iterable: Iterable<T>, expectedValues: T[]) {
  const values = Array.from(iterable);
  expect(values).to.deep.eq(expectedValues);
}

describe("PendingNodeTracker", () => {
  let tracker: PendingNodeTracker;

  beforeEach(() => {
    tracker = new PendingNodeTracker();
  });

  describe("addNodes", () => {
    it("adds new input nodes", async () => {
      const tree = await initializeTree([{ id: 0 }, { id: 1 }]);
      const nodeKeys = tree.nodes().map((node) => NodeKey.for(node));
      tracker.addNodes(nodeKeys);
      expectIterable(tracker, nodeKeys);
      expect(tracker.getNumPendingNodes()).to.eq(2);
    });

    it("adds only new input nodes", async () => {
      const tree = await initializeTree([{ id: 0 }, { id: 1 }]);
      const nodeKeys = tree.nodes().map((node) => NodeKey.for(node));

      tracker.addNodes([nodeKeys[0]]);
      expectIterable(tracker, [nodeKeys[0]]);
      expect(tracker.getNumPendingNodes()).to.eq(1);

      tracker.addNodes(nodeKeys);
      expectIterable(tracker, nodeKeys);
      expect(tracker.getNumPendingNodes()).to.eq(2);
    });

    it("does not add input nodes if the node is already added for loading recursively", async () => {
      const tree = await initializeTree([{ id: 0 }, { id: 1 }]);
      const nodeKeys = tree.nodes().map((node) => NodeKey.for(node));

      tracker.addNodesRecursively([nodeKeys[1]]);
      expectIterable(tracker, [nodeKeys[1]]);
      expect(tracker.getNumPendingNodes()).to.eq(1);

      tracker.addNodes([nodeKeys[1]]);
      expectIterable(tracker, [nodeKeys[1]]);
      expect(tracker.getNumPendingNodes()).to.eq(1);
    });
  });

  describe("addNodesRecursively", () => {
    it("adds new input nodes", async () => {
      const tree = await initializeTree([{ id: 0 }, { id: 1 }]);
      const nodeKeys = tree.nodes().map((node) => NodeKey.for(node));

      tracker.addNodesRecursively(nodeKeys);
      expectIterable(tracker, nodeKeys);
      expect(tracker.getNumPendingNodes()).to.eq(2);
    });

    it("adds only new input nodes", async () => {
      const tree = await initializeTree([{ id: 0 }, { id: 1 }]);
      const nodeKeys = tree.nodes().map((node) => NodeKey.for(node));

      tracker.addNodesRecursively([nodeKeys[0]]);
      expectIterable(tracker, [nodeKeys[0]]);
      expect(tracker.getNumPendingNodes()).to.eq(1);

      tracker.addNodesRecursively(nodeKeys);
      expectIterable(tracker, nodeKeys);
      expect(tracker.getNumPendingNodes()).to.eq(2);
    });
  });

  describe("onNodeLoaded", () => {
    describe("when input node does not have payload", () => {
      it("does nothing and returns empty list", async () => {
        const tree = await initializeTree([{ id: 0 }, { id: 1 }]);
        const nodeKeys = tree.nodes().map((node) => NodeKey.for(node));
        tracker.addNodesRecursively([nodeKeys[1]]);

        expect(tracker.onNodeLoaded(nodeKeys[1].toNode(tree))).to.be.empty;
        expectIterable(tracker, [nodeKeys[1]]);
        expect(tracker.getNumPendingNodes()).to.eq(1);
        expect(tracker.getTotalAddedNodes()).to.eq(1);
      });
    });

    describe("when input node has payload", () => {
      it("does nothing and returns empty list when input node has not been added", async () => {
        const tree = await initializeTree([{ id: 0 }, { id: 1 }]);
        const nodeKeys = tree.nodes().map((node) => NodeKey.for(node));
        tracker.addNodesRecursively([nodeKeys[1]]);

        expect(tracker.onNodeLoaded(nodeKeys[0].toNode(tree))).to.be.empty;
        expectIterable(tracker, [nodeKeys[1]]);
        expect(tracker.getNumPendingNodes()).to.eq(1);
        expect(tracker.getTotalAddedNodes()).to.eq(1);
      });

      it("returns list containing the input node when the node has been added", async () => {
        const tree = await initializeTree([{ id: 0 }, { id: 1 }]);
        await tree.requestNodeLoad(undefined, 1);

        const inputNode = tree.nodes()[1];
        tracker.addNodes([NodeKey.for(inputNode)]);
        const loadedNodes = tracker.onNodeLoaded(inputNode);
        expect(loadedNodes.length).to.eq(1);
        expect(loadedNodes[0]).to.eq(inputNode);
        expectIterable(tracker, []);
        expect(tracker.getNumPendingNodes()).to.eq(0);
        expect(tracker.getTotalAddedNodes()).to.eq(1);
      });

      describe("when node load has been added recursively", async () => {
        it("returns list containing only the the input node if the node does not have any children", async () => {
          const tree = await initializeTree([{ id: 0 }, { id: 1 }]);
          tracker.addNodesRecursively([NodeKey.for(tree.nodes()[1])]);

          await tree.requestNodeLoad(undefined, 1);
          const inputNode = tree.nodes()[1];
          const loadedNodes = tracker.onNodeLoaded(inputNode);
          expect(loadedNodes.length).to.eq(1);
          expectIterable(loadedNodes, [inputNode]);
          expectIterable(tracker, []);
          expect(tracker.getNumPendingNodes()).to.eq(0);
          expect(tracker.getTotalAddedNodes()).to.eq(1);
        });

        it("returns list containing the input node and its first child and adds the remaining children", async () => {
          const tree = await initializeTree([{ id: 0 }, { id: 1, children: [{ id: 2 }, { id: 3 }] }]);
          tracker.addNodesRecursively([NodeKey.for(tree.nodes()[1])]);

          await tree.requestNodeLoad(undefined, 1);
          const inputNode = tree.nodes()[1];
          const children = toNodes<TreeNodeItem>(inputNode.getChildren());

          const loadedNodes = tracker.onNodeLoaded(inputNode);
          expect(loadedNodes.length).to.eq(2);
          expectIterable(loadedNodes, [inputNode, children[0]]);
          expectIterable(tracker, [NodeKey.for(children[1])]);
          expect(tracker.getNumPendingNodes()).to.eq(1);
          expect(tracker.getTotalAddedNodes()).to.eq(2);
        });
      });

      describe("when node was added normally, then recursively", () => {
        it("returns list containing the input node and its loaded children", async () => {
          const tree = await initializeTree([{ id: 0 }, { id: 1, children: [{ id: 2 }] }]);
          tracker.addNodes([NodeKey.for(tree.nodes()[1])]);
          tracker.addNodesRecursively([NodeKey.for(tree.nodes()[1])]);

          await tree.requestNodeLoad(undefined, 1);
          const inputNode = tree.nodes()[1];
          const children = toNodes<TreeNodeItem>(inputNode.getChildren());

          const loadedNodes = tracker.onNodeLoaded(inputNode);
          expect(loadedNodes.length).to.eq(2);
          expectIterable(loadedNodes, [inputNode, children[0]]);
          expectIterable(tracker, []);
          expect(tracker.getNumPendingNodes()).to.eq(0);
          expect(tracker.getTotalAddedNodes()).to.eq(1);
        });
      });
    });
  });

  describe("reset", () => {
    it("resets the tracker's state", async () => {
      const tree = await initializeTree([{ id: 0 }, { id: 1, children: [{ id: 2 }] }]);
      tracker.addNodes([NodeKey.for(tree.nodes()[0])]);
      tracker.addNodesRecursively([NodeKey.for(tree.nodes()[1])]);
      expect(tracker.getNumPendingNodes()).to.eq(2);
      expect(tracker.getTotalAddedNodes()).to.eq(2);
      expect(tracker.empty).to.be.false;

      tracker.reset();
      expect(tracker.getNumPendingNodes()).to.eq(0);
      expect(tracker.getTotalAddedNodes()).to.eq(0);
      expect(tracker.empty).to.be.true;
      expectIterable(tracker, []);
    });
  });
});

describe("NodeSet", () => {
  describe("constructor", () => {
    it("creates an empty set if nothing is passed", () => {
      const set = new NodeSet();
      expectIterable(set, []);
    });

    it("populates the set with input nodes", () => {
      const nodeKeys = [0, 1, 2].map((id) => new NodeKey(undefined, id));
      const set = new NodeSet(nodeKeys);
      expectIterable(set, nodeKeys);
    });
  });

  describe("size", () => {
    it("is the number of elements contained in the set", () => {
      const set = new NodeSet();
      expect(set.size).to.eq(0);

      set.add(new NodeKey(undefined, 0));
      expect(set.size).to.eq(1);

      set.add(new NodeKey(undefined, 1));
      expect(set.size).to.eq(2);

      set.add(new NodeKey(undefined, 0));
      expect(set.size).to.eq(2);

      set.delete(new NodeKey(undefined, 1));
      expect(set.size).to.eq(1);

      set.clear();
      expect(set.size).to.eq(0);
    });
  });

  describe("empty", () => {
    it("is `true` if the set does not contain anything", () => {
      const set = new NodeSet();
      expect(set.empty).to.be.true;
    });

    it("is `false` is set contains at least one node", () => {
      const set = new NodeSet([new NodeKey(undefined, 0)]);
      expect(set.empty).to.be.false;
    });
  });

  describe("add", () => {
    it("adds node to the set", () => {
      const nodeKeys = [new NodeKey(undefined, 0)];
      const set = new NodeSet();
      expect(set.add(nodeKeys[0])).to.eq(set);
      expectIterable(set, nodeKeys);
    });

    it("does nothing if node is already present", () => {
      const nodeKeys = [new NodeKey(undefined, 0)];
      const set = new NodeSet(nodeKeys);
      expect(set.add(nodeKeys[0])).to.eq(set);
      expectIterable(set, nodeKeys);
    });
  });

  describe("delete", () => {
    it("removes input node from the set and returns `true` when node was present", () => {
      const nodeKeys = [new NodeKey(undefined, 0)];
      const set = new NodeSet(nodeKeys);
      expect(set.delete(nodeKeys[0])).to.be.true;
      expectIterable(set, []);
    });

    it("does nothing and returns `false` if input node was not present", () => {
      const nodeKeys = [0, 1].map((id) => new NodeKey(undefined, id));
      const set = new NodeSet([nodeKeys[0]]);
      expect(set.delete(nodeKeys[1])).to.be.false;
      expectIterable(set, [nodeKeys[0]]);
    });
  });

  describe("clear", () => {
    it("removes all nodes from the set", () => {
      const nodeKeys = [0, 1].map((id) => new NodeKey(undefined, id));
      const set = new NodeSet(nodeKeys);
      set.clear();
      expectIterable(set, []);
    });
  });

  describe("has", () => {
    it("returns `true` if input node is in the set", () => {
      const nodeKeys = [new NodeKey(undefined, 0)];
      const set = new NodeSet(nodeKeys);
      expect(set.has(nodeKeys[0])).to.be.true;
    });

    it("returns `false` if input node is not in the set", () => {
      const nodeKeys = [0, 1].map((id) => new NodeKey(undefined, id));
      const set = new NodeSet([nodeKeys[0]]);
      expect(set.has(nodeKeys[1])).to.be.false;
    });

    it("returns `false` if contained node has a different parent", async () => {
      const tree = await initializeTree([{ id: 0 }, { id: 1, children: [{ id: 0 }] }]);
      await tree.requestNodeLoad(undefined, 1);

      const set = new NodeSet();
      set.add(NodeKey.for(toNode(tree.node("1")!.getChildren()[0])));
      expect(set.has(NodeKey.for(tree.node("0")!))).to.be.false;
    });
  });
});

describe("makeObservableCallback", () => {
  it("returns callback that passes the argument to the returned observable's subscribers", () => {
    const [callback, observable] = makeObservableCallback<number>();
    const expectedValues = [1, 2];
    observable.subscribe({
      next: (value) => {
        expect(value).to.not.be.undefined;
        expect(value).to.eq(expectedValues.shift());
      },
    });
    callback(1);
    callback(2);
  });

  it("returns a hot observable", () => {
    const [callback, observable] = makeObservableCallback<number>();

    // Expect not to receive a '1'
    callback(1);

    // Expect to observe a '2' on one observer and a '3' on both observers
    const expectedValues = [2, 3, 3];
    observable.subscribe({
      next: (value) => {
        expect(value).to.not.be.undefined;
        expect(value).to.eq(expectedValues.shift());
      },
    });
    callback(2);
    observable.subscribe({
      next: (value) => {
        expect(value).to.not.be.undefined;
        expect(value).to.eq(expectedValues.shift());
      },
    });
    callback(3);

    expect(expectedValues).to.be.empty;
  });
});

describe("onCancelation", () => {
  describe("returned observable", () => {
    it("invokes callback if subscriber cancels subscription before the observable completes", (done) => {
      const promise = new ResolvablePromise<void>();
      const subscription = from(promise)
        .pipe(
          onCancelation(done),
        )
        .subscribe();

      subscription.unsubscribe();
      promise.resolve();
    });

    it("invokes callback if observable sends error notification", (done) => {
      throwError(new Error())
        .pipe(
          onCancelation(() => done()),
        )
        .subscribe({
          error: () => { },
        });
    });

    it("does not invoke callback if observable completes", (done) => {
      of([1, 2, 3])
        .pipe(
          onCancelation(() => done(new Error("callback should not have been invoked"))),
        )
        .subscribe();
      done();
    });

    it("invokes callback after subscriber handles error", (done) => {
      let errorHandled = false;
      throwError(new Error())
        .pipe(
          onCancelation(() => {
            expect(errorHandled).to.be.true;
            done();
          }),
        )
        .subscribe({
          error: () => { errorHandled = true; },
        });
    });
  });
});
