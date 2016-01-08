'use strict';
import _ from 'lodash';

const NOT_ALOWED_MODULE_NAMES = [
    'hasOwnProperty'
];

function checkModuleName(name){
    if(~NOT_ALOWED_MODULE_NAMES.indexOf(name)){
        throw Error(`'${name}' is not allowed to be the name of a module`);
    }
}

class Angular {
    constructor(){
        this.$$modules = {};
    }
    module(name, deps) {
        if(!_.isArray(deps)){
            return this.getModule(name);
        }
        return this.createModule(name, deps);
    }
    createModule(name, requires){
        checkModuleName(name);
        return this.$$modules[name] = {name, requires};
    }
    getModule(name){
        var module = this.$$modules[name];
        if(!module){
            throw Error(`Module ${name} is not available`);
        }
        return module;
    }
}

export default Angular;