/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Widgets
 */

import { IModelApp, MessageBoxIconType, MessageBoxType, ParseAndRunResult } from "@itwin/core-frontend";
import { createButton } from "../ui/Button";
import type { DataList, DataListEntry } from "../ui/DataList";
import { appendDataListEntries, createDataList } from "../ui/DataList";
import type { TextBox } from "../ui/TextBox";
import { createTextBox } from "../ui/TextBox";

function keyinsToDataListEntries(keyins: string[]): DataListEntry[] {
  const entries: DataListEntry[] = [];
  for (const keyin of keyins) {
    entries.push({ value: keyin });
  }

  return entries;
}

/** Controls whether localized and/or non-localized key-in strings appear in a KeyinField's auto-completion list.
 * @beta
 */
export enum KeyinFieldLocalization {
  /** Include only non-localized key-in strings. */
  NonLocalized,
  /** Include only localized key-in strings. */
  Localized,
  /** Include localized and non-localized strings for each key-in. */
  Both,
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
  /** Controls whether localized and/or non-localized keyin strings appear in the autocompletion list.
   * Note: the KeyinField will still accept either localized or non-localized strings; this option only controls what is displayed in the auto-completion list.
   * Default: non-localized
   */
  localization?: KeyinFieldLocalization;
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
  private readonly _localization: KeyinFieldLocalization;

  public constructor(props: KeyinFieldProps) {
    this._localization = props.localization ?? KeyinFieldLocalization.NonLocalized;
    this.keyins = this.findKeyins();
    const autoCompleteListId = `${props.baseId}_autoComplete`;
    this.autoCompleteList = createDataList({
      parent: props.parent,
      entries: keyinsToDataListEntries(this.keyins),
      id: autoCompleteListId,
      inline: true,
    });

    this.textBox = createTextBox({
      label: props.wantLabel ? "Key-in: " : undefined,
      id: `${props.baseId}_textBox`,
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
      this.textBox.textbox.onkeydown = (ev) => this.handleKeyDown(ev); // eslint-disable-line @typescript-eslint/promise-function-async
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
      return;

    // NB: History list is ordered by most to least recent so moving "backwards" means incrementing the index.
    const direction = ev.key === "ArrowDown" ? 1 : (ev.key === "ArrowUp" ? 1 : 0);
    if (0 === direction)
      return;

    ev.preventDefault();
    ev.stopPropagation();

    if (this._historyIndex === undefined) {
      if (direction < 0)
        return;
      else
        this._historyIndex = -1;
    }

    const newIndex = this._historyIndex + direction;
    if (newIndex >= 0 && newIndex < this._history.length) {
      this._historyIndex = newIndex;
      if (this._historyIndex >= 0)
        this.textBox.textbox.value = this._history[newIndex];
    }
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

    const input = textBox.value;
    this.pushHistory(input);

    let message: string | undefined;
    try {
      switch (await IModelApp.tools.parseAndRun(input)) {
        case ParseAndRunResult.ToolNotFound:
          message = `Cannot find a key-in that matches: ${input}`;
          break;
        case ParseAndRunResult.BadArgumentCount:
          message = "Incorrect number of arguments";
          break;
        case ParseAndRunResult.FailedToRun:
          message = "Key-in failed to run";
          break;
      }
    } catch (ex) {
      message = `Key-in produced exception: ${ex}`;
    }

    if (undefined !== message)
      await IModelApp.notifications.openMessageBox(MessageBoxType.MediumAlert, message, MessageBoxIconType.Warning);
  }

  private respondToKeyinFocus() {
    this.resetHistoryIndex();

    // Handle case in which new tools were registered since we last populated the auto-complete list.
    // This can occur e.g. as a result of loading a extension, or deferred initialization of a package like markup.
    const keyins = this.findKeyins();
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

  private findKeyins(): string[] {
    const keyins: string[] = [];
    const tools = IModelApp.tools.getToolList();
    for (const tool of tools) {
      switch (this._localization) {
        case KeyinFieldLocalization.Localized:
          keyins.push(tool.keyin);
          break;
        case KeyinFieldLocalization.Both:
          keyins.push(tool.keyin);
          if (tool.keyin === tool.englishKeyin)
            break;
        /* falls through */
        default:
        case KeyinFieldLocalization.NonLocalized:
          keyins.push(tool.englishKeyin);
          break;
      }
    }

    return keyins;
  }
}
