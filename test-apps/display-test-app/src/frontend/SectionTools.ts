/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import {
  IModelApp,
  ViewClipDecorationProvider,
  Viewport,
} from "@bentley/imodeljs-frontend";
import { ToolBarDropDown } from "./ToolBar";
import { createComboBox } from "./ComboBox";
import { createButton } from "./Button";

export class SectionsPanel extends ToolBarDropDown {
  private readonly _vp: Viewport;
  private readonly _element: HTMLElement;
  private _toolName: string = "ViewClip.ByPlane";

  public constructor(vp: Viewport, parent: HTMLElement) {
    super();
    this._vp = vp;
    this._element = document.createElement("div");
    this._element.className = "toolMenu";
    this._element.style.cssFloat = "left";
    this._element.style.display = "block";

    createComboBox({
      parent: this._element,
      id: "section_Type",
      name: "Clip type: ",
      value: this._toolName,
      handler: (select: HTMLSelectElement) => this._toolName = select.value,
      entries: [
        { name: "Plane", value: "ViewClip.ByPlane" },
        { name: "Range", value: "ViewClip.ByRange" },
        { name: "Element", value: "ViewClip.ByElement" },
        { name: "Shape", value: "ViewClip.ByShape" },
      ],
    });

    const div = document.createElement("div");
    div.style.textAlign = "center";
    createButton({
      value: "Define",
      handler: () => IModelApp.tools.run(this._toolName, ViewClipDecorationProvider.create()),
      parent: div,
      inline: true,
      tooltip: "Define clip",
    });
    createButton({
      value: "Edit",
      handler: () => ViewClipDecorationProvider.create().toggleDecoration(this._vp),
      parent: div,
      inline: true,
      tooltip: "Show clip edit handles",
    });
    createButton({
      value: "Clear",
      handler: () => IModelApp.tools.run("ViewClip.Clear", ViewClipDecorationProvider.create()),
      parent: div,
      inline: true,
      tooltip: "Clear clips",
    });

    this._element.appendChild(div);
    parent.appendChild(this._element);
  }

  protected _open(): void { this._element.style.display = "block"; }
  protected _close(): void { this._element.style.display = "none"; }
  public get isOpen(): boolean { return "block" === this._element.style.display; }
}
