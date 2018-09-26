"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var tslib_1 = require("tslib");
var ts = require("typescript");
var Lint = require("tslint");
var AbstractReturnStatementWalker = (function (_super) {
    tslib_1.__extends(AbstractReturnStatementWalker, _super);
    function AbstractReturnStatementWalker() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    AbstractReturnStatementWalker.prototype.walk = function (sourceFile) {
        var _this = this;
        var cb = function (node) {
            if (node.kind === ts.SyntaxKind.ReturnStatement)
                _this._checkReturnStatement(node);
            return ts.forEachChild(node, cb);
        };
        return ts.forEachChild(sourceFile, cb);
    };
    return AbstractReturnStatementWalker;
}(Lint.AbstractWalker));
exports.AbstractReturnStatementWalker = AbstractReturnStatementWalker;
var AbstractIfStatementWalker = (function (_super) {
    tslib_1.__extends(AbstractIfStatementWalker, _super);
    function AbstractIfStatementWalker() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    AbstractIfStatementWalker.prototype.walk = function (sourceFile) {
        var _this = this;
        var cb = function (node) {
            if (node.kind === ts.SyntaxKind.IfStatement)
                _this._checkIfStatement(node);
            return ts.forEachChild(node, cb);
        };
        return ts.forEachChild(sourceFile, cb);
    };
    return AbstractIfStatementWalker;
}(Lint.AbstractWalker));
exports.AbstractIfStatementWalker = AbstractIfStatementWalker;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2Fsa2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsid2Fsa2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLCtCQUFpQztBQUNqQyw2QkFBK0I7QUFFL0I7SUFBK0QseURBQXNCO0lBQXJGOztJQVdBLENBQUM7SUFWVSw0Q0FBSSxHQUFYLFVBQVksVUFBeUI7UUFBckMsaUJBT0M7UUFORyxJQUFNLEVBQUUsR0FBRyxVQUFDLElBQWE7WUFDckIsSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxVQUFVLENBQUMsZUFBZTtnQkFDM0MsS0FBSSxDQUFDLHFCQUFxQixDQUFxQixJQUFJLENBQUMsQ0FBQztZQUN6RCxPQUFPLEVBQUUsQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBQ3JDLENBQUMsQ0FBQztRQUNGLE9BQU8sRUFBRSxDQUFDLFlBQVksQ0FBQyxVQUFVLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFDM0MsQ0FBQztJQUdMLG9DQUFDO0FBQUQsQ0FBQyxBQVhELENBQStELElBQUksQ0FBQyxjQUFjLEdBV2pGO0FBWHFCLHNFQUE2QjtBQWFuRDtJQUEyRCxxREFBc0I7SUFBakY7O0lBV0EsQ0FBQztJQVZVLHdDQUFJLEdBQVgsVUFBWSxVQUF5QjtRQUFyQyxpQkFPQztRQU5HLElBQU0sRUFBRSxHQUFHLFVBQUMsSUFBYTtZQUNyQixJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLFVBQVUsQ0FBQyxXQUFXO2dCQUN2QyxLQUFJLENBQUMsaUJBQWlCLENBQWlCLElBQUksQ0FBQyxDQUFDO1lBQ2pELE9BQU8sRUFBRSxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDckMsQ0FBQyxDQUFDO1FBQ0YsT0FBTyxFQUFFLENBQUMsWUFBWSxDQUFDLFVBQVUsRUFBRSxFQUFFLENBQUMsQ0FBQztJQUMzQyxDQUFDO0lBR0wsZ0NBQUM7QUFBRCxDQUFDLEFBWEQsQ0FBMkQsSUFBSSxDQUFDLGNBQWMsR0FXN0U7QUFYcUIsOERBQXlCIn0=