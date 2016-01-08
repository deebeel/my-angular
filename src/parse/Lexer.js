'use strict';
import {constant} from 'lodash';


var ESCAPES = {'n': '\n', 'f': '\f', 'r': '\r', 't': '\t', 'v': '\v', '\'': '\'', '"': '"'};

var OPERATORS = {
    '+': true,
    '-': true,
    '!': true,
    '*': true,
    '/': true,
    '%': true,
    '=': true,
    '==': true,
    '!=': true,
    '===': true,
    '!==': true,
    '<': true,
    '>': true,
    '<=': true,
    '>=': true,
    '&&': true,
    '||': true,
    '|': true
};



class Lexer {
    lex(text) {
        this.text = text;
        this.index = 0;
        this.ch = null;
        this.tokens = [];
        while (this.index < this.text.length) {
            this.ch = this.text.charAt(this.index);
            if (isNumber(this.ch) ||
                (this.is('.') && isNumber(this.peek()))) {
                this.readNumber();
            } else if (this.is('\'"')) {
                this.readString(this.ch);
            } else if (this.is('[],{}:.()?;')) {
                this.tokens.push({
                    text: this.ch
                });
                this.index++;
            } else if (isIdent(this.ch)) {
                this.readIdent();
            } else if (isWhitespace(this.ch)) {
                this.index++;
            } else {
                var ch = this.ch;
                var ch2 = this.ch + this.peek();
                var ch3 = this.ch + this.peek() + this.peek(2);
                var op = OPERATORS[ch];
                var op2 = OPERATORS[ch2];
                var op3 = OPERATORS[ch3];
                if (op || op2 || op3) {
                    var token = op3 ? ch3 : (op2 ? ch2 : ch);
                    this.tokens.push({text: token});
                    this.index += token.length;
                } else {
                    throw 'Unexpected next character: ' + this.ch;
                }
            }
        }

        return this.tokens;
    }
    readNumber() {
        var number = '';
        while (this.index < this.text.length) {
            var ch = this.text.charAt(this.index).toLowerCase();
            if (ch === '.' || isNumber(ch)) {
                number += ch;
            } else {
                var nextCh = this.peek();
                var prevCh = number.charAt(number.length - 1);
                if (ch === 'e' && isExpOperator(nextCh)) {
                    number += ch;
                } else if (isExpOperator(ch) && prevCh === 'e' &&
                    nextCh && isNumber(nextCh)) {
                    number += ch;
                } else if (isExpOperator(ch) && prevCh === 'e' &&
                    (!nextCh || !isNumber(nextCh))) {
                    throw 'Invalid exponent';
                } else {
                    break;
                }
            }
            this.index++;
        }
        number = 1 * number;
        this.tokens.push({
            text: number,
            value: Number(number)
        });
    }

    readString(quote) {
        this.index++;
        var string = '';
        var rawString = quote;
        var escape = false;
        while (this.index < this.text.length) {
            var ch = this.text.charAt(this.index);
            rawString += ch;
            if (escape) {
                if (ch === 'u') {
                    var hex = this.text.substring(this.index + 1, this.index + 5);
                    if (!hex.match(/[\da-f]{4}/i)) {
                        throw 'Invalid unicode escape';
                    }
                    this.index += 4;
                    string += String.fromCharCode(parseInt(hex, 16));
                } else {
                    var replacement = ESCAPES[ch];
                    if (replacement) {
                        string += replacement;
                    } else {
                        string += ch;
                    }
                }
                escape = false;
            } else if (ch === quote) {
                this.index++;
                this.tokens.push({
                    text: rawString,
                    value: string
                });
                return;
            } else if (ch === '\\') {
                escape = true;
            } else {
                string += ch;
            }
            this.index++;
        }
    }

    readIdent() {
        var text = '';
        while (this.index < this.text.length) {
            var ch = this.text.charAt(this.index);
            if (isIdent(ch) || isNumber(ch)) {
                text += ch;
            } else {
                break;
            }
            this.index++;
        }
        var token = {
            text: text,
            identifier: true
        };
        this.tokens.push(token);
    }

    is(chs) {
        return ~chs.indexOf(this.ch);
    }

    peek(n) {
        n = n || 1;
        return this.index + n < this.text.length ?
            this.text.charAt(this.index + n) : false;
    }


}
function isNumber(ch) {
    return '0' <= ch && ch <= '9';
}
function isExpOperator(ch) {
    return ch === '-' || ch === '+' || isNumber(ch);
}
function isIdent(ch) {
    return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') ||
        ch === '_' || ch === '$';
}
function isWhitespace(ch) {
    return ch === ' ' || ch === '\r' || ch === '\t' ||
        ch === '\n' || ch === '\v' || ch === '\u00A0';
}


export default Lexer;