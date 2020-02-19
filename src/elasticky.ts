type TimerId = ReturnType<typeof setTimeout>; // Ack this sidesteps that window.setTimeout and Node's setTimeout return different types

type Finishable<F> = F & { finish(cancel?: boolean): void };

// throttleFn()
// returns a throttled function that never runs more than every `delay` milliseconds
// the returned function also has a nice .finish() method.
const throttle = <A extends Array<any>, F extends (...args: A) => void>(
	func: F,
	delay: number,
	skipFirst?: boolean
): Finishable<F> => {
	let timeout: TimerId | undefined;
	let throttled = 0;
	let _args: A;
	let _this: unknown;
	const throttledFn = function(...args) {
		_args = args;
		_this = this;
		if (!throttled) {
			skipFirst ? throttled++ : func.apply(_this, _args);
			timeout = (setTimeout(throttledFn.finish, delay) as unknown) as TimerId; // Go home TypeScript, you're drunk!
		}
		throttled++;
	} as Finishable<F>;
	throttledFn.finish = (cancel?: boolean) => {
		timeout && clearTimeout(timeout);
		!cancel && throttled > 1 && func.apply(_this, _args);
		throttled = 0;
	};
	return throttledFn;
};

// ===========================================================================

const Q = (selectorOrElement?: string | Element | Window): Element | Window | null => {
	return !selectorOrElement
		? null
		: typeof selectorOrElement === 'string'
		? document.querySelector(selectorOrElement)
		: selectorOrElement;
};

// FIXME: Replace all the `any` types with actual typing

interface ElastickyOptions {
	/** Used as a className prefix
	 * (`.is-{name}-(fixed|hidden|shown)`)
	 */
	name?: string;
	/** The element on which to toggle the state classNames
	 * String values are treated as a CSS selector.
	 *
	 * Default: `document.documentElement` // ('html')
	 */
	container?: Element | string;
	/* The element on which to monitor scroll events
	 * String values are treated as a CSS selector.
	 *
	 * Default: `window`
	 */
	scrollElm?: Element | string | Window;
	/** The minimum scroll-distance before setting the state to "fixed"
	 *
	 * Defaults to measuring paddingTop of the `options.container`/`<html/>` element.
	 */
	fixAt?: number | (() => number);
	/** The scroll-distance at which to turn a "fixed" state off.
	 *
	 * Defaults to being same as `options.fixAt`
	 */
	releaseAt?: number | (() => number);
	/** Throttle the onScroll/onResize handlers for this many milliseconds
	 *
	 * Default `50`
	 */
	delay?: number;

	/** Should a fixed header be additionally hidden/shown
	 * if the page is scrolled beyond a certain up/down pixel limit
	 *  within a given timeframe of 1000ms?
	 *
	 * Default: `true`
	 */
	recede?: boolean | (() => boolean);
	/** Number of pixels of upwards scroll to allow in 1000ms
	 * before turning on "show"
	 *
	 * Default: `70`
	 */
	upLimit?: number;
	/** Number of pixels of downwards scroll to allow in 1000ms
	 * before turning on "hidden"
	 *
	 * Default: `70`
	 */
	downLimit?: number;

	/** Should window.onresize events be monitored?
	 *  * A non-zero number means
	 *   "recheck the scroll state every `onresize` ms"
	 *
	 *  * `true` means that a relevant window object
	 * 		is used and `onResize` event is attached
	 *
	 * Default `false`
	 */
	onresize?: boolean | number;
}

interface ElastickyWidget {
	start(): void;
	pause(): void;
	resume(): void;
	stop(): void;
}

const Elasticky = function(userOpts: ElastickyOptions = {}): ElastickyWidget {
	const opts: ElastickyOptions = {
		delay: 50,
		recede: true,
		upLimit: 70,
		downLimit: 50,
	};

	(Object.keys(userOpts) as Array<keyof ElastickyOptions>).forEach((key) => {
		if (userOpts[key] !== undefined) {
			// @ts-ignore  (Shameful, I know)
			opts[key] = userOpts[key];
		}
	});

	const name = opts.name || 'header';

	const classPrefix = 'is-' + name;
	const classUnfixed = classPrefix + '-unfixed';
	const classFixed = classPrefix + '-fixed';
	const classHidden = classPrefix + '-hidden';
	const classShown = classPrefix + '-shown';

	let isActive = false;
	let isPaused = false;

	let container: any; //Element | undefined; // lazy bound
	let containerClassList: any; // Element['classList'] | undefined; // lazy bound
	let scrollElm: any; // lazy bound
	let onresize: any; // lazy bound
	let resizeInterval: any; // optional setInterval id for non-window resize checks

	const fixAt: any =
		opts.fixAt == null
			? function() {
					return parseInt(getComputedStyle(container).paddingTop, 10);
			  }
			: typeof opts.fixAt === 'number'
			? function() {
					return opts.fixAt;
			  }
			: opts.fixAt;

	const releaseAt: any =
		opts.releaseAt == null
			? fixAt
			: typeof opts.releaseAt === 'number'
			? function() {
					return opts.releaseAt;
			  }
			: opts.releaseAt;

	let monitorScroll: any;

	const widget: any = {
		upLimit: opts.upLimit as any,
		downLimit: opts.downLimit as any,
		recede: typeof opts.recede === 'boolean' ? () => opts.recede : (opts.recede as any),

		// distY: 0
		// isFixed: (distY > 0),
		// isShown: false,

		fixAt: fixAt,
		releaseAt: releaseAt,

		start() {
			if (!isActive) {
				container = Q(opts.container) || document.documentElement;
				containerClassList = container.classList;
				scrollElm = Q(opts.scrollElm) || window;

				isActive = true;

				const scrollElmIsWindow = !scrollElm.tagName;
				const hasPageYOffset = scrollElmIsWindow && 'pageXOffset' in scrollElm;
				const scrollTopElm = scrollElmIsWindow
					? scrollElm.document.documentElement
					: scrollElm;
				onresize = opts.onresize;
				if (onresize === true) {
					onresize = scrollElmIsWindow ? scrollElm : window;
				}

				let lastOffs = 0;
				let updateLastOffset: number;
				let isFixed = false;
				let isShown = false;

				monitorScroll = function(/*e*/) {
					if (!isPaused) {
						const yOffs = hasPageYOffset ? scrollElm.pageYOffset : scrollTopElm.scrollTop;
						widget.distY = yOffs;
						const doFix = yOffs > (isFixed ? releaseAt() : fixAt());
						clearTimeout(updateLastOffset);

						if (doFix !== isFixed) {
							isFixed = doFix;
							lastOffs = yOffs;
							containerClassList[isFixed ? 'add' : 'remove'](classFixed);
							containerClassList[isFixed ? 'remove' : 'add'](classUnfixed);
							if (!isFixed) {
								containerClassList.remove(classShown);
								containerClassList.remove(classHidden);
								isShown = false;
							}
						}
						if (isFixed && widget.recede()) {
							const delta = yOffs - lastOffs;
							let exceededLimit;
							if ((exceededLimit = delta > widget.downLimit)) {
								// going down
								if (isShown) {
									containerClassList.remove(classShown);
									containerClassList.add(classHidden);
									isShown = false;
								}
							} else if ((exceededLimit = delta < -widget.upLimit)) {
								// going up
								if (!isShown) {
									containerClassList.remove(classHidden);
									containerClassList.add(classShown);
									isShown = true;
								}
							}
							if (exceededLimit) {
								lastOffs = yOffs;
							} else {
								updateLastOffset = setTimeout(function() {
									lastOffs = yOffs;
								}, 1000) as any;
							}
						}
						widget.isFixed = isFixed;
						widget.isShown = isShown;
					}
				};

				if (opts.delay) {
					monitorScroll = throttle(monitorScroll, opts.delay, true);
				}

				scrollElm.addEventListener('scroll', monitorScroll);

				if (onresize) {
					if (typeof onresize === 'number') {
						resizeInterval = setInterval(monitorScroll, onresize);
					} else {
						onresize.addEventListener('resize', monitorScroll);
					}
				}
				monitorScroll();
				!widget.isFixed && containerClassList.add(classUnfixed);
			}
		},
		stop() {
			if (isActive) {
				isActive = false;
				scrollElm.removeEventListener('scroll', monitorScroll);
				if (onresize) {
					if (typeof onresize === 'number') {
						clearInterval(resizeInterval);
					} else {
						onresize.removeEventListener('resize', monitorScroll);
					}
				}
				opts.delay && monitorScroll.finish(true);
				containerClassList.remove(classFixed);
				containerClassList.remove(classShown);
				containerClassList.remove(classHidden);
			}
		},

		pause() {
			isPaused = true;
		},
		resume() {
			isPaused = false;
		},
	};

	return widget;
};

export default Elasticky;
