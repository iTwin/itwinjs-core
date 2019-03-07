/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { assert } from "@bentley/bentleyjs-core";

export interface ToolButtonProps {
  className: string;
  click: (ev: Event) => void;
  tooltip?: string;
}

export function createToolButton(props: ToolButtonProps): HTMLElement {
  const img = document.createElement("i");
  img.className = props.className;

  const div = document.createElement("div");
  div.className = "simpleicon";
  div.addEventListener("click", (ev: Event) => props.click(ev));
  if (undefined !== props.tooltip)
    div.title = props.tooltip;

  div.appendChild(img);
  return div;
}

export interface ImageButtonProps {
  src: string;
  tooltip?: string;
  click: (ev: Event) => void;
}

export function createImageButton(props: ImageButtonProps): HTMLElement {
  const img = document.createElement("img");
  img.className = "simpleicon";
  img.src = props.src;
  if (undefined !== props.tooltip)
    img.title = props.tooltip;
  img.addEventListener("click", (ev: Event) => props.click(ev));
  return img;
}

export abstract class ToolBarDropDown {
  public get onViewChanged(): Promise<void> | undefined { return undefined; }

  protected abstract _open(): void;
  protected abstract _close(): void;

  public abstract get isOpen(): boolean;

  public open(): void {
    if (!this.isOpen)
      this._open();
  }

  public close(): void {
    if (this.isOpen)
      this._close();
  }
}

export type CreateToolBarDropDown = (parent: HTMLElement) => Promise<ToolBarDropDown>;

export interface ToolBarDropDownProps {
  className: string;
  createDropDown: CreateToolBarDropDown;
}

class DropDown {
  private readonly _element: HTMLDivElement;
  private readonly _createDropDown: CreateToolBarDropDown;
  public dropDown?: ToolBarDropDown;

  public constructor(toolBar: ToolBar, index: number, props: ToolBarDropDownProps) {
    this._element = document.createElement("div");
    this._element.className = "simpleicon";
    this._createDropDown = props.createDropDown;

    const image = document.createElement("i");
    image.className = props.className;
    image.addEventListener("click", () => {
      toolBar.toggle(index); // tslint:disable-line:no-floating-promises
    });

    this._element.appendChild(image);
    toolBar.element.appendChild(this._element);
  }

  public async createDropDown(): Promise<ToolBarDropDown> {
    return this._createDropDown(this._element);
  }
}

export class ToolBar {
  public readonly element: HTMLElement;
  private readonly _dropDowns: DropDown[] = [];
  private _currentlyOpen?: number;

  public constructor(container: HTMLElement) {
    this.element = container;
    // this.element = document.createElement("div");
    // this.element.className = "topdiv";
    // parent.appendChild(this.element);
  }

  public addDropDown(props: ToolBarDropDownProps): void {
    this._dropDowns.push(new DropDown(this, this._dropDowns.length, props));
  }

  public addItem(item: HTMLElement): void {
    this.element.appendChild(item);
  }

  public close(): void {
    if (undefined === this._currentlyOpen)
      return;

    const item = this._dropDowns[this._currentlyOpen];
    assert(undefined !== item.dropDown);
    assert(item.dropDown!.isOpen);

    item.dropDown!.close();
    this._currentlyOpen = undefined;
  }

  public async open(index: number): Promise<void> {
    if (index === this._currentlyOpen)
      return;

    this.close();
    const item = this._dropDowns[index];
    if (undefined === item.dropDown)
      item.dropDown = await item.createDropDown();
    else
      item.dropDown.open();

    this._currentlyOpen = index;
  }

  public async toggle(index: number): Promise<void> {
    if (index === this._currentlyOpen)
      this.close();
    else
      await this.open(index);

    return Promise.resolve();
  }

  public async onViewChanged(): Promise<void> {
    const promises: Array<Promise<void>> = [];
    for (const item of this._dropDowns) {
      if (undefined !== item.dropDown) {
        const promise = item.dropDown.onViewChanged;
        if (undefined !== promise)
          promises.push(promise);
      }
    }

    return Promise.all(promises).then(() => { });
  }
}
