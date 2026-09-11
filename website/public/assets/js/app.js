/* ==========================================================================
   Shared behaviour for the internal tool pages

   The landing page has portfolio.js. These pages need a much smaller slice of
   it: the loader, scroll reveals, the pointer sheen and the theme toggle.
   Kept separate so neither file redeclares the other's globals.
   ========================================================================== */

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const HOVERS = window.matchMedia('(hover: hover)').matches;

const root = document.documentElement;

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

/* ------------------------------------------------------------------ theme */

const currentTheme = () => (root.classList.contains('light') ? 'light' : 'dark');

const applyTheme = (theme) => {
	root.classList.toggle('light', theme === 'light');
	root.classList.toggle('dark', theme !== 'light');
	try {
		localStorage.setItem('theme', theme);
	} catch {
		/* private mode, or consent not given: the class still applies */
	}
};

const bindThemeToggles = (scope = document) => {
	for (const toggle of $$('[data-theme-toggle]', scope)) {
		toggle.addEventListener('click', () => {
			applyTheme(currentTheme() === 'light' ? 'dark' : 'light');
		});
	}
};

/* --------------------------------------------------- pointer-lit surfaces */

const bindSheen = (scope = document) => {
	if (REDUCED || !HOVERS) return;

	for (const node of $$('.glass--lit', scope)) {
		node.addEventListener('pointermove', (event) => {
			const rect = node.getBoundingClientRect();
			node.style.setProperty(
				'--mx',
				`${((event.clientX - rect.left) / rect.width) * 100}%`
			);
			node.style.setProperty(
				'--my',
				`${((event.clientY - rect.top) / rect.height) * 100}%`
			);
		});
	}
};

/* ---------------------------------------------------------- scroll reveal */

let revealObserver = null;

const observeReveals = (scope = document) => {
	const nodes = $$('.reveal:not(.in)', scope);

	if (REDUCED || !('IntersectionObserver' in window)) {
		for (const node of nodes) node.classList.add('in');
		return;
	}

	revealObserver ??= new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (!entry.isIntersecting) continue;
				entry.target.classList.add('in');
				revealObserver.unobserve(entry.target);
			}
		},
		{ rootMargin: '0px 0px -10% 0px', threshold: 0.08 }
	);

	for (const node of nodes) revealObserver.observe(node);
};

/* ----------------------------------------------------------------- loader */

const initLoader = () => {
	const loader = $('#loader');
	if (!loader) return;

	const hide = () => loader.classList.add('done');

	if (document.readyState === 'complete') setTimeout(hide, 180);
	else window.addEventListener('load', () => setTimeout(hide, 180));

	/* Never let one slow asset hold the page hostage. */
	setTimeout(hide, 2200);
};

/* ------------------------------------------------------------------- boot */

document.addEventListener('DOMContentLoaded', () => {
	initLoader();
	bindThemeToggles();
	bindSheen();
	observeReveals();
});
