'use strict';
import AST from './AST';
import ASTCompiler from './ASTCompiler';
class Parser {
    constructor($filter) {
        this.astCompiler = new ASTCompiler($filter);
    }

    parse(text) {
        return this.astCompiler.compile(text);
    }
}
export default Parser;

