# Fonts in iModels

Text is an important part of many iModel workflows, especially those involving the production of [drawings and sheets](../../bis/domains/drawing-sheets.md). Every piece of text in an iModel uses a font to define the appearance and layout of the glyphs (i.e., letters, or characters) that comprise it. To store text in an iModel that uses a particular font, the font itself must first be embedded into the iModel. iTwin.js provides APIs to read font objects from the file system or memory, embed them into iModels, query those embeddings, and associate Ids with specific *font families*.

## Terminology

The term "font" can be ambiguous. Strictly speaking, a "font" is a digital representation of a set of unique glyphs that a computer program can use to render text. To minimize confusion, iTwin.js prefers the following more specific terms:
- Font family: a named, characteristic design of a set of glyphs. Two families are distinct if their names differ. For example, Helvetica and Comic Sans are two distinct families sharing few design similarities. Helvetica and Helvetica Condensed are two distinct families sharing many design similarities. A font family comprises one or more *font faces*. When you create text in an iModel, you specify the name of the font family.
- Font face: a specific variation of the glyphs defined by a *font family*. iTwin.js recognizes four types of font face: regular, italic, bold, and bold-italic. These variations can be applied to text in an iModel by a [TextStyle]($common).
- Font file: a digital representation of one or more *font faces* belonging to any number of *font families*. The representation can be expressed in one of a [handful of formats](#Formats). When you embed a "font" into an iModel, you are actually embedding a *font file*.

For backwards compatibility, a handful of ambiguous uses of "font" in the APIs remain:
- [FontProps]($common) describes the properties of a *font family*.
- [FontId]($common) is a numeric identifier for a *font family*.
- [FontType]($common) describes the format of a *font file*.

## Font files

A [FontFile]($backend) is a set of one or more font faces, usually originating in a file on disk. The file must be embedded into an iModel before any of the font families it contains can be used by text in that iModel.

### Formats

iTwin.js supports three font file formats, represented by the [FontType]($common) `enum`:
- [OpenType](https://en.wikipedia.org/wiki/OpenType), referred to throughout the API as "[TrueType](https://en.wikipedia.org/wiki/TrueType)", from which it derives. Virtually all modern fonts are distributed in this format. Common file extensions for OpenType fonts include .ttf, .otf, .ttc, and .otc, where the first two generally contain a single font face and the latter two a collection of multiple faces potentially belonging to multiple font families.
- [SHX](https://help.autodesk.com/view/OARX/2024/ENU/?guid=GUID-DE941DB5-7044-433C-AA68-2A9AE98A5713), a primitive format originating in [AutoCAD](https://en.wikipedia.org/wiki/AutoCAD) and generally distributed as files with a .shx extension.
- [RSC](https://docs.bentley.com/LiveContent/web/MicroStation%20Help-v27/en/GUID-FC78484C-E42F-30BF-BF68-2B2C025AE040.html), a primitive format originating in [MicroStation](https://en.wikipedia.org/wiki/MicroStation). In MicroStation, such fonts are defined in "resource" files with a .rsc extension.

SHX and RSC were designed for early [computer-aided design](https://en.wikipedia.org/wiki/Computer-aided_design) workflows and are hence sometimes referred to as "CAD fonts". They consist of a single font face generally comprising extremely simple representations of glyphs (e.g., basic line segments) and little to no support for Unicode characters. By contrast, OpenType fonts are generally more visually appealing, support Unicode, and provide multiple faces per family.

RSC fonts in iModels are stored in a binary format, not as .rsc files. No public API currently exists to convert to this representation, so for now the only way to embed a RSC font into an iModel is through a connector.

### Embedding rights

Fonts are generally copyrighted and licensed works. Some may be made available under very permissive licenses allowing them to be shared freely, while others may be subject to very specific rules. iModel authors are responsible for ensuring that their usage of a font is consistent with its licensing terms.

The OpenType specification enumerates a handful of possible [embedding licesnging rights](https://learn.microsoft.com/en-us/typography/opentype/spec/os2#fstype) defining whether and for what purposes a font face can be embedded into and distributed with another document like an iModel. [FontFile.isEmbeddable]($backend) will tell you whether embedding is permitted according to these rules. An attempt to embed a non-embeddable font in an iModel will fail.

The unit of embedding is a *font file*. Extracting individual font faces from a font file to embed separately is forbidden by most non-free font licenses. The embedding rights for a font file are determined by the most restrictive embedding rights applied to any face within it.

## Font families

A font family is uniquely identified across iModels by its name and type, as encapsulated by [FontFamilyDescriptor]($common). It is possible to have two font families with the same name but of different [FontType]($common)s. Within an iModel, a font family is identified by its unique integer [FontId]($common).

To use a font family, you must first embed one or more [font files](#font-files) containing the face(s) belonging to that family. Then, you must associate a [FontId]($common) with the [FontFamilyDescriptor]($common). The mapping of family descriptors to font Ids is stored independently from the embedded font files. So, for a given font family, any of the following is possible:
1. The iModel contains a font Id for the family, and one or more font files containing faces belonging to that family; or
2. The iModel contains a font Id for the family, but not corresponding font files; or
3. The iModel contains font files defining faces belonging to that family, but no corresponding font Id; or
4. No information about the family exists in the iModel.

Case #1 above is the optimal one, and [IModelDbFonts.embedFontFile]($backend) by default ensures that a font Id is allocated for each font family in the [FontFile]($backend) being embedded. Case #4 can be addressed by embedding the required font file(s). You may encounter cases #2 and #3 when dealing with font information created by older connectors. You can address #2 by embedding the required font file(s), and #3 by using [IModelDbFonts.acquireId]($backend).

## IModelDbFonts

[IModelDb.fonts]($backend) provides APIs for reading and writing font-related information in an iModel.

### Embedding font files

[IModelDbFonts.embedFontFile]($backend) embeds a [FontFile]($backend) into the iModel, if it is not already embedded. By default, it also ensures a [FontId]($common) is allocated for each font family in the file. If you override this default behavior, you can allocate font Ids manually using [IModelDbFonts.acquireId]($backend).

#### Embedding a font file directly

In the following example, the application provides a filename for an SHX font to be embedded into the iModel.

```ts
[[include:Fonts.embedShxFont]]
```

#### Querying and embedding system fonts

The following function uses the [get-system-fonts](https://www.npmjs.com/package/get-system-fonts) package to query all fonts available on the user's machine. It returns a mapping of font family name to the [FontFile]($backend)(s) containing faces belonging to that family. It omits non-embeddable font files by default.

```ts
[[include:Fonts.getSystemFontFamilies]]
```

The following function uses the `getSystemFontFamilies` function defined above to permit the user to select a font family from their system to embed into an iModel. It ensures that the selected family's information is stored in the iModel and returns the corresponding [FontId]($common).

```ts
[[include:Fonts.selectSystemFont]]
```

### Querying font information

The following methods query font-related information.
- [IModelDbFonts.queryDescriptors]($backend): the font families 




