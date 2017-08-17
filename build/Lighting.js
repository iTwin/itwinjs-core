"use strict";
/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const JsonUtils_1 = require("@bentley/bentleyjs-core/lib/JsonUtils");
const Render_1 = require("./Render");
const Geometry_1 = require("@bentley/geometry-core/lib/Geometry");
/** The type of a Light */
var LightType;
(function (LightType) {
    LightType[LightType["Invalid"] = 0] = "Invalid";
    LightType[LightType["Solar"] = 1] = "Solar";
    LightType[LightType["Ambient"] = 2] = "Ambient";
    LightType[LightType["Flash"] = 3] = "Flash";
    LightType[LightType["Portrait"] = 4] = "Portrait";
    LightType[LightType["Point"] = 5] = "Point";
    LightType[LightType["Spot"] = 6] = "Spot";
    LightType[LightType["Area"] = 7] = "Area";
    LightType[LightType["Distant"] = 8] = "Distant";
    LightType[LightType["SkyOpening"] = 9] = "SkyOpening";
})(LightType = exports.LightType || (exports.LightType = {}));
/** a light to illuminate the contents of a scene */
class Light {
    constructor(opts) {
        opts = opts ? opts : {};
        this.lightType = JsonUtils_1.JsonUtils.asInt(opts.lightType);
        this.intensity = JsonUtils_1.JsonUtils.asDouble(opts.intensity);
        this.kelvin = JsonUtils_1.JsonUtils.asDouble(opts.kelvin);
        this.shadows = JsonUtils_1.JsonUtils.asDouble(opts.shadows);
        this.bulbs = JsonUtils_1.JsonUtils.asInt(opts.bulbs);
        this.lumens = JsonUtils_1.JsonUtils.asDouble(opts.lumens);
        this.color = Render_1.ColorDef.fromJSON(opts.color);
        if (opts.intensity2)
            this.intensity2 = JsonUtils_1.JsonUtils.asDouble(opts.intensity2);
        if (opts.color2)
            this.color2 = Render_1.ColorDef.fromJSON(opts.color2);
    }
    isValid() { return this.lightType !== LightType.Invalid; }
    isVisible() { return this.isValid() && this.intensity > 0.0; }
}
exports.Light = Light;
/** a light from a single location  */
class Spot extends Light {
    constructor(opts) {
        opts = opts ? opts : {};
        super(opts);
        this.lightType = LightType.Spot;
        this.inner = Geometry_1.Angle.fromJSON(opts.inner);
        this.outer = Geometry_1.Angle.fromJSON(opts.outer);
    }
}
exports.Spot = Spot;
