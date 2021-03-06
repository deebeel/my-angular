'use strict';
import publishExternalApi from './module';
import createInjector from './injector';

require('./parse/parse.spec.js');
require('./q/q.spec');

require('./module/module.spec.js');
require('./filter/filter.spec.js');
require('./injector/injector.spec.js');
require('./scope/scope.spec');
require('./compile/compile.spec.js');
require('./directives/ngController.spec');
require('./controller/controller.spec.js');


describe('public api', ()=> {
    var core, injector;
    beforeEach(()=> {
        core = publishExternalApi();
        injector = createInjector(['ng'], core);
    });
    it('should set up ng module', ()=> {
        expect(createInjector(['ng'], core)).toBeDefined();
    });
    it('sets up the $filter service', function () {
        expect(injector.has('$filter')).toBe(true);
    });
    it('sets up $q', function() {
        expect(injector.has('$q')).toBe(true);
    });

    it('sets up $q', function() {
        expect(injector.has('$$q')).toBe(true);
    });
    it('sets up $compile', function() {
        expect(injector.has('$compile')).toBe(true);
    });
    it('sets up $controller', function() {
        expect(injector.has('$controller')).toBe(true);
    });
});

describe('TTL configurability', function () {
    var core;
    beforeEach(function () {
        core = publishExternalApi();
    });
    it('allows configuring a shorter TTL', function () {
        var injector = createInjector(['ng', function ($rootScopeProvider) {
            $rootScopeProvider.digestTtl(5);
        }], core);
        var scope = injector.get('$rootScope');
        scope.counterA = 0;
        scope.counterB = 0;
        scope.$watch(
            function (scope) {
                return scope.counterA;
            },
            function (newValue, oldValue, scope) {
                if (scope.counterB < 5) {
                    scope.counterB++;
                }
            }
        );
        scope.$watch(
            function (scope) {
                return scope.counterB;
            },
            function (newValue, oldValue, scope) {
                scope.counterA++;
            }
        );
        expect(function () {
            scope.$digest();
        }).toThrow();
    });
});

