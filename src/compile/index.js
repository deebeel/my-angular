'use strict';
import _ from 'lodash';
import $ from 'jquery';

const IS_OPTIONAL_CTRL = /^.?\?/;
const ISOLATE_BINDINGS = /\s*(@|&|=(\*?))(\??)\s*(\w*)\s*/;
const PARENT_CTRL_LOOK_UP = /^\??(\^\^?)?/;
const IS_NG_ATTR = /^ngAttr[A-Z]/;
const MULTI_ELEMENT_SUFFIX = /(Start|End)$/;


class $CompileProvider {
    constructor($provide) {
        var hasDirectives = {};
        var DEFAULT_RESTRICTION = 'EA';
        var BOOLEAN_ATTRS = {
            multiple: true,
            selected: true,
            checked: true,
            disabled: true,
            readOnly: true,
            required: true,
            open: true
        };
        var BOOLEAN_ELEMENTS = {
            INPUT: true,
            SELECT: true,
            OPTION: true,
            TEXTAREA: true,
            BUTTON: true,
            FORM: true,
            DETAILS: true
        };
        this.directive = (obj, directiveFactory)=> {
            if (_.isObject(obj)) {
                _.forEach(obj, (factory, name)=> {
                    this.directive(name, factory);
                });
                return;
            }
            if (!hasDirectives.hasOwnProperty(obj)) {
                hasDirectives[obj] = [];
                $provide.factory(obj + 'Directive', ['$injector', ($injector)=> {
                    var factories = hasDirectives[obj];
                    return _.map(factories, (factory, index)=> {
                        var directive = $injector.invoke(factory);
                        directive.restrict = directive.restrict || DEFAULT_RESTRICTION;
                        directive.name = directive.name || obj;
                        directive.priority = directive.priority || 0;
                        directive.index = index;
                        if (directive.link && !directive.compile) {
                            directive.compile = _.constant(directive.link);
                        }
                        directive.$$bindings = parseDirectiveBindings(directive);
                        directive.require = directive.require || (directive.controller && directive.name)
                        return directive;
                    });
                }]);

                this.$get = ['$injector', '$rootScope', '$parse', '$controller',
                    ($injector, $rootScope, $parse, $controller)=> {

                        function compile($compileNodes) {
                            var compositeLinkFn = compileNodes($compileNodes);
                            return function (scope) {
                                $compileNodes.data('$scope', scope);
                                compositeLinkFn(scope);
                            };
                        }

                        function compileNodes($nodes) {
                            var fns = [];
                            _.forEach($nodes, (node)=> {
                                var nodeLinkFn, childLinkFn;
                                var attrs = new Attrs($(node));
                                var directives = collectDirectives(node, attrs);
                                if (directives.length) {
                                    nodeLinkFn = applyDirectivesToNode(directives, node, attrs);
                                }
                                var terminate = (!nodeLinkFn || !nodeLinkFn.terminate);
                                if (terminate && node.childNodes && node.childNodes.length) {
                                    childLinkFn = compileNodes(node.childNodes);
                                }
                                if (nodeLinkFn && nodeLinkFn.scope) {
                                    attrs.$$element.addClass('ng-scope');
                                }
                                if (nodeLinkFn || childLinkFn) {
                                    fns.push({
                                        linkFn: nodeLinkFn,
                                        childFn: childLinkFn,
                                        node
                                    });
                                }
                            });
                            function compositeLinkFn(scope) {
                                _.forEach(fns, (fnObj)=> {
                                    if (fnObj.linkFn) {
                                        if (fnObj.linkFn.scope) {
                                            scope = scope.$new();
                                            $(fnObj.node).data('$scope', scope);
                                        }
                                        fnObj.linkFn(fnObj.childFn, scope, fnObj.node);
                                        return;
                                    }
                                    fnObj.childFn(scope);
                                });
                            }

                            return compositeLinkFn;
                        }

                        class Attrs {
                            constructor(element) {
                                this.$$element = element;
                                this.$$attr = {};
                            }

                            $set(key, val, morphEl, denormalizedName) {
                                this[key] = val;
                                if (isBooleanAttr(this.$$element[0], key)) {
                                    this.$$element.prop(key, val);
                                }
                                if (!denormalizedName) {
                                    if (this.$$attr[key]) {
                                        denormalizedName = this.$$attr[key]
                                    } else {
                                        denormalizedName = this.$$attr[key] = _.kebabCase(key, '-');
                                    }
                                } else {
                                    this.$$attr[key] = denormalizedName;
                                }
                                morphEl !== false && this.$$element.attr(denormalizedName, val);

                                if (this.$$observers) {
                                    _.forEach(this.$$observers[key], (observer)=> {
                                        try {
                                            observer(val);
                                        } catch (e) {
                                            console.log(e);
                                        }
                                    });
                                }
                            }

                            $observe(key, fn) {
                                this.$$observers = this.$$observers || Object.create(null);
                                this.$$observers[key] = this.$$observers[key] || [];
                                this.$$observers[key].push(fn);
                                $rootScope.$evalAsync(()=> {
                                    fn(this[key]);
                                });
                                return ()=> {
                                    var index = this.$$observers[key].indexOf(fn);
                                    if (~index) {
                                        this.$$observers[key].splice(index, 1);
                                    }
                                };
                            }

                            $addClass(className) {
                                this.$$element.addClass(className);
                            }

                            $removeClass(className) {
                                this.$$element.removeClass(className);
                            }

                            $updateClass(newClassVal, oldClassVal) {
                                var newVals = newClassVal.split(/\s+/);
                                var oldVals = oldClassVal.split(/\s+/);
                                var toAdd = _.difference(newVals, oldVals);
                                var toRemove = _.difference(oldVals, newVals);
                                if (toAdd.length) {
                                    this.$addClass(toAdd.join(' '))
                                }
                                if (toRemove.length) {
                                    this.$removeClass(toRemove.join(' '))
                                }
                            }
                        }

                        function applyDirectivesToNode(directives, node, attrs) {
                            var newScopeDirective,
                                newIsolateScopeDirective,
                                controllerDirectives,
                                templateDirective,
                                postLinkFns = [],
                                preLinkFns = [],
                                controllers = {},
                                terminalPriority = -Number.MAX_VALUE,
                                $compileNode = $(node);

                            _.forEach(directives, (directive)=> {
                                var link, isIsolateScope;
                                if (directive.$$start) {
                                    $compileNode = groupScan(node, directive.$$start, directive.$$end);
                                }
                                if (directive.priority < terminalPriority) {
                                    return false;
                                }
                                if (directive.scope) {
                                    if (_.isObject(directive.scope)) {
                                        if (newIsolateScopeDirective || newScopeDirective) {
                                            throw 'Multiple directives asking for new/inherited scope';
                                        }
                                        newIsolateScopeDirective = directive
                                    } else {
                                        if (newIsolateScopeDirective) {
                                            throw 'Multiple directives asking for new/inherited scope';
                                        }
                                        newScopeDirective = newScopeDirective || directive;
                                    }
                                }
                                if (directive.compile) {
                                    link = directive.compile($compileNode, attrs);
                                    isIsolateScope = (directive === newIsolateScopeDirective);
                                    if (_.isFunction(link)) {
                                        addLinkFns({post: link}, directive, isIsolateScope);
                                    } else if (link) {
                                        addLinkFns(link, directive, isIsolateScope);
                                    }
                                }
                                if(directive.template){
                                    if(templateDirective){
                                        throw  Error('Template directive already attached to the element');
                                    }
                                    templateDirective = directive;
                                    applyTemplate(directive, $compileNode, attrs);
                                }


                                if (directive.terminal) {
                                    terminalPriority = directive.priority;
                                }
                                if (directive.controller) {
                                    controllerDirectives = controllerDirectives || {};
                                    controllerDirectives[directive.name] = directive;
                                }
                            });
                            function applyTemplate({template}, elem, attrs){
                                if(_.isFunction(template)){
                                    template = template(elem, attrs);
                                }
                                $compileNode.html(template);
                            }
                            function nodeLinkFn(childNodeFns, parentScope, node) {
                                var isolatedScope, $element = $(node), scopeDirective = newIsolateScopeDirective || newScopeDirective;
                                if (newIsolateScopeDirective) {
                                    isolatedScope = makeIsolateScope(parentScope, $element);
                                }

                                if (controllerDirectives) {
                                    processControllerDirectives(
                                        controllerDirectives,
                                        attrs,
                                        $element,
                                        newIsolateScopeDirective,
                                        isolatedScope,
                                        parentScope,
                                        controllers
                                    );
                                }
                                if (newIsolateScopeDirective) {
                                    handleIsolateScopeDirective(
                                        newIsolateScopeDirective.$$bindings.isolateScope,
                                        attrs,
                                        isolatedScope,
                                        isolatedScope,
                                        parentScope
                                    );
                                }
                                if (scopeDirective && controllers[scopeDirective.name]) {
                                    handleIsolateScopeDirective(
                                        scopeDirective.$$bindings.bindToController,
                                        attrs,
                                        controllers[scopeDirective.name].instance,
                                        isolatedScope,
                                        parentScope
                                    );
                                }

                                _.forEach(controllers, (c)=>c());
                                callLinkFns(preLinkFns);
                                if (childNodeFns) {
                                    if(newIsolateScopeDirective && newIsolateScopeDirective.template){
                                        parentScope = isolatedScope;
                                    }
                                    childNodeFns(parentScope);
                                }
                                callLinkFns(postLinkFns, true);

                                function callLinkFns(fns, reverse) {
                                    var method = reverse ? 'forEachRight' : 'forEach';
                                    _[method](fns, (fn)=> {
                                        fn(
                                            fn.isolateScope ? isolatedScope : parentScope,
                                            $element,
                                            attrs,
                                            fn.require && getControllers(fn.require, $element)
                                        );
                                    });
                                }

                            }

                            function getControllers(require, $element) {
                                if (_.isArray(require)) {
                                    return _.map(require, getControllers);
                                }

                                var ctrl,
                                    isOptional = IS_OPTIONAL_CTRL.test(require),
                                    match = require.match(PARENT_CTRL_LOOK_UP);
                                require = require.substring(match[0].length);

                                if (match[1]) {
                                    if (match[1] === '^^') {
                                        $element = $element.parent();
                                    }
                                    while ($element.length) {
                                        ctrl = $element.data(`$${require}Controller`);
                                        if (ctrl) {
                                            return ctrl;
                                        }

                                        $element = $element.parent();
                                    }
                                } else if (controllers[require]) {
                                    return controllers[require].instance;
                                }
                                if (isOptional) {
                                    return null;
                                }
                                throw Error(`Controller ${require} can not be found`);
                            }

                            function addLinkFns({pre, post}, {$$start, $$end, require}, isolateScope) {
                                addLinkFn(pre, preLinkFns);
                                addLinkFn(post, postLinkFns);

                                function addLinkFn(linkFn, linkFns) {
                                    if (linkFn) {
                                        if ($$start) {
                                            linkFn = groupElements(linkFn, $$start, $$end)
                                        }
                                        linkFn.isolateScope = isolateScope;
                                        linkFn.require = require;
                                        linkFns.push(linkFn);
                                    }
                                }
                            }

                            nodeLinkFn.terminate = terminalPriority !== -Number.MAX_VALUE;
                            nodeLinkFn.scope = newScopeDirective && newScopeDirective.scope;
                            return nodeLinkFn;
                        }

                        function handleIsolateScopeDirective(data,
                                                             attrs,
                                                             destination,
                                                             isolateScope,
                                                             parentScope) {
                            _.forEach(data, (definition, scopeName)=> {
                                switch (definition.mode) {
                                    case '@':
                                        oneWayBinding(
                                            destination,
                                            attrs,
                                            definition.attrName,
                                            scopeName
                                        );
                                        break;
                                    case '=':
                                        twoWayBinding(
                                            destination,
                                            isolateScope,
                                            parentScope,
                                            attrs,
                                            scopeName,
                                            definition
                                        );
                                        break;
                                    case '&':
                                        expressionBinding(
                                            destination,
                                            parentScope,
                                            attrs,
                                            scopeName,
                                            definition
                                        );
                                        break;
                                }
                            });

                        }


                        function oneWayBinding(destination, attrs, attrName, scopeName) {
                            attrs.$observe(attrName, (newVal)=> {
                                destination[scopeName] = newVal;
                            });
                            if (attrs[attrName]) {
                                destination[scopeName] = attrs[attrName];
                            }
                        }

                        function expressionBinding(destination,
                                                   parentScope,
                                                   attrs,
                                                   scopeName,
                            {attrName, optional}) {
                            if (optional && !attrs[attrName]) {
                                return;
                            }
                            var fn = $parse(attrs[attrName]);
                            destination[scopeName] = (locals)=> {
                                return fn(parentScope, locals);
                            }
                        }

                        function processControllerDirectives(controllerDirectives,
                                                             attrs,
                                                             $element,
                                                             newIsolatedScopeDirective,
                                                             isolateScope,
                                                             parentScope,
                                                             controllers) {
                            _.forEach(controllerDirectives, (directive)=> {
                                var {controllerAs, controller, name} = directive;
                                var locals = {
                                    $element,
                                    $attrs: attrs,
                                    $scope: directive === newIsolatedScopeDirective ? isolateScope : parentScope
                                };
                                if (controller === '@') {
                                    controller = attrs[name];
                                }
                                controllers[name] = $controller(controller, locals, true, controllerAs);
                                $element.data(`$${name}Controller`, controllers[name].instance);
                            });
                        }


                        function makeIsolateScope(parentScope, $element) {
                            var isolateScope = parentScope.$new(true);
                            $element.addClass('ng-isolate-scope');
                            $element.data('$isolateScope', isolateScope);
                            return isolateScope;
                        }

                        function twoWayBinding(destination, isolateScope, parentScope, attrs, scopeName, def) {
                            var {attrName, collection, optional} = def;
                            if (optional && !attrs[attrName]) {
                                return;
                            }
                            var collectionWatch,
                                unwatch,
                                parentGet = $parse(attrs[attrName]),
                                lastValue = destination[scopeName] = parentGet(parentScope);

                            if (collection) {
                                if (!collectionWatch) {
                                    collectionWatch = $parse(attrs[attrName]);
                                }
                                unwatch = parentScope.$watchCollection(
                                    collectionWatch,
                                    changeHandler
                                );
                            } else {
                                unwatch = parentScope.$watch(changeHandler);
                            }

                            isolateScope.$on('$destroy', unwatch);

                            function changeHandler() {
                                var parentValue = parentGet(parentScope);
                                if (destination[scopeName] !== parentValue) {
                                    if (parentValue !== lastValue) {
                                        destination[scopeName] = parentValue;
                                    } else {
                                        parentValue = destination[scopeName];
                                        parentGet.assign(parentScope, parentValue);
                                    }
                                }
                                return lastValue = parentValue;
                            }

                        }

                        function collectDirectives(node, attrs) {
                            var directives = [];
                            var normNodeName = _.camelCase(nodeName(node).toLowerCase());
                            addDirective(directives, normNodeName, 'E');
                            _.forEach(node.attributes, (attr)=> {
                                var attrStartName, attrEndName,
                                    name = attr.name,
                                    normalizedName = _.camelCase(attr.name.toLowerCase()),
                                    isNgAttr = IS_NG_ATTR.test(normalizedName);
                                if (isNgAttr) {
                                    name = _.kebabCase(
                                        normalizedName[6].toLowerCase() + normalizedName.substring(7)
                                    );
                                }
                                attrs.$$attr[normalizedName] = name;
                                var directiveName = normalizedName.replace(MULTI_ELEMENT_SUFFIX, '');
                                if (isMultiElement(directiveName)) {
                                    if (/Start$/.test(normalizedName)) {
                                        attrStartName = name;
                                        attrEndName = name.slice(0, -5) + 'end';
                                        name = name.slice(0, -6);
                                    }
                                }
                                normalizedName = _.camelCase(name.toLowerCase());
                                addDirective(directives, normalizedName, 'A', attrStartName, attrEndName);
                                if (isNgAttr || !attrs.hasOwnProperty(normalizedName)) {
                                    if (isBooleanAttr(node, normalizedName)) {
                                        attrs[normalizedName] = true;
                                    } else {
                                        attrs[normalizedName] = attr.value.trim();
                                    }

                                }

                            });
                            directives.sort(byPriority);
                            return directives;
                        }

                        function isBooleanAttr(node, name) {
                            return BOOLEAN_ATTRS[name] && BOOLEAN_ELEMENTS[node.nodeName];
                        }

                        function groupElements(fn, start, end) {
                            return function (scope, elem, attrs, ctrl) {
                                var group = groupScan(elem[0], start, end);
                                return fn(scope, group, attrs, ctrl);
                            };
                        }

                        function groupScan(node, start, end) {
                            var nodes = [];
                            if (start && node && node.hasAttribute(start)) {
                                var depth = 0;
                                do {
                                    if (node.nodeType === Node.ELEMENT_NODE) {
                                        node.hasAttribute(start) && depth++;
                                        node.hasAttribute(end) && depth--;
                                    }
                                    nodes.push(node);
                                    node = node.nextSibling;
                                } while (depth > 0)

                            } else {
                                node.push(node);
                            }

                            return $(nodes);
                        }

                        function isMultiElement(name) {
                            if (hasDirectives.hasOwnProperty(name)) {
                                var directives = $injector.get(name + 'Directive');
                                return _.any(directives, {multiElement: true});
                            }
                            return false;
                        }

                        function byPriority(a, b) {
                            var diff = b.priority - a.priority;
                            if (diff) {
                                return diff;
                            }
                            if (a.name !== b.name) {
                                return a.name < b.name ? -1 : 1;
                            }
                            return a.index - b.index;
                        }

                        function addDirective(directives, name, restricted, start, end) {
                            if (hasDirectives.hasOwnProperty(name)) {
                                var directivesToAdd = _.filter(
                                    $injector.get(name + 'Directive'),
                                    ({restrict})=> {
                                        return ~restrict.indexOf(restricted);
                                    }
                                );
                                _.forEach(directivesToAdd, (directive)=> {
                                    if (start) {
                                        directive = _.create(directive, {
                                            $$start: start,
                                            $$end: end
                                        });
                                    }
                                    directives.push(directive);
                                });
                            }
                        }

                        function nodeName(elem) {
                            return elem.nodeName || elem[0].nodeName;
                        }

                        return compile;
                    }];
            }
            hasDirectives[obj].push(directiveFactory);

            function parseDirectiveBindings({scope, bindToController}) {
                var bindings = {};
                if (_.isObject(scope)) {
                    if (bindToController) {
                        bindings.bindToController = parseIsolateBindings(scope);
                    } else {
                        bindings.isolateScope = parseIsolateBindings(scope);
                    }
                }
                if (_.isObject(bindToController)) {
                    bindings.bindToController = parseIsolateBindings(bindToController);
                }

                return bindings
            }

            function parseIsolateBindings(scope) {
                var bindings = {};
                _.forEach(scope, (def, name)=> {
                    var match = def.match(ISOLATE_BINDINGS);
                    bindings[name] = {
                        mode: match[1][0],
                        collection: match[2] === '*',
                        optional: match[3] === '?',
                        attrName: match[4] || name
                    };
                });
                return bindings;
            }
        };
    }

    static $inject = ['$provide'];
}
export default $CompileProvider;