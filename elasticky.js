// throttleFn()
// returns a throttled function that never runs more than every `delay` milliseconds
// the returned function also has a nice .finish() method.
var throttle = function (func, delay, skipFirst) {
    var timeout;
    var throttled = 0;
    var _args;
    var _this;
    var throttledFn = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        _args = args;
        _this = this;
        if (!throttled) {
            skipFirst ? throttled++ : func.apply(_this, _args);
            timeout = setTimeout(throttledFn.finish, delay); // Go home TypeScript, you're drunk!
        }
        throttled++;
    };
    throttledFn.finish = function (cancel) {
        timeout && clearTimeout(timeout);
        !cancel && throttled > 1 && func.apply(_this, _args);
        throttled = 0;
    };
    return throttledFn;
};
// ===========================================================================
var Q = function (selectorOrElement) {
    return !selectorOrElement
        ? null
        : typeof selectorOrElement === 'string'
            ? document.querySelector(selectorOrElement)
            : selectorOrElement;
};
var Elasticky = function (userOpts) {
    if (userOpts === void 0) { userOpts = {}; }
    var opts = {
        delay: 50,
        recede: true,
        upLimit: 70,
        downLimit: 50,
    };
    Object.keys(userOpts).forEach(function (key) {
        if (userOpts[key] !== undefined) {
            // @ts-ignore  (Shameful, I know)
            opts[key] = userOpts[key];
        }
    });
    var name = opts.name || 'header';
    var classPrefix = 'is-' + name;
    var classUnfixed = classPrefix + '-unfixed';
    var classFixed = classPrefix + '-fixed';
    var classHidden = classPrefix + '-hidden';
    var classShown = classPrefix + '-shown';
    var isActive = false;
    var isPaused = false;
    var container; //Element | undefined; // lazy bound
    var containerClassList; // Element['classList'] | undefined; // lazy bound
    var scrollElm; // lazy bound
    var onresize; // lazy bound
    var resizeInterval; // optional setInterval id for non-window resize checks
    var fixAt = opts.fixAt == null
        ? function () {
            return parseInt(getComputedStyle(container).paddingTop, 10);
        }
        : typeof opts.fixAt === 'number'
            ? function () {
                return opts.fixAt;
            }
            : opts.fixAt;
    var releaseAt = opts.releaseAt == null
        ? fixAt
        : typeof opts.releaseAt === 'number'
            ? function () {
                return opts.releaseAt;
            }
            : opts.releaseAt;
    var monitorScroll;
    var widget = {
        upLimit: opts.upLimit,
        downLimit: opts.downLimit,
        recede: typeof opts.recede === 'boolean' ? function () { return opts.recede; } : opts.recede,
        // distY: 0
        // isFixed: (distY > 0),
        // isShown: false,
        fixAt: fixAt,
        releaseAt: releaseAt,
        start: function () {
            if (!isActive) {
                container = Q(opts.container) || document.documentElement;
                containerClassList = container.classList;
                scrollElm = Q(opts.scrollElm) || window;
                isActive = true;
                var scrollElmIsWindow = !scrollElm.tagName;
                var hasPageYOffset_1 = scrollElmIsWindow && 'pageXOffset' in scrollElm;
                var scrollTopElm_1 = scrollElmIsWindow
                    ? scrollElm.document.documentElement
                    : scrollElm;
                onresize = opts.onresize;
                if (onresize === true) {
                    onresize = scrollElmIsWindow ? scrollElm : window;
                }
                var lastOffs_1 = 0;
                var updateLastOffset_1;
                var isFixed_1 = false;
                var isShown_1 = false;
                monitorScroll = function ( /*e*/) {
                    if (!isPaused) {
                        var yOffs_1 = hasPageYOffset_1 ? scrollElm.pageYOffset : scrollTopElm_1.scrollTop;
                        widget.distY = yOffs_1;
                        var doFix = yOffs_1 > (isFixed_1 ? releaseAt() : fixAt());
                        clearTimeout(updateLastOffset_1);
                        if (doFix !== isFixed_1) {
                            isFixed_1 = doFix;
                            lastOffs_1 = yOffs_1;
                            containerClassList[isFixed_1 ? 'add' : 'remove'](classFixed);
                            containerClassList[isFixed_1 ? 'remove' : 'add'](classUnfixed);
                            if (!isFixed_1) {
                                containerClassList.remove(classShown);
                                containerClassList.remove(classHidden);
                                isShown_1 = false;
                            }
                        }
                        if (isFixed_1 && widget.recede()) {
                            var delta = yOffs_1 - lastOffs_1;
                            var exceededLimit = void 0;
                            if ((exceededLimit = delta > widget.downLimit)) {
                                // going down
                                if (isShown_1) {
                                    containerClassList.remove(classShown);
                                    containerClassList.add(classHidden);
                                    isShown_1 = false;
                                }
                            }
                            else if ((exceededLimit = delta < -widget.upLimit)) {
                                // going up
                                if (!isShown_1) {
                                    containerClassList.remove(classHidden);
                                    containerClassList.add(classShown);
                                    isShown_1 = true;
                                }
                            }
                            if (exceededLimit) {
                                lastOffs_1 = yOffs_1;
                            }
                            else {
                                updateLastOffset_1 = setTimeout(function () {
                                    lastOffs_1 = yOffs_1;
                                }, 1000);
                            }
                        }
                        widget.isFixed = isFixed_1;
                        widget.isShown = isShown_1;
                    }
                };
                if (opts.delay) {
                    monitorScroll = throttle(monitorScroll, opts.delay, true);
                }
                scrollElm.addEventListener('scroll', monitorScroll);
                if (onresize) {
                    if (typeof onresize === 'number') {
                        resizeInterval = setInterval(monitorScroll, onresize);
                    }
                    else {
                        onresize.addEventListener('resize', monitorScroll);
                    }
                }
                monitorScroll();
                !widget.isFixed && containerClassList.add(classUnfixed);
            }
        },
        stop: function () {
            if (isActive) {
                isActive = false;
                scrollElm.removeEventListener('scroll', monitorScroll);
                if (onresize) {
                    if (typeof onresize === 'number') {
                        clearInterval(resizeInterval);
                    }
                    else {
                        onresize.removeEventListener('resize', monitorScroll);
                    }
                }
                opts.delay && monitorScroll.finish(true);
                containerClassList.remove(classFixed);
                containerClassList.remove(classShown);
                containerClassList.remove(classHidden);
            }
        },
        pause: function () {
            isPaused = true;
        },
        resume: function () {
            isPaused = false;
        },
    };
    return widget;
};

module.exports = Elasticky;
