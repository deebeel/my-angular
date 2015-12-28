'use strict';

class ScopeEvent {
    constructor(name, scope) {
        this.name = name;
        this.currentScope = this.targetScope = scope;
    }
}

export default  ScopeEvent;