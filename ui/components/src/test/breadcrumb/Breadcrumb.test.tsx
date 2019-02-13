/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { expect } from "chai";
import * as sinon from "sinon";
import { waitForUpdate } from "../test-helpers/misc";
import { render, cleanup, fireEvent, RenderResult, waitForElement } from "react-testing-library";
import { Breadcrumb, BreadcrumbMode, BreadcrumbPath } from "../../ui-components";
import { mockRawTreeDataProvider, mockInterfaceTreeDataProvider, mockMutableInterfaceTreeDataProvider, mockRawTreeDataProvider2 } from "./mockTreeDataProvider";
import TestUtils from "../TestUtils";
import { BreadcrumbNodeProps, BreadcrumbNode } from "../../ui-components/breadcrumb/Breadcrumb";
import { TreeNodeItem } from "../../ui-components/tree/TreeDataProvider";

describe("Breadcrumb", () => {
  let renderSpy: sinon.SinonSpy;
  let renderedComponent: RenderResult;

  before(async () => {
    await TestUtils.initializeUiComponents(); // tslint:disable-line:no-floating-promises
  });

  beforeEach(() => {
    sinon.restore();
    renderSpy = sinon.spy();
  });

  afterEach(cleanup);

  describe("<Breadcrumb />", () => {
    it("should render", () => {
      render(<Breadcrumb onRender={renderSpy} dataProvider={mockRawTreeDataProvider} />);
    });
    it("should render with interface dataProvider", () => {
      render(<Breadcrumb onRender={renderSpy} dataProvider={mockInterfaceTreeDataProvider} />);
    });
    describe("load callbacks", () => {
      it("should call onRootNodesLoaded correctly", async () => {
        const onRootNodesLoadedSpy = sinon.spy();
        await waitForUpdate(() => renderedComponent = render(<Breadcrumb onRender={renderSpy} dataProvider={mockRawTreeDataProvider} onRootNodesLoaded={onRootNodesLoadedSpy} />), renderSpy, 2);
        expect(onRootNodesLoadedSpy).to.have.been.calledOnce;
      });
      it("should call onChildrenLoaded correctly", async () => {
        const onChildrenLoadedSpy = sinon.spy();
        await waitForUpdate(() => renderedComponent = render(<Breadcrumb onRender={renderSpy} dataProvider={mockInterfaceTreeDataProvider} onChildrenLoaded={onChildrenLoadedSpy} />), renderSpy, 2);
        expect(onChildrenLoadedSpy).to.have.have.callCount(3);
      });
    });

    it("should render with renderTable defined", async () => {
      const renderNode = (props: BreadcrumbNodeProps, _node?: TreeNodeItem, _parent?: TreeNodeItem) => {
        return <BreadcrumbNode label={props.label} icon={props.icon} onRender={renderSpy} />;
      };
      await waitForUpdate(() => render(<Breadcrumb dataProvider={mockRawTreeDataProvider} renderNode={renderNode} />), renderSpy, 1);
      expect(renderSpy).to.be.called;
    });

    describe("with current prop", () => {
      it("should render with current", async () => {
        await waitForUpdate(() => renderedComponent = render(<Breadcrumb onRender={renderSpy} initialCurrent={mockRawTreeDataProvider[0]} dataProvider={mockRawTreeDataProvider} />), renderSpy, 2);
        expect(renderedComponent.getByText(mockRawTreeDataProvider[0].label)).to.exist;
      });
    });

    describe("Interface DataProvider", () => {
      it("should rerender from raw dataProvider to interface dataProvider", async () => {
        const nodeRaw = mockRawTreeDataProvider[1];
        await waitForUpdate(() => renderedComponent = render(<Breadcrumb onRender={renderSpy} dataProvider={mockRawTreeDataProvider} initialCurrent={nodeRaw} />), renderSpy, 2);
        expect(await waitForElement(() => renderedComponent.getByText(nodeRaw.label))).to.exist;
        const nodeInterface = (await mockInterfaceTreeDataProvider.getNodes())[0];
        await waitForUpdate(() => renderedComponent.rerender(<Breadcrumb onRender={renderSpy} dataProvider={mockInterfaceTreeDataProvider} initialCurrent={nodeInterface} />), renderSpy, 2);
        expect(await waitForElement(() => renderedComponent.getByText(nodeInterface.label))).to.exist;
      });

      describe("listening to `ITreeDataProvider.onTreeNodeChanged` events", () => {
        it("rerenders when `onTreeNodeChanged` is broadcasted with node", async () => {
          const node = (await mockInterfaceTreeDataProvider.getNodes())[0];
          await waitForUpdate(() => renderedComponent = render(<Breadcrumb onRender={renderSpy} dataProvider={mockInterfaceTreeDataProvider} initialCurrent={node} />), renderSpy, 2);
          expect(renderedComponent.getAllByTestId("breadcrumb-node").length).to.eq(2);
          node.label = "test";
          await waitForUpdate(() => mockInterfaceTreeDataProvider.onTreeNodeChanged!.raiseEvent([node]), renderSpy, 1);

          expect(renderedComponent.getByText("test")).to.not.be.undefined;
          expect(renderedComponent.getAllByTestId("breadcrumb-node").length).to.eq(2);
        });

        it("ignores when `onTreeNodeChanged` is broadcasted with nodes not contained by tree", async () => {
          const node = mockRawTreeDataProvider[0];
          await waitForUpdate(() => renderedComponent = render(<Breadcrumb onRender={renderSpy} dataProvider={mockInterfaceTreeDataProvider} />), renderSpy, 1);
          mockInterfaceTreeDataProvider.onTreeNodeChanged!.raiseEvent([node]);

          expect(renderedComponent.queryByText(node.label)).to.be.null;
        });

        it("rerenders when `onTreeNodeChanged` is broadcasted with undefined", async () => {
          const node2 = (await mockMutableInterfaceTreeDataProvider.getNodes())[1];
          const node22 = (await mockMutableInterfaceTreeDataProvider.getNodes(node2))[1];
          await waitForUpdate(() => renderedComponent = render(<Breadcrumb onRender={renderSpy} dataProvider={mockMutableInterfaceTreeDataProvider} initialCurrent={node22} />), renderSpy, 2);
          expect(renderedComponent.getAllByTestId("breadcrumb-node").length).to.eq(3);

          await waitForUpdate(() => mockMutableInterfaceTreeDataProvider.moveNode(node2, undefined, node22, 2), renderSpy, 1);
          expect(renderedComponent.getAllByTestId("breadcrumb-node").length).to.eq(2);
        });

        it("subscribes to `onTreeNodeChanged` on mount", () => {
          renderedComponent = render(<Breadcrumb onRender={renderSpy} dataProvider={mockInterfaceTreeDataProvider} />);
          expect(mockInterfaceTreeDataProvider.onTreeNodeChanged!.numberOfListeners).to.eq(1);
        });

        it("unsubscribes to `onTreeNodeChanged` on unmount", () => {
          renderedComponent = render(<Breadcrumb onRender={renderSpy} dataProvider={mockInterfaceTreeDataProvider} />);
          renderedComponent.unmount();
          expect(mockInterfaceTreeDataProvider.onTreeNodeChanged!.numberOfListeners).to.eq(0);
        });

        it("subscribes to `onTreeNodeChanged` on provider change", async () => {
          await waitForUpdate(() => renderedComponent = render(<Breadcrumb onRender={renderSpy} dataProvider={mockRawTreeDataProvider} />), renderSpy, 2);
          await waitForUpdate(() => renderedComponent.rerender(<Breadcrumb onRender={renderSpy} dataProvider={mockInterfaceTreeDataProvider} />), renderSpy, 2);
          expect(mockInterfaceTreeDataProvider.onTreeNodeChanged!.numberOfListeners).to.eq(1);
        });

        it("unsubscribes to `onTreeNodeChanged` on provider change", async () => {
          await waitForUpdate(() => renderedComponent = render(<Breadcrumb onRender={renderSpy} dataProvider={mockInterfaceTreeDataProvider} />), renderSpy, 2);
          await waitForUpdate(() => renderedComponent.rerender(<Breadcrumb onRender={renderSpy} dataProvider={mockRawTreeDataProvider} />), renderSpy, 2);
          expect(mockInterfaceTreeDataProvider.onTreeNodeChanged!.numberOfListeners).to.eq(0);
        });
      });
    });

    describe("Raw DataProvider", () => {
      it("should rerender from interface DataProvider to raw dataProvider", async () => {
        await waitForUpdate(() => renderedComponent = render(<Breadcrumb onRender={renderSpy} dataProvider={mockInterfaceTreeDataProvider} />), renderSpy, 2);
        expect(renderedComponent.getByText("Interface Node 2")).to.exist;
        await waitForUpdate(() => renderedComponent.rerender(<Breadcrumb onRender={renderSpy} dataProvider={mockRawTreeDataProvider} />), renderSpy, 2);
        expect(await waitForElement(() => renderedComponent.getByText("Raw Node 2"))).to.exist;
      });
      it("should rerender from raw DataProvider to raw dataProvider", async () => {
        await waitForUpdate(() => renderedComponent = render(<Breadcrumb onRender={renderSpy} dataProvider={mockRawTreeDataProvider} />), renderSpy, 2);
        const rootNode = mockRawTreeDataProvider[1];
        expect(await waitForElement(() => renderedComponent.getByText(rootNode.label))).to.exist;
        await waitForUpdate(() => renderedComponent.rerender(<Breadcrumb onRender={renderSpy} dataProvider={mockRawTreeDataProvider2} />), renderSpy, 2);
        const rootNode2 = mockRawTreeDataProvider2[1];
        expect(await waitForElement(() => renderedComponent.getByText(rootNode2.label))).to.exist;
      });
      it("should have one child in parent element", async () => {
        await waitForUpdate(() => renderedComponent = render(<Breadcrumb onRender={renderSpy} dataProvider={mockRawTreeDataProvider} />), renderSpy, 2);
        const dropdownInputParent = renderedComponent.getByTestId("breadcrumb-dropdown-input-parent");
        expect(dropdownInputParent).to.exist;
        // should only every have input or dropdown
        expect(dropdownInputParent.children).to.have.lengthOf(1);
      });
    });

    describe("dropdownOnly", () => {
      it("should not change to input mode when dropdown background is clicked", async () => {
        await waitForUpdate(() => renderedComponent = render(<Breadcrumb onRender={renderSpy} dataProvider={mockRawTreeDataProvider} dropdownOnly={true} />), renderSpy, 2);
        const dropdownBackground = renderedComponent.getByTestId("breadcrumb-dropdown-background");
        fireEvent.click(dropdownBackground);
        expect(renderedComponent.queryByTestId("breadcrumb-input-root")).to.not.exist;
      });
    });

    describe("staticOnly", () => {
      it("should not render navigation controls", async () => {
        await waitForUpdate(() => renderedComponent = render(<Breadcrumb onRender={renderSpy} dataProvider={mockRawTreeDataProvider} staticOnly={true} />), renderSpy, 2);
        expect(renderedComponent.queryByTestId("breadcrumb-up-dir")).to.not.exist;
        expect(renderedComponent.queryAllByTestId("breadcrumb-static-button")).to.exist;
      });
      it("should not change to input mode when dropdown background is clicked", async () => {
        await waitForUpdate(() => renderedComponent = render(<Breadcrumb onRender={renderSpy} dataProvider={mockRawTreeDataProvider} staticOnly={true} />), renderSpy, 2);
        const dropdownBackground = renderedComponent.getByTestId("breadcrumb-dropdown-background");
        fireEvent.click(dropdownBackground);
        expect(renderedComponent.queryByTestId("breadcrumb-input-root")).to.not.exist;
      });
      it("should not change to input mode when dropdown background is clicked", async () => {
        await waitForUpdate(() => renderedComponent = render(<Breadcrumb onRender={renderSpy} dataProvider={mockRawTreeDataProvider} staticOnly={true} initialCurrent={mockRawTreeDataProvider[0]} />), renderSpy, 2);
        expect(renderedComponent.getByText(mockRawTreeDataProvider[0].label)).to.exist;
      });
    });

    describe("With path", () => {
      const path = new BreadcrumbPath(mockRawTreeDataProvider);
      it("should render with path", () => {
        render(<Breadcrumb dataProvider={mockRawTreeDataProvider} path={path} />);
      });
      it("should update path to node", async () => {
        await waitForUpdate(() => renderedComponent = render(<Breadcrumb onRender={renderSpy} dataProvider={mockRawTreeDataProvider} path={path} />), renderSpy, 2);
        const rootNode = mockRawTreeDataProvider[1];
        expect(await waitForElement(() => renderedComponent.getByText(rootNode.label))).to.exist;
        const node = mockRawTreeDataProvider[1].children![0];
        path.setCurrentNode(node);
        expect(await waitForElement(() => renderedComponent.getByText(node.label))).to.exist;
      });
      it("should not update if node isn't found", async () => {
        await waitForUpdate(() => renderedComponent = render(<Breadcrumb onRender={renderSpy} dataProvider={mockRawTreeDataProvider} path={path} />), renderSpy, 2);
        const node = { ...mockRawTreeDataProvider[1].children![0], id: "INVALID ID" };
        path.setCurrentNode(node);
        expect(renderedComponent.queryByText(node.label)).to.not.exist;
      });
      it("should update path to root", async () => {
        await waitForUpdate(() => renderedComponent = render(<Breadcrumb onRender={renderSpy} dataProvider={mockRawTreeDataProvider} path={path} />), renderSpy, 2);
        const node = mockRawTreeDataProvider[1].children![0];
        path.setCurrentNode(node);
        expect(await waitForElement(() => renderedComponent.getByText(node.label))).to.exist;
        path.setCurrentNode(undefined);
        const list = await waitForElement(() => renderedComponent.getByTestId("breadcrumb-crumb-list"));
        expect(list).to.exist;
        expect(list!.children.length).to.equal(1);
      });
    });
    describe("Breadcrumb modes", () => {
      it("should submit undefined node", async () => {
        await waitForUpdate(() => renderedComponent = render(<Breadcrumb onRender={renderSpy} dataProvider={mockRawTreeDataProvider} initialBreadcrumbMode={-1 as unknown as BreadcrumbMode} />), renderSpy, 2);
        expect(renderedComponent.getByTestId("breadcrumb-error-unknown-mode")).to.exist;
      });
      describe("BreadcrumbInput mode", () => {
        it("should submit undefined node", async () => {
          await waitForUpdate(() => renderedComponent = render(<Breadcrumb onRender={renderSpy} dataProvider={mockRawTreeDataProvider} initialBreadcrumbMode={BreadcrumbMode.Input} />), renderSpy, 2);
          const breadcrumbInput = renderedComponent.getByTestId("breadcrumb-input") as HTMLInputElement;
          breadcrumbInput.value = "";
          breadcrumbInput.setSelectionRange(0, 0);
          fireEvent.click(breadcrumbInput);
          await waitForUpdate(() => fireEvent.keyUp(breadcrumbInput, { keyCode: 13 /* <Return> */ }), renderSpy, 1);
          expect(renderedComponent.getByTestId("breadcrumb-dropdown-background")).to.exist;
        });
        it("should submit undefined node with parentsOnly={false}", async () => {
          await waitForUpdate(() => renderedComponent = render(<Breadcrumb onRender={renderSpy} dataProvider={mockRawTreeDataProvider} parentsOnly={false} initialBreadcrumbMode={BreadcrumbMode.Input} />), renderSpy, 2);
          const breadcrumbInput = renderedComponent.getByTestId("breadcrumb-input") as HTMLInputElement;
          breadcrumbInput.value = "";
          breadcrumbInput.setSelectionRange(0, 0);
          fireEvent.click(breadcrumbInput);
          await waitForUpdate(() => fireEvent.keyUp(breadcrumbInput, { keyCode: 13 /* <Return> */ }), renderSpy, 1);
          expect(renderedComponent.getByTestId("breadcrumb-dropdown-background")).to.exist;
        });
        it("should submit node", async () => {
          await waitForUpdate(() => renderedComponent = render(<Breadcrumb onRender={renderSpy} delimiter={"\\"} dataProvider={mockRawTreeDataProvider} initialBreadcrumbMode={BreadcrumbMode.Input} />), renderSpy, 2);
          const breadcrumbInput = renderedComponent.getByTestId("breadcrumb-input") as HTMLInputElement;
          const label = mockRawTreeDataProvider[1].label;
          breadcrumbInput.value = label + "\\";
          const l = breadcrumbInput.value.length;
          breadcrumbInput.setSelectionRange(l, l);
          fireEvent.click(breadcrumbInput);
          await waitForUpdate(() => fireEvent.keyUp(breadcrumbInput, { keyCode: 13 /* <Return> */ }), renderSpy, 2);
          expect(renderedComponent.getByTestId("breadcrumb-dropdown-background")).to.exist;
          expect(renderedComponent.getByText(label)).to.exist;
        });
        it("should submit node without trailing slash", async () => {
          await waitForUpdate(() => renderedComponent = render(<Breadcrumb onRender={renderSpy} delimiter={"\\"} dataProvider={mockRawTreeDataProvider} initialBreadcrumbMode={BreadcrumbMode.Input} />), renderSpy, 2);
          const breadcrumbInput = renderedComponent.getByTestId("breadcrumb-input") as HTMLInputElement;
          const label = mockRawTreeDataProvider[1].label;
          breadcrumbInput.value = label;
          const l = breadcrumbInput.value.length;
          breadcrumbInput.setSelectionRange(l, l);
          fireEvent.click(breadcrumbInput);
          await waitForUpdate(() => fireEvent.keyUp(breadcrumbInput, { keyCode: 13 /* <Return> */ }), renderSpy, 2);
          expect(renderedComponent.getByTestId("breadcrumb-dropdown-background")).to.exist;
          expect(renderedComponent.getByText(label)).to.exist;
        });
        it("should submit node with parentsOnly={false}", async () => {
          await waitForUpdate(() => renderedComponent = render(<Breadcrumb onRender={renderSpy} delimiter={"\\"} dataProvider={mockRawTreeDataProvider} parentsOnly={false} initialBreadcrumbMode={BreadcrumbMode.Input} />), renderSpy, 2);
          const breadcrumbInput = renderedComponent.getByTestId("breadcrumb-input") as HTMLInputElement;
          const label1 = mockRawTreeDataProvider[1].label;
          const label2 = mockRawTreeDataProvider[1].children![1].label;
          breadcrumbInput.value = label1 + "\\" + label2;
          const l = breadcrumbInput.value.length;
          breadcrumbInput.setSelectionRange(l, l);
          fireEvent.click(breadcrumbInput);
          await waitForUpdate(() => fireEvent.keyUp(breadcrumbInput, { keyCode: 13 /* <Return> */ }), renderSpy, 2);
          expect(renderedComponent.getByTestId("breadcrumb-dropdown-background")).to.exist;
          expect(renderedComponent.getByText(label1)).to.exist;
          expect(renderedComponent.getByText(label2)).to.exist;
        });
        it("should submit node from preselected node", async () => {
          const node = mockRawTreeDataProvider[0];
          await waitForUpdate(() => renderedComponent = render(<Breadcrumb onRender={renderSpy} delimiter={"\\"} dataProvider={mockRawTreeDataProvider} initialBreadcrumbMode={BreadcrumbMode.Input} initialCurrent={node} />), renderSpy, 2);
          const breadcrumbInput = renderedComponent.getByTestId("breadcrumb-input") as HTMLInputElement;
          const label = mockRawTreeDataProvider[1].label;
          breadcrumbInput.value = label + "\\";
          const l = breadcrumbInput.value.length;
          breadcrumbInput.setSelectionRange(l, l);
          fireEvent.click(breadcrumbInput);
          await waitForUpdate(() => fireEvent.keyUp(breadcrumbInput, { keyCode: 13 /* <Return> */ }), renderSpy, 2);
          expect(renderedComponent.getByTestId("breadcrumb-dropdown-background")).to.exist;
          expect(renderedComponent.getByText(label)).to.exist;
        });
        it("should submit invalid node", async () => {
          await waitForUpdate(() => renderedComponent = render(<Breadcrumb onRender={renderSpy} delimiter={"\\"} dataProvider={mockRawTreeDataProvider} initialBreadcrumbMode={BreadcrumbMode.Input} />), renderSpy, 2);
          const breadcrumbInput = renderedComponent.getByTestId("breadcrumb-input") as HTMLInputElement;
          breadcrumbInput.value = "\\invalidInput\\";
          const l = breadcrumbInput.value.length;
          breadcrumbInput.setSelectionRange(l, l);
          fireEvent.click(breadcrumbInput);
          fireEvent.keyUp(breadcrumbInput, { keyCode: 13 /* <Return> */ });
          const close = await waitForElement(() => renderedComponent.getByTestId("dialog-close"));
          expect(close).to.exist;
          fireEvent.click(close);
          expect(renderedComponent.queryByTestId("dialog-close")).to.not.exist;
        });
        it("should submit node from path", async () => {
          const path = new BreadcrumbPath(mockRawTreeDataProvider);
          path.setCurrentNode(mockRawTreeDataProvider[0]);
          await waitForUpdate(() => renderedComponent = render(<Breadcrumb onRender={renderSpy} dataProvider={mockRawTreeDataProvider} initialBreadcrumbMode={BreadcrumbMode.Input} path={path} />), renderSpy, 2);
          const breadcrumbInput = renderedComponent.getByTestId("breadcrumb-input") as HTMLInputElement;
          const updateEvent = sinon.spy();
          path.BreadcrumbUpdateEvent.addListener(updateEvent);
          breadcrumbInput.value = "";
          breadcrumbInput.setSelectionRange(0, 0);
          fireEvent.click(breadcrumbInput);
          await waitForUpdate(() => fireEvent.keyUp(breadcrumbInput, { keyCode: 13 /* <Return> */ }), renderSpy, 1);
          expect(renderedComponent.getByTestId("breadcrumb-dropdown-background")).to.exist;
          expect(updateEvent).to.be.calledWithMatch({ currentNode: undefined });
        });
        it("should change to input mode when dropdown background is clicked", async () => {
          await waitForUpdate(() => renderedComponent = render(<Breadcrumb onRender={renderSpy} dataProvider={mockRawTreeDataProvider} />), renderSpy, 2);
          const dropdownBackground = renderedComponent.getByTestId("breadcrumb-dropdown-background");
          await waitForUpdate(() => fireEvent.click(dropdownBackground), renderSpy, 1);
          expect(renderedComponent.getByTestId("breadcrumb-input-root")).to.exist;
        });
        it("should change to dropdown mode when outside is clicked", async () => {
          await waitForUpdate(() => renderedComponent = render(<Breadcrumb onRender={renderSpy} dataProvider={mockRawTreeDataProvider} initialBreadcrumbMode={BreadcrumbMode.Input} />), renderSpy, 2);
          const dropdownInputParent = renderedComponent.getByTestId("breadcrumb-dropdown-input-parent");
          await waitForUpdate(() => fireEvent.click(dropdownInputParent), renderSpy, 1);
          expect(renderedComponent.getByTestId("breadcrumb-dropdown-background")).to.exist;
        });
        it("should change back from input mode when (X) button is clicked", async () => {
          await waitForUpdate(() => renderedComponent = render(<Breadcrumb onRender={renderSpy} dataProvider={mockRawTreeDataProvider} initialBreadcrumbMode={BreadcrumbMode.Input} />), renderSpy, 2);
          const inputRoot = renderedComponent.getByTestId("breadcrumb-input-close");
          await waitForUpdate(() => fireEvent.click(inputRoot), renderSpy, 1);
          expect(renderedComponent.getByTestId("breadcrumb-dropdown-background")).to.exist;
        });
        it("should focus inputElement on <Esc> pressed", async () => {
          await waitForUpdate(() => renderedComponent = render(<Breadcrumb onRender={renderSpy} dataProvider={mockRawTreeDataProvider} initialBreadcrumbMode={BreadcrumbMode.Input} />), renderSpy, 2);
          const menu = renderedComponent.getByTestId("context-menu-root");
          fireEvent.keyUp(menu, { keyCode: 27 });
        });
        it("should navigate to node when autocomplete item chosen", async () => {
          await waitForUpdate(() => renderedComponent = render(<Breadcrumb onRender={renderSpy} dataProvider={mockRawTreeDataProvider} initialBreadcrumbMode={BreadcrumbMode.Input} />), renderSpy, 2);
          const menuItem = renderedComponent.getAllByTestId("context-menu-item");
          fireEvent.click(menuItem[0]);
          expect(await waitForElement(() => renderedComponent.getByDisplayValue(mockRawTreeDataProvider[1].label + "\\"))).to.exist;
        });
        describe("Keyboard Navigation", () => {
          it("Should close context menu on <Esc>", async () => {
            await waitForUpdate(() => renderedComponent = render(<Breadcrumb onRender={renderSpy} dataProvider={mockRawTreeDataProvider} initialBreadcrumbMode={BreadcrumbMode.Input} />), renderSpy, 2);
            const input = renderedComponent.getByTestId("breadcrumb-input");
            fireEvent.keyUp(input, { keyCode: 27 });
            expect(renderedComponent.getByTestId("context-menu-container").classList.contains("opened")).to.be.false;
          });
          it("Should prevent default on <Up> and <Down> keydown", async () => {
            await waitForUpdate(() => renderedComponent = render(<Breadcrumb onRender={renderSpy} dataProvider={mockRawTreeDataProvider} initialBreadcrumbMode={BreadcrumbMode.Input} />), renderSpy, 2);
            const input = renderedComponent.getByTestId("breadcrumb-input");
            fireEvent.keyDown(input, { keyCode: 38 });
            fireEvent.keyDown(input, { keyCode: 40 });
          });
          it("Should prevent default on <Up> and <Down> keyup", async () => {
            await waitForUpdate(() => renderedComponent = render(<Breadcrumb onRender={renderSpy} dataProvider={mockRawTreeDataProvider} initialBreadcrumbMode={BreadcrumbMode.Input} />), renderSpy, 2);
            const input = renderedComponent.getByTestId("breadcrumb-input");
            fireEvent.keyUp(input, { keyCode: 38 });
            fireEvent.keyUp(input, { keyCode: 40 });
          });
          it("Should reopen autocomplete on Up/Down keypress", async () => {
            await waitForUpdate(() => renderedComponent = render(<Breadcrumb onRender={renderSpy} dataProvider={mockRawTreeDataProvider} initialBreadcrumbMode={BreadcrumbMode.Input} />), renderSpy, 2);
            const input = renderedComponent.getByTestId("breadcrumb-input");
            fireEvent.keyUp(input, { keyCode: 27 });
            expect(renderedComponent.getByTestId("context-menu-container").classList.contains("opened")).to.be.false;
            fireEvent.keyUp(input, { keyCode: 38 });
            fireEvent.keyUp(input, { keyCode: 40 });
            expect(renderedComponent.getByTestId("context-menu-container").classList.contains("opened")).to.be.true;
          });
        });
      });
      describe("BreadcrumbDropDown mode", () => {
        it("should set current to root/undefined", async () => {
          const node = mockRawTreeDataProvider[0];
          await waitForUpdate(() => renderedComponent = render(<Breadcrumb onRender={renderSpy} dataProvider={mockRawTreeDataProvider} initialCurrent={node} />), renderSpy, 2);
          expect(waitForElement(() => renderedComponent.getByText(node.label))).to.exist;
          const menuItems = renderedComponent.getAllByTestId("context-menu-item");
          await waitForUpdate(() => fireEvent.click(menuItems[0]), renderSpy, 1);
          expect(renderedComponent.queryByText(node.label)).to.not.exist;
        });
        it("should set current to root/undefined from split button press", async () => {
          const node = mockRawTreeDataProvider[0];
          await waitForUpdate(() => renderedComponent = render(<Breadcrumb onRender={renderSpy} dataProvider={mockRawTreeDataProvider} initialCurrent={node} />), renderSpy, 2);
          const nodes = renderedComponent.getAllByTestId("split-button-label");
          fireEvent.click(nodes[0]);
          expect(renderedComponent.queryAllByTestId("breadcrumb-node")).to.have.lengthOf(1);
        });
        it("should navigate to root on updir button press when initialCurrent is a root level node", async () => {
          await waitForUpdate(() => renderedComponent = render(<Breadcrumb onRender={renderSpy} dataProvider={mockRawTreeDataProvider} initialCurrent={mockRawTreeDataProvider[0]} />), renderSpy, 2);
          const upDir = renderedComponent.getByTestId("breadcrumb-up-dir");
          fireEvent.click(upDir);
          expect(renderedComponent.queryAllByTestId("breadcrumb-node")).to.have.lengthOf(1);
        });
        it("should navigate to parent of node on updir button press when initialCurrent is a non-root level node", async () => {
          await waitForUpdate(() => renderedComponent = render(<Breadcrumb onRender={renderSpy} dataProvider={mockRawTreeDataProvider} initialCurrent={mockRawTreeDataProvider[1].children![0]} />), renderSpy, 2);
          const upDir = renderedComponent.getByTestId("breadcrumb-up-dir");
          fireEvent.click(upDir);
          expect(renderedComponent.queryAllByTestId("breadcrumb-node")).to.have.lengthOf(2);
        });
        it("should not change node on updir button press when on root node", async () => {
          await waitForUpdate(() => renderedComponent = render(<Breadcrumb onRender={renderSpy} dataProvider={mockRawTreeDataProvider} />), renderSpy, 2);
          const upDir = renderedComponent.getByTestId("breadcrumb-up-dir");
          fireEvent.click(upDir);
          expect(renderedComponent.queryAllByTestId("breadcrumb-node")).to.have.lengthOf(1);
        });
      });
    });
  });
});
