/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { test, expect } from '@playwright/test';
import assert from 'assert';

test.describe("widget auto size", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    assert(baseURL);
    await page.goto(`${baseURL}?frontstage=appui-test-providers:WidgetApi`);

    await page.waitForSelector('#uifw-configurableui-wrapper');

    // Expect a title "to contain" a substring.
    await expect(page).toHaveTitle(/AppUI Standalone Test App/);
  });

  test("auto-sized floating widget should folow the cursor when undocked", async ({ page }) => {
    const frontstage = await page.locator(".uifw-widgetPanels-frontstage");

    // Widget from end section of a bottom panel.
    const tab = await page.locator("text=Layout Controls");
    const widget = await page.locator(".nz-widget-widget", { has: tab });
    const titleBarHandle = await widget.locator(".nz-handle");

    const boundingBox = await titleBarHandle.boundingBox();
    const frontstageBoundingBox = await frontstage.boundingBox();
    assert(!!boundingBox);
    assert(!!frontstageBoundingBox);
    await titleBarHandle.dragTo(frontstage, {
      // Drag top right corner of a handle.
      sourcePosition: {
        x: boundingBox.width - 30,
        y: boundingBox.height - 5,
      },
      // Drag to top right corner of a frontstage.
      targetPosition: {
        x: frontstageBoundingBox.width - 5,
        y: 5,
      },
    });

    const updatedBoundingBox = await titleBarHandle.boundingBox();
    assert(!!updatedBoundingBox);

    // Top right corner of a floating widget should render close to the top right of a frontstage.
    expect(updatedBoundingBox.x + updatedBoundingBox.width).toBeGreaterThan(frontstageBoundingBox.width - 5);
    expect(updatedBoundingBox.y).toBeLessThan(5);
  });
});
