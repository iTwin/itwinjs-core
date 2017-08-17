"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
const Element_1 = require("./Element");
const Render_1 = require("./Render");
const IModel_1 = require("./IModel");
const JsonUtils_1 = require("@bentley/bentleyjs-core/lib/JsonUtils");
/** Parameters that define the way geometry drawn on a SubCategory appears. */
class Appearance {
    constructor(props) {
        this.color = Render_1.ColorDef.black();
        this.weight = 0;
        this.priority = 0;
        this.transparency = 0;
        this.invisible = false;
        this.dontPlot = false;
        this.dontSnap = false;
        this.dontLocate = false;
        this.styleId = new IModel_1.Id();
        this.materialId = new IModel_1.Id();
        if (!props)
            return;
        this.invisible = JsonUtils_1.JsonUtils.asBool(props.invisible);
        this.dontSnap = JsonUtils_1.JsonUtils.asBool(props.dontSnap);
        this.dontLocate = JsonUtils_1.JsonUtils.asBool(props.dontLocate);
        this.dontPlot = JsonUtils_1.JsonUtils.asBool(props.dontPlot);
        this.color = Render_1.ColorDef.fromJSON(props.color);
        this.weight = JsonUtils_1.JsonUtils.asInt(props.weight);
        if (props.style)
            this.styleId = new IModel_1.Id(props.style);
        this.priority = JsonUtils_1.JsonUtils.asInt(props.priority);
        if (props.material)
            this.materialId = new IModel_1.Id(props.material);
        this.transparency = JsonUtils_1.JsonUtils.asInt(props.transp);
    }
    equals(other) {
        return this.invisible === other.invisible &&
            this.dontPlot === other.dontPlot &&
            this.dontSnap === other.dontSnap &&
            this.dontLocate === other.dontLocate &&
            this.color.equals(other.color) &&
            this.weight === other.weight &&
            this.priority === other.priority &&
            this.styleId.equals(other.styleId) &&
            this.materialId.equals(other.materialId) &&
            this.transparency === other.transparency;
    }
    toJSON() {
        const val = {};
        if (this.invisible)
            val.invisible = true;
        if (this.dontPlot)
            val.dontPlot = true;
        if (this.dontSnap)
            val.dontSnap = true;
        if (this.dontLocate)
            val.dontLocate = true;
        if (!Render_1.ColorDef.black().equals(this.color))
            val.color = this.color;
        if (0 !== this.weight)
            val.weight = this.weight;
        if (this.styleId.isValid())
            val.style = this.styleId;
        if (0 !== this.priority)
            val.priority = this.priority;
        if (this.materialId.isValid())
            val.material = this.materialId;
        if (0.0 !== this.transparency)
            val.transp = this.transparency;
        return val;
    }
}
exports.Appearance = Appearance;
/** the SubCategory appearance overrides for a view */
class SubCategoryOverride {
    constructor() { this._value = new Appearance(); }
    setInvisible(val) { this._invisible = true; this._value.invisible = val; }
    setColor(val) { this._color = true; this._value.color = val; }
    setWeight(val) { this._weight = true; this._value.weight = val; }
    setStyle(val) { this._style = true; this._value.styleId = val; }
    setDisplayPriority(val) { this._priority = true; this._value.priority = val; }
    setMaterial(val) { this._material = true; this._value.materialId = val; }
    setTransparency(val) { this._transp = true; this._value.transparency = val; }
    applyTo(appear) {
        if (this._invisible)
            appear.invisible = this._value.invisible;
        if (this._color)
            appear.color = this._value.color;
        if (this._weight)
            appear.weight = this._value.weight;
        if (this._style)
            appear.styleId = this._value.styleId;
        if (this._material)
            appear.materialId = this._value.materialId;
        if (this._priority)
            appear.priority = this._value.priority;
        if (this._transp)
            appear.transparency = this._value.transparency;
    }
    /** convert this SubCategoryOverride to a JSON object */
    toJSON() {
        const val = {};
        if (this._invisible)
            val.invisible = this._value.invisible;
        if (this._color)
            val.color = this._value.color;
        if (this._weight)
            val.weight = this._value.weight;
        if (this._style)
            val.style = this._value.styleId;
        if (this._material)
            val.material = this._value.materialId;
        if (this._priority)
            val.priority = this._value.priority;
        if (this._transp)
            val.transp = this._value.transparency;
        return val;
    }
    /** Create a new SubCategoryOverride from a JSON object */
    static fromJSON(json) {
        const val = new SubCategoryOverride();
        if (!json)
            return val;
        if (json.invisible)
            val.setInvisible(JsonUtils_1.JsonUtils.asBool(json.invisible));
        if (json.color)
            val.setColor(Render_1.ColorDef.fromJSON(json.color));
        if (json.weight)
            val.setWeight(JsonUtils_1.JsonUtils.asInt(json.weight));
        if (json.style)
            val.setStyle(new IModel_1.Id(json.style));
        if (json.material)
            val.setMaterial(new IModel_1.Id(json.material));
        if (json.priority)
            val.setDisplayPriority(JsonUtils_1.JsonUtils.asInt(json.priority));
        if (json.transp)
            val.setTransparency(JsonUtils_1.JsonUtils.asDouble(json.transp));
        return val;
    }
}
exports.SubCategoryOverride = SubCategoryOverride;
/** a Subcategory defines the appearance for graphics in Geometric elements */
class SubCategory extends Element_1.DefinitionElement {
    constructor(props) {
        super(props);
        this.appearance = new Appearance(props.appearance);
        this.description = JsonUtils_1.JsonUtils.asString(props.description);
    }
    getSubCategoryName() { return this.code.getValue(); }
    getSubCategoryId() { return this.id; }
    getCategoryId() { return this.parent ? this.parent.id : new IModel_1.Id(); }
    isDefaultSubCategory() { return Category.getDefaultSubCategoryId(this.getCategoryId()) === this.getSubCategoryId(); }
}
exports.SubCategory = SubCategory;
/** the rank for a Category */
var Rank;
(function (Rank) {
    Rank[Rank["System"] = 0] = "System";
    Rank[Rank["Domain"] = 1] = "Domain";
    Rank[Rank["Application"] = 2] = "Application";
    Rank[Rank["User"] = 3] = "User";
})(Rank = exports.Rank || (exports.Rank = {}));
/** a Category for a Geometric element */
class Category extends Element_1.DefinitionElement {
    constructor(opts) {
        super(opts);
        this.rank = Rank.User;
    }
    static getDefaultSubCategoryId(id) { return id.isValid() ? new IModel_1.Id([id.lo, id.hi + 1]) : new IModel_1.Id(); }
    myDefaultSubCategoryId() { return Category.getDefaultSubCategoryId(this.id); }
}
exports.Category = Category;
/** Categorizes 2d graphical elements. */
class DrawingCategory extends Category {
    constructor(opts) { super(opts); }
}
exports.DrawingCategory = DrawingCategory;
/** Categorizes a SpatialElement. */
class SpatialCategory extends Category {
    constructor(opts) { super(opts); }
}
exports.SpatialCategory = SpatialCategory;
