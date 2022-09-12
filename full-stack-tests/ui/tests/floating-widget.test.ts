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
});
