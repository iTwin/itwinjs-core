/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as fs from "fs";
import { FontFile, TrueTypeFontFile } from "../Font";
import { FontType, LocalFileName } from "@itwin/core-common";
import { IModelHost } from "../IModelHost";
import { _implementationProhibited } from "./Symbols";

export function trueTypeFontFileFromFileName(fileName: LocalFileName): TrueTypeFontFile {
  const metadata = IModelHost.platform.getTrueTypeFontMetadata(fileName);
  return {
    [_implementationProhibited]: undefined,
    type: FontType.TrueType,
    isEmbeddable: metadata.embeddable,
    familyNames: metadata.familyNames,
  };
}

/*
ShxFont::ShxType ShxFont::ValidateHeader(CharCP fileHeader) {
    static const CharCP UNIFONT_HEADER = "AutoCAD-86 unifont 1.0";
    static const CharCP SHAPES1_0_HEADER = "AutoCAD-86 shapes 1.0";
    static const CharCP SHAPES1_1_HEADER = "AutoCAD-86 shapes 1.1";

    if (0 == strncmp(fileHeader, UNIFONT_HEADER, strlen(UNIFONT_HEADER)))
        return ShxFont::ShxType::Unicode;

    if ((0 == strncmp(fileHeader, SHAPES1_0_HEADER, strlen(SHAPES1_0_HEADER))) || (0 == strncmp(fileHeader, SHAPES1_1_HEADER, strlen(SHAPES1_1_HEADER))))
        return ShxFont::ShxType::Locale;

    return ShxFont::ShxType::Invalid;
}

ShxFont::ShxType ShxFont::GetShxType() {
    static const size_t MAX_HEADER = 40; // an SHX file with less than 40 bytes isn't valid

    // Allow this to be used in the middle of other read operations.
    AutoRestoreFPos restoreFPos(*this);
    Seek(0);

    char fileHeader[MAX_HEADER];
    if (MAX_HEADER != Read (fileHeader,MAX_HEADER))
        return ShxFont::ShxType::Invalid;

    return ValidateHeader(fileHeader);
}
*/
