/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { CodeScopeSpec, CodeSpecProperties, ECSqlReader, QueryRowProxy } from "@itwin/core-common";
import { IModelConnection } from "../IModelConnection";

describe("IModelConnection.CodeSpecs", async () => {
  describe("_isCodeSpecProperties", async () => {

    it("should validate valid CodeSpecProperties", async () => {
      const fakeCodeSpecProperties: CodeSpecProperties = {
        scopeSpec: {
          type: CodeScopeSpec.Type.Repository,
          fGuidRequired: true,
          relationship: "valid",
        },
        spec: { isManagedWithDgnDb: false },
        version: "1.0.0",
      };
      const fakeValue = {
        /* eslint-disable @typescript-eslint/naming-convention */
        Id: "0x123",
        Name: "TestCodeSpec",
        JsonProperties: JSON.stringify(fakeCodeSpecProperties),
        /* eslint-enable @typescript-eslint/naming-convention */
      } as unknown as QueryRowProxy;

      const ecsqlReaderFake = {
        next: async () => ({ done: false, value: fakeValue }),
      } as unknown as ECSqlReader;

      const iModelConnectionFake = {
        createQueryReader: () => ecsqlReaderFake,
      } as unknown as IModelConnection;

      const codeSpecs = new IModelConnection.CodeSpecs(iModelConnectionFake);
      const codeSpec = await codeSpecs.getByName("TestCodeSpec");

      expect(codeSpec.name).to.be.equal("TestCodeSpec");
      expect(codeSpec.id).to.be.equal("0x123");
      expect(codeSpec.properties).to.be.deep.equal(fakeCodeSpecProperties);
    });

    async function expectInvalidCodeSpecPropertiesToBeRejected(codeSpecProperties: any) {
      const fakeValue = {
        /* eslint-disable @typescript-eslint/naming-convention */
        Id: "0x123",
        Name: "TestCodeSpec",
        JsonProperties: JSON.stringify(codeSpecProperties),
        /* eslint-enable @typescript-eslint/naming-convention */
      } as unknown as QueryRowProxy;

      const ecsqlReaderFake = {
        next: async () => ({ done: false, value: fakeValue }),
      } as unknown as ECSqlReader;

      const iModelConnectionFake = {
        createQueryReader: () => ecsqlReaderFake,
      } as unknown as IModelConnection;

      const codeSpecs = new IModelConnection.CodeSpecs(iModelConnectionFake);

      await expect(codeSpecs.getByName("TestCodeSpec")).rejects.toThrow("Invalid CodeSpecProperties returned in the CodeSpec");
    }

    const invalidCodeSpecPropertiesWithWrongTypes = [
      {
        reason: "invalid scopeSpec.type type",
        codeSpecProperties: {
          scopeSpec: {
            type: "invalid",
            fGuidRequired: true,
            relationship: "valid",
          },
          spec: { isManagedWithDgnDb: false },
          version: "1.0.0",
        },
      },
      {
        reason: "invalid scopeSpec.fGuidRequired type",
        codeSpecProperties: {
          scopeSpec: {
            type: CodeScopeSpec.Type.Repository,
            fGuidRequired: "invalid",
            relationship: "valid",
          },
          spec: { isManagedWithDgnDb: false },
          version: "1.0.0",
        },
      },
      {
        reason: "invalid scopeSpec.relationship type",
        codeSpecProperties: {
          scopeSpec: {
            type: CodeScopeSpec.Type.Repository,
            fGuidRequired: true,
            relationship: false,
          },
          spec: { isManagedWithDgnDb: false },
          version: "1.0.0",
        },
      },
      {
        reason: "invalid spec.isManagedWithDgnDb type",
        codeSpecProperties: {
          scopeSpec: {
            type: CodeScopeSpec.Type.Repository,
            fGuidRequired: true,
            relationship: "valid",
          },
          spec: { isManagedWithDgnDb: "invalid" },
          version: "1.0.0",
        },
      },
      {
        reason: "invalid version type",
        codeSpecProperties: {
          scopeSpec: {
            type: CodeScopeSpec.Type.Repository,
            fGuidRequired: true,
            relationship: "valid",
          },
          spec: { isManagedWithDgnDb: false },
          version: false,
        },
      },
    ];

    for (const { codeSpecProperties, reason } of invalidCodeSpecPropertiesWithWrongTypes) {
      it(`should not validate invalid CodeSpecProperties with ${reason}`, async () => {
        await expectInvalidCodeSpecPropertiesToBeRejected(codeSpecProperties);
      });
    };

    const invalidCodeSpecPropertiesWithMissingProperties = [
      {
        reason: "codeSpecProperties.scopeSpec are undefined",
        codeSpecProperties: {
          scopeSpec: undefined,
          spec: { isManagedWithDgnDb: false },
          version: "1.0.0",
        },
      },
      {
        reason: "codeSpecProperties.scopeSpec.type are undefined",
        codeSpecProperties: {
          scopeSpec: {
            type: undefined,
            fGuidRequired: true,
            relationship: "valid",
          },
          spec: { isManagedWithDgnDb: false },
          version: "1.0.0",
        },
      },
    ];

    for (const { codeSpecProperties, reason } of invalidCodeSpecPropertiesWithMissingProperties) {
      it(`should not validate invalid CodeSpecProperties when ${reason}`, async () => {
        await expectInvalidCodeSpecPropertiesToBeRejected(codeSpecProperties);
      });
    };
  });
});