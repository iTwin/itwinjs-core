"use strict";
/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const Elements_1 = require("./Elements");
const Model_1 = require("./Model");
const DgnDb_1 = require("@bentley/imodeljs-dgnplatform/lib/DgnDb");
const BeSQLite_1 = require("@bentley/bentleyjs-core/lib/BeSQLite");
const JsonUtils_1 = require("@bentley/bentleyjs-core/lib/JsonUtils");
const PointVector_1 = require("@bentley/geometry-core/lib/PointVector");
const Constant_1 = require("@bentley/geometry-core/lib/Constant");
const Geometry_1 = require("@bentley/geometry-core/lib/Geometry");
const js_base64_1 = require("js-base64");
/** The mapping between a class name and its the metadata for that class  */
class ClassMetaDataRegistry {
    constructor(imodel) {
        this.imodel = imodel;
        this.reg = new Map();
    }
    static getKey(schemaName, className) { return (schemaName + "." + className).toLowerCase(); }
    /** Get the specified Entity metadata */
    get(schemaName, className) {
        const key = ClassMetaDataRegistry.getKey(schemaName, className);
        let mdata = this.reg.get(key);
        if (null !== mdata && undefined !== mdata) {
            return mdata;
        }
        if (!this.imodel.dgnDb)
            throw new Error("IModel must be open");
        const { error, result: mstr } = this.imodel.dgnDb.getECClassMetaDataSync(schemaName, className);
        if (error || !mstr)
            return undefined;
        mdata = JSON.parse(mstr);
        if (undefined === mdata)
            return undefined;
        this.reg.set(key, mdata);
        return mdata;
    }
}
exports.ClassMetaDataRegistry = ClassMetaDataRegistry;
/** An iModel database. */
class IModel {
    toJSON() { return undefined; } // we don't have any members that are relevant to JSON
    /** Open the iModel
     * @param fileName  The name of the iModel
     * @param mode      Open mode for database
     * @return non-zero error status if the iModel could not be opened
     */
    openDgnDb(fileName, mode) {
        return __awaiter(this, void 0, void 0, function* () {
            mode = (typeof mode === "number") ? mode : BeSQLite_1.OpenMode.Readonly;
            if (!this._db)
                this._db = new DgnDb_1.DgnDb();
            return this._db.openDb(fileName, mode);
        });
    }
    /** Get the ClassMetaDataRegistry for this iModel */
    get classMetaDataRegistry() {
        if (!this._classMetaDataRegistry)
            this._classMetaDataRegistry = new ClassMetaDataRegistry(this);
        return this._classMetaDataRegistry;
    }
    /** Get the Elements of this iModel */
    get elements() {
        if (!this._elements)
            this._elements = new Elements_1.Elements(this);
        return this._elements;
    }
    /** Get the Models of this iModel */
    get models() {
        if (!this._models)
            this._models = new Model_1.Models(this);
        return this._models;
    }
    get dgnDb() {
        return this._db;
    }
    /**
     * Execute a query against this iModel
     * @param ecsql  The ECSql statement to execute
     * @return all rows in JSON syntax or the empty string if nothing was selected
     * @throws Error if the statement is invalid
     */
    executeQuery(ecsql) {
        return this._db.executeQuery(ecsql);
    }
}
exports.IModel = IModel;
/** A two-part id, containing a briefcase id and a local id. */
class Id {
    static toHex(str) { const v = parseInt(str, 16); return Number.isNaN(v) ? 0 : v; }
    static isHex(str) { return !Number.isNaN(parseInt(str, 16)); }
    toJSON() { return this.value ? this.value : ""; }
    get lo() {
        if (!this.value)
            return 0;
        let start = 2;
        const len = this.value.length;
        if (len > 12)
            start = (len - 10);
        return Id.toHex(this.value.slice(start));
    }
    get hi() {
        if (!this.value)
            return 0;
        let start = 2;
        const len = this.value.length;
        if (len <= 12)
            return 0;
        start = (len - 10);
        return Id.toHex(this.value.slice(2, start));
    }
    /**
     * constructor for Id
     * @param prop either a string with a hex number, an Id, or an array of two numbers with [lo,hi]. Otherwise the Id will be invalid.
     */
    constructor(prop) {
        if (!prop)
            return;
        if (typeof prop === "string") {
            prop = prop.toLowerCase().trim();
            if (prop[0] !== "0" || !(prop[1] === "x")) {
                return;
            }
            let start = 2;
            const len = prop.length;
            if (len > 12) {
                start = (len - 10);
                if (!Id.isHex(prop.slice(2, start)))
                    return;
            }
            if (0 !== Id.toHex(prop.slice(start)))
                this.value = prop;
            return;
        }
        if (prop instanceof Id) {
            this.value = prop.value;
            return;
        }
        if (!Array.isArray(prop) || prop.length < 2)
            return;
        const lo = prop[0] | 0;
        if (lo === 0)
            return;
        const hi = Math.trunc(prop[1]);
        this.value = "0x" + hi.toString(16).toLowerCase() + ("0000000000" + lo.toString(16).toLowerCase()).substr(-10);
    }
    /** convert this Id to a string */
    toString() { return this.value ? this.value : ""; }
    /** Determine whether this Id is valid */
    isValid() { return this.value !== undefined; }
    /** Test whether two Ids are the same */
    equals(other) { return this.value === other.value; }
    static areEqual(a, b) { return (a === b) || (a != null && b != null && a.equals(b)); }
}
exports.Id = Id;
/** A 3 part Code that identifies an Element */
class Code {
    constructor(val) {
        this.spec = new Id(val.spec);
        this.scope = JsonUtils_1.JsonUtils.asString(val.scope, "");
        this.value = JsonUtils_1.JsonUtils.asString(val.value);
    }
    /** Create an instance of the default code (1,1,undefined) */
    static createDefault() { return new Code({ spec: new Id([1, 0]), scope: "1" }); }
    getValue() { return this.value ? this.value : ""; }
    equals(other) { return this.spec.equals(other.spec) && this.scope === other.scope && this.value === other.value; }
}
exports.Code = Code;
/** A bounding box aligned to the orientation of a 3d Element */
class ElementAlignedBox3d extends PointVector_1.Range3d {
    constructor(low, high) { super(low.x, low.y, low.z, high.x, high.y, high.z); }
    get left() { return this.low.x; }
    get bottom() { return this.low.y; }
    get front() { return this.low.z; }
    get right() { return this.high.x; }
    get top() { return this.high.y; }
    get back() { return this.high.z; }
    get width() { return this.xLength(); }
    get depth() { return this.yLength(); }
    get height() { return this.zLength(); }
    isValid() {
        const max = Constant_1.Constant.circumferenceOfEarth;
        const lo = this.low;
        const hi = this.high;
        return !this.isNull() && lo.x > -max && lo.y > -max && lo.z > -max && hi.x < max && hi.y < max && hi.z < max;
    }
    static fromJSON(json) {
        json = json ? json : {};
        return new ElementAlignedBox3d(PointVector_1.Point3d.fromJSON(json.low), PointVector_1.Point3d.fromJSON(json.high));
    }
}
exports.ElementAlignedBox3d = ElementAlignedBox3d;
/** A bounding box aligned to the orientation of a 2d Element */
class ElementAlignedBox2d extends PointVector_1.Range2d {
    constructor(low, high) { super(low.x, low.y, high.x, high.y); }
    get left() { return this.low.x; }
    get bottom() { return this.low.y; }
    get right() { return this.high.x; }
    get top() { return this.high.y; }
    get width() { return this.xLength(); }
    get depth() { return this.yLength(); }
    static fromJSON(json) {
        json = json ? json : {};
        return new ElementAlignedBox2d(PointVector_1.Point2d.fromJSON(json.low), PointVector_1.Point2d.fromJSON(json.high));
    }
    isValid() {
        const max = Constant_1.Constant.circumferenceOfEarth;
        const lo = this.low;
        const hi = this.high;
        return !this.isNull() && lo.x > -max && lo.y > -max && hi.x < max && hi.y < max;
    }
}
exports.ElementAlignedBox2d = ElementAlignedBox2d;
class GeometryStream {
    constructor(stream) { this.geomStream = stream; }
    /** return false if this GeometryStream is empty. */
    hasGeometry() { return this.geomStream.byteLength !== 0; }
    static fromJSON(json) { return json ? new GeometryStream(js_base64_1.Base64.decode(json)) : undefined; }
}
exports.GeometryStream = GeometryStream;
/**
 * The placement of a GeometricElement3d. This includes the origin, orientation, and size (bounding box) of the element.
 * All geometry of a GeometricElement are relative to its placement.
 */
class Placement3d {
    constructor(origin, angles, bbox) {
        this.origin = origin;
        this.angles = angles;
        this.bbox = bbox;
    }
    getTransform() { return PointVector_1.Transform.createOriginAndMatrix(this.origin, this.angles.toRotMatrix()); }
    static fromJSON(json) {
        json = json ? json : {};
        return new Placement3d(PointVector_1.Point3d.fromJSON(json.origin), PointVector_1.YawPitchRollAngles.fromJSON(json.angles), ElementAlignedBox3d.fromJSON(json.bbox));
    }
    /** Determine whether this Placement3d is valid. */
    isValid() { return this.bbox.isValid() && this.origin.maxAbs() < Constant_1.Constant.circumferenceOfEarth; }
}
exports.Placement3d = Placement3d;
/** The placement of a GeometricElement2d. This includes the origin, orientation, and size (bounding box) of the element. */
class Placement2d {
    constructor(origin, angle, bbox) {
        this.origin = origin;
        this.angle = angle;
        this.bbox = bbox;
    }
    getTransform() { return PointVector_1.Transform.createOriginAndMatrix(PointVector_1.Point3d.createFrom(this.origin), PointVector_1.RotMatrix.createRotationAroundVector(PointVector_1.Vector3d.unitZ(), this.angle)); }
    static fromJSON(json) {
        json = json ? json : {};
        return new Placement2d(PointVector_1.Point2d.fromJSON(json.origin), Geometry_1.Angle.fromJSON(json.angle), ElementAlignedBox2d.fromJSON(json.bbox));
    }
    /** Determine whether this Placement2d is valid. */
    isValid() { return this.bbox.isValid() && this.origin.maxAbs() < Constant_1.Constant.circumferenceOfEarth; }
}
exports.Placement2d = Placement2d;
