'use strict';
import Core from './core';
import ngControllerDirective from '../directives/ng-controller';

import $FilterProvider from '../filter';
import $CompileProvider from '../compile';
import $ControllerProvider from '../controller';
import {$QProvider, $$QProvider} from '../q';
import $ParseProvider from '../parse';
import $RootScopeProvider from '../scope';



export default function publishExternalApi() {
    var core = new Core();
    var ngModule = core.module('ng', []);
    ngModule.provider('$filter', $FilterProvider);
    ngModule.provider('$parse', $ParseProvider);
    ngModule.provider('$rootScope', $RootScopeProvider);
    ngModule.provider('$q', $QProvider);
    ngModule.provider('$$q', $$QProvider);
    ngModule.provider('$compile', $CompileProvider);
    ngModule.provider('$controller', $ControllerProvider);
    ngModule.directive('ngController', ngControllerDirective);
    return core;
};