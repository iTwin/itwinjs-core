/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ProcessDetector } from "@itwin/core-bentley";
import { createButton, createTextBox, TextBoxProps } from "@itwin/frontend-devtools";
import { getConfigurationString } from "./DisplayTestApp";
import { ToolBarDropDown } from "./ToolBar";

export class HubPicker extends ToolBarDropDown {
  private readonly _parent: HTMLElement;
  private readonly _element: HTMLElement;
  private _iModelIdInput: HTMLInputElement | undefined;
  private _iTwinIdInput: HTMLInputElement | undefined;
  private _onOpenIModel: (iModelId: string, iTwinId: string) => void;
  private static _lastITwinId: string | undefined;
  private static _lastIModelId: string | undefined;
  private _inputWidth = 300;
  private _totalWidth = this._inputWidth + 95;

  public constructor(parent: HTMLElement, onOpenIModel: (iModelId: string, iTwinId: string) => void) {
    super();
    if (ProcessDetector.isIOSAppFrontend) {
      this._inputWidth = 255;
      this._totalWidth = this._inputWidth + 110;
    }
    this._parent = parent;
    this._onOpenIModel = onOpenIModel;
    this._element = document.createElement("div");
    this._element.className = "debugPanel";
    this._element.style.width = `${this._totalWidth}px`;
    parent.appendChild(this._element);
    if (HubPicker._lastITwinId === undefined) {
      HubPicker._lastITwinId = getConfigurationString("iTwinId");
    }
    if (HubPicker._lastIModelId === undefined) {
      HubPicker._lastIModelId = getConfigurationString("iModelId");
    }
  }

  protected _open(): void { this._element.style.display = "block"; }
  protected _close(): void { this._element.style.display = "none"; }
  public get isOpen(): boolean { return "none" !== this._element.style.display; }

  private _createTextBox(props: TextBoxProps, defaultValue: string | undefined) {
    const div = this._element.appendChild(document.createElement("div"));
    div.className = "inputDiv";
    const textbox = createTextBox({
      ...props,
      parent: div,
      inline: true,
    }).textbox;
    textbox.defaultValue = defaultValue ?? "";
    textbox.style.width = `${this._inputWidth}px`;
    textbox.style.fontFamily = "monospace";
    return textbox;
  }

  private openIModel() {
    const iModelId = this._iModelIdInput?.value;
    const iTwinId = this._iTwinIdInput?.value;
    // Note: below checks for undefined OR empty.
    if (iModelId && iTwinId) {
      HubPicker._lastITwinId = iTwinId;
      HubPicker._lastIModelId = iModelId;
      this._onOpenIModel(iModelId, iTwinId);
    } else {
      alert("You must enter an iTwinId and an iModelId");
    }
  }

  public async populate(): Promise<void> {
    this._iTwinIdInput = this._createTextBox({
      label: "iTwin Id: ",
      id: "HubPicker_iTwinId",
      tooltip: "Enter the iTwin Id of the iModel to load",
    }, HubPicker._lastITwinId);
    this._iModelIdInput = this._createTextBox({
      label: "iModel Id: ",
      id: "HubPicker_iModelId",
      tooltip: "Enter the iModel Id of the iModel to load",
    }, HubPicker._lastIModelId);
    const openIModelDiv = this._element.appendChild(document.createElement("div"));
    openIModelDiv.className = "inputDiv";
    createButton({
      parent: openIModelDiv,
      value: "Open hub iModel",
      inline: true,
      handler: () => this.openIModel(),
      tooltip: "Download and open hub iModel",
    });
  }
}
