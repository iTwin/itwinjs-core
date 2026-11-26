/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expectDefined } from "@itwin/core-bentley";
import { describe, expect, it, vi } from "vitest";
import { openImageDataUrlInNewWindow } from "../common/ImageUtil";

describe("openImageDataUrlInNewWindow", () => {
  it("preserves an apostrophe in the image URL and displays the image", async () => {
    const frame = document.createElement("iframe");
    document.body.append(frame);
    try {
      const popup = expectDefined(frame.contentWindow ?? undefined);
      const open = vi.spyOn(window, "open").mockReturnValue(popup);
      try {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        const url = `${canvas.toDataURL()}#view's-image`;

        openImageDataUrlInNewWindow(url, "Saved View");

        const image = expectDefined(popup.document.body.querySelector("img") ?? undefined);
        expect(image.getAttribute("src")).toBe(url);
        await image.decode();
        expect(image.naturalWidth).toBe(1);
        expect(popup.document.title).toBe("Saved View");
      } finally {
        open.mockRestore();
      }
    } finally {
      frame.remove();
    }
  });
});
