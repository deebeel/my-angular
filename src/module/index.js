'use strict';
import Core from './core';
import $FilterProvider from '../filter';
import {$QProvider, $$QProvider} from '../q';
import $ParseProvider from '../parse';
import $RootScopeProvider from '../scope';

if (TEST) {
    require('./module.spec.js');
}


export default function publishExternalApi() {
    var core = new Core();
    var ngModule = core.module('ng', []);
    ngModule.provider('$filter', $FilterProvider);
    ngModule.provider('$parse', $ParseProvider);
    ngModule.provider('$rootScope', $RootScopeProvider);
    ngModule.provider('$q', $QProvider);
    ngModule.provider('$$q', $$QProvider);
    return core;
};