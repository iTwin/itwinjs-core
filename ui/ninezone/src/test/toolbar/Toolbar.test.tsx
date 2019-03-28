/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { Direction, Toolbar, ToolbarPanelAlignment, PanelsProvider, ToolbarItem, ToolbarItemProps } from "../../ui-ninezone";
import { getToolbarItemProps } from "../../ui-ninezone/toolbar/Toolbar";

describe("<Toolbar />", () => {
  it("should render", () => {
    mount(<Toolbar />);
  });

  it("renders correctly", () => {
    shallow(<Toolbar />).should.matchSnapshot();
  });

  it("renders with expandsTo", () => {
    const sut = shallow(
      <Toolbar
        expandsTo={Direction.Right}
      />,
    );
    const renderProp = sut.find(PanelsProvider).prop("children");
    const rendered = shallow(renderProp!(undefined) as React.ReactElement<{}>);
    rendered.should.matchSnapshot();
  });

  it("renders with panelAlignment", () => {
    const sut = shallow(
      <Toolbar
        panelAlignment={ToolbarPanelAlignment.End}
      />,
    );
    const renderProp = sut.find(PanelsProvider).prop("children");
    const rendered = shallow(renderProp!(undefined) as React.ReactElement<{}>);
    rendered.should.matchSnapshot();
  });
});

class ItemComponent extends React.Component implements ToolbarItem {
  public panel = document.createElement("div");
  public history = document.createElement("div");

  public render() {
    return <div></div>;
  }
}

class ExpandableItem extends React.Component<ToolbarItemProps<ItemComponent>> {
  public render() {
    return <ItemComponent ref={this.props.toolbarItemRef} />;
  }
}

// tslint:disable-next-line: variable-name
const BadItem = () => <div></div>;

class SwitchItem extends React.Component<{}, { isExpandable: boolean }> {
  public readonly state = {
    isExpandable: false,
  };

  public render() {
    if (this.state.isExpandable)
      return <ExpandableItem {...this.props} />;
    return <BadItem />;
  }
}

describe("<PanelsProvider />", () => {
  it("should append panels", () => {
    const panels = document.createElement("div");
    const appendChild = sinon.stub(panels, "appendChild").callsFake((newChild: Node) => newChild);
    mount(
      <PanelsProvider
        histories={React.createRef<HTMLElement>()}
        items={
          <>
            <ExpandableItem />
            <BadItem />
            <ExpandableItem />
          </>
        }
        panels={{ current: panels }}
      >
        {(items) => items}
      </PanelsProvider>,
    );
    appendChild.calledTwice.should.true;
  });

  it("should remove existing panels", () => {
    const panels = document.createElement("div");
    panels.appendChild(document.createElement("div"));
    panels.appendChild(document.createElement("div"));
    const removeChild = sinon.spy(panels, "removeChild");
    mount(
      <PanelsProvider
        histories={React.createRef<HTMLElement>()}
        items={
          <ExpandableItem />
        }
        panels={{ current: panels }}
      >
        {(items) => items}
      </PanelsProvider>,
    );
    removeChild.calledTwice.should.true;
  });

  it("should append histories", () => {
    const histories = document.createElement("div");
    const appendChild = sinon.stub(histories, "appendChild").callsFake((newChild: Node) => newChild);
    mount(
      <PanelsProvider
        histories={{ current: histories }}
        items={
          <>
            <ExpandableItem />
            <BadItem />
            <ExpandableItem />
          </>
        }
        panels={React.createRef<HTMLElement>()}
      >
        {(items) => items}
      </PanelsProvider>,
    );
    appendChild.calledTwice.should.true;
  });

  it("should remove existing histories", () => {
    const histories = document.createElement("div");
    histories.appendChild(document.createElement("div"));
    histories.appendChild(document.createElement("div"));
    const removeChild = sinon.spy(histories, "removeChild");
    mount(
      <PanelsProvider
        histories={{ current: histories }}
        items={
          <ExpandableItem />
        }
        panels={React.createRef<HTMLElement>()}
      >
        {(items) => items}
      </PanelsProvider>,
    );
    removeChild.calledTwice.should.true;
  });

  it("should not clone if item is not a valid element", () => {
    const children = sinon.fake(() => null);
    mount(
      <PanelsProvider
        histories={React.createRef<HTMLElement>()}
        items={"!element"}
        panels={React.createRef<HTMLElement>()}
      >
        {children}
      </PanelsProvider>,
    );
    children.calledOnce.should.true;
    children.calledWith(sinon.match.array.deepEquals([]));
  });

  it("should force update", () => {
    const sut = mount(
      <PanelsProvider
        histories={React.createRef<HTMLElement>()}
        items={
          <>
            <ExpandableItem />
            <SwitchItem />
            <ExpandableItem />
          </>
        }
        panels={React.createRef<HTMLElement>()}
      >
        {(items) => items}
      </PanelsProvider>,
    );
    const instance = sut.instance();
    const forceUpdateSpy = sinon.spy(instance, "forceUpdate");
    const switchItem = sut.find(SwitchItem);
    switchItem.setState({ isExpandable: true });

    forceUpdateSpy.calledOnce.should.true;
  });
});

describe("getToolbarItemProps", () => {
  it("should return toolbarItemRef", () => {
    const sut = getToolbarItemProps({
      toolbarItemRef: "abc",
    });
    expect(sut).to.eql({ toolbarItemRef: "abc" });
  });

  it("should return empty object if toolbarItemRef is not set", () => {
    const sut = getToolbarItemProps({
      tir: "abc",
    });
    expect(sut).to.eql({});
  });
});
