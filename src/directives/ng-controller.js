'use strict';


function ngControllerDirective() {
    return {
        restrict: 'A',
        scope: true,
        controller: '@'
    };
}


export default ngControllerDirective;

