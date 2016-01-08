'use strict';
import AST from './AST';
import _ from 'lodash';

const NOT_ALLOWED_FUNCTIONS = [
    Function.prototype.apply,
    Function.prototype.call,
    Function.prototype.bind
];

class ASTCompiler {
    constructor($filter) {
        this.astBuilder = new AST();
        this.$filter = $filter;
    }

    compile(text) {
        var ast = this.astBuilder.ast(text);
        var extra = '';
        markConstantAndWatchExpressions(ast, this.$filter);
        this.state = {
            nextId: 0,
            fn: {body: [], vars: []},
            filters: {},
            assign: {body: [], vars: []},
            inputs: []
        };
        this.stage = 'inputs';
        _.forEach(getInputs(ast.body), function (input, idx) {
            var inputKey = 'fn' + idx;
            this.state[inputKey] = {body: [], vars: []};
            this.state.computing = inputKey;
            this.state[inputKey].body.push('return ' + this.recurse(input) + ';');
            this.state.inputs.push(inputKey);
        }, this);

        this.stage = 'assign';

        var assignable = assignableAST(ast);
        if (assignable) {
            this.state.computing = 'assign';
            this.state.assign.body.push(this.recurse(assignable));
            extra = 'fn.assign = function(s,v,l){' +
                (this.state.assign.vars.length ?
                    'var ' + this.state.assign.vars.join(',') + ';' :
                        ''
                ) +
                this.state.assign.body.join('') +
                '};';
        }
        this.stage = 'main';
        this.state.computing = 'fn';

        this.recurse(ast);
        var fnString = this.filterPrefix() +
            'var fn=function(s,l){' +
            (this.state.fn.vars.length ?
                'var ' + this.state.fn.vars.join(',') + ';' : ''
            ) +
            this.state.fn.body.join('') +
            '};' +
            this.watchFns() +
            extra +
            ' return fn;';
        /* jshint -W054 */
        var fn = new Function(
            'ensureSafeMemberName',
            'ensureSafeObject',
            'ensureSafeFunction',
            'ifDefinedStub',
            'filter',
            fnString)(
            ensureSafeMemberName,
            ensureSafeObject,
            ensureSafeFunction,
            ifDefinedStub,
            this.$filter);

        /* jshint +W054 */
        fn.literal = isLiteral(ast);
        fn.constant = ast.constant;
        return fn;
    }

    watchFns() {
        var result = [];
        _.forEach(this.state.inputs, function (inputName) {
            result.push('var ', inputName, '=function(s) {',
                (this.state[inputName].vars.length ?
                    'var ' + this.state[inputName].vars.join(',') + ';' :
                        ''
                ),
                this.state[inputName].body.join(''),
                '};');
        }, this);
        if (result.length) {
            result.push('fn.inputs = [', this.state.inputs.join(','), '];');
        }
        return result.join('');
    }

    recurse(ast, context, create) {
        var intoId;
        switch (ast.type) {
            case AST.Program:
                _.forEach(_.initial(ast.body), function (stmt) {
                    this.state[this.state.computing].body.push(this.recurse(stmt), ';');
                }, this);
                this.state[this.state.computing].body.push(
                    'return ', this.recurse(_.last(ast.body)), ';');
                break;
            case AST.Literal:
                return escape(ast.value);
            case AST.ArrayExpression:
                var elements = _.map(ast.elements, function (element) {
                    return removeLastSemicolon(this.recurse(element));
                }, this);
                return '[' + elements.join(',') + ']';
            case AST.ObjectExpression:
                var properties = _.map(ast.properties, function (property) {
                    var key = property.key.type === AST.Identifier ?
                        property.key.name :
                        escape(property.key.value);
                    return key + ':' + removeLastSemicolon(this.recurse(property.value));
                }, this);
                return '{' + properties.join(',') + '}';
            case AST.Identifier:
                ensureSafeMemberName(ast.name);
                intoId = this.nextId();
                var localsCheck;
                if (this.stage === 'inputs') {
                    localsCheck = 'false';
                } else {
                    localsCheck = getHasOwnProperty('l', ast.name);
                }
                this.if_(localsCheck, assign(intoId, nonComputedMember('l', ast.name)));
                if (create) {
                    this.if_(not(localsCheck) +
                        ' && s && ' +
                        not(getHasOwnProperty('s', ast.name)),
                        assign(nonComputedMember('s', ast.name), '{}'));
                }
                this.if_(not(localsCheck) + ' && s',
                    assign(intoId, nonComputedMember('s', ast.name)));
                if (context) {
                    context.context = localsCheck + '?l:s';
                    context.name = ast.name;
                    context.computed = false;
                }
                this.addEnsureSafeObject(intoId);
                return intoId;
            case AST.ThisExpression:
                return 's';
            case AST.MemberExpression:
                intoId = this.nextId();
                var left = this.recurse(ast.object, undefined, create);
                if (context) {
                    context.context = left;
                }
                if (ast.computed) {
                    var right = this.recurse(ast.property);
                    this.addEnsureSafeMemberName(right);
                    if (create) {
                        this.if_(not(computedMember(left, right)),
                            assign(computedMember(left, right), '{}'));
                    }
                    this.if_(left,
                        assign(intoId,
                            'ensureSafeObject(' + computedMember(left, right) + ')'));
                    if (context) {
                        context.name = right;
                        context.computed = true;
                    }
                } else {
                    ensureSafeMemberName(ast.property.name);
                    if (create) {
                        this.if_(not(nonComputedMember(left, ast.property.name)),
                            assign(nonComputedMember(left, ast.property.name), '{}'));
                    }
                    this.if_(left,
                        assign(intoId,
                            'ensureSafeObject(' + nonComputedMember(left, ast.property.name) + ')'));
                    if (context) {
                        context.name = ast.property.name;
                        context.computed = false;
                    }
                }
                return intoId;
            case AST.CallExpression:
                var callContext, callee, args;
                if (ast.filter) {
                    callee = this.filter(ast.callee.name);
                    args = _.map(ast.arguments, function (arg) {
                        return this.recurse(arg);
                    }, this);
                    return callee + '(' + args + ')';
                } else {
                    callContext = {};
                    callee = this.recurse(ast.callee, callContext);
                    args = _.map(ast.arguments, function (arg) {
                        return 'ensureSafeObject(' + this.recurse(arg) + ')';
                    }, this);
                    if (callContext.name) {
                        this.addEnsureSafeObject(callContext.context);
                        if (callContext.computed) {
                            callee = computedMember(callContext.context, callContext.name);
                        } else {
                            callee = nonComputedMember(callContext.context, callContext.name);
                        }
                    }
                    this.addEnsureSafeFunction(callee);
                    return callee + '&&ensureSafeObject(' + callee + '(' + args.join(',') + '))';
                }
                break;
            case AST.AssignmentExpression:
                var leftContext = {};
                this.recurse(ast.left, leftContext, true);
                var leftExpr;
                if (leftContext.computed) {
                    leftExpr = computedMember(leftContext.context, leftContext.name);
                } else {
                    leftExpr = nonComputedMember(leftContext.context, leftContext.name);
                }
                return assign(leftExpr,
                    'ensureSafeObject(' + this.recurse(ast.right) + ')');
            case AST.UnaryExpression:
                return ast.operator +
                    '(' + ifDefined(this.recurse(ast.argument), 0) + ')';
            case AST.BinaryExpression:
                if (ast.operator === '+' || ast.operator === '-') {
                    return '(' + ifDefined(this.recurse(ast.left), 0) + ')' +
                        ast.operator +
                        '(' + ifDefined(this.recurse(ast.right), 0) + ')';
                } else {
                    return '(' + this.recurse(ast.left) + ')' +
                        ast.operator +
                        '(' + this.recurse(ast.right) + ')';
                }
                break;
            case AST.LogicalExpression:
                intoId = this.nextId();
                this.state[this.state.computing].body.push(
                    assign(intoId, this.recurse(ast.left)));
                this.if_(ast.operator === '&&' ? intoId : not(intoId),
                    assign(intoId, this.recurse(ast.right)));
                return intoId;
            case AST.ConditionalExpression:
                intoId = this.nextId();
                var testId = this.nextId();
                this.state[this.state.computing].body.push(
                    assign(testId, this.recurse(ast.test))
                );
                this.if_(testId, assign(intoId, this.recurse(ast.consequent)));
                this.if_(not(testId), assign(intoId, this.recurse(ast.alternate)));
                return intoId;
            case AST.NGValueParameter:
                return 'v';
        }
    }

    nextId(skip) {
        var id = 'v' + (this.state.nextId++);
        if (!skip) {
            this.state[this.state.computing].vars.push(id);
        }
        return id;
    }

    if_(test, consequent) {
        this.state[this.state.computing].body.push('if(', test, '){', consequent, '}');
    }


    addEnsureSafeMemberName(expr) {
        this.state[this.state.computing].body.push('ensureSafeMemberName(' + expr + ');');
    }

    addEnsureSafeObject(expr) {
        this.state[this.state.computing].body.push('ensureSafeObject(' + expr + ');');
    }

    addEnsureSafeFunction(expr) {
        this.state[this.state.computing].body.push('ensureSafeFunction(' + expr + ');');
    }


    filter(name) {
        if (!this.state.filters.hasOwnProperty(name)) {
            this.state.filters[name] = this.nextId(true);
        }
        return this.state.filters[name];
    }


    filterPrefix() {

        if (_.isEmpty(this.state.filters)) {
            return '';
        } else {
            var parts = _.map(this.state.filters, function (varName, filterName) {
                return varName + '=' + 'filter(' + escape(filterName) + ')';
            }, this);
            return 'var ' + parts.join(',') + ';';
        }
    }
}
ASTCompiler.stringEscapeRegex = /[^ a-zA-Z0-9]/g;
function not(e) {
    return '!(' + e + ')';
}


function markConstantAndWatchExpressions(ast, $filter) {
    var allConstants;
    var argsToWatch;
    switch (ast.type) {
        case AST.Program:
            allConstants = true;
            _.forEach(ast.body, function (expr) {
                markConstantAndWatchExpressions(expr, $filter);
                allConstants = allConstants && expr.constant;
            });
            ast.constant = allConstants;
            break;
        case AST.Literal:
            ast.constant = true;
            ast.toWatch = [];
            break;
        case AST.Identifier:
            ast.constant = false;
            ast.toWatch = [ast];
            break;
        case AST.ArrayExpression:
            allConstants = true;
            argsToWatch = [];
            _.forEach(ast.elements, function (element) {
                markConstantAndWatchExpressions(element, $filter);
                allConstants = allConstants && element.constant;
                if (!element.constant) {
                    argsToWatch.push.apply(argsToWatch, element.toWatch);
                }
            });

            ast.constant = allConstants;
            ast.toWatch = argsToWatch;
            break;
        case AST.ObjectExpression:
            allConstants = true;
            argsToWatch = [];
            _.forEach(ast.properties, function (property) {
                markConstantAndWatchExpressions(property.value, $filter);
                allConstants = allConstants && property.value.constant;
                if (!property.value.constant) {
                    argsToWatch.push.apply(argsToWatch, property.value.toWatch);
                }
            });
            ast.constant = allConstants;
            ast.toWatch = argsToWatch;
            break;
        case AST.ThisExpression:
            ast.constant = false;
            ast.toWatch = [];
            break;
        case AST.MemberExpression:
            markConstantAndWatchExpressions(ast.object, $filter);
            if (ast.computed) {
                markConstantAndWatchExpressions(ast.property, $filter);
            }
            ast.constant = ast.object.constant &&
                (!ast.computed || ast.property.constant);
            ast.toWatch = [ast];
            break;
        case AST.CallExpression:
            var stateless = ast.filter && !$filter(ast.callee.name).$stateful;
            allConstants = stateless ? true : false;
            argsToWatch = [];
            _.forEach(ast.arguments, function (arg) {
                markConstantAndWatchExpressions(arg, $filter);
                allConstants = allConstants && arg.constant;
                if (!arg.constant) {
                    argsToWatch.push.apply(argsToWatch, arg.toWatch);
                }
            });
            ast.constant = allConstants;
            ast.toWatch = stateless ? argsToWatch : [ast];
            break;
        case AST.AssignmentExpression:
            markConstantAndWatchExpressions(ast.left, $filter);
            markConstantAndWatchExpressions(ast.right, $filter);
            ast.constant = ast.left.constant && ast.right.constant;
            ast.toWatch = [ast];
            break;
        case AST.UnaryExpression:
            markConstantAndWatchExpressions(ast.argument, $filter);
            ast.constant = ast.argument.constant;
            ast.toWatch = ast.argument.toWatch;
            break;
        case AST.BinaryExpression:
            markConstantAndWatchExpressions(ast.left, $filter);
            markConstantAndWatchExpressions(ast.right, $filter);
            ast.constant = ast.left.constant && ast.right.constant;
            ast.toWatch = ast.left.toWatch.concat(ast.right.toWatch);
            break;
        case AST.LogicalExpression:
            markConstantAndWatchExpressions(ast.left, $filter);
            markConstantAndWatchExpressions(ast.right, $filter);
            ast.constant = ast.left.constant && ast.right.constant;
            ast.toWatch = [ast];
            break;
        case AST.ConditionalExpression:
            markConstantAndWatchExpressions(ast.test, $filter);
            markConstantAndWatchExpressions(ast.consequent, $filter);
            markConstantAndWatchExpressions(ast.alternate, $filter);
            ast.constant =
                ast.test.constant && ast.consequent.constant && ast.alternate.constant;
            ast.toWatch = [ast];
            break;
    }
}

function getInputs(ast) {
    if (ast.length !== 1) {
        return;
    }
    var candidate = ast[0].toWatch;
    if (candidate.length !== 1 || candidate[0] !== ast[0]) {
        return candidate;
    }
}

function isAssignable(ast) {
    return ast.type === AST.Identifier || ast.type == AST.MemberExpression;
}
function assignableAST(ast) {
    if (ast.body.length == 1 && isAssignable(ast.body[0])) {
        return {
            type: AST.AssignmentExpression,
            left: ast.body[0],
            right: {type: AST.NGValueParameter}
        };
    }
}

function ensureSafeMemberName(name) {
    if (name === 'constructor' || name === '__proto__' ||
        name === '__defineGetter__' || name === '__defineSetter__' ||
        name === '__lookupGetter__' || name === '__lookupSetter__') {
        throw 'Attempting to access a disallowed field in Angular expressions!';
    }
}

function ensureSafeObject(obj) {
    if (obj) {
        if (obj.window === window) {
            throw 'Referencing window in Angular expressions is disallowed!';
        } else if (obj.children &&
            (obj.nodeName || (obj.prop && obj.attr && obj.find))) {
            throw 'Referencing DOM nodes in Angular expressions is disallowed!';
        } else if (obj.constructor === obj) {
            throw 'Referencing Function in Angular expressions is disallowed!';
        } else if (obj === Object) {
            throw 'Referencing Object in Angular expressions is disallowed!';
        }
    }
    return obj;
}

function ensureSafeFunction(obj) {
    if (obj) {
        if (obj.constructor === obj) {
            throw 'Referencing Function in Angular expressions is disallowed!';
        } else if (~NOT_ALLOWED_FUNCTIONS.indexOf(obj)) {
            throw 'Referencing call, apply, or bind in Angular expressions ' +
            'is disallowed!';
        }
    }
    return obj;
}
function assign(id, value) {
    return id + '=' + value + ';';
}
function stringEscapeFn(c) {
    return '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4);
}

function escape(value) {
    if (_.isString(value)) {
        return '\'' + value.replace(ASTCompiler.stringEscapeRegex, stringEscapeFn) + '\'';
    } else if (_.isNull(value)) {
        return 'null';
    } else {
        return value;
    }
}

function nonComputedMember(left, right) {
    return '(' + left + ').' + right;
}

function getHasOwnProperty(object, property) {
    return object + '&&(' + escape(property) + ' in ' + object + ')';
}

function ifDefined(value, defaultValue) {
    return 'ifDefinedStub(' + value + ',' + escape(defaultValue) + ')';
}

function computedMember(left, right) {
    return '(' + left + ')[' + right + ']';
}

function removeLastSemicolon(val) {
    if (_.isString(val) && val.charAt(val.length - 1) === ';') {
        return val.slice(0, -1);
    }
    return val;
}

function isLiteral(ast) {
    return ast.body.length === 0 ||
        ast.body.length === 1 && (
        ast.body[0].type === AST.Literal ||
        ast.body[0].type === AST.ArrayExpression ||
        ast.body[0].type === AST.ObjectExpression);
}

function ifDefinedStub(value, defaultValue) {
    return typeof value === 'undefined' ? defaultValue : value;
}

export default ASTCompiler;
