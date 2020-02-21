/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as sinon from "sinon";
import { expect } from "chai";

import {
  ButtonGroupEditorParams,
  DialogItemsManager,
  DialogItem,
  DialogItemValue,
  DialogRow,
  PropertyEditorParamTypes,
  PropertyValueFormat,
  PropertyDescription,
  SuppressLabelEditorParams } from "../../ui-abstract";

const value1: DialogItemValue = { valueFormat: PropertyValueFormat.Primitive, value: 3 };
const value2: DialogItemValue = { valueFormat: PropertyValueFormat.Primitive, value: 10 };
const lockValue: DialogItemValue = { valueFormat: PropertyValueFormat.Primitive, value: true };
const buttonGroupValue: DialogItemValue = { valueFormat: PropertyValueFormat.Primitive, value: "One" };

const getItem1Description = (): PropertyDescription => {
  return {
    name: "Item1",
    displayLabel: "Item One",
    typename: "number",
  };
};

const getItem2Description = (): PropertyDescription => {
  return {
    name: "Item2",
    displayLabel: "Item Two",
    typename: "number",
  };
};

const getLockToggleDescription = (): PropertyDescription => {
  return {
    name: "LockToggle",
    displayLabel: "Lock",
    typename: "boolean",
    editor: {name: "toggle"},
  };
};
const getButtonGroupItemDescription = (): PropertyDescription => {
  return {
    name: "ButtonGroupName",
    displayLabel: "",
    typename: "enum",
    editor: {
      name: "enum-buttongroup",
      params: [{
        type: PropertyEditorParamTypes.ButtonGroupData,
        buttons: [
          { iconSpec: "icon-placeholder" },
          { iconSpec: "icon-placeholder" },
          { iconSpec: "icon-placeholder" },
        ],
      } as ButtonGroupEditorParams, {
        type: PropertyEditorParamTypes.SuppressEditorLabel,
        suppressLabelPlaceholder: true,
      } as SuppressLabelEditorParams,
      ],
    },
    enum: {
      choices: [
        { label: "Choice1", value: "One" },
        { label: "Choice2", value: "Two" },
        { label: "Choice3", value: "Three" },
      ],
    },
  };
};

const lockItem: DialogItem = {value: lockValue, property: getLockToggleDescription(), itemName: "Lock Item", editorPosition: {rowPriority: 0, columnIndex: 0}};
const item1: DialogItem = {value: value1, property: getItem1Description(), itemName: "Item 1", editorPosition: {rowPriority: 0, columnIndex: 1}, lockProperty: lockItem};
const item2: DialogItem = {value: value2, property: getItem2Description(), itemName: "Item 2", editorPosition: {rowPriority: 0, columnIndex: 2}};
const buttonGroupItem: DialogItem = {value: buttonGroupValue, property: getButtonGroupItemDescription(), itemName: "Item 3", editorPosition: {rowPriority: 1, columnIndex: 0}};
const dialogItems: DialogItem[] = [item1, item2, buttonGroupItem];

describe("DialogItemsManager", () => {
  describe("items", () => {
    it("should raise onItemsChanged event when new items are set", () => {
      const sut = new DialogItemsManager();
      const spy = sinon.spy();
      sut.onItemsChanged.addListener(spy);

      sut.items = [];

      spy.calledOnce.should.true;
    });
    it("should not raise onItemsChanged event if items did not change", () => {
      const sut = new DialogItemsManager();
      const spy = sinon.spy();

      const items: DialogItemsManager["items"] = [];
      sut.items = items;

      sut.onItemsChanged.addListener(spy);
      sut.items = items;

      spy.notCalled.should.true;
    });
    it("should layout rows if items have changed", () => {
      const sut = new DialogItemsManager(dialogItems);

      sut.rows.should.not.be.empty;
    });
    it("should have items", () => {
      const sut = new DialogItemsManager(dialogItems);
      const items = sut.items;

      expect(items.length).to.eq(3);
    });
  });
  describe ("dialogItem", () => {
    it("should want label", () => {
      const wantsLabel = DialogItemsManager.editorWantsLabel (item1);
      expect (wantsLabel).to.be.true;
    });
    it("should not want label", () => {
      const wantsLabel = DialogItemsManager.editorWantsLabel (buttonGroupItem);
      expect (wantsLabel).to.be.false;
    });
    it("has lock property", () => {
      const hasLockProperty = DialogItemsManager.hasAssociatedLockProperty(item1);
      expect (hasLockProperty).to.be.true;
    });
    it("has no lock property", () => {
      const hasLockProperty = DialogItemsManager.hasAssociatedLockProperty(item2);
      expect (hasLockProperty).to.be.false;
    });
  });
  describe ("row", () => {
    it("has only button groups", () => {
      const sut = new DialogItemsManager (dialogItems);
      const row: DialogRow = sut.rows[1];
      const hasOnlyButtonGroups = DialogItemsManager.onlyContainButtonGroupEditors(row);

      expect (hasOnlyButtonGroups).to.be.true;
    });
    it("does not have only button groups", () => {
      const sut = new DialogItemsManager (dialogItems);
      const row: DialogRow = sut.rows[0];
      const hasOnlyButtonGroups = DialogItemsManager.onlyContainButtonGroupEditors(row);

      expect (hasOnlyButtonGroups).to.be.false;
    });
  });
});
