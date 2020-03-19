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
  DialogItemSyncArgs,
  DialogItemValue,
  DialogRow,
  DialogPropertySyncItem,
  PropertyEditorParamTypes,
  PropertyDescription,
  SuppressLabelEditorParams } from "../../ui-abstract";
import { PrimitiveValue } from "../../ui-abstract/properties/Value";

const value1: DialogItemValue = { value: 3 };
const value2: DialogItemValue = { value: 10 };
const lockValue: DialogItemValue = { value: true };
const buttonGroupValue: DialogItemValue = { value: "One" };

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

const lockItem: DialogItem = {value: lockValue, property: getLockToggleDescription(), editorPosition: {rowPriority: 0, columnIndex: 0}};
const item1: DialogItem = {value: value1, property: getItem1Description(), editorPosition: {rowPriority: 0, columnIndex: 1}, lockProperty: lockItem};
const item2: DialogItem = {value: value2, property: getItem2Description(), editorPosition: {rowPriority: 0, columnIndex: 2}, isDisabled: true};
const buttonGroupItem: DialogItem = {value: buttonGroupValue, property: getButtonGroupItemDescription(), editorPosition: {rowPriority: 1, columnIndex: 0}};
const dialogItems: DialogItem[] = [item1, item2, buttonGroupItem];

describe("DialogItemsManager", () => {
  describe("isToolSettingsManager", () => {
    it("should not be a tool settings manager", () => {
      const sut = new DialogItemsManager();
      expect(sut.isToolSettingsManager()).to.be.false;
    });
  });
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
    it("should raise onPropertiesChanged event when new items are set", () => {
      const sut = new DialogItemsManager();
      const spy = sinon.spy();
      sut.onPropertiesChanged.addListener(spy);

      const syncItem: DialogPropertySyncItem = { value: {value: 10}, propertyName: "myname", isDisabled: false};
      const syncEventArgs: DialogItemSyncArgs = {items: [syncItem]};
      sut.onPropertiesChanged.emit(syncEventArgs);
      spy.calledOnce.should.true;
    });
    it("should update disabled state of DialogItem", () => {
      const sut = new DialogItemsManager(dialogItems);

      const itemToUpdate = sut.items[1];
      const syncItem: DialogPropertySyncItem = { value: itemToUpdate.value, propertyName: itemToUpdate.property.name, isDisabled: true };
      const syncEventArgs: DialogItemSyncArgs = {items: [syncItem]};
      sut.updateItemProperties(syncEventArgs);
      const itemDisabled = sut.items[1].isDisabled;
      expect (itemDisabled).to.be.true;
    });
    it("should update value of DialogItem", () => {
      const sut = new DialogItemsManager(dialogItems);

      const itemToUpdate = sut.items[1];
      const updateItemValue = { value: 50 };
      const syncItem: DialogPropertySyncItem = { value: updateItemValue as DialogItemValue, propertyName: itemToUpdate.property.name};
      const syncEventArgs: DialogItemSyncArgs = {items: [syncItem]};
      sut.updateItemProperties(syncEventArgs);
      const itemValue = sut.items[1].value.value;
      expect (itemValue).to.be.eq(50);
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
  describe ("property record", () => {
    it("should reflect value", () => {
      const record = DialogItemsManager.getPropertyRecord(buttonGroupItem);
      record.should.not.be.undefined;
      const primitiveValue = record.value as PrimitiveValue;
      primitiveValue.should.not.be.undefined;
      expect (primitiveValue.value).to.eq("One");
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
