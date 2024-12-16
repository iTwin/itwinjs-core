/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import getSystemFonts from "get-system-fonts";
import { IModelTestUtils } from "./IModelTestUtils";
import {
    BlobContainer,
  EditableWorkspaceContainer, EditableWorkspaceDb, FontFile, IModelHost, SettingGroupSchema, SettingsContainer,
  SettingsDictionaryProps, SettingsPriority, StandaloneDb, Workspace, WorkspaceDb, WorkspaceEditor,
} from "@itwin/core-backend";
import { assert, Guid, OpenMode } from "@itwin/core-bentley";
import { AzuriteTest } from "./AzuriteTest";
import { FontFamilyDescriptor, FontId, FontType } from "@itwin/core-common";

describe("Font Examples", () => {
  let iModel: StandaloneDb;

  before(async () => {
    iModel = IModelTestUtils.openIModelForWrite("test.bim");
  });

  it("queries and embeds system fonts", async () => {
    async function askUserToChooseFontFamilyToInstall(availableFamilies: Iterable<string>): Promise<string | undefined> {
      for (const family of availableFamilies) {
        return family;
      }

      return undefined;
    }

    // __PUBLISH_EXTRACT_START__ Fonts.getSystemFontFamilies
    async function getSystemFontFamilies(includeNonEmbeddable = false): Promise<Map<string, FontFile[]>> {
      const families = new Map<string, FontFile[]>();
      const systemFontPaths = await getSystemFonts();
      for (const path of systemFontPaths) {
        let fontFile;
        try {
          fontFile = FontFile.createFromTrueTypeFileName(path);
          if (!includeNonEmbeddable && !fontFile.isEmbeddable) {
            continue;
          }
        } catch (_) {
          continue;
        }

        for (const face of fontFile.faces) {
          let list = families.get(face.familyName);
          if (!list) {
            families.set(face.familyName, list = []);
          }

          list.push(fontFile);
        }
      }

      return families;
    }
    // __PUBLISH_EXTRACT_END__

    const sysFams = await getSystemFontFamilies();
    expect(sysFams.size).greaterThan(0);
    
    // __PUBLISH_EXTRACT_START__ Fonts.selectSystemFont
    async function selectSystemFont(): Promise<FontId | undefined> {
      const availableFamilies = await getSystemFontFamilies();
      const familyToInstall = await askUserToChooseFontFamilyToInstall(availableFamilies.keys());
      if (!familyToInstall || !availableFamilies.get(familyToInstall)) {
        return undefined;
      }

      const descriptor: FontFamilyDescriptor = {
        name: familyToInstall,
        type: FontType.TrueType,
      };

      const fontId = iModel.fonts.findId(descriptor);
      if (undefined !== fontId) {
        return fontId;
      }
      
      const filesToInstall = availableFamilies.get(familyToInstall)!;
      await Promise.all(filesToInstall.map((file) => iModel.fonts.embedFontFile({ file })));
      return iModel.fonts.findId(descriptor);
    }
    // __PUBLISH_EXTRACT_END__

    const sysFontId = await selectSystemFont();
    expect(sysFontId).to.equal(1);
  });
});
