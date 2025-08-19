/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { beforeEach, describe, expect, it } from "vitest";

describe("Field formatting", () => {
  describe("string", () => {
    it("adds prefix and/or suffix", () => {
    });

    it("applies case rules", () => {
    });

    it("does not apply case rules to prefix and suffix", () => {
    });

    it("converts property value to default string representation", () => {
    });
  });

  describe("boolean", () => {
    it("fails if property value is not boolean", () => {
    });

    it("converts boolean to display label", () => {
    });

    it("fails if display label is not specified", () => {
    });

    it("applies string formatting options", () => {
    });
  });

  describe("enum", () => {
    it("fails if property value is not integer", () => {
    });

    it("converts integer to display label", () => {
    });

    it("fails if display label is not specified", () => {
    });

    it("applies string formatting options", () => {
    });
  });

  describe("quantity", () => {
    it("###TODO", () => {
    });
  });

  describe("coordinate", () => {
    it("fails if property value is not coordinate", () => {
    });

    it("converts coordinates to string", () => {
    });

    it("formats specific components", () => {
    });

    it("separates components with separator string", () => {
    });

    it("applies string formatting options", () => {
    });

    it("applies quantity formatting options", () => {
    });
  });

  describe("datetime", () => {
    it("###TODO", () => {
    });
  });
});

