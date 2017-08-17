"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const BeSQLite_1 = require("@bentley/bentleyjs-core/lib/BeSQLite");
const assert_1 = require("@bentley/bentleyjs-core/lib/assert");
/** Base class for all schema classes. */
class ElementPropertyFormatter {
    /** Construct a formatter
     * @param iModel  The IModel that contains the elements that are to be formatted.
     * *** TBD: Take presentation rules as an argument?
     */
    constructor(iModel) { this._iModel = iModel; }
    /**
     * Format the properties of an elemen, suitable for display in a property browser.
     * The returned object will contain the formatted properties, organized according to the presentation rules.
     * For example, the immediate properties may represent categories of properties, where each category object contains the names and values of the proeprties in that category.
     * @param elem        The element to formatName of briefcase to query
     * *** TBD: Take presentation rules as an argument?
     * @return the formatted properties of the element as an anonymous element
     */
    formatProperties(elem) {
        return __awaiter(this, void 0, void 0, function* () {
            // *** NEEDS WORK: We want to format the element's properties right here, using presentation rules.
            // ***             *For now* we must fall back on some hard-coded formatting logic in the native code library.
            // ***             This is a very bad work-around, as it formats the properties of the persistent element in the BIM, not the element passed in!
            const res = yield this._iModel.dgnDb.tempfmtPropsNative(elem.id.toString());
            if (res.error || undefined === res.result)
                return res;
            const propsObj = JSON.parse(res.result);
            if (undefined === propsObj) {
                assert_1.assert(false, "tempfmtPropsNative returned invalid JSON on success");
                return Promise.resolve({ error: { status: BeSQLite_1.DbResult.BE_SQLITE_ABORT, message: "?" } });
            }
            return Promise.resolve({ result: propsObj });
        });
    }
}
exports.ElementPropertyFormatter = ElementPropertyFormatter;
