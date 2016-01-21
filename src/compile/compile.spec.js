'use strict';

import publishExternalApi from '../module';
import createInjector from '../injector';
import _ from 'lodash';
import $ from 'jquery';


fdescribe('$compile', ()=> {
    var core, myModule;
    beforeEach(()=> {
        core = publishExternalApi();
        myModule = core.module('myModule', []);
    });

    it('allows creating directives', function () {
        myModule.directive('testing', function () {
        });
        var injector = createInjector(['ng', 'myModule'], core);
        expect(injector.has('testingDirective')).toBe(true);
    });
    it('allows creating many directives with the same name', function () {
        myModule.directive('testing', _.constant({d: 'one'}));
        myModule.directive('testing', _.constant({d: 'two'}));
        var injector = createInjector(['ng', 'myModule'], core);
        var result = injector.get('testingDirective');
        expect(result.length).toBe(2);
        expect(result[0].d).toEqual('one');
        expect(result[1].d).toEqual('two');
    });
    it('allows creating directives with object notation', function () {
        myModule.directive({
            a: function () {
            },
            b: function () {
            },
            c: function () {
            }
        });
        var injector = createInjector(['ng', 'myModule'], core);
        expect(injector.has('aDirective')).toBe(true);
        expect(injector.has('bDirective')).toBe(true);
        expect(injector.has('cDirective')).toBe(true);
    });
    it('compiles element directives from a single element', function () {
        var injector = makeInjectorWithDirectives('myDirective', function () {
            return {
                compile: function (element) {
                    element.data('hasCompiled', true);
                }
            };
        });
        injector.invoke(function ($compile) {
            var el = $('<my-directive></my-directive>');
            $compile(el);
            expect(el.data('hasCompiled')).toBe(true);
        });
    });
    it('compiles element directives found from several elements', function () {
        var idx = 1;
        var injector = makeInjectorWithDirectives('myDirective', function () {
            return {
                compile: function (element) {
                    element.data('hasCompiled', idx++);
                }
            };
        });
        injector.invoke(function ($compile) {
            var el = $('<my-directive></my-directive><my-directive></my-directive>');
            $compile(el);
            expect(el.eq(0).data('hasCompiled')).toBe(1);
            expect(el.eq(1).data('hasCompiled')).toBe(2);
        });
    });
    it('compiles element directives from child elements', function () {
        var idx = 1;
        var injector = makeInjectorWithDirectives('myDirective', function () {
            return {
                compile: function (element) {
                    element.data('hasCompiled', idx++);
                }
            };
        });
        injector.invoke(function ($compile) {
            var el = $('<div><my-directive></my-directive></div>');
            $compile(el);
            expect(el.data('hasCompiled')).toBeUndefined();
            expect(el.find('> my-directive').data('hasCompiled')).toBe(1);
        });
    });
    it('compiles nested directives', function () {
        var idx = 1;
        var injector = makeInjectorWithDirectives('myDir', function () {
            return {
                compile: function (element) {
                    element.data('hasCompiled', idx++);
                }
            };
        });
        injector.invoke(function ($compile) {
            var el = $('<my-dir><my-dir><my-dir/></my-dir></my-dir>');
            $compile(el);
            expect(el.data('hasCompiled')).toBe(1);
            expect(el.find('> my-dir').data('hasCompiled')).toBe(2);
            expect(el.find('> my-dir > my-dir').data('hasCompiled')).toBe(3);
        });
    });
    it('compiles attribute directives', function () {
        var injector = makeInjectorWithDirectives('myDirective', function () {
            return {
                compile: function (element) {
                    element.data('hasCompiled', true);
                }
            };
        });
        injector.invoke(function ($compile) {
            var el = $('<div my-directive></div>');
            $compile(el);
            expect(el.data('hasCompiled')).toBe(true);
        });
    });
    it('compiles several attribute directives in an element', function () {
        var injector = makeInjectorWithDirectives({
            myDirective: function () {
                return {
                    compile: function (element) {
                        element.data('hasCompiled', true);
                    }
                };
            },
            mySecondDirective: function () {
                return {
                    compile: function (element) {
                        element.data('secondCompiled', true);
                    }
                };
            }
        });
        injector.invoke(function ($compile) {
            var el = $('<div my-directive my-second-directive></div>');
            $compile(el);
            expect(el.data('hasCompiled')).toBe(true);
            expect(el.data('secondCompiled')).toBe(true);
        });
    });
    it('compiles both element and attributes directives in an element', function () {
        var injector = makeInjectorWithDirectives({
            myDirective: function () {
                return {
                    compile: function (element) {
                        element.data('hasCompiled', true);
                    }
                };
            },
            mySecondDirective: function () {
                return {
                    compile: function (element) {
                        element.data('secondCompiled', true);
                    }
                };
            }
        });
        injector.invoke(function ($compile) {
            var el = $('<my-directive my-second-directive></my-directive>');
            $compile(el);
            expect(el.data('hasCompiled')).toBe(true);
            expect(el.data('secondCompiled')).toBe(true);
        });
    });

    it('compiles attribute directives with ng-attr prefix', function () {
        var injector = makeInjectorWithDirectives('myDirective', function () {
            return {
                compile: function (element) {
                    element.data('hasCompiled', true);
                }
            };
        });
        injector.invoke(function ($compile) {
            var el = $('<div ng-attr-my-directive></div>');
            $compile(el);
            expect(el.data('hasCompiled')).toBe(true);
        });
    });

    _.forEach({
        A: {element: false, attribute: true},
        E: {element: true, attribute: false},
        AE: {element: true, attribute: true}
    }, (expected, restrict)=> {
        describe('restricted to ' + restrict, function () {
            _.forEach({
                element: '<my-directive></my-directive>',
                attribute: '<div my-directive></div>'
            }, function (dom, type) {
                it((expected[type] ? 'matches' : 'does not match') + ' on ' + type, function () {
                    var hasCompiled = false;
                    var injector = makeInjectorWithDirectives('myDirective', function () {
                        return {
                            restrict: restrict,
                            compile: function (element) {
                                hasCompiled = true;
                            }
                        };
                    });
                    injector.invoke(function ($compile) {
                        var el = $(dom);
                        $compile(el);
                        expect(hasCompiled).toBe(expected[type]);
                    });
                });
            });
        });

    });


    it('applies in priority order', function () {
        var compilations = [];
        var injector = makeInjectorWithDirectives({
            lowerDirective: function () {
                return {
                    priority: 1,
                    compile: function (element) {
                        compilations.push('lower');
                    }
                };
            },
            higherDirective: function () {
                return {
                    priority: 2,
                    compile: function (element) {
                        compilations.push('higher');
                    }
                };
            }
        });
        injector.invoke(function ($compile) {
            var el = $('<div lower-directive higher-directive></div>');
            $compile(el);
            expect(compilations).toEqual(['higher', 'lower']);
        });
    });


    it('applies in name order when priorities are the same', function () {
        var compilations = [];
        var injector = makeInjectorWithDirectives({
            firstDirective: function () {
                return {
                    priority: 1,
                    compile: function (element) {
                        compilations.push('first');
                    }
                };
            },
            secondDirective: function () {
                return {
                    priority: 1,
                    compile: function (element) {
                        compilations.push('second');
                    }
                };
            }
        });
        injector.invoke(function ($compile) {
            var el = $('<div second-directive first-directive></div>');
            $compile(el);
            expect(compilations).toEqual(['first', 'second']);
        });
    });

    it('applies in registration order when names are the same', function () {
        var compilations = [];
        var myModule = core.module('myModule', []);
        myModule.directive('aDirective', function () {
            return {
                priority: 1,
                compile: function (element) {
                    compilations.push('first');
                }
            };
        });
        myModule.directive('aDirective', function () {
            return {
                priority: 1,
                compile: function (element) {
                    compilations.push('second');
                }
            };
        });
        var injector = createInjector(['ng', 'myModule'], core);
        injector.invoke(function ($compile) {
            var el = $('<div a-directive></div>');
            $compile(el);
            expect(compilations).toEqual(['first', 'second']);
        });
    });

    it('uses default priority when one not given', function () {
        var compilations = [];
        var myModule = core.module('myModule', []);
        myModule.directive('firstDirective', function () {
            return {
                priority: 1,
                compile: function (element) {
                    compilations.push('first');
                }
            };
        });
        myModule.directive('secondDirective', function () {
            return {
                compile: function (element) {
                    compilations.push('second');
                }
            };
        });
        var injector = createInjector(['ng', 'myModule'], core);
        injector.invoke(function ($compile) {
            var el = $('<div second-directive first-directive></div>');
            $compile(el);
            expect(compilations).toEqual(['first', 'second']);
        });
    });
    it('stops compiling at a terminal directive', function () {
        var compilations = [];
        var myModule = core.module('myModule', []);
        myModule.directive('firstDirective', function () {
            return {
                priority: 1,
                terminal: true,
                compile: function (element) {
                    compilations.push('first');
                }
            };
        });
        myModule.directive('secondDirective', function () {
            return {
                priority: 0,
                compile: function (element) {
                    compilations.push('second');
                }
            };
        });
        var injector = createInjector(['ng', 'myModule'], core);
        injector.invoke(function ($compile) {
            var el = $('<div first-directive second-directive></div>');
            $compile(el);
            expect(compilations).toEqual(['first']);
        });
    });

    it('still compiles directives with same priority after terminal', function () {
        var compilations = [];
        var myModule = core.module('myModule', []);
        myModule.directive('firstDirective', function () {
            return {
                priority: 1,
                terminal: true,
                compile: function (element) {
                    compilations.push('first');
                }
            };
        });
        myModule.directive('secondDirective', function () {
            return {
                priority: 1,
                compile: function (element) {
                    compilations.push('second');
                }
            };
        });
        var injector = createInjector(['ng', 'myModule'], core);
        injector.invoke(function ($compile) {
            var el = $('<div first-directive second-directive></div>');
            $compile(el);
            expect(compilations).toEqual(['first', 'second']);
        });
    });

    it('stops child compilation after a terminal directive', function () {
        var compilations = [];
        var myModule = core.module('myModule', []);
        myModule.directive('parentDirective', function () {
            return {
                terminal: true,
                compile: function (element) {
                    compilations.push('parent');
                }
            };
        });
        myModule.directive('childDirective', function () {
            return {
                compile: function (element) {
                    compilations.push('child');
                }
            };
        });
        var injector = createInjector(['ng', 'myModule'], core);
        injector.invoke(function ($compile) {
            var el = $('<div parent-directive><div child-directive></div></div>');
            $compile(el);
            expect(compilations).toEqual(['parent']);
        });
    });
    it('allows applying a directive to multiple elements', function () {
        var compileEl = false;
        var injector = makeInjectorWithDirectives('myDir', function () {
            return {
                multiElement: true,
                compile: function (element) {
                    compileEl = element;
                }
            };
        });
        injector.invoke(function ($compile) {
            var el = $('<div my-dir-start></div><span></span><div my-dir-end></div>');
            $compile(el);
            expect(compileEl.length).toBe(3);
        });
    });


    describe('attributes', function () {

        it('passes the element attributes to the compile function', function () {
            registerAndCompile(
                'myDirective',
                '<my-directive my-attr="1" my-other-attr="two"></my-directive>',
                function (element, attrs) {
                    expect(attrs.myAttr).toEqual('1');
                    expect(attrs.myOtherAttr).toEqual('two');
                }
            );
        });
        it('trims attribute values', function () {
            registerAndCompile(
                'myDirective',
                '<my-directive my-attr=" val "></my-directive>',
                function (element, attrs) {
                    expect(attrs.myAttr).toEqual('val');
                }
            );
        });
        it('sets the value of boolean attributes to true', function () {
            registerAndCompile(
                'myDirective',
                '<input my-directive disabled>',
                function (element, attrs) {
                    expect(attrs.disabled).toBe(true);
                }
            );
        });
        it('does not set the value of custom boolean attributes to true', function () {
            registerAndCompile(
                'myDirective',
                '<input my-directive whatever>',
                function (element, attrs) {
                    expect(attrs.whatever).toEqual('');
                }
            );
        });
        it('overrides attributes with ng-attr- versions', function () {
            registerAndCompile(
                'myDirective',
                '<input my-directive ng-attr-whatever="42" whatever="41">',
                function (element, attrs) {
                    expect(attrs.whatever).toEqual('42');
                }
            );
        });
        it('allows setting attributes', function () {
            registerAndCompile(
                'myDirective',
                '<my-directive attr="true"></my-directive>',
                function (element, attrs) {
                    attrs.$set('attr', 'false');
                    expect(attrs.attr).toEqual('false');
                }
            );
        });
        it('sets attributes to DOM', function () {
            registerAndCompile(
                'myDirective',
                '<my-directive attr="true"></my-directive>',
                function (element, attrs) {
                    attrs.$set('attr', 'false');
                    expect(element.attr('attr')).toEqual('false');
                }
            );
        });
        it('does not set attributes to DOM when flag is false', function () {
            registerAndCompile(
                'myDirective',
                '<my-directive attr="true"></my-directive>',
                function (element, attrs) {
                    attrs.$set('attr', 'false', false);
                    expect(element.attr('attr')).toEqual('true');
                }
            );
        });
        it('shares attributes between directives', function () {
            var attrs1, attrs2;
            var injector = makeInjectorWithDirectives({
                myDir: function () {
                    return {
                        compile: function (element, attrs) {
                            attrs1 = attrs;
                        }
                    };
                },
                myOtherDir: function () {
                    return {
                        compile: function (element, attrs) {
                            attrs2 = attrs;
                        }
                    };
                }
            });
            injector.invoke(function ($compile) {
                var el = $('<div my-dir my-other-dir></div>');
                $compile(el);
                expect(attrs1).toBe(attrs2);
            });
        });
        it('sets prop for boolean attributes', function () {
            registerAndCompile(
                'myDirective',
                '<input my-directive>',
                function (element, attrs) {
                    attrs.$set('disabled', true);
                    expect(element.prop('disabled')).toBe(true);
                }
            );
        });
        it('sets prop for boolean attributes even when not flushing', function () {
            registerAndCompile(
                'myDirective',
                '<input my-directive>',
                function (element, attrs) {
                    attrs.$set('disabled', true, false);
                    expect(element.prop('disabled')).toBe(true);
                }
            );
        });
        it('denormalizes attribute name when explicitly given', function () {
            registerAndCompile(
                'myDirective',
                '<my-directive some-attribute="42"></my-directive>',
                function (element, attrs) {
                    attrs.$set('someAttribute', 43, true, 'some-attribute');
                    expect(element.attr('some-attribute')).toEqual('43');
                }
            );
        });
        it('denormalizes attribute by snake-casing', function () {
            registerAndCompile(
                'myDirective',
                '<my-directive some-attribute="42"></my-directive>',
                function (element, attrs) {
                    attrs.$set('someAttribute', 43);
                    expect(element.attr('some-attribute')).toEqual('43');
                }
            );
        });
        it('does not use ng-attr- prefix in denormalized names', function () {
            registerAndCompile(
                'myDirective',
                '<my-directive ng-attr-some-attribute="42"></my-directive>',
                function (element, attrs) {
                    attrs.$set('someAttribute', 43);
                    expect(element.attr('some-attribute')).toEqual('43');
                }
            );
        });
        it('uses new attribute name after once given', function () {
            registerAndCompile(
                'myDirective',
                '<my-directive x-some-attribute="42"></my-directive>',
                function (element, attrs) {
                    attrs.$set('someAttribute', 43, true, 'some-attribute');
                    attrs.$set('someAttribute', 44);
                    expect(element.attr('some-attribute')).toEqual('44');
                    expect(element.attr('x-some-attribute')).toEqual('42');
                }
            );
        });
        it('calls observer immediately when attribute is $set', function () {
            registerAndCompile(
                'myDirective',
                '<my-directive some-attribute="42"></my-directive>',
                function (element, attrs) {
                    var gotValue;
                    attrs.$observe('someAttribute', function (value) {
                        gotValue = value;
                    });
                    attrs.$set('someAttribute', '43');
                    expect(gotValue).toEqual('43');
                }
            );
        });
        it('calls observer on next $digest after registration', function () {
            registerAndCompile(
                'myDirective',
                '<my-directive some-attribute="42"></my-directive>',
                function (element, attrs, $rootScope) {
                    var gotValue;
                    attrs.$observe('someAttribute', function (value) {
                        gotValue = value;
                    });
                    $rootScope.$digest();
                    expect(gotValue).toEqual('42');
                }
            );
        });
        it('lets observers be deregistered', function () {
            registerAndCompile(
                'myDirective',
                '<my-directive some-attribute="42"></my-directive>',
                function (element, attrs) {
                    var gotValue;
                    var remove = attrs.$observe('someAttribute', function (value) {
                        gotValue = value;
                    });
                    attrs.$set('someAttribute', '43');
                    expect(gotValue).toEqual('43');
                    remove();
                    attrs.$set('someAttribute', '44');
                    expect(gotValue).toEqual('43');
                }
            );
        });
        it('allows adding classes', function () {
            registerAndCompile(
                'myDirective',
                '<my-directive></my-directive>',
                function (element, attrs) {
                    attrs.$addClass('some-class');
                    expect(element.hasClass('some-class')).toBe(true);
                }
            );
        });
        it('allows removing classes', function () {
            registerAndCompile(
                'myDirective',
                '<my-directive class="some-class"></my-directive>',
                function (element, attrs) {
                    attrs.$removeClass('some-class');
                    expect(element.hasClass('some-class')).toBe(false);
                }
            );
        });
        it('allows updating classes', function () {
            registerAndCompile(
                'myDirective',
                '<my-directive class="one three four"></my-directive>',
                function (element, attrs) {
                    attrs.$updateClass('one two three', 'one three four');
                    expect(element.hasClass('one')).toBe(true);
                    expect(element.hasClass('two')).toBe(true);
                    expect(element.hasClass('three')).toBe(true);
                    expect(element.hasClass('four')).toBe(false);
                }
            );
        });
    });
    describe('linking', function () {

        it('returns a public link function from compile', function () {
            var injector = makeInjectorWithDirectives('myDirective', function () {
                return {compile: _.noop};
            });
            injector.invoke(function ($compile) {
                var el = $('<div my-directive></div>');
                var linkFn = $compile(el);
                expect(linkFn).toBeDefined();
                expect(_.isFunction(linkFn)).toBe(true);
            });
        });
        it('takes a scope and attaches it to elements', function () {
            var injector = makeInjectorWithDirectives('myDirective', function () {
                return {compile: _.noop};
            });
            injector.invoke(function ($compile, $rootScope) {
                var el = $('<div my-directive></div>');
                $compile(el)($rootScope);
                expect(el.data('$scope')).toBe($rootScope);
            });
        });
        it('calls directive link function with scope', function () {
            var givenScope, givenElement, givenAttrs;
            var injector = makeInjectorWithDirectives('myDirective', function () {
                return {
                    compile: function () {
                        return function link(scope, element, attrs) {
                            givenScope = scope;
                            givenElement = element;
                            givenAttrs = attrs;
                        };
                    }
                };
            });
            injector.invoke(function ($compile, $rootScope) {
                var el = $('<div my-directive></div>');
                $compile(el)($rootScope);
                expect(givenScope).toBe($rootScope);
                expect(givenElement[0]).toBe(el[0]);
                expect(givenAttrs).toBeDefined();
                expect(givenAttrs.myDirective).toBeDefined();
            });
        });
        it('supports link function in directive definition object', function () {
            var givenScope, givenElement, givenAttrs;
            var injector = makeInjectorWithDirectives('myDirective', function () {
                return {
                    link: function (scope, element, attrs) {
                        givenScope = scope;
                        givenElement = element;
                        givenAttrs = attrs;
                    }
                };
            });
            injector.invoke(function ($compile, $rootScope) {
                var el = $('<div my-directive></div>');
                $compile(el)($rootScope);
                expect(givenScope).toBe($rootScope);
                expect(givenElement[0]).toBe(el[0]);
                expect(givenAttrs).toBeDefined();
                expect(givenAttrs.myDirective).toBeDefined();
            });
        });
        it('links directive on child elements first', function () {
            var givenElements = [];
            var injector = makeInjectorWithDirectives('myDirective', function () {
                return {
                    link: function (scope, element, attrs) {
                        givenElements.push(element);
                    }
                };
            });
            injector.invoke(function ($compile, $rootScope) {
                var el = $('<div my-directive><div my-directive></div></div>');
                $compile(el)($rootScope);
                expect(givenElements.length).toBe(2);
                expect(givenElements[0][0]).toBe(el[0].firstChild);
                expect(givenElements[1][0]).toBe(el[0]);
            });
        });
        it('links children when parent has no directives', function () {
            var givenElements = [];
            var injector = makeInjectorWithDirectives('myDirective', function () {
                return {
                    link: function (scope, element, attrs) {
                        givenElements.push(element);
                    }
                };
            });
            injector.invoke(function ($compile, $rootScope) {
                var el = $('<div><div my-directive></div></div>');
                $compile(el)($rootScope);
                expect(givenElements.length).toBe(1);
                expect(givenElements[0][0]).toBe(el[0].firstChild);
            });
        });
        it('supports link function objects', function () {
            var linked;
            var injector = makeInjectorWithDirectives('myDirective', function () {
                return {
                    link: {
                        post: function (scope, element, attrs) {
                            linked = true;
                        }
                    }
                };
            });
            injector.invoke(function ($compile, $rootScope) {
                var el = $('<div><div my-directive></div></div>');
                $compile(el)($rootScope);
                expect(linked).toBe(true);
            });
        });
        it('supports prelinking and postlinking', function () {
            var linkings = [];
            var injector = makeInjectorWithDirectives('myDirective', function () {
                return {
                    link: {
                        pre: function (scope, element) {
                            linkings.push(['pre', element[0]]);
                        },
                        post: function (scope, element) {
                            linkings.push(['post', element[0]]);
                        }
                    }
                };
            });
            injector.invoke(function ($compile, $rootScope) {
                var el = $('<div my-directive><div my-directive></div></div>');
                $compile(el)($rootScope);
                expect(linkings.length).toBe(4);
                expect(linkings[0]).toEqual(['pre', el[0]]);
                expect(linkings[1]).toEqual(['pre', el[0].firstChild]);
                expect(linkings[2]).toEqual(['post', el[0].firstChild]);
                expect(linkings[3]).toEqual(['post', el[0]]);
            });
        });

        it('reverses priority for postlink functions', function () {
            var linkings = [];
            var injector = makeInjectorWithDirectives({
                firstDirective: function () {
                    return {
                        priority: 2,
                        link: {
                            pre: function (scope, element) {
                                linkings.push('first-pre');
                            },
                            post: function (scope, element) {
                                linkings.push('first-post');
                            }
                        }
                    };
                },
                secondDirective: function () {
                    return {
                        priority: 1,
                        link: {
                            pre: function (scope, element) {
                                linkings.push('second-pre');
                            },
                            post: function (scope, element) {
                                linkings.push('second-post');
                            }
                        }
                    }
                }
            });

            injector.invoke(function ($compile, $rootScope) {
                var el = $('<div first-directive second-directive></div>');
                $compile(el)($rootScope);
                expect(linkings).toEqual([
                    'first-pre',
                    'second-pre',
                    'second-post',
                    'first-post'
                ]);
            });
        });
        it('stabilizes node list during linking', function () {
            var givenElements = [];
            var injector = makeInjectorWithDirectives('myDirective', function () {
                return {
                    link: function (scope, element, attrs) {
                        givenElements.push(element[0]);
                        element.after('<div></div>');
                    }
                };
            });
            injector.invoke(function ($compile, $rootScope) {
                var el = $('<div><div my-directive></div><div my-directive></div></div>');
                var el1 = el[0].childNodes[0], el2 = el[0].childNodes[1];
                $compile(el)($rootScope);
                expect(givenElements.length).toBe(2);
                expect(givenElements[0]).toBe(el1);
                expect(givenElements[1]).toBe(el2);
            });
        });
        it('invokes multi-element directive link functions with whole group', function () {
            var givenElements;
            var injector = makeInjectorWithDirectives('myDirective', function () {
                return {
                    multiElement: true,
                    link: function (scope, element, attrs) {
                        givenElements = element;
                    }
                };
            });
            injector.invoke(function ($compile, $rootScope) {
                var el = $(
                    '<div my-directive-start></div>' +
                    '<p></p>' +
                    '<div my-directive-end></div>'
                );
                $compile(el)($rootScope);
                expect(givenElements.length).toBe(3);
            });
        });
        it('makes new scope for element when directive asks for it', function () {
            var givenScope;
            var injector = makeInjectorWithDirectives('myDirective', function () {
                return {
                    scope: true,
                    link: function (scope) {
                        givenScope = scope;
                    }
                };
            });
            injector.invoke(function ($compile, $rootScope) {
                var el = $('<div my-directive></div>');
                $compile(el)($rootScope);
                expect(givenScope.$parent).toBe($rootScope);
            });
        });
        it('gives inherited scope to all directives on element', function () {
            var givenScope;
            var injector = makeInjectorWithDirectives({
                myDirective: function () {
                    return {
                        scope: true
                    };
                },
                myOtherDirective: function () {
                    return {
                        link: function (scope) {
                            givenScope = scope;
                        }
                    };
                }
            });
            injector.invoke(function ($compile, $rootScope) {
                var el = $('<div my-directive my-other-directive></div>');
                $compile(el)($rootScope);
                expect(givenScope.$parent).toBe($rootScope);
            });
        });
        it('adds scope class and data for element with new scope', function () {
            var givenScope;
            var injector = makeInjectorWithDirectives('myDirective', function () {
                return {
                    scope: true,
                    link: function (scope) {
                        givenScope = scope;
                    }
                };
            });
            injector.invoke(function ($compile, $rootScope) {
                var el = $('<div my-directive></div>');
                $compile(el)($rootScope);
                expect(el.hasClass('ng-scope')).toBe(true);
                expect(el.data('$scope')).toBe(givenScope);
            });
        });
        it('creates an isolate scope when requested', function () {
            var givenScope;
            var injector = makeInjectorWithDirectives('myDirective', function () {
                return {
                    scope: {},
                    link: function (scope) {
                        givenScope = scope;
                    }
                };
            });
            injector.invoke(function ($compile, $rootScope) {
                var el = $('<div my-directive></div>');
                $compile(el)($rootScope);
                expect(givenScope.$parent).toBe($rootScope);
                expect(Object.getPrototypeOf(givenScope)).not.toBe($rootScope);
            });
        });
        it('does not share isolate scope with other directives', function () {
            var givenScope;
            var injector = makeInjectorWithDirectives({
                myDirective: function () {
                    return {
                        scope: {}
                    };
                },
                myOtherDirective: function () {
                    return {
                        link: function (scope) {
                            givenScope = scope;
                        }
                    };
                }
            });
            injector.invoke(function ($compile, $rootScope) {
                var el = $('<div my-directive my-other-directive></div>');
                $compile(el)($rootScope);
                expect(givenScope).toBe($rootScope);
            });
        });

        it('does not allow two isolate scope directives on an element', function () {
            var injector = makeInjectorWithDirectives({
                myDirective: function () {
                    return {
                        scope: {}
                    };
                },
                myOtherDirective: function () {
                    return {
                        scope: {}
                    };
                }
            });
            injector.invoke(function ($compile, $rootScope) {
                var el = $('<div my-directive my-other-directive></div>');
                expect(function () {
                    $compile(el);
                }).toThrow();
            });
        });
        it('does not allow both isolate and inherited scopes on an element', function () {
            var injector = makeInjectorWithDirectives({
                myDirective: function () {
                    return {
                        scope: {}
                    };
                },
                myOtherDirective: function () {
                    return {
                        scope: true
                    };
                }
            });
            injector.invoke(function ($compile, $rootScope) {
                var el = $('<div my-directive my-other-directive></div>');
                expect(function () {
                    $compile(el);
                }).toThrow();
            });
        });
        it('adds class and data for element with isolated scope', function () {
            var givenScope;
            var injector = makeInjectorWithDirectives('myDirective', function () {
                return {
                    scope: {},
                    link: function (scope) {
                        givenScope = scope;
                    }
                };
            });
            injector.invoke(function ($compile, $rootScope) {
                var el = $('<div my-directive></div>');
                $compile(el)($rootScope);
                expect(el.hasClass('ng-isolate-scope')).toBe(true);
                expect(el.hasClass('ng-scope')).toBe(false);
                expect(el.data('$isolateScope')).toBe(givenScope);
            });
        });

        it('allows observing attribute to the isolate scope', function () {
            var givenScope, givenAttrs;
            var injector = makeInjectorWithDirectives('myDirective', function () {
                return {
                    scope: {
                        anAttr: '@'
                    },
                    link: function (scope, element, attrs) {
                        givenScope = scope;
                        givenAttrs = attrs;
                    }
                };
            });
            injector.invoke(function ($compile, $rootScope) {
                var el = $('<div my-directive></div>');
                $compile(el)($rootScope);
                givenAttrs.$set('anAttr', '42');
                expect(givenScope.anAttr).toEqual('42');
            });
        });

        it('sets initial value of observed attr to the isolate scope', function () {
            var givenScope;
            var injector = makeInjectorWithDirectives('myDirective', function () {
                return {
                    scope: {
                        anAttr: '@'
                    },
                    link: function (scope, element, attrs) {
                        givenScope = scope;
                    }
                };
            });
            injector.invoke(function ($compile, $rootScope) {
                var el = $('<div my-directive an-attr="42"></div>');
                $compile(el)($rootScope);
                expect(givenScope.anAttr).toEqual('42');
            });
        });
        it('allows aliasing observed attribute', function () {
            var givenScope;
            var injector = makeInjectorWithDirectives('myDirective', function () {
                return {
                    scope: {
                        aScopeAttr: '@anAttr'
                    },
                    link: function (scope, element, attrs) {
                        givenScope = scope;
                    }
                };
            });
            injector.invoke(function ($compile, $rootScope) {
                var el = $('<div my-directive an-attr="42"></div>');
                $compile(el)($rootScope);
                expect(givenScope.aScopeAttr).toEqual('42');
            });
        });

        it('allows binding expression to isolate scope', function () {
            var givenScope;
            var injector = makeInjectorWithDirectives('myDirective', function () {
                return {
                    scope: {
                        anAttr: '='
                    },
                    link: function (scope) {
                        givenScope = scope;
                    }
                };
            });
            injector.invoke(function ($compile, $rootScope) {
                var el = $('<div my-directive an-attr="42"></div>');
                $compile(el)($rootScope);
                expect(givenScope.anAttr).toBe(42);
            });
        });
        it('allows aliasing expression attribute on isolate scope', function () {
            var givenScope;
            var injector = makeInjectorWithDirectives('myDirective', function () {
                return {
                    scope: {
                        myAttr: '=theAttr'
                    },
                    link: function (scope) {
                        givenScope = scope;
                    }
                };
            });
            injector.invoke(function ($compile, $rootScope) {
                var el = $('<div my-directive the-attr="42"></div>');
                $compile(el)($rootScope);
                expect(givenScope.myAttr).toBe(42);
            });
        });
        it('evaluates isolate scope expression on parent scope', function () {
            var givenScope;
            var injector = makeInjectorWithDirectives('myDirective', function () {
                return {
                    scope: {
                        myAttr: '='
                    },
                    link: function (scope) {
                        givenScope = scope;
                    }
                };
            });
            injector.invoke(function ($compile, $rootScope) {
                $rootScope.parentAttr = 41;
                var el = $('<div my-directive my-attr="parentAttr + 1"></div>');
                $compile(el)($rootScope);
                expect(givenScope.myAttr).toBe(42);
            });
        });

        it('watches isolated scope expressions', function () {
            var givenScope;
            var injector = makeInjectorWithDirectives('myDirective', function () {
                return {
                    scope: {
                        myAttr: '='
                    },
                    link: function (scope) {
                        givenScope = scope;
                    }
                };
            });
            injector.invoke(function ($compile, $rootScope) {
                var el = $('<div my-directive my-attr="parentAttr + 1"></div>');
                $compile(el)($rootScope);
                $rootScope.parentAttr = 41;
                $rootScope.$digest();
                expect(givenScope.myAttr).toBe(42);
            });
        });
        it('allows assigning to isolated scope expressions', function () {
            var givenScope;
            var injector = makeInjectorWithDirectives('myDirective', function () {
                return {
                    scope: {
                        myAttr: '='
                    },
                    link: function (scope) {
                        givenScope = scope;
                    }
                };
            });
            injector.invoke(function ($compile, $rootScope) {
                var el = $('<div my-directive my-attr="parentAttr"></div>');
                $compile(el)($rootScope);
                givenScope.myAttr = 42;
                $rootScope.$digest();
                expect($rootScope.parentAttr).toBe(42);
            });
        });
        it('gives parent change precedence when both parent and child change', function () {
            var givenScope;
            var injector = makeInjectorWithDirectives('myDirective', function () {
                return {
                    scope: {
                        myAttr: '='
                    },
                    link: function (scope) {
                        givenScope = scope;
                    }
                };
            });
            injector.invoke(function ($compile, $rootScope) {
                var el = $('<div my-directive my-attr="parentAttr"></div>');
                $compile(el)($rootScope);
                $rootScope.parentAttr = 42;
                givenScope.myAttr = 43;
                $rootScope.$digest();
                expect($rootScope.parentAttr).toBe(42);
                expect(givenScope.myAttr).toBe(42);
            });
        });
        //fit('throws when isolate scope expression returns new arrays', function() {
        //    var givenScope;
        //    var injector = makeInjectorWithDirectives('myDirective', function() {
        //        return {
        //            scope: {
        //                myAttr: '='
        //            },
        //            link: function(scope) {
        //                givenScope = scope;
        //            }
        //        };
        //    });
        //    injector.invoke(function($compile, $rootScope) {
        //        $rootScope.parentFunction = function() {
        //            return [1, 2, 3];
        //        };
        //        var el = $('<div my-directive my-attr="parentFunction()"></div>');
        //        $compile(el)($rootScope);
        //        expect(function() {
        //            $rootScope.$digest();
        //        }).toThrow();
        //        console.log(givenScope.myAttr);
        //
        //    });
        //});
        it('can watch isolated scope expressions as collections', function () {
            var givenScope;
            var injector = makeInjectorWithDirectives('myDirective', function () {
                return {
                    scope: {
                        myAttr: '=*'
                    },
                    link: function (scope) {
                        givenScope = scope;
                    }
                };
            });
            injector.invoke(function ($compile, $rootScope) {
                $rootScope.parentFunction = function () {
                    return [1, 2, 3];
                };
                var el = $('<div my-directive my-attr="parentFunction()"></div>');
                $compile(el)($rootScope);
                $rootScope.$digest();
                expect(givenScope.myAttr).toEqual([1, 2, 3]);
            });
        });

        it('does not watch optional missing isolate scope expressions', function () {
            var givenScope;
            var injector = makeInjectorWithDirectives('myDirective', function () {
                return {
                    scope: {
                        myAttr: '=?'
                    },
                    link: function (scope) {
                        givenScope = scope;
                    }
                };
            });
            injector.invoke(function ($compile, $rootScope) {
                var el = $('<div my-directive></div>');
                $compile(el)($rootScope);
                expect($rootScope.$$watchers.length).toBe(0);
            });
        });
        it('cleans up isolated scope', function () {
            var givenScope;
            var injector = makeInjectorWithDirectives('myDirective', function () {
                return {
                    scope: {
                        myAttr: '='
                    },
                    link: function (scope) {
                        givenScope = scope;
                    }
                };
            });
            injector.invoke(function ($compile, $rootScope) {
                var el = $('<div my-directive my-attr="c"></div>');
                $compile(el)($rootScope);
                expect($rootScope.$$watchers.length).toBe(1);
                givenScope.$emit('$destroy');
                expect($rootScope.$$watchers.length).toBe(0);
            });
        });
        it('allows binding an invokable expression on the parent scope', function () {
            var givenScope;
            var injector = makeInjectorWithDirectives('myDirective', function () {
                return {
                    scope: {
                        myExpr: '&'
                    },
                    link: function (scope) {
                        givenScope = scope;
                    }
                };
            });
            injector.invoke(function ($compile, $rootScope) {
                $rootScope.parentFunction = function () {
                    return 42;
                };
                var el = $('<div my-directive my-expr="parentFunction() + 1"></div>');
                $compile(el)($rootScope);
                expect(givenScope.myExpr()).toBe(43);
            });
        });
        it('allows passing arguments to parent scope expression', function () {
            var givenScope;
            var injector = makeInjectorWithDirectives('myDirective', function () {
                return {
                    scope: {
                        myExpr: '&'
                    },
                    link: function (scope) {
                        givenScope = scope;
                    }
                };
            });
            injector.invoke(function ($compile, $rootScope) {
                var gotArg;
                $rootScope.parentFunction = function (arg) {
                    gotArg = arg;
                };
                var el = $('<div my-directive my-expr="parentFunction(argFromChild)"></div>');
                $compile(el)($rootScope);
                givenScope.myExpr({argFromChild: 42});
                expect(gotArg).toBe(42);
            });
        });
        it('sets missing optional parent scope expression to undefined', function () {
            var givenScope;
            var injector = makeInjectorWithDirectives('myDirective', function () {
                return {
                    scope: {
                        myExpr: '&?'
                    },
                    link: function (scope) {
                        givenScope = scope;
                    }
                };
            });
            injector.invoke(function ($compile, $rootScope) {
                var gotArg;
                $rootScope.parentFunction = function (arg) {
                    gotArg = arg;
                };
                var el = $('<div my-directive></div>');
                $compile(el)($rootScope);
                expect(givenScope.myExpr).toBeUndefined();
            });
        });

    });
    describe('controllers', function () {
        it('can be attached to directives as functions', function () {
            var controllerInvoked;
            var injector = makeInjectorWithDirectives('myDirective', function () {
                return {
                    controller: function MyController() {
                        controllerInvoked = true;
                    }
                };
            });
            injector.invoke(function ($compile, $rootScope) {
                var el = $('<div my-directive></div>');
                $compile(el)($rootScope);
                expect(controllerInvoked).toBe(true);
            });
        });

        it('can be attached to directives as string references', function () {
            var controllerInvoked;

            function MyController() {
                controllerInvoked = true;
            }

            var injector = createInjector(['ng',
                function ($controllerProvider, $compileProvider) {
                    $controllerProvider.register('MyController', MyController);
                    $compileProvider.directive('myDirective', function () {
                        return {controller: 'MyController'};
                    });
                }], core);
            injector.invoke(function ($compile, $rootScope) {
                var el = $('<div my-directive></div>');
                $compile(el)($rootScope);
                expect(controllerInvoked).toBe(true);
            });
        });
        it('can be applied in the same element independent of each other', function () {
            var controllerInvoked;
            var otherControllerInvoked;

            function MyController() {
                controllerInvoked = true;
            }

            function MyOtherController() {
                otherControllerInvoked = true;
            }

            var injector = createInjector(['ng', function ($controllerProvider, $compileProvider) {
                $controllerProvider.register('MyController', MyController);
                $controllerProvider.register('MyOtherController', MyOtherController);
                $compileProvider.directive('myDirective', function () {
                    return {controller: 'MyController'};
                });
                $compileProvider.directive('myOtherDirective', function () {
                    return {controller: 'MyOtherController'};
                });
            }], core);
            injector.invoke(function ($compile, $rootScope) {
                var el = $('<div my-directive my-other-directive></div>');
                $compile(el)($rootScope);
                expect(controllerInvoked).toBe(true);
                expect(otherControllerInvoked).toBe(true);
            });


        });

        it('can be applied to different directives, as different instances', function () {
            var invocations = 0;

            function MyController() {
                invocations++;
            }

            var injector = createInjector(['ng',
                function ($controllerProvider, $compileProvider) {
                    $controllerProvider.register('MyController', MyController);
                    $compileProvider.directive('myDirective', function () {
                        return {controller: 'MyController'};
                    });
                    $compileProvider.directive('myOtherDirective', function () {
                        return {controller: 'MyController'};
                    });
                }], core);
            injector.invoke(function ($compile, $rootScope) {
                var el = $('<div my-directive my-other-directive></div>');
                $compile(el)($rootScope);
                expect(invocations).toBe(2);
            });
        });
        it('can be aliased with @ when given in directive attribute', function () {
            var controllerInvoked;

            function MyController() {
                controllerInvoked = true;
            }

            var injector = createInjector(['ng',
                function ($controllerProvider, $compileProvider) {
                    $controllerProvider.register('MyController', MyController);
                    $compileProvider.directive('myDirective', function () {
                        return {controller: '@'};
                    });
                }], core);
            injector.invoke(function ($compile, $rootScope) {
                var el = $('<div my-directive="MyController"></div>');
                $compile(el)($rootScope);
                expect(controllerInvoked).toBe(true);
            });
        });
        it('gets scope, element, and attrs through DI', function () {
            var gotScope, gotElement, gotAttrs;

            function MyController($element, $scope, $attrs) {
                gotElement = $element;
                gotScope = $scope;
                gotAttrs = $attrs;
            }

            var injector = createInjector(['ng',
                function ($controllerProvider, $compileProvider) {
                    $controllerProvider.register('MyController', MyController);
                    $compileProvider.directive('myDirective', function () {
                        return {controller: 'MyController'};
                    });
                }], core);
            injector.invoke(function ($compile, $rootScope) {
                var el = $('<div my-directive an-attr="abc"></div>');
                $compile(el)($rootScope);
                expect(gotElement[0]).toBe(el[0]);
                expect(gotScope).toBe($rootScope);
                expect(gotAttrs).toBeDefined();
                expect(gotAttrs.anAttr).toEqual('abc');
            });
        });
        it('can be attached on the scope', function () {
            function MyController() {
            }

            var injector = createInjector(['ng',
                function ($controllerProvider, $compileProvider) {
                    $controllerProvider.register('MyController', MyController);
                    $compileProvider.directive('myDirective', function () {
                        return {
                            controller: 'MyController',
                            controllerAs: 'myCtrl'
                        };
                    });
                }], core);
            injector.invoke(function ($compile, $rootScope) {
                var el = $('<div my-directive></div>');
                $compile(el)($rootScope);
                expect($rootScope.myCtrl).toBeDefined();
                expect($rootScope.myCtrl instanceof MyController).toBe(true);
            });
        });
        it('gets isolate scope as injected $scope', function () {
            var gotScope;

            function MyController($scope) {
                gotScope = $scope;
            }

            var injector = createInjector(['ng',
                function ($controllerProvider, $compileProvider) {
                    $controllerProvider.register('MyController', MyController);
                    $compileProvider.directive('myDirective', function () {
                        return {
                            scope: {},
                            controller: 'MyController'
                        };
                    });
                }], core);
            injector.invoke(function ($compile, $rootScope) {
                var el = $('<div my-directive></div>');
                $compile(el)($rootScope);
                expect(gotScope).not.toBe($rootScope);
            });
        });
        it('has isolate scope bindings available during construction', function () {
            var gotMyAttr;

            function MyController($scope) {
                gotMyAttr = $scope.myAttr;
            }

            var injector = createInjector(['ng',
                function ($controllerProvider, $compileProvider) {
                    $controllerProvider.register('MyController', MyController);
                    $compileProvider.directive('myDirective', function () {
                        return {
                            scope: {
                                myAttr: '@myDirective'
                            },
                            controller: 'MyController'
                        };
                    });
                }], core);
            injector.invoke(function ($compile, $rootScope) {
                var el = $('<div my-directive="abc"></div>');
                $compile(el)($rootScope);
                expect(gotMyAttr).toEqual('abc');
            });
        });
        it('can bind isolate scope bindings directly to self', function () {
            var gotMyAttr;

            function MyController() {
                gotMyAttr = this.myAttr;
            }

            var injector = createInjector(['ng',
                function ($controllerProvider, $compileProvider) {
                    $controllerProvider.register('MyController', MyController);
                    $compileProvider.directive('myDirective', function () {
                        return {
                            scope: {
                                myAttr: '@myDirective'
                            },
                            controller: 'MyController',
                            bindToController: true
                        };
                    });
                }], core);
            injector.invoke(function ($compile, $rootScope) {
                var el = $('<div my-directive="abc"></div>');
                $compile(el)($rootScope);
                expect(gotMyAttr).toEqual('abc');
            });
        });
        it('can bind iso scope bindings through bindToController', function () {
            var gotMyAttr;

            function MyController() {
                gotMyAttr = this.myAttr;
            }

            var injector = createInjector(['ng',
                function ($controllerProvider, $compileProvider) {
                    $controllerProvider.register('MyController', MyController);
                    $compileProvider.directive('myDirective', function () {
                        return {
                            scope: {},
                            controller: 'MyController',
                            bindToController: {
                                myAttr: '@myDirective'
                            }
                        };
                    });
                }], core);
            injector.invoke(function ($compile, $rootScope) {
                var el = $('<div my-directive="abc"></div>');
                $compile(el)($rootScope);
                expect(gotMyAttr).toEqual('abc');
            });
        });
        it('can bind through bindToController without iso scope', function () {
            var gotMyAttr;

            function MyController() {
                gotMyAttr = this.myAttr;
            }

            var injector = createInjector(['ng',
                function ($controllerProvider, $compileProvider) {
                    $controllerProvider.register('MyController', MyController);
                    $compileProvider.directive('myDirective', function () {
                        return {
                            scope: true,
                            controller: 'MyController',
                            bindToController: {
                                myAttr: '@myDirective'
                            }
                        };
                    });
                }], core);
            injector.invoke(function ($compile, $rootScope) {
                var el = $('<div my-directive="abc"></div>');
                $compile(el)($rootScope);
                expect(gotMyAttr).toEqual('abc');
            });
        });
        it('can be required from a sibling directive', function () {
            function MyController() {
            }

            var gotMyController;
            var injector = createInjector(['ng', function ($compileProvider) {
                $compileProvider.directive('myDirective', function () {
                    return {
                        scope: {},
                        controller: MyController
                    };
                });
                $compileProvider.directive('myOtherDirective', function () {
                    return {
                        require: 'myDirective',
                        link: function (scope, element, attrs, myController) {
                            gotMyController = myController;
                        }
                    };
                });
            }], core);
            injector.invoke(function ($compile, $rootScope) {
                var el = $('<div my-directive my-other-directive></div>');
                $compile(el)($rootScope);
                expect(gotMyController).toBeDefined();
                expect(gotMyController instanceof MyController).toBe(true);
            });
        });
        it('can be required from multiple sibling directives', function () {
            function MyController() {
            }

            function MyOtherController() {
            }

            var gotControllers;
            var injector = createInjector(['ng', function ($compileProvider) {
                $compileProvider.directive('myDirective', function () {
                    return {
                        scope: true,
                        controller: MyController
                    };
                });
                $compileProvider.directive('myOtherDirective', function () {
                    return {
                        scope: true,
                        controller: MyOtherController
                    };
                });
                $compileProvider.directive('myThirdDirective', function () {
                    return {
                        require: ['myDirective', 'myOtherDirective'],
                        link: function (scope, element, attrs, controllers) {
                            gotControllers = controllers;
                        }
                    };
                });
            }], core);
            injector.invoke(function ($compile, $rootScope) {
                var el = $('<div my-directive my-other-directive my-third-directive></div>');
                $compile(el)($rootScope);
                expect(gotControllers).toBeDefined();
                expect(gotControllers.length).toBe(2);
                expect(gotControllers[0] instanceof MyController).toBe(true);
                expect(gotControllers[1] instanceof MyOtherController).toBe(true);
            });
        });
        it('is passed to link functions if there is no require', function () {
            function MyController() {
            }

            var gotMyController;
            var injector = createInjector(['ng', function ($compileProvider) {
                $compileProvider.directive('myDirective', function () {
                    return {
                        scope: {},
                        controller: MyController,
                        link: function (scope, element, attrs, myController) {
                            gotMyController = myController;
                        }
                    };
                });
            }], core);
            injector.invoke(function ($compile, $rootScope) {
                var el = $('<div my-directive></div>');
                $compile(el)($rootScope);
                expect(gotMyController).toBeDefined();
                expect(gotMyController instanceof MyController).toBe(true);
            });
        });
        it('is passed through grouped link wrapper', function () {
            function MyController() {
            }

            var gotMyController;
            var injector = createInjector(['ng', function ($compileProvider) {
                $compileProvider.directive('myDirective', function () {
                    return {
                        multiElement: true,
                        scope: {},
                        controller: MyController,
                        link: function (scope, element, attrs, myController) {
                            gotMyController = myController;
                        }
                    };
                });
            }], core);
            injector.invoke(function ($compile, $rootScope) {
                var el = $('<div my-directive-start></div><div my-directive-end></div>');
                $compile(el)($rootScope);
                expect(gotMyController).toBeDefined();
                expect(gotMyController instanceof MyController).toBe(true);
            });
        });
        it('can be required from a parent directive', function () {
            function MyController() {
            }

            var gotMyController;
            var injector = createInjector(['ng', function ($compileProvider) {
                $compileProvider.directive('myDirective', function () {
                    return {
                        scope: {},
                        controller: MyController
                    };
                });
                $compileProvider.directive('myOtherDirective', function () {
                    return {
                        require: '^myDirective',
                        link: function (scope, element, attrs, myController) {
                            gotMyController = myController;
                        }
                    };
                });
            }], core);
            injector.invoke(function ($compile, $rootScope) {
                var el = $('<div my-directive><div my-other-directive></div></div>');
                $compile(el)($rootScope);
                expect(gotMyController).toBeDefined();
                expect(gotMyController instanceof MyController).toBe(true);
            });
        });
        it('finds from sibling directive when requiring with parent prefix', function () {
            function MyController() {
            }

            var gotMyController;
            var injector = createInjector(['ng', function ($compileProvider) {
                $compileProvider.directive('myDirective', function () {
                    return {
                        scope: {},
                        controller: MyController
                    };
                });
                $compileProvider.directive('myOtherDirective', function () {
                    return {
                        require: '^myDirective',
                        link: function (scope, element, attrs, myController) {
                            gotMyController = myController;
                        }
                    };
                });
            }], core);
            injector.invoke(function ($compile, $rootScope) {
                var el = $('<div my-directive my-other-directive></div>');
                $compile(el)($rootScope);
                expect(gotMyController).toBeDefined();
                expect(gotMyController instanceof MyController).toBe(true);
            });
        });
        it('can be required from a parent directive with ^^', function () {
            function MyController() {
            }

            var gotMyController;
            var injector = createInjector(['ng', function ($compileProvider) {
                $compileProvider.directive('myDirective', function () {
                    return {
                        scope: {},
                        controller: MyController
                    };
                });
                $compileProvider.directive('myOtherDirective', function () {
                    return {
                        require: '^^myDirective',
                        link: function (scope, element, attrs, myController) {
                            gotMyController = myController;
                        }
                    };
                });
            }], core);
            injector.invoke(function ($compile, $rootScope) {
                var el = $('<div my-directive><div my-other-directive></div></div>');
                $compile(el)($rootScope);
                expect(gotMyController).toBeDefined();
                expect(gotMyController instanceof MyController).toBe(true);
            });
        });
        it('does not find from sibling directive when requiring with ^^', function () {
            function MyController() {
            }

            var injector = createInjector(['ng', function ($compileProvider) {
                $compileProvider.directive('myDirective', function () {
                    return {
                        scope: {},
                        controller: MyController
                    };
                });
                $compileProvider.directive('myOtherDirective', function () {
                    return {
                        require: '^^myDirective',
                        link: function (scope, element, attrs, myController) {
                        }
                    };
                });
            }], core);
            injector.invoke(function ($compile, $rootScope) {
                var el = $('<div my-directive my-other-directive></div>');
                expect(function () {
                    $compile(el)($rootScope);
                }).toThrow();
            });
        });
        it('does not throw on required missing controller when optional', function () {
            var gotCtrl;
            var injector = createInjector(['ng', function ($compileProvider) {
                $compileProvider.directive('myDirective', function () {
                    return {
                        require: '?noSuchDirective',
                        link: function (scope, element, attrs, ctrl) {
                            gotCtrl = ctrl;
                        }
                    };
                });
            }], core);
            injector.invoke(function ($compile, $rootScope) {
                var el = $('<div my-directive></div>');
                $compile(el)($rootScope);
                expect(gotCtrl).toBe(null);
            });
        });
        it('allows optional marker after parent marker', function () {
            var gotCtrl;
            var injector = createInjector(['ng', function ($compileProvider) {
                $compileProvider.directive('myDirective', function () {
                    return {
                        require: '^?noSuchDirective',
                        link: function (scope, element, attrs, ctrl) {
                            gotCtrl = ctrl;
                        }
                    };
                });
            }], core);
            injector.invoke(function ($compile, $rootScope) {
                var el = $('<div my-directive></div>');
                $compile(el)($rootScope);
                expect(gotCtrl).toBe(null);
            });
        });
        it('allows optional marker before parent marker', function () {
            function MyController() {
            }

            var gotMyController;
            var injector = createInjector(['ng', function ($compileProvider) {
                $compileProvider.directive('myDirective', function () {
                    return {
                        scope: {},
                        controller: MyController
                    };
                });
                $compileProvider.directive('myOtherDirective', function () {
                    return {
                        require: '?^myDirective',
                        link: function (scope, element, attrs, ctrl) {
                            gotMyController = ctrl;
                        }
                    };
                });
            }], core);
            injector.invoke(function ($compile, $rootScope) {
                var el = $('<div my-directive my-other-directive></div>');
                $compile(el)($rootScope);
                expect(gotMyController).toBeDefined();
                expect(gotMyController instanceof MyController).toBe(true);
            });
        });
    });
    describe('template', function() {
        it('populates an element during compilation', function() {
            var injector = makeInjectorWithDirectives('myDirective', function() {
                return {
                    template: '<div class="from-template"></div>'
                };
            });
            injector.invoke(function($compile) {
                var el = $('<div my-directive></div>');
                $compile(el);
                expect(el.find('> .from-template').length).toBe(1);
            });
        });

        it('replaces any existing children', function() {
            var injector = makeInjectorWithDirectives('myDirective', function() {
                return {
                    template: '<div class="from-template"></div>'
                };
            });
            injector.invoke(function($compile) {
                var el = $('<div my-directive><div class="existing"></div></div>');
                $compile(el);
                expect(el.find('> .existing').length).toBe(0);
            });
        });
        it('compiles template contents also', function() {
            var compileSpy = jasmine.createSpy();
            var injector = makeInjectorWithDirectives({
                myDirective: function() {
                    return {
                        template: '<div my-other-directive></div>'
                    };
                },
                myOtherDirective: function() {
                    return {
                        compile: compileSpy
                    };
                }
            });
            injector.invoke(function($compile) {
                var el = $('<div my-directive></div>');
                $compile(el);
                expect(compileSpy).toHaveBeenCalled();
            });
        });
        it('does not allow two directives with templates', function() {
            var injector = makeInjectorWithDirectives({
                myDirective: function() {
                    return {template: '<div></div>'};
                },
                myOtherDirective: function() {
                    return {template: '<div></div>'};
                }
            });
            injector.invoke(function($compile) {
                var el = $('<div my-directive my-other-directive></div>');
                expect(function() {
                    $compile(el);
                }).toThrow();
            });
        });
        it('supports functions as template values', function() {
            var templateSpy = jasmine.createSpy()
                .and.returnValue('<div class="from-template"></div>');
            var injector = makeInjectorWithDirectives({
                myDirective: function() {
                    return {
                        template: templateSpy
                    };
                }
            });
            injector.invoke(function($compile) {
                var el = $('<div my-directive></div>');
                $compile(el);
                expect(el.find('> .from-template').length).toBe(1);
// Check that template function was called with element and attrs
                expect(templateSpy.calls.first().args[0][0]).toBe(el[0]);
                expect(templateSpy.calls.first().args[1].myDirective).toBeDefined();
            });
        });
        it('uses isolate scope for template contents', function() {
            var linkSpy = jasmine.createSpy();
            var injector = makeInjectorWithDirectives({
                myDirective: function() {
                    return {
                        scope: {
                            isoValue: '=myDirective'
                        },
                        template: '<div my-other-directive></div>'
                    };
                },
                myOtherDirective: function() {
                    return {link: linkSpy};
                }
            });
            injector.invoke(function($compile, $rootScope) {
                var el = $('<div my-directive="42"></div>');
                $compile(el)($rootScope);
                expect(linkSpy.calls.first().args[0]).not.toBe($rootScope);
                expect(linkSpy.calls.first().args[0].isoValue).toBe(42);
            });
        });
    });
    function registerAndCompile(name, str, cb) {
        var resAttrs;
        var injector = makeInjectorWithDirectives(name, function () {
            return {
                restrict: 'EA',
                compile: function (element, attrs) {
                    resAttrs = attrs;
                }
            };
        });
        injector.invoke(($compile, $rootScope)=> {
            var el = $(str);
            $compile(el);
            cb(el, resAttrs, $rootScope);
        });
    }


    function makeInjectorWithDirectives() {
        var args = arguments;
        return createInjector(['ng', function ($compileProvider) {
            $compileProvider.directive.apply($compileProvider, args);
        }], core);
    }
});

