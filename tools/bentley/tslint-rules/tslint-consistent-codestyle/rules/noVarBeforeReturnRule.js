"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var tslib_1 = require("tslib");
var ts = require("typescript");
var Lint = require("tslint");
var tsutils_1 = require("tsutils");
var utils_1 = require("../src/utils");
var OPTION_ALLOW_DESTRUCTURING = 'allow-destructuring';
var Rule = (function (_super) {
    tslib_1.__extends(Rule, _super);
    function Rule() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Rule.prototype.apply = function (sourceFile) {
        return this.applyWithFunction(sourceFile, walk, {
            allowDestructuring: this.ruleArguments.indexOf(OPTION_ALLOW_DESTRUCTURING) !== -1,
        });
    };
    return Rule;
}(Lint.Rules.AbstractRule));
exports.Rule = Rule;
function walk(ctx) {
    var variables;
    return ts.forEachChild(ctx.sourceFile, cbNode, cbNodeArray);
    function isUnused(node) {
        if (variables === undefined)
            variables = tsutils_1.collectVariableUsage(ctx.sourceFile);
        return variables.get(node).uses.length === 1;
    }
    function cbNode(node) {
        return ts.forEachChild(node, cbNode, cbNodeArray);
    }
    function cbNodeArray(nodes) {
        if (nodes.length === 0)
            return;
        ts.forEachChild(nodes[0], cbNode, cbNodeArray);
        for (var i = 1; i < nodes.length; ++i) {
            var node = nodes[i];
            if (tsutils_1.isReturnStatement(node)) {
                if (node.expression === undefined)
                    continue;
                if (!tsutils_1.isIdentifier(node.expression)) {
                    ts.forEachChild(node.expression, cbNode, cbNodeArray);
                    continue;
                }
                var previous = nodes[i - 1];
                if (tsutils_1.isVariableStatement(previous) && declaresVariable(previous, node.expression.text, isUnused, ctx.options))
                    ctx.addFailureAtNode(node.expression, "don't declare variable " + node.expression.text + " to return it immediately");
            }
            else {
                ts.forEachChild(node, cbNode, cbNodeArray);
            }
        }
    }
}
function declaresVariable(statement, name, isUnused, options) {
    var declarations = statement.declarationList.declarations;
    var lastDeclaration = declarations[declarations.length - 1].name;
    if (lastDeclaration.kind === ts.SyntaxKind.Identifier)
        return lastDeclaration.text === name && isUnused(lastDeclaration);
    return !options.allowDestructuring && isSimpleDestructuringForName(lastDeclaration, name, isUnused);
}
function isSimpleDestructuringForName(pattern, name, isUnused) {
    var identifiersSeen = new Set();
    var inArray = 0;
    var dependsOnVar = 0;
    return recur(pattern) === true;
    function recur(p) {
        if (p.kind === ts.SyntaxKind.ArrayBindingPattern) {
            ++inArray;
            for (var _i = 0, _a = p.elements; _i < _a.length; _i++) {
                var element = _a[_i];
                if (element.kind !== ts.SyntaxKind.OmittedExpression) {
                    var result = handleBindingElement(element);
                    if (result !== undefined)
                        return result;
                }
            }
            --inArray;
        }
        else {
            for (var _b = 0, _c = p.elements; _b < _c.length; _b++) {
                var element = _c[_b];
                var result = handleBindingElement(element);
                if (result !== undefined)
                    return result;
            }
        }
    }
    function handleBindingElement(element) {
        if (element.name.kind !== ts.SyntaxKind.Identifier) {
            if (dependsOnPrevious(element)) {
                ++dependsOnVar;
                var result = recur(element.name);
                --dependsOnVar;
                return result;
            }
            return recur(element.name);
        }
        if (element.name.text !== name)
            return void identifiersSeen.add(element.name.text);
        if (dependsOnVar !== 0)
            return false;
        if (element.dotDotDotToken) {
            if (element.parent.elements.length > 1 ||
                inArray > (element.parent.kind === ts.SyntaxKind.ArrayBindingPattern ? 1 : 0))
                return false;
        }
        else if (inArray !== 0) {
            return false;
        }
        if (element.initializer !== undefined && !utils_1.isUndefined(element.initializer))
            return false;
        return !dependsOnPrevious(element) && isUnused(element.name);
    }
    function dependsOnPrevious(element) {
        if (element.propertyName === undefined || element.propertyName.kind !== ts.SyntaxKind.ComputedPropertyName)
            return false;
        if (tsutils_1.isIdentifier(element.propertyName.expression))
            return identifiersSeen.has(element.propertyName.expression.text);
        if (tsutils_1.isLiteralExpression(element.propertyName.expression))
            return false;
        return true;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm9WYXJCZWZvcmVSZXR1cm5SdWxlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsibm9WYXJCZWZvcmVSZXR1cm5SdWxlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLCtCQUFpQztBQUNqQyw2QkFBK0I7QUFDL0IsbUNBQXVJO0FBRXZJLHNDQUEyQztBQUUzQyxJQUFNLDBCQUEwQixHQUFHLHFCQUFxQixDQUFDO0FBTXpEO0lBQTBCLGdDQUF1QjtJQUFqRDs7SUFNQSxDQUFDO0lBTFUsb0JBQUssR0FBWixVQUFhLFVBQXlCO1FBQ2xDLE9BQU8sSUFBSSxDQUFDLGlCQUFpQixDQUFDLFVBQVUsRUFBRSxJQUFJLEVBQUU7WUFDNUMsa0JBQWtCLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsMEJBQTBCLENBQUMsS0FBSyxDQUFDLENBQUM7U0FDcEYsQ0FBQyxDQUFDO0lBQ1AsQ0FBQztJQUNMLFdBQUM7QUFBRCxDQUFDLEFBTkQsQ0FBMEIsSUFBSSxDQUFDLEtBQUssQ0FBQyxZQUFZLEdBTWhEO0FBTlksb0JBQUk7QUFRakIsY0FBYyxHQUErQjtJQUN6QyxJQUFJLFNBQXVELENBQUM7SUFDNUQsT0FBTyxFQUFFLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxVQUFVLEVBQUUsTUFBTSxFQUFFLFdBQVcsQ0FBQyxDQUFDO0lBRTVELGtCQUFrQixJQUFtQjtRQUNqQyxJQUFJLFNBQVMsS0FBSyxTQUFTO1lBQ3ZCLFNBQVMsR0FBRyw4QkFBb0IsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDckQsT0FBTyxTQUFTLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBRSxDQUFDLElBQUksQ0FBQyxNQUFNLEtBQUssQ0FBQyxDQUFDO0lBQ2xELENBQUM7SUFFRCxnQkFBZ0IsSUFBYTtRQUN6QixPQUFPLEVBQUUsQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFLE1BQU0sRUFBRSxXQUFXLENBQUMsQ0FBQztJQUN0RCxDQUFDO0lB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