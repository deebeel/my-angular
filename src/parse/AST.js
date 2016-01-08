'use strict';
import {constant, map, property} from 'lodash';
import {setter} from './Lexer';
import {filter} from '../filter';

var MULTIPLICATIVE_OPS = ['*', '/', '%'];
var ADDITIVE_OPS = ['+', '-'];
var RELATIONAL_OPTS = ['>', '<', '<=', '>='];
var EQUALITY_OPS = ['==', '!=', '===', '!=='];

var ZERO = constant(0);
ZERO.constant = true;
var NOT_ALLOWED_FUNCTIONS = [Function.prototype.apply, Function.prototype.call, Function.prototype.bind];
class Parser {
    constructor(lex) {
        this.lexer = lex;
    }

    parse(expr) {
        this.tokens = this.lexer.lex(expr);
        return this.statements();
    }

    primary() {
        var primary, next, context;
        if (this.expect('(')) {
            primary = this.filter();
            this.consume(')');
        } else if (this.expect('[')) {
            primary = this.array();
        } else if (this.expect('{')) {
            primary = this.object();
        } else {
            primary = this.identifier();
        }
        while ((next = this.expect('[', '.', '('))) {
            if (next.text === '[') {
                context = primary;
                primary = this.objectIndex(primary);
            } else if (next.text === '.') {
                context = primary;
                primary = this.fieldAccess(primary);
            } else if (next.text === '(') {
                primary = this.functionCall(primary, context);
                context = null;
            }
        }
        return primary;
    }


    expect(...args) {
        return this.peek(...args) && this.tokens.shift();
    }


    functionCall(objFn, contextFn) {
        var argFns = [];
        if (!this.peek(')')) {
            do {
                argFns.push(this.primary());
            } while (this.expect(','));
        }
        this.consume(')');
        return (scope, locals)=> {
            var context = contextFn ? contextFn(scope, locals) : scope;
            context = ensureSafeObject(context);
            var toCall = ensureSafeFunction(objFn(scope, locals));
            var args = argFns.map(fn=> fn(scope, locals));
            var res = toCall.apply(context, args);
            return ensureSafeObject(res);
        }
    }

    assignment() {
        var fn, right, left = this.ternary();
        if (this.expect('=')) {
            if (!left.assign) {
                throw 'Implies assignment but cannot assign to';
            }
            right = this.ternary();
            fn = (scope, locals)=> left.assign(scope, right(scope, locals), locals);
            fn.constant = left.constant && right.constant;
        }
        return fn || left;
    }

    statements() {
        var statements = [];
        do {
            statements.push(this.filter());
        } while (this.expect(';'));

        if (statements.length === 1) {
            return statements[0];
        }
        return (scope, locals)=> {
            var value, index = 0;
            while (index < statements.length) {
                value = statements[index++](scope, locals);
            }
            return value;
        };
    }


    filter() {
        var args, filterName, fn = this.assignment();
        while (this.expect('|')) {
            filterName = this.identifier().text;
            args = this.filterArguments();
            fn = filterCall(filterName, args, fn);
        }
        return fn;
    }

    filterArguments() {
        var args = [];
        while (this.expect(':')) {
            args.push(this.assignment());
        }
        return args;
    }

    identifier() {
        var token = this.expect();
        var primary = token.fn;
        primary.text = token.text;
        if (token.constant) {
            primary.constant = primary.literal = true;
        }
        return primary;
    }

    objectIndex(objFn) {
        var indexFn = this.primary();
        this.consume(']');
        var objectIndexFn = (scope, locals)=> {
            var obj = objFn(scope, locals);
            var index = indexFn(scope, locals);
            return ensureSafeObject(obj[index]);
        };
        objectIndexFn.assign = (scope, value, locals)=> {
            var obj = ensureSafeObject(objFn(scope, locals));
            var index = indexFn(scope, locals);
            return obj[index] = value;
        };

        return objectIndexFn;
    }

    fieldAccess(objFn) {
        var token = this.expect();
        var getter = token.fn;
        var fn = (scope, locals)=> {
            var obj = objFn(scope, locals);
            return getter(obj);
        };
        fn.assign = (scope, value, locals)=> {
            var obj = objFn(scope, locals);
            return setter(obj, token.text, value);
        };
        return fn;
    }

    array() {
        var fns = [], arrayFn = (scope, literals)=>fns.map(fn=>fn(scope, literals));
        if (!this.peek(']')) {
            do {
                fns.push(this.assignment());
            } while (this.expect(',') && !this.peek(']'));
        }
        this.consume(']');
        arrayFn.literal = true;
        arrayFn.constant = fns.every(i=>!!i.constant);
        return arrayFn;
    }

    object() {
        var keyValues = [], keyToken, value, fn = (scope, literals)=> {
            return keyValues.reduce((acc, item)=> {
                acc[item.key] = item.value(scope, literals);
                return acc;
            }, {});
        };
        if (!this.peek('}')) {
            do {
                keyToken = this.expect();
                this.consume(':');
                value = this.assignment();
                keyValues.push({key: keyToken.string || keyToken.text, value});
            } while (this.expect(','));
        }
        this.consume('}');
        fn.constant = keyValues.every(pair=>pair.value.constant);
        fn.literal = true;
        return fn;
    }

    unary() {
        var operand, operator, fn;
        if (this.expect('+')) {
            //return this.primary();
        } else if ((operator = this.expect('!'))) {
            operand = this.unary();
            fn = (scope, locals)=> {
                return operator.fn(scope, locals, operand);
            };
            fn.constant = operand.constant;
            fn.literal = false;
        } else if ((operator = this.expect('-'))) {
            operand = this.unary();
            fn = this.binary(ZERO, operator, operand);
        }
        return fn || this.primary();
    }

    ternary() {
        var right, middle, fn, left = this.logicalOR();
        if (this.expect('?')) {
            middle = this.assignment();
            this.consume(':');
            right = this.assignment();
            fn = (scope, locals)=> {
                return left(scope, locals) ? middle(scope, locals) : right(scope, locals);
            };
            fn.constant = left.constant && middle.constant && right.constant;
        }
        return fn || left;
    }


    multiplicative() {
        return this.operationHandler(MULTIPLICATIVE_OPS, this.unary);
    }

    additive() {
        return this.operationHandler(ADDITIVE_OPS, this.multiplicative);
    }

    relational() {
        return this.operationHandler(RELATIONAL_OPTS, this.additive);
    }

    equality() {
        return this.operationHandler(EQUALITY_OPS, this.relational);
    }

    logicalAND() {
        return this.operationHandler(['&&'], this.equality);
    }

    logicalOR() {
        return this.operationHandler(['||'], this.logicalAND);
    }

    operationHandler(operators, higherPrecedenceOp) {
        var operator, left = higherPrecedenceOp.call(this);
        while ((operator = this.expect(...operators))) {
            left = this.binary(left, operator, higherPrecedenceOp.call(this));
        }
        return left;
    }

    binary(left, op, right) {
        var fn = (self, locals)=> {
            return op.fn(self, locals, left, right);
        };
        fn.constant = left.constant && right.constant;
        fn.literal = false;
        return fn;
    }

    peek(...args) {
        if (this.tokens.length && (exist(this.tokens[0].text, args))) {
            return this.tokens[0];
        }
    }

    consume(ch) {
        if (!this.expect(ch)) {
            throw 'Unexpected. Expecting ' + ch;
        }
    }
}

var exist = (text, args) => {
    args = args.filter(nonUndefined);
    return ~args.indexOf(text) || !args.length;
};
var nonUndefined = (item) => {
    return item !== undefined;
};

var ensureSafeObject = (obj) => {
    if (obj) {
        if (isWindow(obj)) {
            throw 'Referencing window is not allowed';
        }
        if (isDOMElement(obj)) {
            throw 'Referencing DOM elements is not allowed';
        }
        if (obj === Object) {
            throw 'Referencing "Object" is not allowed';
        }
    }
    return obj;
};
var filterCall = (filterName, args, valueFn)=> {
    var fn = (scope, locals)=> {
        args.unshift(valueFn);
        args = args.map(argFn=>argFn(scope, locals));
        return filter(filterName).apply(null, args);
    };
    fn.constant = valueFn.constant && args.every(fn=>fn.constant);
    return fn;
};
var isWindow = (obj)=> {
    return obj.location && obj.document && obj.alert && obj.setInterval;
};
var isDOMElement = obj=> {
    return obj.children && (obj.nodeName || (obj.prop && obj.attr && obj.find));
};
var ensureSafeFunction = obj=> {
    if (!obj) {
        return;
    }
    if (obj.constructor === obj) {
        throw 'Referencing "constructor" is not allowed';
    }
    if (obj && ~NOT_ALLOWED_FUNCTIONS.indexOf(obj)) {
        throw `Calling "${obj}" is not allowed`;
    }
    return obj;
};

export default Parser;