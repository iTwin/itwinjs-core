/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "@itwin/core-bentley";
import { IModelApp, Viewport } from "@itwin/core-frontend";

// cspell:ignore simpleicon

export interface ToolButtonProps {
  iconUnicode: string;
  click: (ev: Event) => void;
  tooltip?: string;
}

const createTestAppIcon = (iconUnicode: string) => {
  const icon = IModelApp.makeHTMLElement("span", { innerText: iconUnicode });
  icon.style.fontFamily = "Display-Test-App-Icons";
  icon.style.fontSize = "35px";
  return icon;
};

export function createToolButton(props: ToolButtonProps) {
  const icon = createTestAppIcon(props.iconUnicode);
  const div = IModelApp.makeHTMLElement("div", { className: "simpleicon" });

  div.addEventListener("click", (ev: Event) => props.click(ev));
  if (undefined !== props.tooltip)
    div.title = props.tooltip;

  div.appendChild(icon);
  return div;
}

export interface ImageButtonProps {
  src: string;
  tooltip?: string;
  click: (ev: Event) => void;
}

export function createImageButton(props: ImageButtonProps) {
  const img = IModelApp.makeHTMLElement("img", { className: "simpleicon" });
  img.src = props.src;
  if (undefined !== props.tooltip)
    img.title = props.tooltip;
  img.addEventListener("click", (ev: Event) => props.click(ev));
  return img;
}

export abstract class ToolBarDropDown {
  protected _isPinned: boolean = false;

  public get onViewChanged(): Promise<void> | undefined { return undefined; }

  protected abstract _open(): void;
  protected abstract _close(): void;
  public dispose(): void { }

  public abstract get isOpen(): boolean;

  public open(): void {
    if (!this.isOpen)
      this._open();
  }

  public close(): boolean {
    if (this.isOpen && !this._isPinned) {
      this._close();
      return true;
    }
    return false;
  }

  public togglePinnedState(): void {
    this._isPinned = !this._isPinned;
  }
}

export type CreateToolBarDropDown = (parent: HTMLElement) => Promise<ToolBarDropDown>;

export interface ToolBarDropDownProps {
  iconUnicode: string;
  createDropDown: CreateToolBarDropDown;
  tooltip?: string;
  only3d?: boolean;
}

class DropDown {
  public readonly element: HTMLDivElement;
  private readonly _createDropDown: CreateToolBarDropDown;
  public dropDown?: ToolBarDropDown;
  public readonly only3d: boolean;

  public constructor(toolBar: ToolBar, index: number, props: ToolBarDropDownProps) {
    this.element = IModelApp.makeHTMLElement("div", { parent: toolBar.element, className: "simpleicon" });
    this._createDropDown = props.createDropDown;
    this.only3d = true === props.only3d;

    const icon = createTestAppIcon(props.iconUnicode);
    icon.addEventListener("click", () => {
      toolBar.toggle(index); // eslint-disable-line @typescript-eslint/no-floating-promises
    });

    if (undefined !== props.tooltip)
      this.element.title = props.tooltip;

    this.element.appendChild(icon);
  }

  public dispose(): void {
    if (this.dropDown) {
      this.dropDown.dispose();
      this.dropDown = undefined;
    }
  }

  public async createDropDown(): Promise<ToolBarDropDown> {
    return this._createDropDown(this.element);
  }
}

export class ToolBar {
  public readonly element: HTMLElement;
  private readonly _dropDowns: DropDown[] = [];
  private _currentlyOpen: Set<number> = new Set<number>();

  public constructor(container: HTMLElement) {
    this.element = container;
  }

  public dispose(): void {
    for (const dd of this._dropDowns)
      dd.dispose();

    this._dropDowns.length = 0;
    this._currentlyOpen.clear();
  }

  public addDropDown(props: ToolBarDropDownProps): void {
    this._dropDowns.push(new DropDown(this, this._dropDowns.length, props));
  }

  public addItem(item: HTMLElement): void {
    this.element.appendChild(item);
  }

  public close(): void {
    for (const currentlyOpen of this._currentlyOpen) {
      const item = this._dropDowns[currentlyOpen];
      assert(undefined !== item.dropDown);
      assert(item.dropDown.isOpen);

      const closeSuccess = item.dropDown.close();
      if (closeSuccess)
        this._currentlyOpen.delete(currentlyOpen);
    }
  }

  public async open(index: number): Promise<void> {
    if (this._currentlyOpen.has(index))
      return;

    this.close();
    const item = this._dropDowns[index];
    if (undefined === item.dropDown)
      item.dropDown = await item.createDropDown();
    else
      item.dropDown.open();

    this._currentlyOpen.add(index);
  }

  public async toggle(index: number): Promise<void> {
    if (this._currentlyOpen.has(index))
      this.close();
    else
      await this.open(index);
  }

  public async onViewChanged(vp: Viewport): Promise<void> {
    this.close();

    const promises: Array<Promise<void>> = [];
    for (const item of this._dropDowns) {
      if (item.only3d)
        item.element.style.display = vp.view.is3d() ? "block" : "none";

      if (undefined !== item.dropDown) {
        const promise = item.dropDown.onViewChanged;
        if (undefined !== promise)
          promises.push(promise);
      }
    }

    await Promise.all(promises);
  }
}
