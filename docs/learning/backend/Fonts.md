# Fonts in iModels

Fonts define the appearance and layout of text in a model or on a drawing. Some fonts are in the public domain, but others are licensed works of third parties governed by a license agreement. Some fonts are delivered with an operating system, but others are purchased externally. Authors of iModels must choose a strategy for the picking the set of fonts they wish to use so that:

 1. fonts are always available whenever the iModel is accessed
 2. the license agreements of the fonts are respected

The various font apis in iTwin.js are designed to accomplish these goals. Generally, it is expected that system administrators will choose the set of fonts for an iModel at initialization time, make sure they're available and licensed correctly, and then only add new fonts as necessary. In particular, users without administrator rights will not be able to import new fonts from local files on their computers. This avoids "polluting" an iModel with fonts that don't satisfy one or both requirements above.

## FontId and FontMap

Text in iModels is created using [TextString]($common)s. Each `TextString` uses a specific font, identified by its [FontId]($common). iModels hold a [FontMap]($common) that maps `FontId` to a font name and [FontType]($common). The FontMap can be used to look up a `FontId` from an font name and [FontType]($common). At rendering type, the FontId is translated back to font name and type, and the font data is loaded, either from a Font Workspace or from a copy of the font embedded in the iModel itself.

Entries can be added to the FontMap using the [IModelDb.addNewFont]($backend) method. It takes a font name (and optionally a FontType) and returns a new FontId. It is generally intended to be used by administrators establishing the set of fonts available for an iModel during project setup. It requires a writeable iModel with the schema lock held. On success, the FontMap is updated and the current transaction must be committed for the change to become permanent. Then, the changeset must be pushed so that other briefcases can use the font.

## FontType

Most fonts in iModels are defined using the [OpenType](https://en.wikipedia.org/wiki/OpenType) format. However, for backwards compatibility with CAD applications, iModels also support the MicroStation "RSC" format, and the AutoCAD "SHX" format. The CAD format fonts are generally less capable, less complete, and less visually appealing. They should be avoided if possible, and are supported only for visual fidelity with legacy CAD data sources.

The enum [FontType]($common) specifies which of the 3 formats defines a font.

### MicroStation RSC Fonts

RSC Fonts are delivered in MicroStation in a resource file known as a Font Library. All of the RSC fonts delivered with MicroStation have been converted to a Font Workspace called `RscFonts.itwin-workspace` that is delivered with iTwin.js. Some user organizations have created their own RSC fonts, and the DGNV8 converter will embed those fonts into iModels created from DGN files that reference them.

### AutoCAD SHX Fonts

SHX fonts are stored in files, one per font, with an extension ".shx". They may be imported into Font Workspaces by supplying the name of the file.

### TrueType Fonts

Fonts defined in the `OpenType` format are delivered in files with the extensions: ".ttf", ".ttc", ".otf", or ".otc". They may be imported into Font Workspaces by supplying the name of the  file.

> Note: iTwin.js uses the term `TrueType` where a more accurate term would be `OpenType`. Ignore the distinction.

#### TrueType Font Faces

TrueType fonts may supply separate *faces* to display `Regular`, `Italics`, `Bold`, and `BoldItalics` flavors of the same font name. OpenType files with the extension ".ttf" or ".otf" hold a single font face. OpenType files with the extension ".ttc" or ".otc" hold a *collection* of faces. Sometimes .ttc/.otc collection files hold multiple faces for the same font name and sometimes they hold font faces from multiple fonts.

## Font Workspaces

Fonts may be stored in a [WorkspaceDb]($backend) using the Workspace Editor.

## Embedded Fonts

Fonts may be "embedded" within an iModel. This is analogous to embedding fonts in a PDF file. It ensures that the font will be available wherever the iModel is accessed.

However, the license agreements for some fonts permits embedding only when the file is immutable (readonly.) Also, embedding fonts requires that they be copied into all branches and briefcases so that all copies will contain the fonts. As some fonts can be very large, this is inefficient. For these reasons, fonts should only be embedded in "snapshot" iModels.

Versions of iTwin.js previous to 3.0 *only* supported embedded fonts. In V3.0 and forward, if a font exists in a Font Workspace it is used, *even if a font with the same name* is embedded in an iModel.

To embed a font in an iModel, use `DgnDb.embedFont`.
