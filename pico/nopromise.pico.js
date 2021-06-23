/* http://github.com/avih/nopromise MIT */

exports.deferred =      // <-- remove this line if using in a browser

function NoPromise() {  // returns a new promise object, doesn't need `new`
    var sysAsync = setTimeout,  // Yes, it's configurable!

        state,              // undefined-pending, 1-fulfilled, 2-rejected
        output,             // value if fulfilled, reason if rejected
        resolvers = [],     // holds `then` resolvers while it's pending

        new_promise = {     // <-- A new Promise is born
            resolve: changeState.bind(1),  //|
            reject:  changeState.bind(2),  //| all methods are in fact closures
            then:    promise1then          //|
        };

    return new_promise.promise = new_promise;   // .promise is a customary API
    // -- We're done here --

    // This is both `resolve` and `reject`, depending on its `this` (1 or 2)
    function changeState(value) {
        if (!state) {
            state = this;
            output = value;
            resolvers.forEach(sysAsync);  // execute all pending resolvers
        }
    }

    function promise1then(onFulfilled, onRejected) {
        var promise2 = NoPromise();       // create a new promise object
        state ? sysAsync(promise2Resolver) : resolvers.push(promise2Resolver);
        return promise2;
        // -- That's it --

        // Here's where the main logic is. Executes after fulfilled/rejected and
        // asynchronously to `then`, and decides the fate of promise2.
        // state here is either 1 (fulfilled) or 2 (rejected)
        function promise2Resolver() {
            var handler  = state < 2 ? onFulfilled : onRejected;

            if (typeof handler != "function") { // --> handler is ignored
                (state < 2 ? promise2.resolve : promise2.reject)(output);

            } else {
                // Run the relevant handler with `output' as input and decide on
                // promise2 according to that, possibly asynchronously.
                // Because it can throw, and to go through one less try/catch,
                // we delegate this invocation to promise2Resolution.
                promise2Resolution(0, handler);
            }
        }

        // In a nutshell: if x is a Promise or looks like one - "adopt" its
        // state, else fulfil to x, and if something throws - reject.
        function promise2Resolution(x, handler) {
            var then,
                done = 0;  // used by `once`

            // Between all the once-wrapped functions: only the first to get
            // called is executed, and only once. They accept one argument.
            // NoPromise doesn't need it - it behaves nicely, but others might.
            // Also, it masks handler when called back recursively.
            function once(fn) {
                return function(v) { done++ || fn(v) }
            }

            // Treat NoPromise as generic thenable because it is, and we can.
            try {
                if (handler)  // Only happens on first invocation
                    x = handler(output);

                if (x == promise2) {
                    promise2.reject(TypeError());  // Can't resolve to itself

                } else if ((typeof x == "function" || x && typeof x == "object")
                           && typeof (then = x.then) == "function") {
                    // x is a Promise or looks like one.
                    // When x resolves - try to resolve promise2 again
                    // Unguarded it's: x.then(promise2Resolution, reject2)
                    then.call(x, once(promise2Resolution), once(promise2.reject));

                } else {
                    promise2.resolve(x);
                }

            } catch (e) {
                once(promise2.reject)(e);
            }
        }
    }  // promise1then
}  // NoPromise


/*

Minification: to get below 512 chars, the following changes have been applied:

1. Variables added at `_then`, used at promise2Resolver and promise2Resolution:
      resolve2 = promise2.resolve,
      reject2  = promise2.reject,
      FUNCTION = "function";

2. The function `once` was removed - and unrolled as follows:
   - Added `function once_reject2(r){ done++ || reject2(r) };`
     and then used `once_reject2` instead of `once(promise2.reject)`.

   - `once(promise2Resolution)` replaced with inline anonymous function:
     `function(y){ done++ || promise2Resolution(y) }`.


// Minified as module (511 bytes) - nopromise.pico.module.min.js :

exports.deferred=function e(){function t(e){r||(r=this,o=e,f.forEach(c))}function n(t,n){function i(){var e=2>r?t:n;typeof e!=h?(2>r?p:s)(o):u(0,e)}function u(e,t){function n(e){c++||s(e)}var r,c=0;try{t&&(e=t(o)),e==a?s(TypeError()):(typeof e==h||e&&"object"==typeof e)&&typeof(r=e.then)==h?r.call(e,function(e){c++||u(e)},n):p(e)}catch(f){n(f)}}var a=e(),p=a.resolve,s=a.reject,h="function";return r?c(i):f.push(i),a}var r,o,c=setTimeout,f=[],i={resolve:t.bind(1),reject:t.bind(2),then:n};return i.promise=i};


// Minified for browsers (509 bytes) - nopromise.pico.browser.min.js :

function NoPromise(){function e(e){n||(n=this,o=e,c.forEach(r))}function t(e,t){function i(){var r=2>n?e:t;typeof r!=p?(2>n?a:s)(o):f(0,r)}function f(e,t){function n(e){c++||s(e)}var r,c=0;try{t&&(e=t(o)),e==u?s(TypeError()):(typeof e==p||e&&"object"==typeof e)&&typeof(r=e.then)==p?r.call(e,function(e){c++||f(e)},n):a(e)}catch(i){n(i)}}var u=NoPromise(),a=u.resolve,s=u.reject,p="function";return n?r(i):c.push(i),u}var n,o,r=setTimeout,c=[],i={resolve:e.bind(1),reject:e.bind(2),then:t};return i.promise=i}

*/
