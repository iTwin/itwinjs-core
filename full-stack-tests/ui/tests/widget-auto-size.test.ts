/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { test, expect } from '@playwright/test';
import assert from 'assert';

test.describe("widget auto size", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    assert(baseURL);
    await page.goto(baseURL);

    await page.waitForSelector('#uifw-configurableui-wrapper');

    // Expect a title "to contain" a substring.
    await expect(page).toHaveTitle(/AppUI Standalone Test App/);

    const blankConnection = page.locator("text=Blank Connection");
    await blankConnection.click();

    const homeButton = await page.locator(".nz-toolbar-button-button")
    await homeButton.click();

    const exerciseFrontstage = await page.locator("text=Exercise Widget Api");
    await exerciseFrontstage.click();
  });

  test("auto-sized floating widget should folow the cursor when undocked", async ({ page }) => {
    const frontstage = await page.locator(".uifw-widgetPanels-frontstage");

    const tab = await page.locator("text=WT-1");
    const widget = await page.locator(".nz-widget-widget", { has: tab });

    // TODO: pinning the panel. Use pre-configured stage or launch a key-in instead?
    const panel = await page.locator(".nz-widgetPanels-panel", { has: tab });
    const panelGrip = await panel.locator(".nz-widgetPanels-grip");
    await panelGrip.hover();

    const pinToggle = await widget.locator(".nz-widget-pinToggle");
    await pinToggle.click();

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
        y: frontstageBoundingBox.height - 5,
      },
    });

    const updatedBoundingBox = await titleBarHandle.boundingBox();
    assert(!!updatedBoundingBox);

    // Top right corner of a floating widget should render close to the top right of a frontstage.
    expect(updatedBoundingBox.x + updatedBoundingBox.width).toBeGreaterThan(frontstageBoundingBox.width - 40);

    // 1px border.
    expect(updatedBoundingBox.y).toEqual(boundingBox.y + 1);
  });
});
