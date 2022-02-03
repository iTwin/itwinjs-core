/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";

import { fireEvent, render } from "@testing-library/react";
import { SpecialKey } from "@itwin/appui-abstract";
import type { ListboxValue } from "../../core-react/listbox/Listbox";
import { Listbox, ListboxItem } from "../../core-react/listbox/Listbox";

describe("<ListBox />", () => {
  const listItems = ["London", "Paris", "Stockholm", "Berlin", "Mumbai", "Christchurch", "Johannesburg", "Beijing", "New York"];

  it("renders single item list", () => {
    const listBox = render(
      <Listbox id="test-list" className="map-manager-source-list" >
      </Listbox>);

    const listBoxElement = listBox.container.querySelector("ul#test-list");
    expect(listBoxElement).not.to.be.null;
    expect(listBox.container.querySelector("ul#test-list[data-value]")).to.be.null;

    fireEvent.keyDown(listBoxElement!, { key: "ArrowDown" });
    const focusedItem = listBox.container.querySelector("li.focused");
    expect(focusedItem).to.be.null;
  });

  it("renders without selected item", () => {
    const listBox = render(
      <Listbox id="test-list" className="map-manager-source-list" >
        {
          listItems?.map((cityName) =>
            <ListboxItem key={cityName} className="map-source-list-entry" value={cityName}>
              <span className="map-source-list-entry-name" title={cityName}>{cityName}</span>
            </ListboxItem>)
        }
      </Listbox>);

    const listBoxElement = listBox.container.querySelector("ul#test-list");
    expect(listBoxElement).not.to.be.null;
    expect(listBox.container.querySelector("ul#test-list[data-value]")).to.be.null;
    const selectedItems = listBox.container.querySelectorAll("li[aria-selected='true']");
    expect(selectedItems.length).to.eq(0);

    fireEvent.keyDown(listBoxElement!, { key: "ArrowDown" });
    const focusedItem = listBox.container.querySelector("li.focused");
    expect(focusedItem).not.to.null;
    expect(focusedItem!.getAttribute("data-value")).to.eq(listItems[0]);
  });

  it("honors aria-labelledby", () => {
    const listBoxDiv = render(
      <div id="aria-label-provider" aria-label="test-div-label">
        <Listbox className="map-manager-source-list" ariaLabelledBy="aria-label-provider" >
          {
            listItems?.map((cityName) =>
              <ListboxItem key={cityName} className="map-source-list-entry" value={cityName}>
                <span className="map-source-list-entry-name" title={cityName}>{cityName}</span>
              </ListboxItem>)
          }
        </Listbox>
      </div>);
    const listBoxElement = listBoxDiv.container.querySelector("ul");
    expect(listBoxElement).not.to.be.null;
    expect(listBoxElement!.id.length).to.eq(36);
    const ariaLabeledBy = listBoxElement!.getAttribute("aria-labelledby");
    expect(ariaLabeledBy).to.eq("aria-label-provider");
  });

  it("aria-label overrides aria-labelledby", () => {
    const listBoxDiv = render(
      <div id="aria-label-provider" aria-label="test-div-label">
        <Listbox className="map-manager-source-list" ariaLabel="aria-explicit-label" ariaLabelledBy="aria-label-provider" >
          {
            listItems?.map((cityName) =>
              <ListboxItem key={cityName} className="map-source-list-entry" value={cityName}>
                <span className="map-source-list-entry-name" title={cityName}>{cityName}</span>
              </ListboxItem>)
          }
        </Listbox>
      </div>);
    // listBoxDiv.debug();
    const listBoxElement = listBoxDiv.container.querySelector("ul");
    expect(listBoxElement).not.to.be.null;
    expect(listBoxElement!.id.length).to.eq(36);
    const ariaLabeledBy = listBoxElement!.getAttribute("aria-labelledby");
    expect(ariaLabeledBy).to.be.null;
    const ariaLabel = listBoxElement!.getAttribute("aria-label");
    expect(ariaLabel).to.eq("aria-explicit-label");
  });

  it("renders without selected item or list id", () => {
    const listBox = render(
      <Listbox className="map-manager-source-list" ariaLabel="test-label" >
        {
          listItems?.map((cityName) =>
            <ListboxItem key={cityName} className="map-source-list-entry" value={cityName}>
              <span className="map-source-list-entry-name" title={cityName}>{cityName}</span>
            </ListboxItem>)
        }
      </Listbox>);
    const listBoxElement = listBox.container.querySelector("ul");
    expect(listBoxElement).not.to.be.null;
    expect(listBoxElement!.id.length).to.eq(36);
    const ariaLabel = listBoxElement!.getAttribute("aria-label");
    expect(ariaLabel).to.eq("test-label");
  });

  it("renders with selected item", () => {
    const listBox = render(
      <Listbox id="test-list" className="map-manager-source-list" selectedValue={listItems[1]} >
        {
          listItems?.map((cityName) =>
            <ListboxItem key={cityName} className="map-source-list-entry" value={cityName}>
              <span className="map-source-list-entry-name" title={cityName}>{cityName}</span>
            </ListboxItem>)
        }
      </Listbox>);

    const listBoxElement = listBox.container.querySelector("ul#test-list");
    expect(listBoxElement).not.to.be.null;
    expect(listBox.container.querySelector("ul#test-list[data-value]")).not.to.be.null;
    expect(listBox.container.querySelector(`li[data-value='${listItems[1]}']`)).not.to.be.null;
    const selectedItems = listBox.container.querySelectorAll("li[aria-selected='true']");
    expect(selectedItems.length).to.eq(1);
    const dataValue = selectedItems[0].getAttribute("data-value");
    expect(dataValue).to.eq(listItems[1]);

    fireEvent.keyDown(listBoxElement!, { key: "ArrowUp" });
    let focusedItem = listBox.container.querySelector("li.focused");
    expect(focusedItem).not.to.null;
    expect(focusedItem!.getAttribute("data-value")).to.eq(listItems[0]);

    fireEvent.keyDown(listBoxElement!, { key: "ArrowDown" });
    focusedItem = listBox.container.querySelector("li.focused");
    expect(focusedItem).not.to.null;
    expect(focusedItem!.getAttribute("data-value")).to.eq(listItems[1]);

    fireEvent.keyDown(listBoxElement!, { key: "ArrowDown" });
    focusedItem = listBox.container.querySelector("li.focused");
    expect(focusedItem).not.to.null;
    expect(focusedItem!.getAttribute("data-value")).to.eq(listItems[2]);

    // set list box selection using space key
    fireEvent.keyDown(listBoxElement!, { key: SpecialKey.Space });
    // ensure list box value is set to match
    expect(listBoxElement!.getAttribute("data-value")).to.eq(listItems[2]);

    fireEvent.keyDown(listBoxElement!, { key: "End" });
    focusedItem = listBox.container.querySelector("li.focused");
    expect(focusedItem).not.to.null;
    expect(focusedItem!.getAttribute("data-value")).to.eq(listItems[8]);

    fireEvent.keyDown(listBoxElement!, { key: "ArrowDown" });
    focusedItem = listBox.container.querySelector("li.focused");
    expect(focusedItem).not.to.null;
    expect(focusedItem!.getAttribute("data-value")).to.eq(listItems[8]);

    fireEvent.keyDown(listBoxElement!, { key: "PageDown" });
    focusedItem = listBox.container.querySelector("li.focused");
    expect(focusedItem).not.to.null;
    expect(focusedItem!.getAttribute("data-value")).to.eq(listItems[8]);

    fireEvent.keyDown(listBoxElement!, { key: "Home" });
    focusedItem = listBox.container.querySelector("li.focused");
    expect(focusedItem).not.to.null;
    expect(focusedItem!.getAttribute("data-value")).to.eq(listItems[0]);

    fireEvent.keyDown(listBoxElement!, { key: "ArrowUp" });
    focusedItem = listBox.container.querySelector("li.focused");
    expect(focusedItem).not.to.null;
    expect(focusedItem!.getAttribute("data-value")).to.eq(listItems[0]);

    fireEvent.keyDown(listBoxElement!, { key: "PageUp" });
    focusedItem = listBox.container.querySelector("li.focused");
    expect(focusedItem).not.to.null;
    expect(focusedItem!.getAttribute("data-value")).to.eq(listItems[0]);
  });

  it("renders and processed key navigation with disabled items", () => {
    const listBox = render(
      <Listbox id="test-list" className="map-manager-source-list" selectedValue={listItems[1]} >
        {
          listItems?.map((cityName, index) =>
            <ListboxItem key={cityName} className="map-source-list-entry" value={cityName} disabled={0 === index % 2}>
              <span className="map-source-list-entry-name" title={cityName}>{cityName}</span>
            </ListboxItem>)
        }
      </Listbox>);

    const listBoxElement = listBox.container.querySelector("ul#test-list");
    expect(listBoxElement).not.to.be.null;
    expect(listBox.container.querySelector("ul#test-list[data-value]")).not.to.be.null;
    expect(listBox.container.querySelector(`li[data-value='${listItems[1]}']`)).not.to.be.null;
    const selectedItems = listBox.container.querySelectorAll("li[aria-selected='true']");
    expect(selectedItems.length).to.eq(1);
    const dataValue = selectedItems[0].getAttribute("data-value");
    expect(dataValue).to.eq(listItems[1]);
    expect(selectedItems[0].className.indexOf("focused")).not.to.eq(-1);

    fireEvent.keyDown(listBoxElement!, { key: "ArrowDown" });
    let focusedItem = listBox.container.querySelector("li.focused");
    expect(focusedItem).not.to.null;
    expect(focusedItem!.getAttribute("data-value")).to.eq(listItems[3]);

    fireEvent.keyDown(listBoxElement!, { key: "ArrowDown" });
    focusedItem = listBox.container.querySelector("li.focused");
    expect(focusedItem).not.to.null;
    expect(focusedItem!.getAttribute("data-value")).to.eq(listItems[5]);

    // set list box selection using space key
    fireEvent.keyDown(listBoxElement!, { key: SpecialKey.Space });
    // ensure list box value is set to match
    expect(listBoxElement!.getAttribute("data-value")).to.eq(listItems[5]);

    fireEvent.keyDown(listBoxElement!, { key: "End" });
    focusedItem = listBox.container.querySelector("li.focused");
    expect(focusedItem).not.to.null;
    expect(focusedItem!.getAttribute("data-value")).to.eq(listItems[7]);

    fireEvent.keyDown(listBoxElement!, { key: "ArrowDown" });
    focusedItem = listBox.container.querySelector("li.focused");
    expect(focusedItem).not.to.null;
    expect(focusedItem!.getAttribute("data-value")).to.eq(listItems[7]);

    fireEvent.keyDown(listBoxElement!, { key: "PageDown" });
    focusedItem = listBox.container.querySelector("li.focused");
    expect(focusedItem).not.to.null;
    expect(focusedItem!.getAttribute("data-value")).to.eq(listItems[7]);

    fireEvent.keyDown(listBoxElement!, { key: "Home" });
    focusedItem = listBox.container.querySelector("li.focused");
    expect(focusedItem).not.to.null;
    expect(focusedItem!.getAttribute("data-value")).to.eq(listItems[1]);

    fireEvent.keyDown(listBoxElement!, { key: "ArrowUp" });
    focusedItem = listBox.container.querySelector("li.focused");
    expect(focusedItem).not.to.null;
    expect(focusedItem!.getAttribute("data-value")).to.eq(listItems[1]);

    fireEvent.keyDown(listBoxElement!, { key: "PageUp" });
    focusedItem = listBox.container.querySelector("li.focused");
    expect(focusedItem).not.to.null;
    expect(focusedItem!.getAttribute("data-value")).to.eq(listItems[1]);
  });

  it("handles key processing", () => {
    const spyOnKeyboard = sinon.spy();
    let onListboxValueChangeCalled = false;

    const onListboxValueChange = (newValue: ListboxValue) => {
      expect(newValue).to.eq(listItems[2]);
      onListboxValueChangeCalled = true;
    };

    const listBox = render(
      <Listbox id="test-list" className="map-manager-source-list" selectedValue={listItems[1]} onKeyPress={spyOnKeyboard} onListboxValueChange={onListboxValueChange} >
        {
          listItems?.map((cityName) =>
            <ListboxItem key={cityName} className="map-source-list-entry" value={cityName}>
              <span className="map-source-list-entry-name" title={cityName}>{cityName}</span>
            </ListboxItem>)
        }
      </Listbox>);

    const listBoxElement = listBox.container.querySelector("ul#test-list");

    // we should not see key events passed to external handler if handled internally
    fireEvent.keyDown(listBoxElement!, { key: "ArrowDown" });
    expect(spyOnKeyboard.notCalled);
    spyOnKeyboard.resetHistory();

    // hitting spacebar below should trigger onListboxValueChange
    expect(onListboxValueChangeCalled).to.be.false;
    fireEvent.keyDown(listBoxElement!, { key: SpecialKey.Space });
    expect(onListboxValueChangeCalled).to.be.true;
    expect(spyOnKeyboard.notCalled);
    spyOnKeyboard.resetHistory();

    fireEvent.keyDown(listBoxElement!, { key: SpecialKey.Enter });
    expect(spyOnKeyboard.calledOnce);
    spyOnKeyboard.resetHistory();

    fireEvent.keyDown(listBoxElement!, { key: "P" });
    expect(spyOnKeyboard.calledOnce);
    spyOnKeyboard.resetHistory();

  });

  it("handles click processing", () => {
    const onListboxValueChangeSpy = sinon.spy();

    const listBox = render(
      <Listbox id="test-list" className="map-manager-source-list" selectedValue={listItems[1]} onListboxValueChange={onListboxValueChangeSpy} >
        {
          listItems?.map((cityName) =>
            <ListboxItem key={cityName} className="map-source-list-entry" value={cityName}>
              <span className="map-source-list-entry-name" title={cityName}>{cityName}</span>
            </ListboxItem>)
        }
      </Listbox>);

    const listBoxElement = listBox.container.querySelector("ul#test-list");
    expect(listBoxElement).not.to.be.null;

    const listItemElement = listBoxElement!.querySelector(`li[data-value='${listItems[5]}']`);

    expect(listItemElement).not.to.be.null;
    expect(onListboxValueChangeSpy.notCalled);
    fireEvent.click(listItemElement!);
    expect(onListboxValueChangeSpy.calledOnce);
    // ensure list box value is set to match
    expect(listBoxElement!.getAttribute("data-value")).to.eq(listItems[5]);
  });

  it("renders with selected item/re-render empty selection", () => {
    const listBox = render(
      <Listbox id="test-list" className="map-manager-source-list" selectedValue={listItems[1]} >
        {
          listItems?.map((cityName) =>
            <ListboxItem key={cityName} className="map-source-list-entry" value={cityName}>
              <span className="map-source-list-entry-name" title={cityName}>{cityName}</span>
            </ListboxItem>)
        }
      </Listbox>);

    const listBoxElement = listBox.container.querySelector("ul#test-list");
    expect(listBoxElement).not.to.be.null;
    expect(listBox.container.querySelector("ul#test-list[data-value]")).not.to.be.null;
    expect(listBox.container.querySelector(`li[data-value='${listItems[1]}']`)).not.to.be.null;
    let selectedItems = listBox.container.querySelectorAll("li[aria-selected='true']");
    expect(selectedItems.length).to.eq(1);
    let dataValue = selectedItems[0].getAttribute("data-value");
    expect(dataValue).to.eq(listItems[1]);

    // re-render with a different selected value
    listBox.rerender(
      <Listbox id="test-list" className="map-manager-source-list" selectedValue={listItems[2]} >
        {
          listItems?.map((cityName) =>
            <ListboxItem key={cityName} className="map-source-list-entry" value={cityName}>
              <span className="map-source-list-entry-name" title={cityName}>{cityName}</span>
            </ListboxItem>)
        }
      </Listbox>);

    selectedItems = listBox.container.querySelectorAll("li[aria-selected='true']");
    expect(selectedItems.length).to.eq(1);
    dataValue = selectedItems[0].getAttribute("data-value");
    expect(dataValue).to.eq(listItems[2]);

    // re-render with no selected value
    listBox.rerender(
      <Listbox id="test-list" className="map-manager-source-list" selectedValue={undefined} >
        {
          listItems?.map((cityName) =>
            <ListboxItem key={cityName} className="map-source-list-entry" value={cityName}>
              <span className="map-source-list-entry-name" title={cityName}>{cityName}</span>
            </ListboxItem>)
        }
      </Listbox>);

    selectedItems = listBox.container.querySelectorAll("li[aria-selected='true']");
    expect(selectedItems.length).to.eq(0);
  });
});
