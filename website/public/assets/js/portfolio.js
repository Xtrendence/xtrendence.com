/* ==========================================================================
   Xtrendence, site behaviour

   Ported from xtrendence.dev. The case-study pages live on the .dev site, so
   anything that only ran on /pages/* has been left out here. Project links and
   thumbnails point at .dev, which acts as the CDN for that content.
   ========================================================================== */

const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const HOVERS = window.matchMedia("(hover: hover)").matches;

// Where the portfolio content lives. Thumbnails, case studies and the download
// counters are all served from here rather than being duplicated on .com
const PORTFOLIO_ORIGIN = "https://www.xtrendence.dev";
const GITHUB_USER = "Xtrendence";

const root = document.documentElement;

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [
	...scope.querySelectorAll(selector),
];

const el = (tag, className, html) => {
	const node = document.createElement(tag);
	if (className) node.className = className;
	if (html != null) node.innerHTML = html;
	return node;
};

const escapeHtml = (value) =>
	String(value).replace(
		/[&<>"']/g,
		(char) =>
			({
				"&": "&amp;",
				"<": "&lt;",
				">": "&gt;",
				'"': "&quot;",
				"'": "&#39;",
			})[char],
	);

/* ------------------------------------------------------------------ theme */

const currentTheme = () =>
	root.classList.contains("light") ? "light" : "dark";

const applyTheme = (theme) => {
	root.classList.toggle("light", theme === "light");
	root.classList.toggle("dark", theme !== "light");
	try {
		localStorage.setItem("theme", theme);
	} catch {
		/* private mode: the class still applies for this page view */
	}
};

const bindThemeToggles = (scope = document) => {
	for (const toggle of $$("[data-theme-toggle]", scope)) {
		toggle.addEventListener("click", () => {
			applyTheme(currentTheme() === "light" ? "dark" : "light");
		});
	}
};

/* ------------------------------------------------------------------- util */

/**
 * Human-readable gap between two dates, e.g. "2 yrs 7 mos".
 * `end` defaults to today, so current roles keep counting on their own.
 */
const duration = (start, end) => {
	const from = new Date(start);
	const to = end ? new Date(end) : new Date();
	if (to < from) return "";

	let months =
		(to.getFullYear() - from.getFullYear()) * 12 +
		(to.getMonth() - from.getMonth());
	if (to.getDate() < from.getDate()) months--;

	const years = Math.floor(months / 12);
	const rest = months % 12;
	const parts = [];

	if (years) parts.push(`${years} ${years === 1 ? "yr" : "yrs"}`);
	if (rest) parts.push(`${rest} ${rest === 1 ? "mo" : "mos"}`);
	return parts.join(" ") || "< 1 mo";
};

const formatCount = (n) => {
	if (n >= 1000000) return `${(n / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
	if (n >= 1000) return `${Math.floor(n / 1000)}K`;
	return String(n);
};

/* --------------------------------------------------- pointer-lit surfaces */

/**
 * Glass catches a specular highlight wherever the light is. We treat the
 * cursor as that light and hand its position to CSS as --mx / --my.
 */
const bindSheen = (scope = document) => {
	if (REDUCED || !HOVERS) return;

	for (const node of $$(".glass--lit", scope)) {
		node.addEventListener("pointermove", (event) => {
			const rect = node.getBoundingClientRect();
			node.style.setProperty(
				"--mx",
				`${((event.clientX - rect.left) / rect.width) * 100}%`,
			);
			node.style.setProperty(
				"--my",
				`${((event.clientY - rect.top) / rect.height) * 100}%`,
			);
		});
	}
};

/* ---------------------------------------------------------- scroll reveal */

let revealObserver = null;

const observeReveals = (scope = document) => {
	const nodes = $$(".reveal:not(.in)", scope);

	if (REDUCED || !("IntersectionObserver" in window)) {
		for (const node of nodes) node.classList.add("in");
		return;
	}

	revealObserver ??= new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (!entry.isIntersecting) continue;
				entry.target.classList.add("in");
				revealObserver.unobserve(entry.target);
			}
		},
		{ rootMargin: "0px 0px -10% 0px", threshold: 0.08 },
	);

	for (const node of nodes) revealObserver.observe(node);
};

/* -------------------------------------------------------------- icon set */

const githubIconMarkup = () =>
	'<svg viewBox="0 0 24 24"><path d="M12 .5A11.5 11.5 0 0 0 .5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2.1c-3.2.7-3.88-1.37-3.88-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.56-.29-5.25-1.28-5.25-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.12 3.05.74.81 1.18 1.84 1.18 3.1 0 4.43-2.69 5.4-5.26 5.69.41.36.78 1.06.78 2.14v3.18c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5Z"/></svg>';

/**
 * The sprite lives in its own cacheable file, but it has to be inlined into
 * the document before <use> can inherit currentColor from the page.
 *
 * Served locally rather than from .dev, since a cross-origin fetch for it
 * would be blocked. The images below are plain <img> tags, so they are fine
 * coming from .dev directly.
 */
const loadSprite = async () => {
	if (document.getElementById("icon-sprite")) return;

	try {
		const response = await fetch("/assets/img/icons.svg");
		if (!response.ok) return;

		const holder = el("div", null, await response.text());
		holder.id = "icon-sprite";
		holder.setAttribute("aria-hidden", "true");
		holder.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
		document.body.prepend(holder);
	} catch {
		/* icons are decorative; the labels carry the meaning */
	}
};

/* ==========================================================================
   Landing page
   ========================================================================== */

const initLoader = () => {
	const loader = $("#loader");
	if (!loader) return;

	const hide = () => loader.classList.add("done");

	if (document.readyState === "complete") setTimeout(hide, 220);
	else window.addEventListener("load", () => setTimeout(hide, 220));

	/* Never let one slow asset hold the page hostage. */
	setTimeout(hide, 2600);
};

/** Cycles the specialisms that follow "Engineering". */
const initRotator = () => {
	const rotator = $("#rotator");
	if (!rotator) return;

	const words = $$("span", rotator);
	if (words.length < 2) return;

	words[0].classList.add("active");
	if (REDUCED) return;

	let index = 0;
	setInterval(() => {
		const leaving = words[index];
		index = (index + 1) % words.length;
		leaving.classList.remove("active");
		leaving.classList.add("leaving");
		setTimeout(() => leaving.classList.remove("leaving"), 520);
		words[index].classList.add("active");
	}, 2900);
};

const initNav = () => {
	const nav = $("#nav");
	if (!nav) return;

	const links = $$(".nav-link", nav);
	const indicator = $(".nav-indicator", nav);
	const sections = links
		.map((link) => $(link.getAttribute("href")))
		.filter(Boolean);

	const moveIndicator = (link) => {
		if (!indicator || !link) return;
		indicator.style.width = `${link.offsetWidth}px`;
		indicator.style.transform = `translateX(${link.offsetLeft}px)`;
		indicator.style.opacity = "1";
	};

	const setActive = (id) => {
		let match = null;
		for (const link of links) {
			const on = link.getAttribute("href") === `#${id}`;
			link.classList.toggle("active", on);
			if (on) match = link;
		}
		moveIndicator(match);
	};

	if ("IntersectionObserver" in window && sections.length) {
		const ratios = new Map();
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					ratios.set(
						entry.target.id,
						entry.isIntersecting ? entry.intersectionRatio : 0,
					);
				}

				let best = null;
				let bestRatio = 0;
				for (const [id, ratio] of ratios) {
					if (ratio > bestRatio) {
						bestRatio = ratio;
						best = id;
					}
				}
				if (best) setActive(best);
			},
			{ rootMargin: "-45% 0px -45% 0px", threshold: [0, 0.25, 0.5, 1] },
		);

		for (const section of sections) observer.observe(section);
	}

	for (const link of links) {
		link.addEventListener("click", () =>
			setActive(link.getAttribute("href").slice(1)),
		);
	}

	window.addEventListener("resize", () =>
		moveIndicator($(".nav-link.active", nav)),
	);

	/* Get out of the way when reading downward; come back on the way up. */
	let lastY = window.scrollY;
	window.addEventListener(
		"scroll",
		() => {
			const y = window.scrollY;
			nav.classList.toggle("nav--tucked", y > lastY && y > 420);
			lastY = y;
		},
		{ passive: true },
	);

	setActive("home");
};

const initScrollProgress = () => {
	const bar = $("#progress");
	if (!bar) return;

	const update = () => {
		const max = document.body.scrollHeight - window.innerHeight;
		bar.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
	};

	window.addEventListener("scroll", update, { passive: true });
	window.addEventListener("resize", update);
	update();
};

/** Role lengths recalculate themselves, so the CV never goes stale. */
const initDurations = () => {
	for (const node of $$("[data-from]")) {
		node.textContent = duration(
			node.getAttribute("data-from"),
			node.getAttribute("data-to") || null,
		);
	}
};

/* --------------------------------------------------------------- projects */

const buildProjectCard = (key) => {
	const project = projects[key];
	const info = (typeof projectMeta !== "undefined" && projectMeta[key]) || {};

	// Reading up on a project sends the visitor to the .dev case study, since
	// that is the only place those pages exist
	const href = `${PORTFOLIO_ORIGIN}/pages/${key}/index.html`;
	const thumbnail = `${PORTFOLIO_ORIGIN}/pages/${key}/thumbnail.jpg`;

	const status = project.status;
	const tags = project.tags
		.split(",")
		.map((tag) => tag.trim())
		.filter(Boolean)
		.slice(0, 4);

	const card = el("article", "project-card glass glass--lit reveal");
	card.dataset.groups = (info.groups || []).join(" ");
	card.dataset.search =
		`${project.title} ${project.description} ${project.tags}`.toLowerCase();

	card.innerHTML = `
		<a class="project-shot" href="${href}" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true">
			<span class="project-status ${status.toLowerCase()}"><i></i>${escapeHtml(status)}</span>
			<img loading="lazy" decoding="async" alt="" src="${thumbnail}">
		</a>
		<div class="project-body-text">
			<h3>${escapeHtml(project.title)}</h3>
			<p>${escapeHtml(project.description)}</p>
			<div class="project-tags">${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
		</div>
		<div class="project-foot">
			<a class="learn" href="${href}" target="_blank" rel="noopener">Learn more
				<svg viewBox="0 0 24 24"><path d="M13.6 4.4 12.2 5.8l5.2 5.2H3v2h14.4l-5.2 5.2 1.4 1.4L21.2 12z"/></svg>
			</a>
			${
				info.repo
					? `<a class="repo" href="https://github.com/${GITHUB_USER}/${info.repo}" target="_blank" rel="noopener" aria-label="${escapeHtml(project.title)} on GitHub">${githubIconMarkup()}</a>`
					: ""
			}
		</div>`;

	const img = $("img", card);
	img.addEventListener("load", () => img.classList.add("loaded"));
	if (img.complete) img.classList.add("loaded");

	return card;
};

const initProjects = () => {
	const grid = $("#project-grid");
	if (!grid || typeof projects === "undefined") return;

	for (const key of projectOrder) {
		if (projects[key]) grid.appendChild(buildProjectCard(key));
	}

	const cards = $$(".project-card", grid);
	const empty = $("#projects-empty");
	const search = $("#project-search");
	const filters = $$(".filter");

	let activeFilter = "all";
	let query = "";

	const apply = () => {
		let shown = 0;
		for (const card of cards) {
			const inGroup =
				activeFilter === "all" ||
				card.dataset.groups.split(" ").includes(activeFilter);
			const inQuery = !query || card.dataset.search.includes(query);
			const show = inGroup && inQuery;
			card.classList.toggle("is-filtered", !show);
			if (show) shown++;
		}
		empty?.classList.toggle("show", shown === 0);
	};

	for (const button of filters) {
		button.addEventListener("click", () => {
			for (const other of filters)
				other.classList.toggle("active", other === button);
			activeFilter = button.dataset.filter;
			apply();
		});
	}

	search?.addEventListener("input", () => {
		query = search.value.trim().toLowerCase();
		apply();
	});

	observeReveals(grid);
	bindSheen(grid);
};

/* ------------------------------------------------------------------ stats */

const countTo = (node, target, suffix = "") => {
	if (REDUCED) {
		node.textContent = formatCount(target) + suffix;
		return;
	}

	const start = performance.now();
	const step = (now) => {
		const t = Math.min((now - start) / 1400, 1);
		const eased = 1 - (1 - t) ** 3;
		node.textContent = formatCount(Math.round(target * eased)) + suffix;
		if (t < 1) requestAnimationFrame(step);
	};

	requestAnimationFrame(step);
};

/**
 * Stat tiles ship with sensible numbers baked into the markup and upgrade
 * themselves to live figures once GitHub and the download counters answer.
 */
const initStats = async () => {
	const tiles = $$("[data-stat]");
	if (!tiles.length) return;

	const tile = (name) => tiles.find((node) => node.dataset.stat === name);

	const render = (node, value) => {
		if (!node || !value) return;
		const target = $("b", node);
		if (target) countTo(target, value, node.dataset.suffix || "");
	};

	const experience = tile("experience");
	if (experience) {
		const years = Math.floor(
			(Date.now() - new Date("2022-07-04").getTime()) / 31557600000,
		);
		$("b", experience).textContent = `${years}+`;
	}

	try {
		const response = await fetch(
			`https://api.github.com/users/${GITHUB_USER}/repos?per_page=100`,
		);
		if (response.ok) {
			const repos = await response.json();
			if (repos.length) {
				render(
					tile("stars"),
					repos.reduce((sum, repo) => sum + (repo.stargazers_count || 0), 0),
				);
				render(tile("repos"), repos.length);
			}
		}
	} catch {
		/* rate-limited or offline: the baked-in numbers stand */
	}

	// These counters send an Access-Control-Allow-Origin header, so reading them
	// from .com works even though the static assets next to them do not
	const counts = await Promise.all(
		["cryptofolio-stats.php", "filedrop-stats.php"].map(async (script) => {
			try {
				const response = await fetch(`${PORTFOLIO_ORIGIN}/scripts/${script}`);
				if (!response.ok) return 0;
				return (
					Number.parseInt((await response.text()).replace(/[^0-9]/g, ""), 10) ||
					0
				);
			} catch {
				return 0;
			}
		}),
	);

	const downloads = counts.reduce((sum, count) => sum + count, 0);
	if (downloads > 0) render(tile("downloads"), downloads);
};

/** The previous site used ?page=about, keep those links working. */
const redirectLegacyPage = () => {
	const page = new URL(window.location.href).searchParams.get("page");
	const sections = [
		"home",
		"about",
		"experience",
		"skills",
		"projects",
		"contact",
	];
	if (!page || !sections.includes(page.toLowerCase())) return;

	const id = page.toLowerCase();
	history.replaceState(null, "", `${window.location.pathname}#${id}`);
	requestAnimationFrame(() => $(`#${id}`)?.scrollIntoView());
};

const initHome = () => {
	redirectLegacyPage();
	initLoader();
	initRotator();
	initNav();
	initScrollProgress();
	initDurations();
	initProjects();
	initStats();

	const year = $("#year");
	if (year) year.textContent = new Date().getFullYear();

	bindThemeToggles();
	bindSheen();
	observeReveals();
	loadSprite();
};

/* ------------------------------------------------------------------- boot */

document.addEventListener("DOMContentLoaded", initHome);
