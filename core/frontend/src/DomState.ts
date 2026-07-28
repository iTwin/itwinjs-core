/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/**
 * Snapshot of DOM/interaction state that is used to determine how we handle key strokes in ToolAdmin.
 */
export interface DomState {
  readonly activeElement: Element | undefined;
  readonly isFocusVisible: boolean;
  readonly selectedText: string | undefined;
  readonly blockingElement: Element | undefined;
  readonly isDragging: boolean;
  readonly hasPointerCapture: boolean;
  readonly isPointerLocked: boolean;
}

/**
 * Tracks the two bits of state that cannot be read synchronously from the DOM:
 * whether the user is mid-drag and whether an element holds pointer capture.
 */
export class DomInteractionTracker {
  public isDragging = false;
  public hasPointerCapture = false;

  private readonly _onPointerDown = (e: PointerEvent): void => {
    if (e.button === 0) {
      this.isDragging = true;
    }
  };

  private readonly _onPointerEnd = (): void => {
    this.isDragging = false;
  };

  private readonly _onGotCapture = (): void => {
    this.hasPointerCapture = true;
  };

  private readonly _onLostCapture = (): void => {
    this.hasPointerCapture = false;
  };

  attach(): void {
    document.addEventListener("pointerdown", this._onPointerDown, true);
    document.addEventListener("pointerup", this._onPointerEnd, true);
    document.addEventListener("pointercancel", this._onPointerEnd, true);
    document.addEventListener("gotpointercapture", this._onGotCapture, true);
    document.addEventListener("lostpointercapture", this._onLostCapture, true);
  }

  detach(): void {
    document.removeEventListener("pointerdown", this._onPointerDown, true);
    document.removeEventListener("pointerup", this._onPointerEnd, true);
    document.removeEventListener("pointercancel", this._onPointerEnd, true);
    document.removeEventListener("gotpointercapture", this._onGotCapture, true);
    document.removeEventListener("lostpointercapture", this._onLostCapture, true);
  }
}

export namespace DomState {
  export function captureDomState(tracker: DomInteractionTracker): DomState {
    const active = document.activeElement ?? undefined;

    return {
      activeElement: active === document.body ? undefined : active,
      isFocusVisible: active?.matches(":focus-visible") ?? false,
      selectedText: window.getSelection()?.toString() || undefined,
      blockingElement: document.querySelector("dialog:modal, [aria-modal=\"true\"]:not([hidden])") ?? undefined,
      isDragging: tracker.isDragging,
      hasPointerCapture: tracker.hasPointerCapture,
      isPointerLocked: document.pointerLockElement !== null,
    };
  }

  /**
   * True when the focused element accepts text input.
   */
  export function isEditable(element: Element): boolean {
    if (element.tagName === "TEXTAREA")
      return true;

    if (element.tagName === "INPUT" && textInputTypes.has((element as HTMLInputElement).type))
      return true;

    const contentEditable = element.getAttribute("contenteditable");
    if (contentEditable === "true" || contentEditable === "")
      return true;

    const role = element.getAttribute("role");

    return role === "textbox" || role === "searchbox" || role === "spinbutton";
  }

  /**
   * True when Enter/Space would natively activate the focused element (button, link, checkbox...).
   */
  export function isActivatable(element: Element, key: string): boolean {
    const role = element.getAttribute("role") ?? "";
    if (key === "Enter") {
      if (enterTags.has(element.tagName))
        return true;

      if (element.tagName === "A" && element.hasAttribute("href"))
        return true;

      if (element.tagName === "INPUT" && enterInputTypes.has((element as HTMLInputElement).type))
        return true;

      return enterRoles.has(role);
    }

    if (key === " ") {
      if (element.tagName === "BUTTON")
        return true;

      if (element.tagName === "INPUT" && spaceInputTypes.has((element as HTMLInputElement).type))
        return true;

      return spaceRoles.has(role);
    }

    return false;
  }

  /**
   * True when focus is inside a composite widget that uses type-ahead (typing letters navigates it, e.g. drop down menu).
   */
  export function isInsideTypeAheadWidget(element: Element): boolean {
    if (element.tagName === "SELECT")
      return true;

    for (let current: Element | null = element; current; current = current.parentElement) {
      if (typeAheadRoles.has(current.getAttribute("role") ?? ""))
        return true;
    }

    return false;
  }

  /**
   * True when key is a navigation key claimed by the focused element or one of its ancestors.
   */
  export function isNavigationClaimed(element: Element, key: string): boolean {
    if (element.tagName === "INPUT" && (element as HTMLInputElement).type === "radio" && radioArrowKeys.has(key))
      return true;

    for (let current: Element | null = element; current; current = current.parentElement) {
      if (ariaNavigationKeys[current.getAttribute("role") ?? ""]?.has(key))
        return true;
    }

    return false;
  }

  /**
   * True if key is one of Ctrl/Cmd + C/X/V/A/Z/Y.
   */
  export function isNativeTextEditingShortcut(event: KeyboardEvent): boolean {
    if (!event.ctrlKey && !event.metaKey)
      return false;

    return ["c", "x", "v", "a", "z", "y"].includes(event.key.toLowerCase());
  }
}

const textInputTypes = new Set([
  "text", "search", "email", "url", "tel", "password",
  "number", "date", "datetime-local", "month", "week", "time",
]);
const enterTags = new Set(["BUTTON", "SUMMARY"]);
const enterRoles = new Set(["menuitem", "treeitem", "option", "tab", "combobox", "gridcell", "row"]);
const enterInputTypes = new Set(["submit", "reset", "button", "image", "color", "file"]);
const spaceRoles = new Set(["button", "menuitem", "option", "tab", "checkbox", "switch", "radio", "combobox"]);
const spaceInputTypes = new Set(["checkbox", "radio", "submit", "reset", "button", "image", "color", "file"]);
const typeAheadRoles = new Set(["listbox", "tree", "menu", "menubar", "grid", "treegrid", "combobox", "toolbar", "accordion"]);
const ariaNavigationKeys: Record<string, ReadonlySet<string>> = {
  radiogroup: new Set(["ArrowUp", "ArrowDown"]),
  tablist: new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"]),
  slider: new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"]),
  accordion: new Set(["ArrowUp", "ArrowDown", "Home", "End"]),
  toolbar: new Set(["ArrowLeft", "ArrowRight"]),
  listbox: new Set(["ArrowUp", "ArrowDown", "Home", "End", "Escape"]),
  menu: new Set(["ArrowUp", "ArrowDown", "Home", "End", "Escape"]),
  menubar: new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"]),
  tree: new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"]),
  combobox: new Set(["ArrowUp", "ArrowDown", "Escape"]),
  grid: new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"]),
  treegrid: new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"]),
  spinbutton: new Set(["ArrowUp", "ArrowDown", "Home", "End"]),
  dialog: new Set(["Escape"]),
};
const radioArrowKeys = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);
