"use strict";
/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const JsonUtils_1 = require("@bentley/bentleyjs-core/lib/JsonUtils");
var RenderMode;
(function (RenderMode) {
    RenderMode[RenderMode["Wireframe"] = 0] = "Wireframe";
    RenderMode[RenderMode["HiddenLine"] = 3] = "HiddenLine";
    RenderMode[RenderMode["SolidFill"] = 4] = "SolidFill";
    RenderMode[RenderMode["SmoothShade"] = 6] = "SmoothShade";
})(RenderMode = exports.RenderMode || (exports.RenderMode = {}));
/** Flags for view display style */
class ViewFlags {
    constructor() {
        this.renderMode = RenderMode.Wireframe;
        this.dimensions = true; // Shows or hides dimensions.
        this.patterns = true; // Shows or hides pattern geometry.
        this.weights = true; // Controls whether non-zero line weights are used or display using weight 0.
        this.styles = true; // Controls whether custom line styles are used (e.g. control whether elements with custom line styles draw normally, or as solid lines).
        this.transparency = true; // Controls whether element transparency is used (e.g. control whether elements with transparency draw normally, or as opaque).
        this.fill = true; // Controls whether the fills on filled elements are displayed.
        this.textures = true; // Controls whether to display texture maps for material assignments. When off only material color is used for display.
        this.materials = true; // Controls whether materials are used (e.g. control whether geometry with materials draw normally, or as if it has no material).
        this.acsTriad = false; // Shows or hides the ACS triad.
        this.grid = false; // Shows or hides the grid. The grid settings are a design file setting.
        this.visibleEdges = false; // Shows or hides visible edges in the shaded render mode.
        this.hiddenEdges = false; // Shows or hides hidden edges in the shaded render mode.
        this.sourceLights = false; // Controls whether the source lights in spatial models are used
        this.cameraLights = false; // Controls whether camera (ambient, portrait, flashbulb) lights are used.
        this.solarLight = false; // Controls whether sunlight used
        this.shadows = false; // Shows or hides shadows.
        this.noClipVolume = false; // Controls whether the clip volume is applied.
        this.constructions = false; // Shows or hides construction class geometry.
        this.monochrome = false; // draw all graphics in a single color
        this.noGeometryMap = false; // ignore geometry maps
        this.hLineMaterialColors = false; // use material colors for hidden lines
        this.edgeMask = 0; // 0=none, 1=generate mask, 2=use mask
    }
    toJSON() {
        const out = {};
        if (!this.constructions)
            out.noConstruct = true;
        if (!this.dimensions)
            out.noDim = true;
        if (!this.patterns)
            out.noPattern = true;
        if (!this.weights)
            out.noWeight = true;
        if (!this.styles)
            out.noStyle = true;
        if (!this.transparency)
            out.noTransp = true;
        if (!this.fill)
            out.noFill = true;
        if (this.grid)
            out.grid = true;
        if (this.acsTriad)
            out.acs = true;
        if (!this.textures)
            out.noTexture = true;
        if (!this.materials)
            out.noMaterial = true;
        if (!this.cameraLights)
            out.noCameraLights = true;
        if (!this.sourceLights)
            out.noSourceLights = true;
        if (!this.solarLight)
            out.noSolarLight = true;
        if (this.visibleEdges)
            out.visEdges = true;
        if (this.hiddenEdges)
            out.hidEdges = true;
        if (this.shadows)
            out.shadows = true;
        if (!this.noClipVolume)
            out.clipVol = true;
        if (this.hLineMaterialColors)
            out.hlMatColors = true;
        if (this.monochrome)
            out.monochrome = true;
        if (this.edgeMask !== 0)
            out.edgeMask = this.edgeMask;
        out.renderMode = this.renderMode;
        return out;
    }
    static fromJSON(json) {
        const val = new ViewFlags();
        if (!json)
            return val;
        val.constructions = !JsonUtils_1.JsonUtils.asBool(json.noConstruct);
        val.dimensions = !JsonUtils_1.JsonUtils.asBool(json.noDim);
        val.patterns = !JsonUtils_1.JsonUtils.asBool(json.noPattern);
        val.weights = !JsonUtils_1.JsonUtils.asBool(json.noWeight);
        val.styles = !JsonUtils_1.JsonUtils.asBool(json.noStyle);
        val.transparency = !JsonUtils_1.JsonUtils.asBool(json.noTransp);
        val.fill = !JsonUtils_1.JsonUtils.asBool(json.noFill);
        val.grid = JsonUtils_1.JsonUtils.asBool(json.grid);
        val.acsTriad = JsonUtils_1.JsonUtils.asBool(json.acs);
        val.textures = !JsonUtils_1.JsonUtils.asBool(json.noTexture);
        val.materials = !JsonUtils_1.JsonUtils.asBool(json.noMaterial);
        val.cameraLights = !JsonUtils_1.JsonUtils.asBool(json.noCameraLights);
        val.sourceLights = !JsonUtils_1.JsonUtils.asBool(json.noSourceLights);
        val.solarLight = !JsonUtils_1.JsonUtils.asBool(json.noSolarLight);
        val.visibleEdges = JsonUtils_1.JsonUtils.asBool(json.visEdges);
        val.hiddenEdges = JsonUtils_1.JsonUtils.asBool(json.hidEdges);
        val.shadows = JsonUtils_1.JsonUtils.asBool(json.shadows);
        val.noClipVolume = !JsonUtils_1.JsonUtils.asBool(json.clipVol);
        val.monochrome = JsonUtils_1.JsonUtils.asBool(json.monochrome);
        val.edgeMask = JsonUtils_1.JsonUtils.asInt(json.edgeMask);
        val.hLineMaterialColors = JsonUtils_1.JsonUtils.asBool(json.hlMatColors);
        const renderModeValue = JsonUtils_1.JsonUtils.asInt(json.renderMode);
        if (renderModeValue < RenderMode.HiddenLine)
            val.renderMode = RenderMode.Wireframe;
        else if (renderModeValue > RenderMode.SolidFill)
            val.renderMode = RenderMode.SmoothShade;
        else
            val.renderMode = renderModeValue;
        return val;
    }
}
exports.ViewFlags = ViewFlags;
const scratchBytes = new Uint8Array(4);
const scratchUInt32 = new Uint32Array(scratchBytes.buffer);
/** an RGBA value for a color */
class ColorDef {
    constructor(rgba) { this.rgba = rgba ? rgba : 0; }
    toJSON() { return this._rgba; }
    static fromJSON(json) {
        if (typeof json === "number")
            return new ColorDef(json);
        if (json instanceof ColorDef)
            return new ColorDef(json.rgba);
        return new ColorDef();
    }
    static from(r, g, b, a, result) {
        scratchBytes[0] = r;
        scratchBytes[1] = g;
        scratchBytes[2] = b;
        scratchBytes[3] = a ? a : 0;
        if (result)
            result.rgba = scratchUInt32[0];
        else
            result = new ColorDef(scratchUInt32[0]);
        return result;
    }
    getColors() { scratchUInt32[0] = this._rgba; return { r: scratchBytes[0], g: scratchBytes[1], b: scratchBytes[2], a: scratchBytes[3] }; }
    get rgba() { return this._rgba; }
    set rgba(rgba) { this._rgba = rgba | 0; }
    equals(other) { return this._rgba === other._rgba; }
    static black() { return new ColorDef(); }
    static white() { return ColorDef.from(0xff, 0xff, 0xff); }
    static red() { return ColorDef.from(0xff, 0, 0); }
    static green() { return ColorDef.from(0, 0xff, 0); }
    static blue() { return ColorDef.from(0, 0, 0xff); }
    static Yellow() { return ColorDef.from(0xff, 0xff, 0); }
    static cyan() { return ColorDef.from(0, 0xff, 0xff); }
    static orange() { return ColorDef.from(0xff, 0xa5, 0); }
    static magenta() { return ColorDef.from(0xff, 0, 0xff); }
    static brown() { return ColorDef.from(0xa5, 0x2a, 0x2a); }
    static lightGrey() { return ColorDef.from(0xbb, 0xbb, 0xbb); }
    static mediumGrey() { return ColorDef.from(0x88, 0x88, 0x88); }
    static darkGrey() { return ColorDef.from(0x55, 0x55, 0x55); }
    static darkRed() { return ColorDef.from(0x80, 0, 0); }
    static darkGreen() { return ColorDef.from(0, 0x80, 0); }
    static darkBlue() { return ColorDef.from(0, 0, 0x80); }
    static darkYellow() { return ColorDef.from(0x80, 0x80, 0); }
    static darkOrange() { return ColorDef.from(0xff, 0x8c, 0); }
    static darkCyan() { return ColorDef.from(0, 0x80, 0x80); }
    static darkMagenta() { return ColorDef.from(0x80, 0, 0x80); }
    static darkBrown() { return ColorDef.from(0x8b, 0x45, 0x13); }
}
exports.ColorDef = ColorDef;
var LinePixels;
(function (LinePixels) {
    LinePixels[LinePixels["Solid"] = 0] = "Solid";
    LinePixels[LinePixels["Code0"] = 0] = "Code0";
    LinePixels[LinePixels["Code1"] = 2155905152] = "Code1";
    LinePixels[LinePixels["Code2"] = 4177066232] = "Code2";
    LinePixels[LinePixels["Code3"] = 4292935648] = "Code3";
    LinePixels[LinePixels["Code4"] = 4262526480] = "Code4";
    LinePixels[LinePixels["Code5"] = 3772834016] = "Code5";
    LinePixels[LinePixels["Code6"] = 4169726088] = "Code6";
    LinePixels[LinePixels["Code7"] = 4279828248] = "Code7";
    LinePixels[LinePixels["HiddenLine"] = 3435973836] = "HiddenLine";
    LinePixels[LinePixels["Invisible"] = 1] = "Invisible";
    LinePixels[LinePixels["Invalid"] = 4294967295] = "Invalid";
})(LinePixels = exports.LinePixels || (exports.LinePixels = {}));
var HiddenLine;
(function (HiddenLine) {
    class Style {
        constructor(ovrColor, color, pattern, width) {
            this.ovrColor = ovrColor;
            this.color = color;
            this.pattern = pattern;
            this.width = width;
        }
        equals(rhs) {
            return this.ovrColor === rhs.ovrColor && this.color === rhs.color && this.pattern === rhs.pattern && this.width === rhs.width;
        }
    }
    HiddenLine.Style = Style;
    class Params {
        constructor() {
            this.visible = new Style(false, new ColorDef(), LinePixels.Solid, 1);
            this.hidden = new Style(false, new ColorDef(), LinePixels.HiddenLine, 1);
            this.transparencyThreshold = 1.0;
        }
        equals(rhs) { return this.visible === rhs.visible && this.hidden === rhs.hidden && this.transparencyThreshold === rhs.transparencyThreshold; }
    }
    HiddenLine.Params = Params;
})(HiddenLine = exports.HiddenLine || (exports.HiddenLine = {}));
