'use strict';
import {constant, map, property} from 'lodash';
import {setter} from './Lexer';
import {filter} from '../filter';
import Lexer from './Lexer';

var MULTIPLICATIVE_OPS = ['*', '/', '%'];
var ADDITIVE_OPS = ['+', '-'];
var RELATIONAL_OPTS = ['>', '<', '<=', '>='];
var EQUALITY_OPS = ['==', '!=', '===', '!=='];

var ZERO = constant(0);
ZERO.constant = true;

class AST {
    constructor() {
        this.lexer = new Lexer();
    }

    ast(expr) {
        this.tokens = this.lexer.lex(expr);
        return this.program();
    }


    program() {
        var body = [];
        while (true) {
            if (this.tokens.length) {
                body.push(this.filter());
            }
            if (!this.expect(';')) {
                return {type: AST.Program, body: body};
            }
        }
    }


    parseArguments() {
        var args = [];
        if (!this.peek(')')) {
            do {
                args.push(this.assignment());
            } while (this.expect(','));
        }
        return args;
    }

    consume(e) {
        var token = this.expect(e);
        if (!token) {
            throw 'Unexpected. Expecting: ' + e;
        }
        return token;
    }

    filter() {
        var left = this.assignment();
        while (this.expect('|')) {
            var args = [left];
            left = {
                type: AST.CallExpression,
                callee: this.identifier(),
                arguments: args,
                filter: true
            };
            while (this.expect(':')) {
                args.push(this.assignment());
            }
        }
        return left;
    }

    assignment() {
        var left = this.ternary();
        if (this.expect('=')) {
            var right = this.ternary();
            return {type: AST.AssignmentExpression, left: left, right: right};
        }
        return left;
    }

    ternary() {
        var test = this.logicalOR();
        if (this.expect('?')) {
            var consequent = this.assignment();
            if (this.consume(':')) {
                var alternate = this.assignment();
                return {
                    type: AST.ConditionalExpression,
                    test: test,
                    consequent: consequent,
                    alternate: alternate
                };
            }
        }
        return test;
    }

    unary() {
        var token;
        if ((token = this.expect('+', '!', '-'))) {
            return {
                type: AST.UnaryExpression,
                operator: token.text,
                argument: this.unary()
            };
        }
        return this.primary();
    }

    primary() {
        var primary;
        
        if (this.expect('(')) {
            primary = this.filter();
            this.consume(')');
        } else if (this.expect('[')) {
            primary = this.arrayDeclaration();
        } else if (this.expect('{')) {
            primary = this.object();
        } else if (AST.constants.hasOwnProperty(this.tokens[0].text)) {
            primary = AST.constants[this.consume().text];
        } else if (this.peek().identifier) {
            primary = this.identifier();
        } else {
            primary = this.constant();
        }

        var next;
        while ((next = this.expect('.', '[', '('))) {
            if (next.text === '[') {
                primary = {
                    type: AST.MemberExpression,
                    object: primary,
                    property: this.primary(),
                    computed: true
                };
                this.consume(']');
            } else if (next.text === '.') {
                primary = {
                    type: AST.MemberExpression,
                    object: primary,
                    property: this.identifier(),
                    computed: false
                };
            } else if (next.text === '(') {
                primary = {
                    type: AST.CallExpression,
                    callee: primary,
                    arguments: this.parseArguments()
                };
                this.consume(')');
            }
        }
        return primary;
    }

    arrayDeclaration() {
        var elements = [];
        if (!this.peek(']')) {
            do {
                if (this.peek(']')) {
                    break;
                }
                elements.push(this.assignment());
            } while (this.expect(','));
        }
        this.consume(']');
        return {type: AST.ArrayExpression, elements: elements};
    }

    object() {
        var properties = [];
        if (!this.peek('}')) {
            do {
                var property = {type: AST.Property};
                if (this.peek().identifier) {
                    property.key = this.identifier();
                } else {
                    property.key = this.constant();
                }
                this.consume(':');
                property.value = this.assignment();
                properties.push(property);
            } while (this.expect(','));
        }
        this.consume('}');
        return {type: AST.ObjectExpression, properties: properties};
    }

    constant() {
        return {type: AST.Literal, value: this.consume().value};
    }

    identifier() {
        return {type: AST.Identifier, name: this.consume().text};
    }


    multiplicative() {
        return this.binaryExpressionHandler(MULTIPLICATIVE_OPS, this.unary);
    }

    additive() {
        return this.binaryExpressionHandler(ADDITIVE_OPS, this.multiplicative);
    }

    relational() {
        return this.binaryExpressionHandler(RELATIONAL_OPTS, this.additive);
    }

    equality() {
        return this.binaryExpressionHandler(EQUALITY_OPS, this.relational);
    }

    logicalAND() {
        return this.binaryExpressionHandler(['&&'], this.equality);
    }

    logicalOR() {
        return this.binaryExpressionHandler(['||'], this.logicalAND);
    }

    binaryExpressionHandler(operators, higherPrecedenceOp) {
        var token, left = higherPrecedenceOp.call(this);
        while ((token = this.expect.apply(this, operators))) {
            left = {
                type: AST.BinaryExpression,
                left: left,
                operator: token.text,
                right: higherPrecedenceOp.call(this)
            };
        }
        return left;
    }

    expect(e1, e2, e3, e4) {
        var token = this.peek(e1, e2, e3, e4);
        if (token) {
            return this.tokens.shift();
        }
    }

    peek(e1, e2, e3, e4) {
        if (this.tokens.length) {
            var text = this.tokens[0].text;
            if (text === e1 || text === e2 || text === e3 || text === e4 ||
                (!e1 && !e2 && !e3 && !e4)) {
                return this.tokens[0];
            }
        }
    }

}
AST.Program = 'Program';
AST.Literal = 'Literal';
AST.ArrayExpression = 'ArrayExpression';
AST.ObjectExpression = 'ObjectExpression';
AST.Property = 'Property';
AST.Identifier = 'Identifier';
AST.ThisExpression = 'ThisExpression';
AST.MemberExpression = 'MemberExpression';
AST.CallExpression = 'CallExpression';
AST.AssignmentExpression = 'AssignmentExpression';
AST.UnaryExpression = 'UnaryExpression';
AST.BinaryExpression = 'BinaryExpression';
AST.LogicalExpression = 'LogicalExpression';
AST.ConditionalExpression = 'ConditionalExpression';
AST.constants = {
    'null': {type: AST.Literal, value: null},
    'true': {type: AST.Literal, value: true},
    'false': {type: AST.Literal, value: false},
    'this': {type: AST.ThisExpression}
};
export default AST;