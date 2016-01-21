'use strict';
import publishExternalApi from '../module';
import createInjector from '../injector';
import _ from 'lodash';
import $ from 'jquery';

describe('ngController', function () {
    var core;
    beforeEach(()=> {
        core = publishExternalApi();
    });

    it('is instantiated during compilation & linking', function () {
        var instantiated;

        function MyController() {
            instantiated = true;
        }

        var injector = createInjector(['ng', function ($controllerProvider) {
            $controllerProvider.register('MyController', MyController);
        }], core);
        injector.invoke(function ($compile, $rootScope) {
            var el = $('<div ng-controller="MyController"></div>');
            $compile(el)($rootScope);
            expect(instantiated).toBe(true);
        });
    });
    it('may inject scope, element, and attrs', function () {
        var gotScope, gotElement, gotAttrs;

        function MyController($scope, $element, $attrs) {
            gotScope = $scope;
            gotElement = $element;
            gotAttrs = $attrs;
        }

        var injector = createInjector(['ng', function ($controllerProvider) {
            $controllerProvider.register('MyController', MyController);
        }], core);
        injector.invoke(function ($compile, $rootScope) {
            var el = $('<div ng-controller="MyController"></div>');
            $compile(el)($rootScope);
            expect(gotScope).toBeDefined();
            expect(gotElement).toBeDefined();
            expect(gotAttrs).toBeDefined();
        });
    });
    it('has an inherited scope', function() {
        var gotScope;
        function MyController($scope, $element, $attrs) {
            gotScope = $scope;
        }
        var injector = createInjector(['ng', function($controllerProvider) {
            $controllerProvider.register('MyController', MyController);
        }], core);
        injector.invoke(function($compile, $rootScope) {
            var el = $('<div ng-controller="MyController"></div>');
            $compile(el)($rootScope);
            expect(gotScope).not.toBe($rootScope);
            expect(gotScope.$parent).toBe($rootScope);
            expect(Object.getPrototypeOf(gotScope)).toBe($rootScope);
        });
    });
    it('allows aliasing controller in expression', function() {
        var gotScope;
        function MyController($scope) {
            gotScope = $scope;
        }
        var injector = createInjector(['ng', function($controllerProvider) {
            $controllerProvider.register('MyController', MyController);
        }], core);
        injector.invoke(function($compile, $rootScope) {
            var el = $('<div ng-controller="MyController as myCtrl"></div>');
            $compile(el)($rootScope);
            expect(gotScope.myCtrl).toBeDefined();
            expect(gotScope.myCtrl instanceof MyController).toBe(true);
        });
    });
    it('allows looking up controller from surrounding scope', function() {
        var gotScope;
        function MyController($scope) {
            gotScope = $scope;
        }
        var injector = createInjector(['ng'], core);
        injector.invoke(function($compile, $rootScope) {
            var el = $('<div ng-controller="MyCtrlOnScope as myCtrl"></div>');
            $rootScope.MyCtrlOnScope = MyController;
            $compile(el)($rootScope);
            expect(gotScope.myCtrl).toBeDefined();
            expect(gotScope.myCtrl instanceof MyController).toBe(true);
        });
    });
});