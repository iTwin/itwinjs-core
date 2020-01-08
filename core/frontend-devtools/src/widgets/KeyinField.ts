/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @module Widgets */

import { ToolType, IModelApp, MessageBoxType, MessageBoxIconType } from "@bentley/imodeljs-frontend";
import { createButton } from "../ui/Button";
import { createTextBox, TextBox } from "../ui/TextBox";
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
  const findTool = (lowerKeyin: string) => tools.find((x) => x.keyin.toLowerCase() === lowerKeyin || x.englishKeyin.toLowerCase() === lowerKeyin);

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

/** Properties controlling how a KeyinField is created.
 * @beta
 */
export interface KeyinFieldProps {
  /** If supplied, the keyin field's elements will be added as children of this parent element. */
  parent?: HTMLElement;
  /** Required, unique ID prefix used to produce unique IDs for child elements. */
  baseId: string;
  /** Default: false. */
  wantButton?: boolean;
  /** Default: false. */
  wantLabel?: boolean;
  /** The maximum number of submitted key-ins to store in the history.
   * If greater than zero, pressing up/down while the KeyinField has focus will move backwards/forwards through the history.
   * Default: zero;
   */
  historyLength?: number;
}

/** A textbox allowing input of key-ins (localized tool names) combined with a drop-down that lists all registered key-ins, filtered by substring match on the current input.
 * Press `enter` or click the Enter button to run the key-in.
 * @beta
 */
export class KeyinField {
  /** @alpha */
  public readonly autoCompleteList: DataList;
  public readonly textBox: TextBox;
  public readonly keyins: string[];
  private _historyIndex?: number;
  private _historyLength = 0;
  private readonly _history: string[] | undefined;

  public constructor(props: KeyinFieldProps) {
    this.keyins = findKeyins();
    const autoCompleteListId = props.baseId + "_autoComplete";
    this.autoCompleteList = createDataList({
      parent: props.parent,
      entries: keyinsToDataListEntries(this.keyins),
      id: autoCompleteListId,
      inline: true,
    });

    this.textBox = createTextBox({
      label: props.wantLabel ? "Key-in: " : undefined,
      id: props.baseId + "_textBox",
      parent: props.parent,
      handler: () => this.selectAll(),
      keypresshandler: async (_tb, ev) => { await this.handleKeyPress(ev); },
      focushandler: (_tb) => { this.respondToKeyinFocus(); },
      tooltip: "Type the key-in text here",
      inline: true,
      list: autoCompleteListId,
    });

    if (props.wantButton) {
      createButton({
        handler: async (_bt) => { await this.submitKeyin(); },
        parent: props.parent,
        value: "Enter",
        inline: true,
        tooltip: "Click here to execute the key-in",
      });
    }

    if (undefined !== props.historyLength && props.historyLength > 0) {
      this.textBox.textbox.onkeydown = (ev) => this.handleKeyDown(ev);
      this._historyLength = props.historyLength;
      this._history = [];
    }
  }

  public focus() { this.textBox.textbox.focus(); }
  public loseFocus() { this.textBox.textbox.blur(); }

  public selectAll(): void {
    this.textBox.textbox.setSelectionRange(0, this.textBox.textbox.value.length);
  }

  private async handleKeyPress(ev: KeyboardEvent): Promise<void> {
    ev.stopPropagation();

    if ("Enter" === ev.key)
      await this.submitKeyin();
  }

  private async handleKeyDown(ev: KeyboardEvent): Promise<void> {
    ev.stopPropagation();

    if (undefined === this._history || 0 === this._history.length)
      return Promise.resolve();

    // NB: History list is ordered by most to least recent so moving "backwards" means incrementing the index.
    const upArrow = 38;
    const downArrow = 40;
    const direction = ev.keyCode === downArrow ? 1 : (ev.keyCode === upArrow ? 1 : 0);
    if (0 === direction)
      return Promise.resolve();

    ev.preventDefault();
    ev.stopPropagation();

    if (this._historyIndex === undefined) {
      if (direction < 0)
        return Promise.resolve();
      else
        this._historyIndex = -1;
    }

    const newIndex = this._historyIndex + direction;
    if (newIndex >= 0 && newIndex < this._history.length) {
      this._historyIndex = newIndex;
      if (this._historyIndex >= 0)
        this.textBox.textbox.value = this._history[newIndex];
    }

    return Promise.resolve();
  }

  private resetHistoryIndex(): void {
    this._historyIndex = undefined;
  }

  private pushHistory(keyin: string): void {
    if (undefined === this._history)
      return;

    this.textBox.textbox.value = "";
    this.resetHistoryIndex();
    if (this._history.length === 0 || keyin.toLowerCase() !== this._history[0].toLowerCase()) {
      this._history.unshift(keyin);
      if (this._history.length > this._historyLength)
        this._history.pop();
    }
  }

  private async submitKeyin(): Promise<void> {
    this.selectAll();
    const textBox = this.textBox.textbox;

    const outputMessage = async (msg: string) => {
      await IModelApp.notifications.openMessageBox(MessageBoxType.MediumAlert, msg, MessageBoxIconType.Warning);
      this.focus();
    };

    const input = textBox.value;
    this.pushHistory(input);

    const keyin = parseKeyin(input);
    if (undefined === keyin.tool) {
      await outputMessage("Cannot find a key-in that matches: " + input);
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

  private respondToKeyinFocus() {
    this.resetHistoryIndex();

    // Handle case in which new tools were registered since we last populated the auto-complete list.
    // This can occur e.g. as a result of loading a plugin, or deferred initialization of a package like markup.
    const keyins = findKeyins();
    if (keyins.length > this.keyins.length) {
      const newKeyins: string[] = [];
      for (const keyin of keyins)
        if (!this.keyins.includes(keyin)) {
          newKeyins.push(keyin);
          this.keyins.push(keyin);
        }

      if (newKeyins.length > 0)
        appendDataListEntries(this.autoCompleteList, keyinsToDataListEntries(newKeyins));
    }
  }
}
