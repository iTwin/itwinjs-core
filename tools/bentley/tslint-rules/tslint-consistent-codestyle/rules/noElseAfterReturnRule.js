"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var tslib_1 = require("tslib");
var Lint = require("tslint");
var utils_1 = require("../src/utils");
var walker_1 = require("../src/walker");
var tsutils_1 = require("tsutils");
var FAIL_MESSAGE = "unnecessary else after return";
var OPTION_ALLOW_ELSE_IF = 'allow-else-if';
var Rule = (function (_super) {
    tslib_1.__extends(Rule, _super);
    function Rule() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Rule.prototype.apply = function (sourceFile) {
        return this.applyWithWalker(new IfWalker(sourceFile, this.ruleName, {
            allowElseIf: this.ruleArguments.indexOf(OPTION_ALLOW_ELSE_IF) !== -1,
        }));
    };
    return Rule;
}(Lint.Rules.AbstractRule));
exports.Rule = Rule;
var IfWalker = (function (_super) {
    tslib_1.__extends(IfWalker, _super);
    function IfWalker() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    IfWalker.prototype._checkIfStatement = function (node) {
        if (shouldCheckNode(node, this.options.allowElseIf) && endsWithReturnStatement(node.thenStatement))
            this.addFailureAtNode(node.getChildAt(5, this.sourceFile), FAIL_MESSAGE);
    };
    return IfWalker;
}(walker_1.AbstractIfStatementWalker));
function shouldCheckNode(node, allowElseIf) {
    if (node.elseStatement === undefined)
        return false;
    if (!allowElseIf)
        return !utils_1.isElseIf(node);
    if (tsutils_1.isIfStatement(node.elseStatement) && utils_1.isElseIf(node.elseStatement))
        return false;
    while (utils_1.isElseIf(node)) {
        node = node.parent;
        if (!endsWithReturnStatement(node.thenStatement))
            return false;
    }
    return true;
}
function endsWithReturnStatement(node) {
    var end = tsutils_1.getControlFlowEnd(node);
    return end.end && end.statements.every(tsutils_1.isReturnStatement);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm9FbHNlQWZ0ZXJSZXR1cm5SdWxlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsibm9FbHNlQWZ0ZXJSZXR1cm5SdWxlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUNBLDZCQUErQjtBQUUvQixzQ0FBd0M7QUFDeEMsd0NBQTBEO0FBQzFELG1DQUE4RTtBQUU5RSxJQUFNLFlBQVksR0FBRywrQkFBK0IsQ0FBQztBQUNyRCxJQUFNLG9CQUFvQixHQUFHLGVBQWUsQ0FBQztBQU03QztJQUEwQixnQ0FBdUI7SUFBakQ7O0lBTUEsQ0FBQztJQUxVLG9CQUFLLEdBQVosVUFBYSxVQUF5QjtRQUNsQyxPQUFPLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxRQUFRLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxRQUFRLEVBQUU7WUFDaEUsV0FBVyxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLG9CQUFvQixDQUFDLEtBQUssQ0FBQyxDQUFDO1NBQ3ZFLENBQUMsQ0FBQyxDQUFDO0lBQ1IsQ0FBQztJQUNMLFdBQUM7QUFBRCxDQUFDLEFBTkQsQ0FBMEIsSUFBSSxDQUFDLEtBQUssQ0FBQyxZQUFZLEdBTWhEO0FBTlksb0JBQUk7QUFRakI7SUFBdUIsb0NBQW1DO0lBQTFEOztJQUtBLENBQUM7SUFKYSxvQ0FBaUIsR0FBM0IsVUFBNEIsSUFBb0I7UUFDNUMsSUFBSSxlQUFlLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLElBQUksdUJBQXVCLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQztZQUM5RixJQUFJLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLEVBQVcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxFQUFFLFlBQVksQ0FBQyxDQUFDO0lBQzFGLENBQUM7SUFDTCxlQUFDO0FBQUQsQ0FBQyxBQUxELENBQXVCLGtDQUF5QixHQUsvQztBQUVELHlCQUF5QixJQUFvQixFQUFFLFdBQW9CO0lBQy9ELElBQUksSUFBSSxDQUFDLGFBQWEsS0FBSyxTQUFTO1FBQ2hDLE9BQU8sS0FBSyxDQUFDO0lBQ2pCLElBQUksQ0FBQyxXQUFXO1FBQ1osT0FBTyxDQUFDLGdCQUFRLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDM0IsSUFBSSx1QkFBYSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxnQkFBUSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUM7UUFDakUsT0FBTyxLQUFLLENBQUM7SUFDakIsT0FBTyxnQkFBUSxDQUFDLElBQUksQ0FBQyxFQUFFO1FBQ25CLElBQUksR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDO1FBQ25CLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDO1lBQzVDLE9BQU8sS0FBSyxDQUFDO0tBQ3BCO0lBQ0QsT0FBTyxJQUFJLENBQUM7QUFDaEIsQ0FBQztBQUVELGlDQUFpQyxJQUFrQjtJQUMvQyxJQUFNLEdBQUcsR0FBRywyQkFBaUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNwQyxPQUFPLEdBQUcsQ0FBQyxHQUFHLElBQUksR0FBRyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsMkJBQWlCLENBQUMsQ0FBQztBQUM5RCxDQUFDIn0=