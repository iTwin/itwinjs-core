/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as enzyme from "enzyme";
import { createStore, Store } from "redux";
import * as sinon from "sinon";
import { fireEvent, prettyDOM } from "@testing-library/react";
import { expect } from "chai";

import { ContentLayoutProps, PrimitiveValue, PropertyDescription, PropertyEditorInfo, PropertyRecord, PropertyValueFormat, StandardContentLayouts, StandardTypeNames } from "@itwin/appui-abstract";
import { UiStateStorage, UiStateStorageResult, UiStateStorageStatus } from "@itwin/core-react";

import {
  ActionsUnion, combineReducers, ContentGroup, createAction, DeepReadonly, FrameworkReducer,
  FrameworkState, UiFramework,
} from "../appui-react";
import { TestContentControl } from "./frontstage/FrontstageTestUtils";
import userEvent from "@testing-library/user-event";
import { InternalSyncUiEventDispatcher } from "../appui-react/syncui/InternalSyncUiEventDispatcher";
export {userEvent};

/* eslint-disable deprecation/deprecation */

interface SampleAppState {
  placeHolder?: boolean;
}

const initialState: SampleAppState = {
  placeHolder: false,
};

/** */
export interface RootState {
  sampleAppState: SampleAppState;
  testDifferentFrameworkKey?: FrameworkState;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const SampleAppActions = {
  // eslint-disable-next-line jsdoc/require-jsdoc
  example: () => createAction("SampleApp:EXAMPLE"),
};

/** @internal */
export type SampleAppActionsUnion = ActionsUnion<typeof SampleAppActions>;

function SampleAppReducer(state: SampleAppState = initialState, action: SampleAppActionsUnion): DeepReadonly<SampleAppState> {
  switch (action.type) {
    case "SampleApp:EXAMPLE": {
      return { ...state, placeHolder: true };
    }
  }

  return state;
}

/** @internal */
export class TestUtils {
  private static _uiFrameworkInitialized = false;
  public static store: Store<RootState>;

  private static _rootReducer: any;

  public static async initializeUiFramework(testAlternateKey = false) {
    if (!TestUtils._uiFrameworkInitialized) {
      if (testAlternateKey) {
        // this is the rootReducer for the test application.
        this._rootReducer = combineReducers({
          sampleAppState: SampleAppReducer,
          testDifferentFrameworkKey: FrameworkReducer,
        });

      } else {
        // this is the rootReducer for the test application.
        this._rootReducer = combineReducers({
          sampleAppState: SampleAppReducer,
          frameworkState: FrameworkReducer,
        });
      }

      this.store = createStore(this._rootReducer,
        (window as any).__REDUX_DEVTOOLS_EXTENSION__ && (window as any).__REDUX_DEVTOOLS_EXTENSION__());

      if (testAlternateKey)
        await UiFramework.initialize(this.store, "testDifferentFrameworkKey");
      else
        await UiFramework.initialize(this.store);

      TestUtils._uiFrameworkInitialized = true;
    }
    UiFramework.toolSettings.clearToolSettingsData();
    InternalSyncUiEventDispatcher.setTimeoutPeriod(0); // disables non-immediate event processing.
  }

  public static terminateUiFramework() {
    UiFramework.terminate();
    TestUtils._uiFrameworkInitialized = false;
  }

  /** Define Content Layouts referenced by Frontstages. */
  public static fourQuadrants: ContentLayoutProps = {
    id: "FourQuadrants",
    description: "SampleApp:ContentLayoutDef.FourQuadrants",
    horizontalSplit: {
      id: "FourQuadrants.MainHorizontal",
      percentage: 0.50,
      top: { verticalSplit: { id: "FourQuadrants.TopVert", percentage: 0.50, left: 0, right: 1 } },
      bottom: { verticalSplit: { id: "FourQuadrants.BottomVert", percentage: 0.50, left: 2, right: 3 } },
    },
  };

  /** Define Content Groups referenced by Frontstages. */
  public static TestContentGroup1 = new ContentGroup({
    id: "TestContentGroup1",
    layout: StandardContentLayouts.fourQuadrants,
    contents: [
      {
        id: "test:TestContentControl1",
        classId: TestContentControl,
        applicationData: { label: "Content 1a", bgColor: "black" },
      },
      {
        id: "test:TestContentControl2",
        classId: TestContentControl,
        applicationData: { label: "Content 2a", bgColor: "black" },
      },
      {
        id: "test:TestContentControl3",
        classId: TestContentControl,
        applicationData: { label: "Content 3a", bgColor: "black" },
      },
      {
        id: "test:TestContentControl4",
        classId: TestContentControl,
        applicationData: { label: "Content 4a", bgColor: "black" },
      },
    ],
  });

  public static TestContentGroup2 = new ContentGroup({
    id: "TestContentGroup2",
    layout: StandardContentLayouts.singleView,
    contents: [
      {
        id: "test:TestContentControl2",
        classId: TestContentControl,
        applicationData: { label: "Content 1a", bgColor: "black" },
      },
    ],
  });

  /** Waits until all async operations finish */
  public static async flushAsyncOperations() {
    return new Promise((resolve) => setTimeout(resolve));
  }

  public static createBubbledEvent(type: string, props = {}) {
    const event = new Event(type, { bubbles: true });
    Object.assign(event, props);
    return event;
  }

  public static createPrimitiveStringProperty(name: string, rawValue: string, displayValue: string = rawValue.toString(), editorInfo?: PropertyEditorInfo) {
    const value: PrimitiveValue = {
      displayValue,
      value: rawValue,
      valueFormat: PropertyValueFormat.Primitive,
    };

    const description: PropertyDescription = {
      displayLabel: name,
      name,
      typename: StandardTypeNames.String,
    };

    if (editorInfo)
      description.editor = editorInfo;

    const property = new PropertyRecord(value, description);
    property.isReadonly = false;
    return property;
  }

}

// cSpell:ignore testuser mailinator saml

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

/** @internal */
export class UiStateStorageStub implements UiStateStorage {
  public async deleteSetting(): Promise<UiStateStorageResult> {
    return {
      status: UiStateStorageStatus.Success,
      setting: {},
    };
  }

  public async getSetting(): Promise<UiStateStorageResult> {
    return {
      status: UiStateStorageStatus.NotFound,
      setting: {},
    };
  }

  public async saveSetting(): Promise<UiStateStorageResult> {
    return {
      status: UiStateStorageStatus.Success,
      setting: {},
    };
  }
}

/** Stubs requestAnimationFrame. */
export function stubRaf() {
  const raf = window.requestAnimationFrame;
  const caf = window.cancelAnimationFrame;

  before(() => {
    window.requestAnimationFrame = (cb: FrameRequestCallback) => {
      return window.setTimeout(cb, 0);
    };
    window.cancelAnimationFrame = (handle: number) => {
      window.clearTimeout(handle);
    };
  });

  after(() => {
    window.requestAnimationFrame = raf;
    window.cancelAnimationFrame = caf;
  });
}

/** @internal */
export type ReactWrapper<C extends React.Component, P = C["props"], S = C["state"]> = enzyme.ReactWrapper<P, S, C>;

declare module "sinon" {
  interface SinonStubStatic {
    // eslint-disable-next-line @typescript-eslint/prefer-function-type
    <T extends (...args: any) => any>(): sinon.SinonStub<Parameters<T>, ReturnType<T>>;
  }
}

/** Enzyme mount with automatic unmount after the test. */
export const mount: typeof enzyme.mount = (global as any).enzymeMount;

/** Get a iTwinUI Button with a given label */
export function getButtonWithText(container: HTMLElement, label: string, onError?: (msg: string) => void): Element | undefined {
  const selector = "button.iui-button";
  const buttons = container.querySelectorAll(selector);
  if (buttons.length <= 0)
    onError && onError(`Couldn't find any '${selector}' buttons`);

  const button = [...buttons].find((btn) => {
    const span = btn.querySelector("span.iui-button-label");
    return span!.textContent === label;
  });
  if (!button)
    onError && onError(`No button found with '${label}' label`);

  return button;
}

/**
 * Select component pick value using index
 */
export const selectChangeValueByIndex = (select: HTMLElement, index: number, onError?: (msg: string) => void): void => {
  fireEvent.click(select.querySelector(".iui-select-button") as HTMLElement);
  const tippy = select.ownerDocument.querySelector("[data-tippy-root]") as HTMLElement;
  const menu = tippy.querySelector(".iui-menu") as HTMLUListElement;
  if (!menu)
    onError && onError(`Couldn't find menu`);
  expect(menu).to.exist;

  const menuItem = menu.querySelectorAll("li");
  if (menuItem[index] === undefined)
    onError && onError(`Couldn't find menu item ${index}`);
  expect(menuItem[index]).to.not.be.undefined;

  fireEvent.click(menuItem[index]);
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

/**
 * Select component test number of options
 */
export const selectTestOptionCount = (select: HTMLElement, expectedCount: number, onError?: (msg: string) => void): void => {
  fireEvent.click(select.querySelector(".iui-select-button") as HTMLElement);
  const tippy = select.ownerDocument.querySelector("[data-tippy-root]") as HTMLElement;
  const menu = tippy.querySelector(".iui-menu") as HTMLUListElement;
  if (!menu)
    onError && onError(`Couldn't find menu`);
  expect(menu).to.exist;

  const menuItems = menu.querySelectorAll("li span.iui-content");
  if (menuItems.length <= 0)
    onError && onError(`Couldn't find any menu items`);

  expect(menuItems.length).to.eq(expectedCount);

  fireEvent.click(select.querySelector(".iui-select-button") as HTMLElement);
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

/** Returns tag, id and classes of the information used by CSS selectors */
function getPartialSelctorInfo(e: HTMLElement) {
  return `${e.tagName}${e.id ? `#${e.id}`: ""}${Array.from(e.classList.values()).map((c) => `.${c}`).join("")}`;
}

/** Returns the full list of classes and tag chain for an element up to HTML */
function currentSelectorInfo(e: HTMLElement) {
  let w = e;
  const chain = [getPartialSelctorInfo(w)];
  while(w.parentElement) {
    w = w.parentElement;
    chain.unshift(getPartialSelctorInfo(w));
  }
  return chain.join(" > ");
}

/**
 * Function to generate a `satisfy` function and the relevant error message.
 * @param selectors selector string used in `matches`
 * @returns satisfy function which returns `tested.matches(selectors)`
 */
export function selectorMatches(selectors: string) {
  const satisfier = (e: HTMLElement) => {
    // \b\b\b... removes default "[Function : " part to get clear message in output.
    const message = `\b\b\b\b\b\b\b\b\b\b\belement.matches('${selectors}'); current element selector: '${currentSelectorInfo(e)}'\n\n${prettyDOM()}`;
    Object.defineProperty(satisfier, "name",  {value: message});
    return e.matches(selectors);
  };
  return satisfier;
}

/**
 * Function to generate a `satisfy` function and the relevant error message.
 * @param selectors selector string used in `querySelector` of the element tested.
 * @returns satisfy function which returns `!!tested.querySelector(selectors)`
 */
export function childStructure(selectors: string) {
  const satisfier = (e: HTMLElement) => {
    // \b\b\b... removes default "[Function : " part to get clear message in output.
    const message = `\b\b\b\b\b\b\b\b\b\b\belement.querySelector('${selectors}'); but is: \n${prettyDOM(e)}`;
    Object.defineProperty(satisfier, "name", {value: message});
    return !!e.querySelector(selectors);
  };
  return satisfier;
}

/**
 * **WARNING:** THIS DO NOT TEST `INTERNAL` IMPLEMENTATION **AT ALL**, ONLY THAT IT IS CALLED.
 *
 * Used for Manager classes that have a 1-1 Internal implementation, that should directly call the
 * internal implementation.
 * @param tested *Manager class with statics
 * @param internal Internal*Manager class (with statics)
 * @returns [methodValidator, propValidator]
 */
export function createStaticInternalPassthroughValidators<P extends Object>(tested: P, internal: any) {
  type CallableOnly<Src> = {
    [Prop in keyof Src as Src[Prop] extends (...args: any[]) => any ? Prop : never]: Src[Prop];
  };
  type C = CallableOnly<P>;

  /**
   * `method` will be mocked on the `internal` class and called on the `tested` class, then validates that the
   * internal method was called with the same arguments.
   * ```
   * sinon.stub(internal, method);
   * tested[method](...args);
   * expect(internal[method]).was.calledOnceWithExactly(...args);
   * ```
   * When a tuple `method` is provided, the first one will be used on the tested class, the second one on the internal.
   * ```
   * sinon.stub(internal, method[1]);
   * tested[method[0]](...args);
   * expect(internal[method[1]]).was.calledOnceWithExactly(...args);
   * ```
   * @param method Name of the method to test (only callable member will show up)
   * @param args List of arguments that the method expects (type do not really matter, only the number of items does)
   */
  function methodValidator<T extends keyof C>(method: T | [T, string], ...args: C[T] extends (...args: any[]) => any ? Parameters<C[T]> : never) {
    const [tMethod, iMethod] = Array.isArray(method) ? method : [method, method];
    sinon.stub(internal, iMethod);
    (tested as any)[tMethod](...args);
    expect(internal[iMethod], `Method ${String(iMethod)} was not called once on the internal class.`).to.have.been.calledOnceWithExactly(...args);
  }

  type PropOnly<Src> = {
    [Prop in keyof Src as Src[Prop] extends (...args: any[]) => any ? never : Prop]: Src[Prop];
  };
  type G = PropOnly<P>;
  /**
   * Stub the getter on the `internal` class to return a `Symbol` and validate that calling the `tested`
   * will return the Symbol (regardless of actual type, tested class should NOT validate anyway);
   * ```
   * const returned = Symbol();
   * sinon.stub(internal, prop).get(() => returned);
   * expect(tested[prop]).to.eq(returned);
   * ```
   * When a tuple `prop` is provided, the first one will be used on the tested class, the second one on the internal.
   * ```
   * const returned = Symbol();
   * sinon.stub(internal, prop[1]).get(() => returned);
   * expect(tested[prop[0]]).to.eq(returned);
   * ```
   * When `readWrite` is `true`, will also stub the setter and validate that passing a different
   * `Symbol` to the tested will be also passed to the setter
   * ```
   * const symbol = Symbol();
   * const setter = sinon.spy();
   * sinon.stub(internal.prop).set(setter);
   * tested[prop] = symbol;
   * expect(setter).to.have.beenCalledOnceWithExactly(symbol);
   * ```
   * @param prop Name of the property to test (only non callable member will show up)
   * @param readWrite Type of property defaults to onlyGet (getter, getter and setter, or direct property)
   */
  function getterValidator<T extends keyof G>(prop: T | [T, string], readWrite = false) {
    const [tProp, iProp] = Array.isArray(prop) ? prop : [prop, prop];
    const returned = Symbol("returnedValue");
    const setValue = Symbol("setValue") as any;
    const setter = sinon.spy();
    sinon.stub(internal, iProp).get(() => returned).set(setter);
    expect((tested as any)[tProp]).to.eq(returned);

    if (readWrite) {
      (tested as any)[tProp] = setValue;
      expect(setter, `Internal setter ${String(iProp)} was not called.`).to.have.been.calledOnceWithExactly(setValue);
    }
  }

  return [methodValidator, getterValidator] as [typeof methodValidator, typeof getterValidator];
}

export default TestUtils;   // eslint-disable-line: no-default-export
