/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { TextureMapping } from "../TextureMapping";

describe("TextureMapping.Params", () => {
  describe("constructor", () => {
    it("applies default values when no props provided", () => {
      const params = new TextureMapping.Params();

      expect(params.mode).toBe(TextureMapping.Mode.Parametric);
      expect(params.weight).toBe(1);
      expect(params.worldMapping).toBe(false);
      expect(params.useConstantLod).toBe(false);
      expect(params.textureMatrix).toBe(TextureMapping.Trans2x3.identity);

      // Constant LOD params should have defaults
      expect(params.constantLodParams.repetitions).toBe(1);
      expect(params.constantLodParams.offset).toEqual({ x: 0, y: 0 });
      expect(params.constantLodParams.minDistClamp).toBe(1);
      expect(params.constantLodParams.maxDistClamp).toBe(4096 * 1024 * 1024);
    });

    it("applies default constant LOD values when useConstantLod is true but no constantLodProps provided", () => {
      const params = new TextureMapping.Params({ useConstantLod: true });

      expect(params.useConstantLod).toBe(true);
      expect(params.constantLodParams.repetitions).toBe(1);
      expect(params.constantLodParams.offset).toEqual({ x: 0, y: 0 });
      expect(params.constantLodParams.minDistClamp).toBe(1);
      expect(params.constantLodParams.maxDistClamp).toBe(4096 * 1024 * 1024);
    });

    it("applies default constant LOD values for missing properties in constantLodProps", () => {
      // Only provide repetitions, other props should use defaults
      const params = new TextureMapping.Params({
        useConstantLod: true,
        constantLodProps: { repetitions: 5.0 },
      });

      expect(params.constantLodParams.repetitions).toBe(5.0);
      expect(params.constantLodParams.offset).toEqual({ x: 0, y: 0 });
      expect(params.constantLodParams.minDistClamp).toBe(1);
      expect(params.constantLodParams.maxDistClamp).toBe(4096 * 1024 * 1024);
    });

    it("uses provided constant LOD values when all are specified", () => {
      const params = new TextureMapping.Params({
        useConstantLod: true,
        constantLodProps: {
          repetitions: 2.5,
          offset: { x: 10, y: 20 },
          minDistClamp: 100,
          maxDistClamp: 5000,
        },
      });

      expect(params.constantLodParams.repetitions).toBe(2.5);
      expect(params.constantLodParams.offset).toEqual({ x: 10, y: 20 });
      expect(params.constantLodParams.minDistClamp).toBe(100);
      expect(params.constantLodParams.maxDistClamp).toBe(5000);
    });
  });
});
