/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { fireEvent } from "@testing-library/react";
import { expect } from "chai";
import { ITwinLocalization } from "@itwin/core-i18n";
import { UiCore } from "../core-react/UiCore";

/** @internal */
export class TestUtils {
  private static _i18n?: ITwinLocalization;
  private static _uiCoreInitialized = false;

  public static get i18n(): ITwinLocalization {
    return TestUtils._i18n!;
  }

  public static async initializeUiCore() {
    if (!TestUtils._uiCoreInitialized) {
      TestUtils._i18n = new ITwinLocalization();

      await TestUtils._i18n.initialize(["IModelJs"]);
      await UiCore.initialize(TestUtils.i18n);
      TestUtils._uiCoreInitialized = true;
    }
  }

  public static terminateUiCore() {
    UiCore.terminate();
    TestUtils._uiCoreInitialized = false;
  }

  public static createBubbledEvent(type: string, props = {}) {
    const event = new Event(type, { bubbles: true });
    Object.assign(event, props);
    return event;
  }

  /** Waits until all async operations finish */
  public static async flushAsyncOperations() {
    return new Promise((resolve) => setTimeout(resolve));
  }
}

/** @internal */
export const storageMock = () => {
  const storage: { [key: string]: any } = {};
  return {
    setItem: (key: string, value: string) => {
      storage[key] = value || "";
    },
    getItem: (key: string) => {
      return key in storage ? storage[key] : null;
    },
    removeItem: (key: string) => {
      delete storage[key];
    },
    get length() {
      return Object.keys(storage).length;
    },
    key: (i: number) => {
      const keys = Object.keys(storage);
      return keys[i] || null;
    },
  };
};

/**
 * Select component change value using text of menu item to find item
 */
export const selectChangeValueByText = (select: HTMLElement, label: string, onError?: (msg: string) => void): void => {
  fireEvent.click(select.querySelector(".iui-select-button") as HTMLElement);
  const tippy = select.ownerDocument.querySelector("[data-tippy-root]") as HTMLElement;
  const menu = tippy.querySelector(".iui-menu") as HTMLUListElement;
  if (!menu)
    onError && onError(`Couldn't find menu`);
  expect(menu).to.exist;

  const menuItems = menu.querySelectorAll("li span.iui-content");
  if (menuItems.length <= 0)
    onError && onError("Couldn't find any menu items");
  expect(menuItems.length).to.be.greaterThan(0);

  const menuItem = [...menuItems].find((span) => span.textContent === label);
  if (!menuItem)
    onError && onError(`Couldn't find menu item with '${label}' label`);
  expect(menuItem).to.not.be.undefined;

  fireEvent.click(menuItem!);
};

/** Handle an error when attempting to get an element */
export function handleError(msg: string) {
  console.log(msg); // eslint-disable-line no-console
}

/** Stubs scrollIntoView. */
export function stubScrollIntoView() {
  const originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView;
  const scrollIntoViewMock = function () { };

  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;
  });

  afterEach(() => {
    window.HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  });
}

/**
 * Extracts e.classList.values() and return as an array for expect.
 * @param e Element to get class list
 * @returns Array of classes for the element
 */
export function classesFromElement(e: Element | null | undefined) {
  // ! below is intended, we want this to throw if there is no element, so the test returns a comprehensive error.
  return Array.from(e!.classList.values());
}

export default TestUtils;   // eslint-disable-line: no-default-export
