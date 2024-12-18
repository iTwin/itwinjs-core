/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as path from "path";
import * as fs from "fs";
import { expect } from "chai";
import getSystemFonts from "get-system-fonts";
import { IModelTestUtils, KnownTestLocations } from "./IModelTestUtils";
import {
    BlobContainer,
  EditableWorkspaceContainer, EditableWorkspaceDb, FontFile, IModelDb, IModelHost, SettingGroupSchema, SettingsContainer,
  SettingsDictionaryProps, SettingsPriority, StandaloneDb, Workspace, WorkspaceDb, WorkspaceEditor,
} from "@itwin/core-backend";
import { assert, Guid, OpenMode } from "@itwin/core-bentley";
import { AzuriteTest } from "./AzuriteTest";
import { FontFamilyDescriptor, FontId, FontType } from "@itwin/core-common";

describe.only("Font Examples", () => {
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
      // Map font family names to the font file(s) containing their faces.
      const families = new Map<string, FontFile[]>();
      // Query the absolute filename for every available system font.
      const systemFontPaths = await getSystemFonts();
      // Add the font families from each font file to the map.
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
    async function selectAndEmbedSystemFont(db: IModelDb): Promise<FontId | undefined> {
      // Query available font families.
      const availableFamilies = await getSystemFontFamilies();
      // Ask the user to select the family to be installed.
      const familyToInstall = await askUserToChooseFontFamilyToInstall(availableFamilies.keys());
      if (!familyToInstall || !availableFamilies.get(familyToInstall)) {
        // No family selected to install.
        return undefined;
      }

      const descriptor: FontFamilyDescriptor = {
        name: familyToInstall,
        type: FontType.TrueType,
      };

      // If the family's faces are already embedded and the family is already assigned an Id, we're finished.
      for (const family of db.fonts.queryMappedFamilies()) {
        if (family.name === descriptor.name && family.type === descriptor.type) {
          return family.id;
        }
      }

      // Install all of the font files containing the selected families faces.
      const filesToInstall = availableFamilies.get(familyToInstall)!;
      await Promise.all(filesToInstall.map((file) => db.fonts.embedFontFile({ file })));
      return db.fonts.findId(descriptor);
    }
    // __PUBLISH_EXTRACT_END__

    const sysFontId = await selectAndEmbedSystemFont(iModel);
    expect(sysFontId).to.equal(1);
  });

  it("embeds user-provided SHX font", async () => {
    // __PUBLISH_EXTRACT_START__ Fonts.embedShxFont
    async function embedShxFont(filename: string, db: IModelDb): Promise<FontId> {
      // Read the contents of the SHX file into memory.
      const blob = fs.readFileSync(filename);
      // Use the base file name as the family name.
      // Alternatively, this function could be adjusted to accept the family name as an argument.
      const familyName = path.basename(filename, path.extname(filename));
      // Embed the font file into the iModel, automatically allocating a corresponding FontId for the font family it contains.
      const fontFile = FontFile.createFromShxFontBlob({ blob, familyName });
      await db.fonts.embedFontFile({ file: fontFile });
      // Query and return the font Id.
      const fontId = db.fonts.findId({ name: familyName, type: FontType.Shx });
      assert(undefined !== fontId);
      return fontId;
    }
    // __PUBLISH_EXTRACT_END__

    const shxFileName = path.join(KnownTestLocations.assetsDir, "Cdm.shx");
    const shxFontId = await embedShxFont(shxFileName, iModel);
    expect(shxFontId).greaterThan(0);
  });
});
