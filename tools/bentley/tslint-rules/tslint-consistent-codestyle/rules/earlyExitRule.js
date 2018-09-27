"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var tslib_1 = require("tslib");
var tsutils_1 = require("tsutils");
var Lint = require("tslint");
var ts = require("typescript");
var Rule = (function (_super) {
    tslib_1.__extends(Rule, _super);
    function Rule() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Rule.prototype.apply = function (sourceFile) {
        var options = tslib_1.__assign({ 'max-length': 2 }, this.ruleArguments[0]);
        return this.applyWithFunction(sourceFile, walk, options);
    };
    return Rule;
}(Lint.Rules.AbstractRule));
exports.Rule = Rule;
function failureString(exit) {
    return "Remainder of block is inside 'if' statement. Prefer to invert the condition and '" + exit + "' early.";
}
function failureStringSmall(exit, branch) {
    return "'" + branch + "' branch is small; prefer an early '" + exit + "' to a full if-else.";
}
function failureStringAlways(exit) {
    return "Prefer an early '" + exit + "' to a full if-else.";
}
function walk(ctx) {
    var sourceFile = ctx.sourceFile, maxLineLength = ctx.options["max-length"];
    return ts.forEachChild(sourceFile, function cb(node) {
        if (tsutils_1.isIfStatement(node))
            check(node);
        return ts.forEachChild(node, cb);
    });
    function check(node) {
        var exit = getExit(node);
        if (exit === undefined)
            return;
        var thenStatement = node.thenStatement, elseStatement = node.elseStatement;
        var thenSize = size(thenStatement, sourceFile);
        if (elseStatement === undefined) {
            if (isLarge(thenSize))
                fail(failureString(exit));
            return;
        }
        if (elseStatement.kind === ts.SyntaxKind.IfStatement)
            return;
        if (maxLineLength === 0)
            return fail(failureStringAlways(exit));
        var elseSize = size(elseStatement, sourceFile);
        if (isSmall(thenSize) && isLarge(elseSize)) {
            fail(failureStringSmall(exit, 'then'));
        }
        else if (isSmall(elseSize) && isLarge(thenSize)) {
            fail(failureStringSmall(exit, 'else'));
        }
        function fail(failure) {
            ctx.addFailureAt(node.getStart(sourceFile), 2, failure);
        }
    }
    function isSmall(length) {
        return length === 1;
    }
    function isLarge(length) {
        return length > maxLineLength;
    }
}
function size(node, sourceFile) {
    return tsutils_1.isBlock(node)
        ? node.statements.length === 0 ? 0 : diff(node.statements[0].getStart(sourceFile), node.statements.end, sourceFile)
        : diff(node.getStart(sourceFile), node.end, sourceFile);
}
function diff(start, end, sourceFile) {
    return ts.getLineAndCharacterOfPosition(sourceFile, end).line
        - ts.getLineAndCharacterOfPosition(sourceFile, start).line
        + 1;
}
function getExit(node) {
    var parent = node.parent;
    if (tsutils_1.isBlock(parent)) {
        var container = parent.parent;
        return tsutils_1.isCaseOrDefaultClause(container) && container.statements.length === 1
            ? getCaseClauseExit(container, parent, node)
            : isLastStatement(node, parent.statements) ? getEarlyExitKind(container) : undefined;
    }
    return tsutils_1.isCaseOrDefaultClause(parent)
        ? getCaseClauseExit(parent, parent, node)
        : getEarlyExitKind(parent);
}
function getCaseClauseExit(clause, _a, node) {
    var statements = _a.statements;
    return statements[statements.length - 1].kind === ts.SyntaxKind.BreakStatement
        ? isLastStatement(node, statements, statements.length - 2) ? 'break' : undefined
        : clause.parent.clauses[clause.parent.clauses.length - 1] === clause && isLastStatement(node, statements) ? 'break' : undefined;
}
function getEarlyExitKind(_a) {
    var kind = _a.kind;
    switch (kind) {
        case ts.SyntaxKind.FunctionDeclaration:
        case ts.SyntaxKind.FunctionExpression:
        case ts.SyntaxKind.ArrowFunction:
        case ts.SyntaxKind.MethodDeclaration:
        case ts.SyntaxKind.Constructor:
        case ts.SyntaxKind.GetAccessor:
        case ts.SyntaxKind.SetAccessor:
            return 'return';
        case ts.SyntaxKind.ForInStatement:
        case ts.SyntaxKind.ForOfStatement:
        case ts.SyntaxKind.ForStatement:
        case ts.SyntaxKind.WhileStatement:
        case ts.SyntaxKind.DoStatement:
            return 'continue';
        default:
            return;
    }
}
function isLastStatement(ifStatement, statements, i) {
    if (i === void 0) { i = statements.length - 1; }
    while (true) {
        var statement = statements[i];
        if (statement === ifStatement)
            return true;
        if (statement.kind !== ts.SyntaxKind.FunctionDeclaration)
            return false;
        if (i === 0)
            throw new Error();
        i--;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWFybHlFeGl0UnVsZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImVhcmx5RXhpdFJ1bGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUNBQXdFO0FBQ3hFLDZCQUErQjtBQUMvQiwrQkFBaUM7QUFFakM7SUFBMEIsZ0NBQXVCO0lBQWpEOztJQUtBLENBQUM7SUFKVSxvQkFBSyxHQUFaLFVBQWEsVUFBeUI7UUFDbEMsSUFBTSxPQUFPLHNCQUFLLFlBQVksRUFBRSxDQUFDLElBQUssSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBRSxDQUFDO1FBQzlELE9BQU8sSUFBSSxDQUFDLGlCQUFpQixDQUFDLFVBQVUsRUFBRSxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDN0QsQ0FBQztJQUNMLFdBQUM7QUFBRCxDQUFDLEFBTEQsQ0FBMEIsSUFBSSxDQUFDLEtBQUssQ0FBQyxZQUFZLEdBS2hEO0FBTFksb0JBQUk7QUFPakIsdUJBQXVCLElBQVk7SUFDL0IsT0FBTyxzRkFBb0YsSUFBSSxhQUFVLENBQUM7QUFDOUcsQ0FBQztBQUVELDRCQUE0QixJQUFZLEVBQUUsTUFBdUI7SUFDN0QsT0FBTyxNQUFJLE1BQU0sNENBQXVDLElBQUkseUJBQXNCLENBQUM7QUFDdkYsQ0FBQztBQUVELDZCQUE2QixJQUFZO0lBQ3JDLE9BQU8sc0JBQW9CLElBQUkseUJBQXNCLENBQUM7QUFDMUQsQ0FBQztBQU1ELGNBQWMsR0FBK0I7SUFDakMsSUFBQSwyQkFBVSxFQUFhLHlDQUEyQixDQUFXO0lBRXJFLE9BQU8sRUFBRSxDQUFDLFlBQVksQ0FBQyxVQUFVLEVBQUUsWUFBWSxJQUFJO1FBQy9DLElBQUksdUJBQWEsQ0FBQyxJQUFJLENBQUM7WUFDbkIsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ2hCLE9BQU8sRUFBRSxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFDckMsQ0FBQyxDQUFDLENBQUM7SUFF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