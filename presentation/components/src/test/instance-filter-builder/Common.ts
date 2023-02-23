/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { createTestCategoryDescription, createTestPropertiesContentField, createTestPropertyInfo } from "@itwin/presentation-common/lib/cjs/test";
import { InstanceFilterPropertyInfo } from "../../presentation-components/instance-filter-builder/Utils";

/**
 * Stubs global 'requestAnimationFrame' and 'cancelAnimationFrame' functions.
 * This is needed for tests using 'react-select' component.
 */
export function stubRaf() {
  const raf = global.requestAnimationFrame;
  const caf = global.cancelAnimationFrame;

  before(() => {
    Object.defineProperty(global, "requestAnimationFrame", {
      writable: true,
      value: (cb: FrameRequestCallback) => {
        return setTimeout(cb, 0);
      },
    });
    Object.defineProperty(global, "cancelAnimationFrame", {
      writable: true,
      value: (handle: number) => {
        clearTimeout(handle);
      },
    });
  });

  after(() => {
    Object.defineProperty(global, "requestAnimationFrame", {
      writable: true,
      value: raf,
    });
    Object.defineProperty(global, "cancelAnimationFrame", {
      writable: true,
      value: caf,
    });
  });
}

export const createTestInstanceFilterPropertyInfo = (props?: Partial<InstanceFilterPropertyInfo>) => ({
  sourceClassId: "0x1",
  field: createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo() }], category: createTestCategoryDescription() }),
  propertyDescription: {
    name: "TestName",
    displayLabel: "TestDisplayLabel",
    typename: "string",
  },
  className: "testSchema:testClass",
  ...props,
});
