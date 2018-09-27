"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var tslib_1 = require("tslib");
var ts = require("typescript");
var Lint = require("tslint");
var tsutils_1 = require("tsutils");
var FAIL_MESSAGE = 'use <Type> instead of `as Type`';
var Rule = (function (_super) {
    tslib_1.__extends(Rule, _super);
    function Rule() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Rule.prototype.apply = function (sourceFile) {
        return this.applyWithFunction(sourceFile, walk);
    };
    return Rule;
}(Lint.Rules.AbstractRule));
exports.Rule = Rule;
function walk(ctx) {
    if (ctx.sourceFile.languageVariant === ts.LanguageVariant.JSX)
        return;
    return ts.forEachChild(ctx.sourceFile, function cb(node) {
        var _a;
        if (tsutils_1.isAsExpression(node)) {
            var type = node.type, expression = node.expression;
            var replacement = "<" + type.getText(ctx.sourceFile) + ">";
            while (tsutils_1.isAsExpression(expression)) {
                (_a = expression, type = _a.type, expression = _a.expression);
                replacement += "<" + type.getText(ctx.sourceFile) + ">";
            }
            ctx.addFailure(type.pos - 2, node.end, FAIL_MESSAGE, [
                Lint.Replacement.appendText(expression.getStart(ctx.sourceFile), replacement),
                Lint.Replacement.deleteFromTo(expression.end, node.end),
            ]);
            return cb(expression);
        }
        return ts.forEachChild(node, cb);
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm9Bc1R5cGVBc3NlcnRpb25SdWxlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsibm9Bc1R5cGVBc3NlcnRpb25SdWxlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLCtCQUFpQztBQUNqQyw2QkFBK0I7QUFDL0IsbUNBQXVDO0FBRXZDLElBQU0sWUFBWSxHQUFHLGlDQUFpQyxDQUFDO0FBRXZEO0lBQTBCLGdDQUF1QjtJQUFqRDs7SUFJQSxDQUFDO0lBSFUsb0JBQUssR0FBWixVQUFhLFVBQXlCO1FBQ2xDLE9BQU8sSUFBSSxDQUFDLGlCQUFpQixDQUFDLFVBQVUsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUNwRCxDQUFDO0lBQ0wsV0FBQztBQUFELENBQUMsQUFKRCxDQUEwQixJQUFJLENBQUMsS0FBSyxDQUFDLFlBQVksR0FJaEQ7QUFKWSxvQkFBSTtBQU1qQixjQUFjLEdBQTJCO0lBQ3JDLElBQUksR0FBRyxDQUFDLFVBQVUsQ0FBQyxlQUFlLEtBQUssRUFBRSxDQUFDLGVBQWUsQ0FBQyxHQUFHO1FBQ3pELE9BQU87SUFDWCxPQUFPLEVBQUUsQ0FBQyxZQUFZLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRSxZQUFZLElBQUk7O1FBQ25ELElBQUksd0JBQWMsQ0FBQyxJQUFJLENBQUMsRUFBRTtZQUNqQixJQUFBLGdCQUFJLEVBQUUsNEJBQVUsQ0FBUztZQUM5QixJQUFJLFdBQVcsR0FBRyxNQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxNQUFHLENBQUM7WUFDdEQsT0FBTyx3QkFBYyxDQUFDLFVBQVUsQ0FBQyxFQUFFO2dCQUMvQixDQUFDLGVBQStCLEVBQTlCLGNBQUksRUFBRSwwQkFBVSxDQUFlLENBQUM7Z0JBQ2xDLFdBQVcsSUFBSSxNQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxNQUFHLENBQUM7YUFDdEQ7WUFDRCxHQUFHLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxHQUFHLEdBQUcsQ0FBQyxFQUFFLElBQUksQ0FBQyxHQUFHLEVBQUUsWUFBWSxFQUFFO2dCQUNqRCxJQUFJLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsRUFBRSxXQUFXLENBQUM7Z0JBQzdFLElBQUksQ0FBQyxXQUFXLENBQUMsWUFBWSxDQUFDLFVBQVUsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQzthQUMxRCxDQUFDLENBQUM7WUFDSCxPQUFPLEVBQUUsQ0FBQyxVQUFVLENBQUMsQ0FBQztTQUN6QjtRQUNELE9BQU8sRUFBRSxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFDckMsQ0FBQyxDQUFDLENBQUM7QUFDUCxDQUFDIn0=