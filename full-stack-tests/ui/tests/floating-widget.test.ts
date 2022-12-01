/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect, test } from '@playwright/test';
import assert from 'assert';
import { expectSavedFrontstageState, floatingWidgetLocator, frontstageLocator, tabLocator, titleBarHandleLocator, widgetLocator } from './Utils';

test.describe("floating widget", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    assert(baseURL);
    await page.goto(`${baseURL}?frontstage=appui-test-providers:WidgetApi`);
  });

  test("should float a panel section", async ({ context, page }) => {
    const tab = tabLocator(page, "WL-1");
    const widget = widgetLocator({ tab });
    const titleBarHandle = titleBarHandleLocator(widget);
    const frontstage = frontstageLocator(page);
    const floatingWidget = floatingWidgetLocator({ tab });

    await expect(floatingWidget).not.toBeVisible();

    await titleBarHandle.dragTo(frontstage, {
      targetPosition: {
        x: 300,
        y: 200,
      },
    });

    await expect(floatingWidget).toBeVisible();
  });

  test("should maintain a floating widget (after reload)", async ({ context, page }) => {
    const tab = tabLocator(page, "WL-1");
    const widget = widgetLocator({ tab });
    const titleBarHandle = titleBarHandleLocator(widget);
    const frontstage = frontstageLocator(page);
    const floatingWidget = floatingWidgetLocator({ tab });

    await titleBarHandle.dragTo(frontstage, {
      targetPosition: {
        x: 300,
        y: 200,
      },
    });
    const bounds = await floatingWidget.boundingBox();
    expect(bounds).toBeDefined();

    await expectSavedFrontstageState(context, (state) => {
      const widgets = Object.values(state.nineZone.widgets);
      console.log(widgets);
      const widget = widgets.find((w) => w.tabs.indexOf("WL-1") >= 0);
      if (!widget)
        return false;
      const floatingWidgetIndex = state.nineZone.floatingWidgets.allIds.indexOf(widget.id);
      return floatingWidgetIndex >= 0;
    });
    await page.reload();
    const newBounds = await floatingWidget.boundingBox();
    expect(newBounds).toEqual(bounds);
  });

  test("should drag a floating widget", async ({ page }) => {
    const tab = tabLocator(page, "FW-1");
    const widget = widgetLocator({ tab });
    const titleBarHandle = titleBarHandleLocator(widget);
    const body = page.locator("body");

    const initialBounds = (await widget.boundingBox())!;
    await titleBarHandle.dispatchEvent("mousedown", { clientX: initialBounds.x, clientY: initialBounds.y });
    await titleBarHandle.dispatchEvent("mousemove", { clientX: initialBounds.x + 1, clientY: initialBounds.y + 1 });
    await body.dispatchEvent("mousemove", { clientX: initialBounds.x + 21, clientY: initialBounds.y + 31 });
    await body.dispatchEvent("mouseup");

    const bounds = (await widget.boundingBox())!;
    expect(bounds.x).toEqual(initialBounds.x + 20);
    expect(bounds.y).toEqual(initialBounds.y + 30);
  });

  test("should drag a floating widget (in 'portal/header' mode)", async ({ page }) => {
    const tab = tabLocator(page, "FW-1");
    const widget = widgetLocator({ tab });
    const titleBarHandle = titleBarHandleLocator(widget);
    const body = page.locator("body");

    const setPortalMode = page.locator(`text=setMode("portal")`);
    await setPortalMode.click();

    const initialBounds = (await widget.boundingBox())!;
    await titleBarHandle.dispatchEvent("mousedown", { clientX: initialBounds.x, clientY: initialBounds.y });
    await titleBarHandle.dispatchEvent("mousemove", { clientX: initialBounds.x + 1, clientY: initialBounds.y + 1 });
    await body.dispatchEvent("mousemove", { clientX: initialBounds.x + 21, clientY: initialBounds.y + 31 });
    await body.dispatchEvent("mouseup");

    const bounds = (await widget.boundingBox())!;
    expect(bounds.x).toEqual(initialBounds.x + 20);
    expect(bounds.y).toEqual(initialBounds.y + 30);
  });
});
