"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var tslib_1 = require("tslib");
var ts = require("typescript");
var Lint = require("tslint");
var tsutils_1 = require("tsutils");
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
    var seen = new Set();
    var enums = [];
    var declarations = [];
    var variables = tsutils_1.collectVariableUsage(ctx.sourceFile);
    variables.forEach(function (variable, identifier) {
        if (identifier.parent.kind !== ts.SyntaxKind.EnumDeclaration || seen.has(identifier))
            return;
        var track = {
            name: identifier.text,
            isConst: tsutils_1.hasModifier(identifier.parent.modifiers, ts.SyntaxKind.ConstKeyword),
            declarations: [],
            members: new Map(),
            canBeConst: !variable.inGlobalScope && !variable.exported,
            uses: variable.uses,
        };
        for (var _i = 0, _a = variable.declarations; _i < _a.length; _i++) {
            var declaration = _a[_i];
            seen.add(declaration);
            if (declaration.parent.kind !== ts.SyntaxKind.EnumDeclaration) {
                track.canBeConst = false;
            }
            else {
                track.declarations.push(declaration.parent);
                declarations.push({
                    track: track,
                    declaration: declaration.parent
                });
            }
        }
        enums.push(track);
    });
    declarations.sort(function (a, b) { return a.declaration.pos - b.declaration.pos; });
    for (var _i = 0, declarations_1 = declarations; _i < declarations_1.length; _i++) {
        var _a = declarations_1[_i], track = _a.track, declaration = _a.declaration;
        for (var _b = 0, _c = declaration.members; _b < _c.length; _b++) {
            var member = _c[_b];
            var isConst = track.isConst ||
                member.initializer === undefined ||
                isConstInitializer(member.initializer, track.members, findEnum);
            track.members.set(tsutils_1.getPropertyName(member.name), {
                isConst: isConst,
                stringValued: isConst && member.initializer !== undefined && isStringValued(member.initializer, track.members, findEnum),
            });
            if (!isConst)
                track.canBeConst = false;
        }
    }
    for (var _d = 0, enums_1 = enums; _d < enums_1.length; _d++) {
        var track = enums_1[_d];
        if (track.isConst || !track.canBeConst || !onlyConstUses(track))
            continue;
        for (var _e = 0, _f = track.declarations; _e < _f.length; _e++) {
            var declaration = _f[_e];
            ctx.addFailure(declaration.name.pos - 4, declaration.name.end, "Enum '" + track.name + "' can be a 'const enum'.", Lint.Replacement.appendText(declaration.name.pos - 4, 'const '));
        }
    }
    function findEnum(name) {
        for (var _i = 0, enums_2 = enums; _i < enums_2.length; _i++) {
            var track = enums_2[_i];
            if (track.name !== name.text)
                continue;
            for (var _a = 0, _b = track.uses; _a < _b.length; _a++) {
                var use = _b[_a];
                if (use.location === name)
                    return track;
            }
        }
    }
}
function onlyConstUses(track) {
    for (var _i = 0, _a = track.uses; _i < _a.length; _i++) {
        var use = _a[_i];
        if (use.domain & 2 || use.domain === 1)
            continue;
        if (use.domain & 8)
            return false;
        var parent = use.location.parent;
        switch (parent.kind) {
            default:
                return false;
            case ts.SyntaxKind.ElementAccessExpression:
                if (parent.argumentExpression === undefined ||
                    parent.argumentExpression.kind !== ts.SyntaxKind.StringLiteral)
                    return false;
                break;
            case ts.SyntaxKind.PropertyAccessExpression:
        }
    }
    return true;
}
function isConstInitializer(initializer, members, findEnum) {
    return (function isConst(node, allowStrings) {
        switch (node.kind) {
            case ts.SyntaxKind.Identifier:
                var member = members.get(node.text);
                return member !== undefined && member.isConst && (allowStrings || !member.stringValued);
            case ts.SyntaxKind.StringLiteral:
                return allowStrings;
            case ts.SyntaxKind.NumericLiteral:
                return true;
            case ts.SyntaxKind.PrefixUnaryExpression:
                return isConst(node.operand, false);
            case ts.SyntaxKind.ParenthesizedExpression:
                return isConst(node.expression, allowStrings);
        }
        if (tsutils_1.isPropertyAccessExpression(node)) {
            if (!tsutils_1.isIdentifier(node.expression))
                return false;
            var track = findEnum(node.expression);
            if (track === undefined)
                return false;
            var member = track.members.get(node.name.text);
            return member !== undefined && member.isConst && (allowStrings || !member.stringValued);
        }
        if (tsutils_1.isElementAccessExpression(node)) {
            if (!tsutils_1.isIdentifier(node.expression) ||
                node.argumentExpression === undefined ||
                !tsutils_1.isStringLiteral(node.argumentExpression))
                return false;
            var track = findEnum(node.expression);
            if (track === undefined)
                return false;
            var member = track.members.get(node.argumentExpression.text);
            return member !== undefined && member.isConst && (allowStrings || !member.stringValued);
        }
        if (tsutils_1.isBinaryExpression(node))
            return node.operatorToken.kind !== ts.SyntaxKind.AsteriskAsteriskToken &&
                node.operatorToken.kind !== ts.SyntaxKind.AmpersandAmpersandToken &&
                node.operatorToken.kind !== ts.SyntaxKind.BarBarToken &&
                !tsutils_1.isAssignmentKind(node.operatorToken.kind) &&
                isConst(node.left, false) && isConst(node.right, false);
        return false;
    })(initializer, true);
}
function isStringValued(initializer, members, findEnum) {
    return (function stringValued(node) {
        switch (node.kind) {
            case ts.SyntaxKind.ParenthesizedExpression:
                return stringValued(node.expression);
            case ts.SyntaxKind.Identifier:
                return members.get(node.text).stringValued;
            case ts.SyntaxKind.PropertyAccessExpression:
                return findEnum(node.expression)
                    .members.get(node.name.text).stringValued;
            case ts.SyntaxKind.ElementAccessExpression:
                return findEnum(node.expression)
                    .members.get(node.argumentExpression.text).stringValued;
            default:
                return true;
        }
    })(initializer);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJlZmVyQ29uc3RFbnVtUnVsZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInByZWZlckNvbnN0RW51bVJ1bGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsK0JBQWlDO0FBQ2pDLDZCQUErQjtBQUMvQixtQ0FHaUI7QUFFakI7SUFBMEIsZ0NBQXVCO0lBQWpEOztJQUlBLENBQUM7SUFIVSxvQkFBSyxHQUFaLFVBQWEsVUFBeUI7UUFDbEMsT0FBTyxJQUFJLENBQUMsaUJBQWlCLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQ3BELENBQUM7SUFDTCxXQUFDO0FBQUQsQ0FBQyxBQUpELENBQTBCLElBQUksQ0FBQyxLQUFLLENBQUMsWUFBWSxHQUloRDtBQUpZLG9CQUFJO0FBeUJqQixjQUFjLEdBQTJCO0lBQ3JDLElBQU0sSUFBSSxHQUFHLElBQUksR0FBRyxFQUFpQixDQUFDO0lBQ3RDLElBQU0sS0FBSyxHQUFZLEVBQUUsQ0FBQztJQUMxQixJQUFNLFlBQVksR0FBbUIsRUFBRSxDQUFDO0lBQ3hDLElBQU0sU0FBUyxHQUFHLDhCQUFvQixDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUN2RCxTQUFTLENBQUMsT0FBTyxDQUFDLFVBQUMsUUFBUSxFQUFFLFVBQVU7UUFDbkMsSUFBSSxVQUFVLENBQUMsTUFBTyxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsVUFBVSxDQUFDLGVBQWUsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQztZQUNqRixPQUFPO1FBQ1gsSUFBTSxLQUFLLEdBQVU7WUFDakIsSUFBSSxFQUFFLFVBQVUsQ0FBQyxJQUFJO1lBQ3JCLE9BQU8sRUFBRSxxQkFBVyxDQUFDLFVBQVUsQ0FBQyxNQUFPLENBQUMsU0FBUyxFQUFFLEVBQUUsQ0FBQyxVQUFVLENBQUMsWUFBWSxDQUFDO1lBQzlFLFlBQVksRUFBRSxFQUFFO1lBQ2hCLE9BQU8sRUFBRSxJQUFJLEdBQUcsRUFBRTtZQUNs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