"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var tslib_1 = require("tslib");
var Lint = require("tslint");
var ts = require("typescript");
var tsutils_1 = require("tsutils");
var FAILURE_STRING = 'accessor recursion is not allowed';
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
    var name;
    return ctx.sourceFile.statements.forEach(function cb(node) {
        if (tsutils_1.isAccessorDeclaration(node) && node.body !== undefined) {
            var before = name;
            name = tsutils_1.getPropertyName(node.name);
            node.body.statements.forEach(cb);
            name = before;
        }
        else if (name !== undefined && tsutils_1.hasOwnThisReference(node)) {
            var before = name;
            name = undefined;
            ts.forEachChild(node, cb);
            name = before;
        }
        else if (name !== undefined && tsutils_1.isPropertyAccessExpression(node) &&
            node.expression.kind === ts.SyntaxKind.ThisKeyword && node.name.text === name) {
            ctx.addFailureAtNode(node, FAILURE_STRING);
        }
        else {
            return ts.forEachChild(node, cb);
        }
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm9BY2Nlc3NvclJlY3Vyc2lvblJ1bGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJub0FjY2Vzc29yUmVjdXJzaW9uUnVsZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSw2QkFBK0I7QUFDL0IsK0JBQWlDO0FBQ2pDLG1DQUFrSDtBQUVsSCxJQUFNLGNBQWMsR0FBRyxtQ0FBbUMsQ0FBQztBQUUzRDtJQUEwQixnQ0FBdUI7SUFBakQ7O0lBSUEsQ0FBQztJQUhVLG9CQUFLLEdBQVosVUFBYSxVQUF5QjtRQUNsQyxPQUFPLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxVQUFVLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDcEQsQ0FBQztJQUNMLFdBQUM7QUFBRCxDQUFDLEFBSkQsQ0FBMEIsSUFBSSxDQUFDLEtBQUssQ0FBQyxZQUFZLEdBSWhEO0FBSlksb0JBQUk7QUFNakIsY0FBYyxHQUEyQjtJQUNyQyxJQUFJLElBQXdCLENBQUM7SUFFN0IsT0FBTyxHQUFHLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsWUFBWSxJQUFhO1FBQzlELElBQUksK0JBQXFCLENBQUMsSUFBSSxDQUFDLElBQUksSUFBSSxDQUFDLElBQUksS0FBSyxTQUFTLEVBQUU7WUFDeEQsSUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDO1lBQ3BCLElBQUksR0FBRyx5QkFBZSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNsQyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDakMsSUFBSSxHQUFHLE1BQU0sQ0FBQztTQUNqQjthQUFNLElBQUksSUFBSSxLQUFLLFNBQVMsSUFBSSw2QkFBbUIsQ0FBQyxJQUFJLENBQUMsRUFBRTtZQUN4RCxJQUFNLE1BQU0sR0FBRyxJQUFJLENBQUM7WUFDcEIsSUFBSSxHQUFHLFNBQVMsQ0FBQztZQUNqQixFQUFFLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQztZQUMxQixJQUFJLEdBQUcsTUFBTSxDQUFDO1NBQ2pCO2FBQU0sSUFBSSxJQUFJLEtBQUssU0FBUyxJQUFJLG9DQUEwQixDQUFDLElBQUksQ0FBQztZQUN0RCxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsVUFBVSxDQUFDLFdBQVcsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksS0FBSyxJQUFJLEVBQUU7WUFDdEYsR0FBRyxDQUFDLGdCQUFnQixDQUFDLElBQUksRUFBRSxjQUFjLENBQUMsQ0FBQztTQUM5QzthQUFNO1lBQ0gsT0FBTyxFQUFFLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQztTQUNwQztJQUNMLENBQUMsQ0FBQyxDQUFDO0FBQ1AsQ0FBQyJ9