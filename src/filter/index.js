'use strict';
var filters = {};

var register = (name, factory)=> {
    return filters[name] = factory();
};

var filter = name=> {
    return filters[name];
};