'use strict';

class ScopeEvent {
    constructor(name, scope) {
        this.name = name;
        this.currentScope = this.targetScope = scope;
        this.propagate = true;
        this.defaultPrevented = false;
    }
    preventDefault(){
        this.defaultPrevented = true;
    }
    stopPropagation() {
        this.propagate = false;
    }
}

export default  ScopeEvent;