"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var tslib_1 = require("tslib");
var ts = require("typescript");
var Lint = require("tslint");
var tsutils_1 = require("tsutils");
var CHECK_RETURN_TYPE_OPTION = 'check-return-type';
var FAIL_MESSAGE = "type annotation is redundant";
var Rule = (function (_super) {
    tslib_1.__extends(Rule, _super);
    function Rule() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Rule.prototype.applyWithProgram = function (sourceFile, program) {
        return this.applyWithFunction(sourceFile, walk, {
            checkReturnType: this.ruleArguments.indexOf(CHECK_RETURN_TYPE_OPTION) !== -1,
        }, program.getTypeChecker());
    };
    return Rule;
}(Lint.Rules.TypedRule));
exports.Rule = Rule;
var formatFlags = ts.TypeFormatFlags.UseStructuralFallback
    | ts.TypeFormatFlags.UseFullyQualifiedType
    | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope
    | ts.TypeFormatFlags.NoTruncation
    | ts.TypeFormatFlags.WriteClassExpressionAsTypeLiteral
    | ts.TypeFormatFlags.WriteArrowStyleSignature;
function walk(ctx, checker) {
    return ts.forEachChild(ctx.sourceFile, function cb(node) {
        switch (node.kind) {
            case ts.SyntaxKind.ArrowFunction:
            case ts.SyntaxKind.FunctionExpression:
                checkFunction(node);
                break;
            case ts.SyntaxKind.MethodDeclaration:
                if (node.parent.kind === ts.SyntaxKind.ObjectLiteralExpression)
                    checkObjectLiteralMethod(node);
                break;
            case ts.SyntaxKind.VariableDeclarationList:
                checkVariables(node);
        }
        return ts.forEachChild(node, cb);
    });
    function checkFunction(node) {
        if (!functionHasTypeDeclarations(node))
            return;
        var iife = tsutils_1.getIIFE(node);
        if (iife !== undefined)
            return checkIife(node, iife);
        var type = getContextualTypeOfFunction(node);
        if (type === undefined)
            return;
        checkContextSensitiveFunctionOrMethod(node, type);
    }
    function checkObjectLiteralMethod(node) {
        if (!functionHasTypeDeclarations(node))
            return;
        var type = getContextualTypeOfObjectLiteralMethod(node);
        if (type === undefined)
            return;
        checkContextSensitiveFunctionOrMethod(node, type);
    }
    function checkContextSensitiveFunctionOrMethod(node, contextualType) {
        var parameters = parametersExceptThis(node.parameters);
        var sig = getMatchingSignature(contextualType, parameters);
        if (sig === undefined)
            return;
        var signature = sig[0], checkReturn = sig[1];
        if (ctx.options.checkReturnType && checkReturn && node.type !== undefined && !signatureHasGenericOrTypePredicateReturn(signature) &&
            typesAreEqual(checker.getTypeFromTypeNode(node.type), signature.getReturnType()))
            fail(node.type);
        var restParameterContext = false;
        var contextualParameterType;
        for (var i = 0; i < parameters.length; ++i) {
            if (!restParameterContext) {
                var context = signature.parameters[i];
                if (context === undefined || context.valueDeclaration === undefined)
                    break;
                if (tsutils_1.isTypeParameter(checker.getTypeAtLocation(context.valueDeclaration)))
                    continue;
                contextualParameterType = checker.getTypeOfSymbolAtLocation(context, node);
                if (context.valueDeclaration.dotDotDotToken !== undefined) {
                    var indexType = contextualParameterType.getNumberIndexType();
                    if (indexType === undefined)
                        break;
                    contextualParameterType = indexType;
                    restParameterContext = true;
                }
            }
            var parameter = parameters[i];
            if (parameter.type === undefined)
                continue;
            var declaredType = void 0;
            if (parameter.dotDotDotToken !== undefined) {
                if (!restParameterContext)
                    break;
                declaredType = checker.getTypeFromTypeNode(parameter.type);
                var indexType = declaredType.getNumberIndexType();
                if (indexType === undefined)
                    break;
                declaredType = indexType;
            }
            else {
                declaredType = checker.getTypeFromTypeNode(parameter.type);
            }
            if (compareParameterTypes(contextualParameterType, declaredType, parameter.questionToken !== undefined || parameter.initializer !== undefined))
                fail(parameter.type);
        }
    }
    function checkIife(func, iife) {
        if (ctx.options.checkReturnType && func.type !== undefined && func.name === undefined &&
            (!tsutils_1.isExpressionValueUsed(iife) ||
                !containsTypeWithFlag(checker.getTypeFromTypeNode(func.type), ts.TypeFlags.Literal) &&
                    checker.getContextualType(iife) !== undefined))
            fail(func.type);
        var parameters = parametersExceptThis(func.parameters);
        var args = iife.arguments;
        var len = Math.min(parameters.length, args.length);
        outer: for (var i = 0; i < len; ++i) {
            var parameter = parameters[i];
            if (parameter.type === undefined)
                continue;
            var declaredType = checker.getTypeFromTypeNode(parameter.type);
            var contextualType = checker.getBaseTypeOfLiteralType(checker.getTypeAtLocation(args[i]));
            if (parameter.dotDotDotToken !== undefined) {
                var indexType = declaredType.getNumberIndexType();
                if (indexType === undefined || !typesAreEqual(indexType, contextualType))
                    break;
                for (var j = i + 1; j < args.length; ++j)
                    if (!typesAreEqual(contextualType, checker.getBaseTypeOfLiteralType(checker.getTypeAtLocation(args[j]))))
                        break outer;
                fail(parameter.type);
            }
            else if (compareParameterTypes(contextualType, declaredType, parameter.questionToken !== undefined || parameter.initializer !== undefined)) {
                fail(parameter.type);
            }
        }
    }
    function checkVariables(list) {
        var isConst = tsutils_1.getVariableDeclarationKind(list) === 2;
        for (var _i = 0, _a = list.declarations; _i < _a.length; _i++) {
            var variable = _a[_i];
            if (variable.type === undefined || variable.initializer === undefined)
                continue;
            var inferred = checker.getTypeAtLocation(variable.initializer);
            if (!isConst)
                inferred = checker.getBaseTypeOfLiteralType(inferred);
            var declared = checker.getTypeFromTypeNode(variable.type);
            if (typesAreEqual(declared, inferred) || isConst && typesAreEqual(declared, checker.getBaseTypeOfLiteralType(inferred)))
                fail(variable.type);
        }
    }
    function fail(type) {
        ctx.addFailure(type.pos - 1, type.end, FAIL_MESSAGE, Lint.Replacement.deleteFromTo(type.pos - 1, type.end));
    }
    function typesAreEqual(a, b) {
        return a === b || checker.typeToString(a, undefined, formatFlags) === checker.typeToString(b, undefined, formatFlags);
    }
    function getContextualTypeOfFunction(func) {
        var type = checker.getContextualType(func);
        return type && checker.getApparentType(type);
    }
    function getContextualTypeOfObjectLiteralMethod(method) {
        var type = checker.getContextualType(method.parent);
        if (type === undefined)
            return;
        type = checker.getApparentType(type);
        if (!tsutils_1.isTypeFlagSet(type, ts.TypeFlags.StructuredType))
            return;
        var t = checker.getTypeAtLocation(method);
        var symbol = t.symbol && type.getProperties().find(function (s) { return s.escapedName === t.symbol.escapedName; });
        return symbol !== undefined
            ? checker.getTypeOfSymbolAtLocation(symbol, method.name)
            : isNumericPropertyName(method.name) && type.getNumberIndexType() || type.getStringIndexType();
    }
    function signatureHasGenericOrTypePredicateReturn(signature) {
        if (signature.declaration === undefined)
            return false;
        if (signature.declaration.type !== undefined && tsutils_1.isTypePredicateNode(signature.declaration.type))
            return true;
        var original = checker.getSignatureFromDeclaration(signature.declaration);
        return original !== undefined && tsutils_1.isTypeParameter(original.getReturnType());
    }
    function removeOptionalityFromType(type) {
        if (!containsTypeWithFlag(type, ts.TypeFlags.Undefined))
            return type;
        var allowsNull = containsTypeWithFlag(type, ts.TypeFlags.Null);
        type = checker.getNonNullableType(type);
        return allowsNull ? checker.getNullableType(type, ts.TypeFlags.Null) : type;
    }
    function compareParameterTypes(context, declared, optional) {
        if (optional)
            declared = removeOptionalityFromType(declared);
        return typesAreEqual(declared, context) ||
            optional && typesAreEqual(checker.getNullableType(declared, ts.TypeFlags.Undefined), context);
    }
    function isNumericPropertyName(name) {
        var str = tsutils_1.getPropertyName(name);
        if (str !== undefined)
            return tsutils_1.isValidNumericLiteral(str) && String(+str) === str;
        return isAssignableToNumber(checker.getTypeAtLocation(name.expression));
    }
    function isAssignableToNumber(type) {
        var typeParametersSeen;
        return (function check(t) {
            if (tsutils_1.isTypeParameter(t) && t.symbol !== undefined && t.symbol.declarations !== undefined) {
                if (typeParametersSeen === undefined) {
                    typeParametersSeen = new Set([t]);
                }
                else if (!typeParametersSeen.has(t)) {
                    typeParametersSeen.add(t);
                }
                else {
                    return false;
                }
                var declaration = t.symbol.declarations[0];
                if (declaration.constraint === undefined)
                    return true;
                return check(checker.getTypeFromTypeNode(declaration.constraint));
            }
            if (tsutils_1.isUnionType(t))
                return t.types.every(check);
            if (tsutils_1.isIntersectionType(t))
                return t.types.some(check);
            return tsutils_1.isTypeFlagSet(t, ts.TypeFlags.NumberLike | ts.TypeFlags.Any);
        })(type);
    }
    function getMatchingSignature(type, parameters) {
        var minArguments = getMinArguments(parameters);
        var signatures = getSignaturesOfType(type).filter(function (s) { return s.declaration !== undefined &&
            getNumParameters(s.declaration.parameters) >= minArguments; });
        switch (signatures.length) {
            case 0:
                return;
            case 1:
                return [signatures[0], true];
            default: {
                var str = checker.signatureToString(signatures[0], undefined, formatFlags);
                var withoutReturn = removeSignatureReturn(str);
                var returnUsable = true;
                for (var i = 1; i < signatures.length; ++i) {
                    var sig = checker.signatureToString(signatures[i], undefined, formatFlags);
                    if (str !== sig) {
                        if (withoutReturn !== removeSignatureReturn(sig))
                            return;
                        returnUsable = false;
                    }
                }
                return [signatures[0], returnUsable];
            }
        }
    }
}
function removeSignatureReturn(str) {
    var sourceFile = ts.createSourceFile('tmp.ts', "type T=" + str, ts.ScriptTarget.ESNext);
    var signature = sourceFile.statements[0].type;
    return sourceFile.text.substring(7, signature.parameters.end + 1);
}
function getSignaturesOfType(type) {
    if (tsutils_1.isUnionType(type)) {
        var signatures = [];
        for (var _i = 0, _a = type.types; _i < _a.length; _i++) {
            var t = _a[_i];
            signatures.push.apply(signatures, getSignaturesOfType(t));
        }
        return signatures;
    }
    if (tsutils_1.isIntersectionType(type)) {
        var signatures = void 0;
        for (var _b = 0, _c = type.types; _b < _c.length; _b++) {
            var t = _c[_b];
            var sig = getSignaturesOfType(t);
            if (sig.length !== 0) {
                if (signatures !== undefined)
                    return [];
                signatures = sig;
            }
        }
        return signatures === undefined ? [] : signatures;
    }
    return type.getCallSignatures();
}
function getNumParameters(parameters) {
    if (parameters.length === 0)
        return 0;
    if (parameters[parameters.length - 1].dotDotDotToken !== undefined)
        return Infinity;
    return parametersExceptThis(parameters).length;
}
function getMinArguments(parameters) {
    var minArguments = parameters.length;
    for (; minArguments > 0; --minArguments) {
        var parameter = parameters[minArguments - 1];
        if (parameter.questionToken === undefined && parameter.initializer === undefined && parameter.dotDotDotToken === undefined)
            break;
    }
    return minArguments;
}
function containsTypeWithFlag(type, flag) {
    return tsutils_1.isUnionType(type) ? type.types.some(function (t) { return tsutils_1.isTypeFlagSet(t, flag); }) : tsutils_1.isTypeFlagSet(type, flag);
}
function parametersExceptThis(parameters) {
    return parameters.length !== 0 && tsutils_1.isThisParameter(parameters[0]) ? parameters.slice(1) : parameters;
}
function functionHasTypeDeclarations(func) {
    return func.type !== undefined || parametersExceptThis(func.parameters).some(function (p) { return p.type !== undefined; });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm9Vbm5lY2Vzc2FyeVR5cGVBbm5vdGF0aW9uUnVsZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm5vVW5uZWNlc3NhcnlUeXBlQW5ub3RhdGlvblJ1bGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsK0JBQWlDO0FBQ2pDLDZCQUErQjtBQUMvQixtQ0FhaUI7QUFJakIsSUFBTSx3QkFBd0IsR0FBRyxtQkFBbUIsQ0FBQztBQUNyRCxJQUFNLFlBQVksR0FBRyw4QkFBOEIsQ0FBQztBQU1wRDtJQUEwQixnQ0FBb0I7SUFBOUM7O0lBVUEsQ0FBQztJQVRVLCtCQUFnQixHQUF2QixVQUF3QixVQUF5QixFQUFFLE9BQW1CO1FBQ2xFLE9BQU8sSUFBSSxDQUFDLGlCQUFpQixDQUN6QixVQUFVLEVBQ1YsSUFBSSxFQUFFO1lBQ0YsZUFBZSxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLHdCQUF3QixDQUFDLEtBQUssQ0FBQyxDQUFDO1NBQy9FLEVBQ0QsT0FBTyxDQUFDLGNBQWMsRUFBRSxDQUMzQixDQUFDO0lBQ04sQ0FBQztJQUNMLFdBQUM7QUFBRCxDQUFDLEFBVkQsQ0FBMEIsSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLEdBVTdDO0FBVlksb0JBQUk7QUFZakIsSUFBTSxXQUFXLEdBQUcsRUFBRSxDQUFDLGVBQWUsQ0FBQyxxQkFBcUI7TUFDdEQsRUFBRSxDQUFDLGVBQWUsQ0FBQyxxQkFBcUI7TUFDeEMsRUFBRSxDQUFDLGVBQWUsQ0FBQyxrQ0FBa0M7TUFDckQsRUFBRSxDQUFDLGVBQWUsQ0FBQyxZQUFZO01BQy9CLEVBQUUsQ0FBQyxlQUFlLENBQUMsaUNBQWlDO01BQ3BELEVBQUUsQ0FBQyxlQUFlLENBQUMsd0JBQXdCLENBQUM7QUFFbEQsY0FBYyxHQUErQixFQUFFLE9BQXVCO0lBQ2xFLE9BQU8sRUFBRSxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsVUFBVSxFQUFFLFlBQVksSUFBSTtRQUNuRCxRQUFRLElB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