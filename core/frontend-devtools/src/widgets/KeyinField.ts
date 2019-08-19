/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { ToolType, Viewport, IModelApp, MessageBoxType, MessageBoxIconType } from "@bentley/imodeljs-frontend";
import { createButton } from "../ui/Button";
import { createTextBox } from "../ui/TextBox";
import { createDataList, DataList, DataListEntry, appendDataListEntries } from "../ui/DataList";

interface Keyin {
  tool?: ToolType;
  args: string[];
}

// ###TODO Remove this when ToolRegistry has a (better) implementation of keyin parsing.
function parseKeyin(input: string): Keyin {
  const tools = IModelApp.tools.getToolList();
  let tool: ToolType | undefined;
  const args: string[] = [];
  const findTool = (lowerKeyin: string) => tools.find((x) => x.keyin.toLowerCase() === lowerKeyin);

  // try the trivial, common case first
  tool = findTool(input.toLowerCase());
  if (undefined !== tool)
    return { tool, args };

  // Tokenize to separate keyin from arguments
  // ###TODO handle quoted arguments
  // ###TODO there's actually nothing that prevents a Tool from including leading/trailing spaces in its keyin, or sequences of more than one space...we will fail to find such tools if they exist...
  const tokens = input.split(" ").filter((x) => 0 < x.length);
  if (tokens.length <= 1)
    return { tool, args };

  // Find the longest starting substring that matches a tool's keyin.
  for (let i = tokens.length - 2; i >= 0; i--) {
    let substr = tokens[0];
    for (let j = 1; j <= i; j++) {
      substr += " ";
      substr += tokens[j];
    }

    tool = findTool(substr.toLowerCase());
    if (undefined !== tool) {
      for (let k = i + 1; k < tokens.length; k++)
        args.push(tokens[k]);

      break;
    }
  }

  return { tool, args };
}

async function submitKeyin(textBox: HTMLInputElement) {
  textBox.setSelectionRange(0, textBox.value.length);

  const outputMessage = async (msg: string) => {
    await IModelApp.notifications.openMessageBox(MessageBoxType.MediumAlert, msg, MessageBoxIconType.Warning);
    textBox.focus();
  };

  const keyin = parseKeyin(textBox.value);
  if (undefined === keyin.tool) {
    await outputMessage("Cannot find a key-in that matches: " + textBox.value);
    return;
  }

  const maxArgs = keyin.tool.maxArgs;
  if (keyin.args.length < keyin.tool.minArgs || (undefined !== maxArgs && keyin.args.length > maxArgs)) {
    await outputMessage("Incorrect number of arguments");
    return;
  }

  const tool = new keyin.tool();
  let runStatus = false;
  try {
    runStatus = keyin.args.length > 0 ? tool.parseAndRun(...keyin.args) : tool.run();
    if (!runStatus)
      await outputMessage("Key-in failed to run");
  } catch (e) {
    await outputMessage("Key-in caused the following exception to occur: " + e);
  }

}

async function maybeSubmitKeyin(textBox: HTMLInputElement, ev: KeyboardEvent) {
  if ("Enter" === ev.key)
    await submitKeyin(textBox);
}

function respondToKeyinFocus(keyinField: KeyinField) {
  const keyins = findKeyins();
  if (keyins.length > keyinField.keyins.length) {
    const newKeyins: string[] = [];
    for (const keyin of keyins) {
      if (!keyinField.keyins.includes(keyin)) {
        newKeyins.push(keyin);
      }
    }
    if (newKeyins.length > 0) {
      appendDataListEntries(keyinField.autoCompleteList, keyinsToDataListEntries(newKeyins));
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

/** A textbox allowing input of key-ins (localized tool names) combined with a drop-down that lists all registered key-ins, filtered by substring match on the current input.
 * Press `enter` or click the Enter button to run the key-in.
 * @beta
 */
export class KeyinField {
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
}
