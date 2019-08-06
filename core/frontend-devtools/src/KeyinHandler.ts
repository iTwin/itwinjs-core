/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { Viewport, IModelApp, MessageBoxType, MessageBoxIconType } from "@bentley/imodeljs-frontend";
import { createButton } from "./Button";
import { createTextBox } from "./TextBox";
import { createDataList, DataList, DataListEntry, appendDataListEntries } from "./DataList";

async function submitKeyin(textBox: HTMLInputElement) {
  textBox.setSelectionRange(0, textBox.value.length);

  const matchClass = IModelApp.tools.findExactMatch(textBox.value);
  if (matchClass === undefined) {
    await IModelApp.notifications.openMessageBox(MessageBoxType.MediumAlert,
      "Cannot find a key-in that matches: " + textBox.value,
      MessageBoxIconType.Warning);
    textBox.focus();
    return;
  }

  const keyin = new matchClass();
  let runStatus = false;
  try {
    runStatus = keyin.run();
  } catch (e) {
    await IModelApp.notifications.openMessageBox(MessageBoxType.MediumAlert,
      "Key-in caused the following exception to occur: " + e,
      MessageBoxIconType.Warning);
    textBox.focus();
  }

  if (!runStatus) {
    await IModelApp.notifications.openMessageBox(MessageBoxType.MediumAlert,
      "Key-in failed to run",
      MessageBoxIconType.Warning);
    textBox.focus();
  }
}

async function maybeSubmitKeyin(textBox: HTMLInputElement, ev: KeyboardEvent) {
  if ("Enter" === ev.key)
    await submitKeyin(textBox);
}

function respondToKeyinFocus(keyinHandler: KeyinHandler) {
  const keyins = findKeyins();
  if (keyins.length > keyinHandler.keyins.length) {
    const newKeyins: string[] = [];
    for (const keyin of keyins) {
      if (!keyinHandler.keyins.includes(keyin)) {
        newKeyins.push(keyin);
      }
    }
    if (newKeyins.length > 0) {
      appendDataListEntries(keyinHandler.autoCompleteList, keyinsToDataListEntries(newKeyins));
    }
  }
}

function findKeyins(): string[] {
  const keyins: string[] = [];
  const tools = IModelApp.tools.getToolList();
  for (const tool of tools) {
    keyins.push(tool.keyin);
  }
  return keyins;
}

function keyinsToDataListEntries(keyins: string[]): DataListEntry[] {
  const entries: DataListEntry[] = [];
  for (const keyin of keyins) {
    entries.push({ value: keyin });
  }
  return entries;
}

function keyinChanged(textBox: HTMLInputElement) {
  textBox.setSelectionRange(0, textBox.value.length);
}

/** @alpha */
export class KeyinHandler {
  public readonly autoCompleteList: DataList;
  public readonly keyins: string[];
  public readonly focus: () => void;

  public constructor(parent: HTMLElement, _vp: Viewport) {
    this.keyins = findKeyins();

    this.autoCompleteList = createDataList({
      parent,
      entries: keyinsToDataListEntries(this.keyins),
      id: "keyin_autoCompleteList",
    });

    const keyinTextBox = createTextBox({
      label: "Key-in: ",
      id: "keyin_cmdTextBox",
      parent,
      handler: keyinChanged,
      keypresshandler: async (tb, ev) => { await maybeSubmitKeyin(tb, ev); },
      focushandler: (_tb) => { respondToKeyinFocus(this); },
      tooltip: "Type the key-in text here",
      inline: true,
      list: "keyin_autoCompleteList",
    });

    createButton({
      handler: async (_bt) => { await submitKeyin(keyinTextBox.textbox); },
      id: "keyin_submitButton",
      parent,
      value: "Enter",
      inline: true,
      tooltip: "Click here to execute the key-in",
    });

    this.focus = () => {
      keyinTextBox.textbox.focus();
    };
  }

  public dispose(): void { }
}
