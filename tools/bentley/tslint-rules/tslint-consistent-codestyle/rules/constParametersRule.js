"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var tslib_1 = require("tslib");
var tsutils_1 = require("tsutils");
var ts = require("typescript");
var Lint = require("tslint");
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
    tsutils_1.collectVariableUsage(ctx.sourceFile).forEach(function (variable, identifier) {
        if (!isParameter(identifier.parent) || !isConst(identifier, ctx.sourceFile))
            return;
        for (var _i = 0, _a = variable.uses; _i < _a.length; _i++) {
            var use = _a[_i];
            if (tsutils_1.isReassignmentTarget(use.location))
                ctx.addFailureAtNode(use.location, "Cannot reassign constant parameter '" + identifier.text + "'.");
        }
    });
}
function isParameter(node) {
    switch (node.kind) {
        case ts.SyntaxKind.Parameter:
            return true;
        case ts.SyntaxKind.BindingElement:
            return tsutils_1.getDeclarationOfBindingElement(node).kind === ts.SyntaxKind.Parameter;
        default:
            return false;
    }
}
function isConst(name, sourceFile) {
    if (name.parent.kind === ts.SyntaxKind.Parameter)
        return tsutils_1.getJsDoc(name.parent, sourceFile).some(jsDocContainsConst);
    return tsutils_1.parseJsDocOfNode(name, true, sourceFile).some(jsDocContainsConst);
}
function jsDocContainsConst(jsDoc) {
    if (jsDoc.tags !== undefined)
        for (var _i = 0, _a = jsDoc.tags; _i < _a.length; _i++) {
            var tag = _a[_i];
            if (tag.tagName.text === 'const' || tag.tagName.text === 'constant')
                return true;
        }
    return false;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uc3RQYXJhbWV0ZXJzUnVsZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImNvbnN0UGFyYW1ldGVyc1J1bGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBaUJBLG1DQUFpSTtBQUNqSSwrQkFBaUM7QUFDakMsNkJBQStCO0FBRS9CO0lBQTBCLGdDQUF1QjtJQUFqRDs7SUFJQSxDQUFDO0lBSFUsb0JBQUssR0FBWixVQUFhLFVBQXlCO1FBQ2xDLE9BQU8sSUFBSSxDQUFDLGlCQUFpQixDQUFDLFVBQVUsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUNwRCxDQUFDO0lBQ0wsV0FBQztBQUFELENBQUMsQUFKRCxDQUEwQixJQUFJLENBQUMsS0FBSyxDQUFDLFlBQVksR0FJaEQ7QUFKWSxvQkFBSTtBQU1qQixjQUFjLEdBQTJCO0lBQ3JDLDhCQUFvQixDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBQyxRQUFRLEVBQUUsVUFBVTtRQUM5RCxJQUFJLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxNQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxVQUFVLEVBQUUsR0FBRyxDQUFDLFVBQVUsQ0FBQztZQUN4RSxPQUFPO1FBQ1gsS0FBa0IsVUFBYSxFQUFiLEtBQUEsUUFBUSxDQUFDLElBQUksRUFBYixjQUFhLEVBQWIsSUFBYTtZQUExQixJQUFNLEdBQUcsU0FBQTtZQUNWLElBQUksOEJBQW9CLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQztnQkFDbEMsR0FBRyxDQUFDLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUseUNBQXVDLFVBQVUsQ0FBQyxJQUFJLE9BQUksQ0FBQyxDQUFDO1NBQUE7SUFDM0csQ0FBQyxDQUFDLENBQUM7QUFDUCxDQUFDO0FBRUQscUJBQXFCLElBQWE7SUFDOUIsUUFBUSxJQUFJLENBQUMsSUFBSSxFQUFFO1FBQ2YsS0FBSyxFQUFFLENBQUMsVUFBVSxDQUFDLFNBQVM7WUFDeEIsT0FBTyxJQUFJLENBQUM7UUFDaEIsS0FBSyxFQUFFLENBQUMsVUFBVSxDQUFDLGNBQWM7WUFDN0IsT0FBTyx3Q0FBOEIsQ0FBb0IsSUFBSSxDQUFDLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDO1FBQ3BHO1lBQ0ksT0FBTyxLQUFLLENBQUM7S0FDcEI7QUFDTCxDQUFDO0FBRUQsaUJBQWlCLElBQW1CLEVBQUUsVUFBeUI7SUFDM0QsSUFBSSxJQUFJLENBQUMsTUFBTyxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsVUFBVSxDQUFDLFNBQVM7UUFDN0MsT0FBTyxrQkFBUSxDQUFDLElBQUksQ0FBQyxNQUFPLEVBQUUsVUFBVSxDQUFDLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLENBQUM7SUFFdkUsT0FBTywwQkFBZ0IsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLFVBQVUsQ0FBQyxDQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO0FBQzdFLENBQUM7QUFFRCw0QkFBNEIsS0FBZTtJQUN2QyxJQUFJLEtBQUssQ0FBQyxJQUFJLEtBQUssU0FBUztRQUN4QixLQUFrQixVQUFVLEVBQVYsS0FBQSxLQUFLLENBQUMsSUFBSSxFQUFWLGNBQVUsRUFBVixJQUFVO1lBQXZCLElBQU0sR0FBRyxTQUFBO1lBQ1YsSUFBSSxHQUFHLENBQUMsT0FBTyxDQUFDLElBQUksS0FBSyxPQUFPLElBQUksR0FBRyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEtBQUssVUFBVTtnQkFDL0QsT0FBTyxJQUFJLENBQUM7U0FBQTtJQUN4QixPQUFPLEtBQUssQ0FBQztBQUNqQixDQUFDIn0=