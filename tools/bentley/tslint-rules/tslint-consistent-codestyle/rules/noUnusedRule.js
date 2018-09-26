"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var tslib_1 = require("tslib");
var ts = require("typescript");
var Lint = require("tslint");
var tsutils_1 = require("tsutils");
var OPTION_FUNCTION_EXPRESSION_NAME = 'unused-function-expression-name';
var OPTION_CLASS_EXPRESSION_NAME = 'unused-class-expression-name';
var OPTION_CATCH_BINDING = 'unused-catch-binding';
var OPTION_IGNORE_PARAMETERS = 'ignore-parameters';
var OPTION_IGNORE_IMPORTS = 'ignore-imports';
var Rule = (function (_super) {
    tslib_1.__extends(Rule, _super);
    function Rule() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Rule.prototype.apply = function (sourceFile) {
        return this.applyWithWalker(new UnusedWalker(sourceFile, this.ruleName, {
            functionExpressionName: this.ruleArguments.indexOf(OPTION_FUNCTION_EXPRESSION_NAME) !== -1,
            classExpressionName: this.ruleArguments.indexOf(OPTION_CLASS_EXPRESSION_NAME) !== -1,
            ignoreParameters: this.ruleArguments.indexOf(OPTION_IGNORE_PARAMETERS) !== -1,
            ignoreImports: this.ruleArguments.indexOf(OPTION_IGNORE_IMPORTS) !== -1,
            catchBinding: this.ruleArguments.indexOf(OPTION_CATCH_BINDING) !== -1,
        }));
    };
    return Rule;
}(Lint.Rules.AbstractRule));
exports.Rule = Rule;
var UnusedWalker = (function (_super) {
    tslib_1.__extends(UnusedWalker, _super);
    function UnusedWalker() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    UnusedWalker.prototype.walk = function (sourceFile) {
        var _this = this;
        var usage = tsutils_1.collectVariableUsage(sourceFile);
        usage.forEach(function (variable, identifier) {
            if (isExcluded(variable, sourceFile, usage, _this.options))
                return;
            switch (identifier.parent.kind) {
                case ts.SyntaxKind.FunctionExpression:
                    if (variable.uses.length === 0 && _this.options.functionExpressionName)
                        _this._failNamedExpression(identifier, "Function");
                    return;
                case ts.SyntaxKind.ClassExpression:
                    if (variable.uses.length === 0 && _this.options.classExpressionName)
                        _this._failNamedExpression(identifier, "Class");
                    return;
            }
            if (variable.uses.length === 0) {
                if (identifier.text === 'React' && _this.sourceFile.languageVariant === ts.LanguageVariant.JSX &&
                    isImportFromExternal(identifier) && containsJsx(_this.sourceFile))
                    return;
                return _this._fail(identifier, 'unused');
            }
            var uses = filterWriteOnly(variable.uses, identifier);
            if (uses.length === 0)
                return _this._fail(identifier, 'only written and never read');
            var filtered = uses.length !== variable.uses.length;
            uses = filterUsesInDeclaration(uses, variable.declarations);
            if (uses.length === 0)
                return _this._fail(identifier, "only " + (filtered ? 'written or ' : '') + "used inside of its declaration");
        });
    };
    UnusedWalker.prototype._fail = function (identifier, error) {
        return this.addFailureAtNode(identifier, showKind(identifier) + " '" + identifier.text + "' is " + error + ".");
    };
    UnusedWalker.prototype._failNamedExpression = function (identifier, kind) {
        this.addFailureAtNode(identifier, kind + " '" + identifier.text + "' is never used by its name. Convert it to an anonymous " + kind.toLocaleLowerCase() + " expression.", Lint.Replacement.deleteFromTo(identifier.pos, identifier.end));
    };
    return UnusedWalker;
}(Lint.AbstractWalker));
function containsJsx(node) {
    switch (node.kind) {
        case ts.SyntaxKind.JsxElement:
        case ts.SyntaxKind.JsxSelfClosingElement:
        case ts.SyntaxKind.JsxFragment:
            return true;
        default:
            return ts.forEachChild(node, containsJsx);
    }
}
function filterUsesInDeclaration(uses, declarations) {
    var result = [];
    outer: for (var _i = 0, uses_1 = uses; _i < uses_1.length; _i++) {
        var use = uses_1[_i];
        for (var _a = 0, declarations_1 = declarations; _a < declarations_1.length; _a++) {
            var declaration = declarations_1[_a];
            var parent = declaration.parent;
            if (use.location.pos > parent.pos && use.location.pos < parent.end &&
                (parent.kind !== ts.SyntaxKind.VariableDeclaration ||
                    initializerHasNoSideEffect(parent, use.location)))
                continue outer;
        }
        result.push(use);
    }
    return result;
}
function initializerHasNoSideEffect(declaration, use) {
    if (declaration.initializer === undefined)
        return true;
    return (function cb(node) {
        if (node.pos > use.pos)
            return 2;
        if (node.end <= use.pos)
            return;
        switch (node.kind) {
            case ts.SyntaxKind.CallExpression:
            case ts.SyntaxKind.NewExpression:
            case ts.SyntaxKind.TaggedTemplateExpression:
                return 1;
            case ts.SyntaxKind.ArrowFunction:
            case ts.SyntaxKind.FunctionExpression:
            case ts.SyntaxKind.ClassExpression:
                return 2;
        }
        return ts.forEachChild(node, cb);
    })(declaration.initializer) !== 1;
}
function filterWriteOnly(uses, identifier) {
    var result = [];
    for (var _i = 0, uses_2 = uses; _i < uses_2.length; _i++) {
        var use = uses_2[_i];
        if (use.domain & (2 | 8) ||
            tsutils_1.isExpressionValueUsed(use.location) && !isUpdate(use.location, identifier))
            result.push(use);
    }
    return result;
}
function isUpdate(use, identifier) {
    while (true) {
        var parent = use.parent;
        switch (parent.kind) {
            case ts.SyntaxKind.ParenthesizedExpression:
            case ts.SyntaxKind.NonNullExpression:
            case ts.SyntaxKind.TypeAssertionExpression:
            case ts.SyntaxKind.AsExpression:
            case ts.SyntaxKind.PrefixUnaryExpression:
            case ts.SyntaxKind.PostfixUnaryExpression:
            case ts.SyntaxKind.TypeOfExpression:
            case ts.SyntaxKind.ConditionalExpression:
            case ts.SyntaxKind.SpreadElement:
            case ts.SyntaxKind.SpreadAssignment:
            case ts.SyntaxKind.ObjectLiteralExpression:
            case ts.SyntaxKind.ArrayLiteralExpression:
                use = parent;
                break;
            case ts.SyntaxKind.PropertyAssignment:
            case ts.SyntaxKind.ShorthandPropertyAssignment:
            case ts.SyntaxKind.TemplateSpan:
                use = parent.parent;
                break;
            case ts.SyntaxKind.BinaryExpression:
                if (tsutils_1.isAssignmentKind(parent.operatorToken.kind))
                    return parent.right === use &&
                        parent.left.kind === ts.SyntaxKind.Identifier &&
                        parent.left.text === identifier.text;
                use = parent;
                break;
            default:
                return false;
        }
    }
}
function isExcluded(variable, sourceFile, usage, opts) {
    if (variable.exported || variable.inGlobalScope)
        return true;
    for (var _i = 0, _a = variable.declarations; _i < _a.length; _i++) {
        var declaration = _a[_i];
        var parent = declaration.parent;
        if (declaration.text.startsWith('_')) {
            switch (parent.kind) {
                case ts.SyntaxKind.Parameter:
                    return true;
                case ts.SyntaxKind.VariableDeclaration:
                    if (parent.parent.parent.kind === ts.SyntaxKind.ForInStatement ||
                        parent.parent.parent.kind === ts.SyntaxKind.ForOfStatement)
                        return true;
                    break;
                case ts.SyntaxKind.BindingElement:
                    if (parent.dotDotDotToken !== undefined)
                        break;
                    var pattern = parent.parent;
                    if (pattern.kind === ts.SyntaxKind.ObjectBindingPattern &&
                        pattern.elements[pattern.elements.length - 1].dotDotDotToken !== undefined)
                        return true;
            }
        }
        if (tsutils_1.isParameterDeclaration(parent) &&
            (opts.ignoreParameters || tsutils_1.isParameterProperty(parent) || !tsutils_1.isFunctionWithBody(parent.parent)) ||
            !opts.catchBinding && parent.kind === ts.SyntaxKind.VariableDeclaration && parent.parent.kind === ts.SyntaxKind.CatchClause ||
            parent.kind === ts.SyntaxKind.TypeParameter && parent.parent.kind === ts.SyntaxKind.MappedType ||
            parent.kind === ts.SyntaxKind.TypeParameter && typeParameterMayBeRequired(parent, usage))
            return true;
        if (/\.tsx?$/.test(sourceFile.fileName) && !sourceFile.isDeclarationFile && opts.ignoreImports && isImportFromExternal(declaration))
            return true;
    }
    return false;
}
function isImportFromExternal(node) {
    switch (node.parent.kind) {
        case ts.SyntaxKind.ImportEqualsDeclaration:
            if (node.parent.moduleReference.kind === ts.SyntaxKind.ExternalModuleReference)
                return true;
            break;
        case ts.SyntaxKind.NamespaceImport:
        case ts.SyntaxKind.ImportSpecifier:
        case ts.SyntaxKind.ImportClause:
            return true;
        default:
            return false;
    }
}
function typeParameterMayBeRequired(parameter, usage) {
    var parent = parameter.parent;
    switch (parent.kind) {
        default:
            return false;
        case ts.SyntaxKind.InterfaceDeclaration:
        case ts.SyntaxKind.ClassDeclaration:
            if (typeParameterIsUsed(parameter, usage))
                return true;
            if (parent.name === undefined)
                return false;
            var variable = usage.get(parent.name);
            if (!variable.exported)
                return variable.inGlobalScope;
    }
    parent = parent.parent;
    while (true) {
        switch (parent.kind) {
            case ts.SyntaxKind.ModuleBlock:
                parent = parent.parent;
                break;
            case ts.SyntaxKind.ModuleDeclaration:
                if (parent.name.kind !== ts.SyntaxKind.Identifier)
                    return ts.isExternalModule(parent.getSourceFile());
                if (parent.flags & ts.NodeFlags.GlobalAugmentation)
                    return true;
                var variable = usage.get(parent.name);
                if (!variable.exported)
                    return variable.inGlobalScope;
                parent = parent.parent;
                break;
            default:
                return false;
        }
    }
}
function typeParameterIsUsed(parameter, usage) {
    if (usage.get(parameter.name).uses.length !== 0)
        return true;
    var parent = parameter.parent;
    if (parent.name === undefined)
        return false;
    var index = parent.typeParameters.indexOf(parameter);
    for (var _i = 0, _a = usage.get(parent.name).declarations; _i < _a.length; _i++) {
        var declaration = _a[_i];
        var declarationParent = declaration.parent;
        if (declarationParent === parent)
            continue;
        switch (declarationParent.kind) {
            case ts.SyntaxKind.ClassDeclaration:
            case ts.SyntaxKind.InterfaceDeclaration:
                if (declarationParent.typeParameters !== undefined &&
                    declarationParent.typeParameters.length > index &&
                    usage.get(declarationParent.typeParameters[index].name).uses.length !== 0)
                    return true;
        }
    }
    return false;
}
function showKind(node) {
    switch (node.parent.kind) {
        case ts.SyntaxKind.BindingElement:
        case ts.SyntaxKind.VariableDeclaration:
            return 'Variable';
        case ts.SyntaxKind.Parameter:
            return 'Parameter';
        case ts.SyntaxKind.FunctionDeclaration:
            return 'Function';
        case ts.SyntaxKind.ClassDeclaration:
            return 'Class';
        case ts.SyntaxKind.InterfaceDeclaration:
            return 'Interface';
        case ts.SyntaxKind.ImportClause:
        case ts.SyntaxKind.NamespaceImport:
        case ts.SyntaxKind.ImportSpecifier:
        case ts.SyntaxKind.ImportEqualsDeclaration:
            return 'Import';
        case ts.SyntaxKind.EnumDeclaration:
            return 'Enum';
        case ts.SyntaxKind.ModuleDeclaration:
            return 'Namespace';
        case ts.SyntaxKind.TypeAliasDeclaration:
            return 'TypeAlias';
        case ts.SyntaxKind.TypeParameter:
            return 'TypeParameter';
        default:
            throw new Error("Unhandled kind " + node.parent.kind + ": " + ts.SyntaxKind[node.parent.kind]);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm9VbnVzZWRSdWxlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsibm9VbnVzZWRSdWxlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLCtCQUFpQztBQUNqQyw2QkFBK0I7QUFDL0IsbUNBR2lCO0FBRWpCLElBQU0sK0JBQStCLEdBQUcsaUNBQWlDLENBQUM7QUFDMUUsSUFBTSw0QkFBNEIsR0FBRyw4QkFBOEIsQ0FBQztBQUNwRSxJQUFNLG9CQUFvQixHQUFHLHNCQUFzQixDQUFDO0FBQ3BELElBQU0sd0JBQXdCLEdBQUcsbUJBQW1CLENBQUM7QUFDckQsSUFBTSxxQkFBcUIsR0FBRyxnQkFBZ0IsQ0FBQztBQUUvQztJQUEwQixnQ0FBdUI7SUFBakQ7O0lBVUEsQ0FBQztJQVRVLG9CQUFLLEdBQVosVUFBYSxVQUF5QjtRQUNsQyxPQUFPLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxZQUFZLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxRQUFRLEVBQUU7WUFDcEUsc0JBQXNCLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsK0JBQStCLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDMUYsbUJBQW1CLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsNEJBQTRCLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDcEYsZ0JBQWdCLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsd0JBQXdCLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDN0UsYUFBYSxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLHFCQUFxQixDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ3ZFLFlBQVksRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxvQkFBb0IsQ0FBQyxLQUFLLENBQUMsQ0FBQztTQUN4RSxDQUFDLENBQUMsQ0FBQztJQUNSLENBQUM7SUFDTCxXQUFDO0FBQUQsQ0FBQyxBQVZELENBQTBCLElBQUks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