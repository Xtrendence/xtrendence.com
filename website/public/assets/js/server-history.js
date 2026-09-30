// Trends, alert history and the internet log for /server. Kept apart from the
// page's main script, which only knows about live stats
(() => {
	const RANGE_KEY = 'server-trends-range';
	const REFRESH_MS = 60000;
	const SVG = 'http://www.w3.org/2000/svg';

	const CHARTS = [
		{ key: 'cpu', label: 'CPU', unit: 'percent', max: 100 },
		{ key: 'mem', label: 'Memory', unit: 'percent', max: 100 },
		{ key: 'temp', label: 'Temperature', unit: 'celsius' },
		{ key: 'swap', label: 'Swap', unit: 'bytes' },
		{ key: 'rx', label: 'Download', unit: 'rate' },
		{ key: 'tx', label: 'Upload', unit: 'rate' },
	];

	let range = '24h';
	try {
		range = localStorage.getItem(RANGE_KEY) || range;
	} catch {}

	let latest = null;
	let timer = null;

	function escapeHtml(value) {
		return String(value ?? '').replace(
			/[&<>"']/g,
			(char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]
		);
	}

	function formatBytes(bytes) {
		let value = Number(bytes) || 0;
		const units = ['B', 'KB', 'MB', 'GB', 'TB'];
		let index = 0;
		while (value >= 1024 && index < units.length - 1) {
			value /= 1024;
			index += 1;
		}
		return `${value.toFixed(value >= 100 || index < 2 ? 0 : 1)} ${units[index]}`;
	}

	function formatValue(value, unit) {
		if (value === null || value === undefined || Number.isNaN(value)) return '--';
		if (unit === 'percent') return `${value.toFixed(value < 10 ? 1 : 0)}%`;
		if (unit === 'celsius') return `${value.toFixed(0)}°C`;
		if (unit === 'rate') return `${formatBytes(value)}/s`;
		return formatBytes(value);
	}

	function formatTime(time, withDate) {
		const date = new Date(time);
		return date.toLocaleString('en-GB', withDate
			? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
			: { hour: '2-digit', minute: '2-digit' });
	}

	function formatDuration(ms) {
		const minutes = Math.max(1, Math.round(ms / 60000));
		if (minutes < 60) return `${minutes} min`;
		const hours = Math.floor(minutes / 60);
		if (hours < 48) return `${hours} h ${minutes % 60} min`;
		return `${Math.round(hours / 24)} days`;
	}

	// Rounds a ceiling up to a readable step, so gridlines land on clean numbers
	function niceMax(value) {
		if (!value || value <= 0) return 1;
		const power = 10 ** Math.floor(Math.log10(value));
		const step = [1, 2, 2.5, 5, 10].find((m) => m * power >= value) ?? 10;
		return step * power;
	}

	function el(name, attrs = {}) {
		const node = document.createElementNS(SVG, name);
		for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
		return node;
	}

	// One series per chart. Buckets with no sample break the line rather than
	// drawing a slope across time nobody measured
	function drawChart(container, points, spec, since, now) {
		container.innerHTML = '';
		const width = Math.max(200, container.clientWidth);
		const height = 120;
		const pad = { top: 8, right: 6, bottom: 20, left: 44 };
		const plotW = width - pad.left - pad.right;
		const plotH = height - pad.top - pad.bottom;

		const values = points.map((p) => p[1]).filter((v) => v !== null);
		const max = spec.max ?? niceMax(Math.max(...values, 0) * 1.1);

		const x = (t) => pad.left + ((t - since) / (now - since)) * plotW;
		const y = (v) => pad.top + plotH - (Math.min(v, max) / max) * plotH;

		const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, width, height, class: 'chart-svg', role: 'img', 'aria-label': `${spec.label} over time` });

		for (const fraction of [0, 0.5, 1]) {
			const gy = pad.top + plotH - fraction * plotH;
			svg.append(el('line', { x1: pad.left, x2: width - pad.right, y1: gy, y2: gy, class: 'chart-grid-line' }));
			const label = el('text', { x: pad.left - 6, y: gy + 3, class: 'chart-axis', 'text-anchor': 'end' });
			label.textContent = formatValue(max * fraction, spec.unit);
			svg.append(label);
		}

		const startLabel = el('text', { x: pad.left, y: height - 4, class: 'chart-axis' });
		startLabel.textContent = formatTime(since, range !== '24h');
		const endLabel = el('text', { x: width - pad.right, y: height - 4, class: 'chart-axis', 'text-anchor': 'end' });
		endLabel.textContent = 'Now';
		svg.append(startLabel, endLabel);

		const runs = [];
		let run = [];
		for (const point of points) {
			if (point[1] === null) {
				if (run.length) runs.push(run);
				run = [];
			} else {
				run.push(point);
			}
		}
		if (run.length) runs.push(run);

		for (const segment of runs) {
			const line = segment.map((p, i) => `${i ? 'L' : 'M'}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join('');
			const base = pad.top + plotH;
			const area = `${line}L${x(segment.at(-1)[0]).toFixed(1)},${base}L${x(segment[0][0]).toFixed(1)},${base}Z`;
			svg.append(el('path', { d: area, class: 'chart-area' }));
			svg.append(el('path', { d: line, class: 'chart-line' }));
		}

		if (values.length === 0) {
			const empty = el('text', { x: pad.left + plotW / 2, y: pad.top + plotH / 2, class: 'chart-axis', 'text-anchor': 'middle' });
			empty.textContent = 'Collecting data';
			svg.append(empty);
		}

		const cross = el('line', { y1: pad.top, y2: pad.top + plotH, class: 'chart-cross', visibility: 'hidden' });
		const dot = el('circle', { r: 4, class: 'chart-dot', visibility: 'hidden' });
		const hit = el('rect', { x: pad.left, y: pad.top, width: plotW, height: plotH, class: 'chart-hit' });
		svg.append(cross, dot, hit);
		container.append(svg);

		const tip = document.createElement('div');
		tip.className = 'chart-tip';
		tip.hidden = true;
		container.append(tip);

		const measured = points.filter((p) => p[1] !== null);

		const hide = () => {
			cross.setAttribute('visibility', 'hidden');
			dot.setAttribute('visibility', 'hidden');
			tip.hidden = true;
		};

		hit.addEventListener('pointermove', (event) => {
			if (!measured.length) return;
			const box = svg.getBoundingClientRect();
			const px = ((event.clientX - box.left) / box.width) * width;
			const t = since + ((px - pad.left) / plotW) * (now - since);
			let nearest = measured[0];
			for (const point of measured) {
				if (Math.abs(point[0] - t) < Math.abs(nearest[0] - t)) nearest = point;
			}

			const cx = x(nearest[0]);
			cross.setAttribute('x1', cx);
			cross.setAttribute('x2', cx);
			cross.setAttribute('visibility', 'visible');
			dot.setAttribute('cx', cx);
			dot.setAttribute('cy', y(nearest[1]));
			dot.setAttribute('visibility', 'visible');

			const peak = nearest[2] !== null && nearest[2] !== undefined && range !== '24h'
				? `<span>peak ${escapeHtml(formatValue(nearest[2], spec.unit))}</span>`
				: '';
			tip.innerHTML = `<b>${escapeHtml(formatValue(nearest[1], spec.unit))}</b>${peak}<span>${escapeHtml(formatTime(nearest[0], range !== '24h'))}</span>`;
			tip.hidden = false;
			const left = (cx / width) * box.width;
			tip.style.left = `${Math.min(Math.max(left, 60), box.width - 60)}px`;
		});
		hit.addEventListener('pointerleave', hide);
	}

	function renderCharts(data) {
		const grid = document.getElementById('chart-grid');
		if (!grid.children.length) {
			grid.innerHTML = CHARTS.map(
				(spec) => `
					<div class="chart-card" data-key="${spec.key}">
						<div class="chart-head">
							<span class="chart-label">${spec.label}</span>
							<span class="chart-now"></span>
						</div>
						<div class="chart-sub"></div>
						<div class="chart-body"></div>
					</div>
				`
			).join('');
		}

		for (const spec of CHARTS) {
			const card = grid.querySelector(`[data-key="${spec.key}"]`);
			const points = data.series[spec.key] ?? [];
			const measured = points.filter((p) => p[1] !== null);
			const last = measured.at(-1)?.[1] ?? null;
			const peak = measured.reduce((m, p) => Math.max(m, p[2] ?? p[1]), 0);
			const average = measured.length ? measured.reduce((sum, p) => sum + p[1], 0) / measured.length : null;

			card.querySelector('.chart-now').innerText = formatValue(last, spec.unit);
			card.querySelector('.chart-sub').innerText = measured.length
				? `avg ${formatValue(average, spec.unit)} · peak ${formatValue(peak, spec.unit)}`
				: 'No data yet';
			drawChart(card.querySelector('.chart-body'), points, spec, data.since, data.now);
		}
	}

	function forecastText(forecast) {
		if (!forecast) return 'No data yet';
		if (!forecast.enoughHistory) return 'Forecast after 2 days of history';
		if (forecast.daysToFull === null) return 'Not growing';
		const days = Math.round(forecast.daysToFull);
		if (days > 3650) return 'Not filling up';
		const perDay = `${formatBytes(Math.abs(forecast.perDay))}/day`;
		return days > 365 ? `Full in over a year · ${perDay}` : `Full in ~${Math.max(1, days)} days · ${perDay}`;
	}

	function renderDrives(data) {
		const container = document.getElementById('drive-trends');
		const mounts = Object.keys(data.drives).sort((a, b) =>
			a === '/' ? -1 : b === '/' ? 1 : a.localeCompare(b, undefined, { numeric: true })
		);
		if (!mounts.length) {
			container.innerHTML = '<div class="empty">Collecting data...</div>';
			return;
		}

		container.innerHTML = mounts
			.map((mount) => {
				const forecast = data.forecasts.find((f) => f.mount === mount);
				const soon = forecast?.daysToFull !== null && forecast?.daysToFull !== undefined && forecast.daysToFull < 60;
				return `
					<div class="drive-trend">
						<span class="drive-trend-mount">${escapeHtml(mount)}</span>
						<div class="drive-trend-chart" data-mount="${escapeHtml(mount)}"></div>
						<span class="drive-trend-now">${forecast ? `${forecast.percent.toFixed(0)}%` : ''}</span>
						<span class="drive-trend-forecast ${soon ? 'soon' : ''}">${escapeHtml(forecastText(forecast))}</span>
					</div>
				`;
			})
			.join('');

		for (const mount of mounts) {
			const target = container.querySelector(`[data-mount="${CSS.escape(mount)}"]`);
			drawSpark(target, data.drives[mount], data.since, data.now);
		}
	}

	// Drives move slowly, so a fixed 0-100 scale would flatten them. The
	// sparkline is scaled to its own range and the number carries the level
	function drawSpark(container, points, since, now) {
		const width = Math.max(120, container.clientWidth);
		const height = 28;
		const values = points.map((p) => p[1]);
		const lo = Math.min(...values);
		const hi = Math.max(...values);
		const spread = Math.max(hi - lo, 0.5);
		const x = (t) => ((t - since) / (now - since)) * width;
		const y = (v) => height - 3 - ((v - lo) / spread) * (height - 6);
		const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join('');
		container.innerHTML = `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" class="spark" aria-hidden="true"><path d="${line}" class="chart-line"/></svg>`;
	}

	function renderTimeline(data) {
		const container = document.getElementById('alert-timeline');
		const events = data.alerts;
		document.getElementById('timeline-count').innerText = `${events.length} in range`;

		if (!events.length) {
			container.innerHTML = '<div class="empty">No alerts in this range.</div>';
			return;
		}

		const lanes = new Map();
		for (const event of events) {
			if (!lanes.has(event.rule)) lanes.set(event.rule, { label: event.label, events: [] });
			lanes.get(event.rule).events.push(event);
		}

		const span = data.now - data.since;
		const pos = (t) => `${(((Math.max(t, data.since) - data.since) / span) * 100).toFixed(2)}%`;

		const laneHtml = [...lanes.values()]
			.map(
				(lane) => `
					<div class="lane">
						<span class="lane-label">${escapeHtml(lane.label)}</span>
						<div class="lane-track">
							${lane.events
								.map((event) => {
									const end = event.ended ?? data.now;
									const width = Math.max(((end - Math.max(event.started, data.since)) / span) * 100, 0.6);
									const title = `${event.message} · ${formatTime(event.started, true)} to ${event.ended ? formatTime(event.ended, true) : 'now'} · ${formatDuration(end - event.started)}`;
									return `<span class="lane-bar ${escapeHtml(event.level)}" style="left:${pos(event.started)};width:${width.toFixed(2)}%" title="${escapeHtml(title)}"></span>`;
								})
								.join('')}
						</div>
					</div>
				`
			)
			.join('');

		const listHtml = events
			.slice(0, 12)
			.map((event) => {
				const end = event.ended ?? data.now;
				return `
					<div class="event ${escapeHtml(event.level)}">
						<span class="event-level">${event.level === 'hard' ? 'Critical' : 'Warning'}</span>
						<span class="event-label">${escapeHtml(event.label)}</span>
						<span class="event-when">${escapeHtml(formatTime(event.started, true))} · ${event.ended ? escapeHtml(formatDuration(end - event.started)) : 'ongoing'}</span>
						<span class="event-message">${escapeHtml(event.message)}</span>
					</div>
				`;
			})
			.join('');

		container.innerHTML = `
			<div class="lanes">${laneHtml}</div>
			<div class="lane-axis"><span>${escapeHtml(formatTime(data.since, true))}</span><span>Now</span></div>
			<div class="events">${listHtml}</div>
		`;
	}

	function renderInternet(data) {
		const state = document.getElementById('internet-state');
		const down = Boolean(data.currentOutage);
		state.className = `badge ${down ? 'critical' : 'healthy'}`;
		state.innerText = down ? `Down since ${formatTime(data.currentOutage.started)}` : 'Online';

		const tiles = Object.entries(data.uptime)
			.map(
				([label, value]) => `
					<div class="uptime-tile">
						<span class="uptime-label">${label}</span>
						<b>${value === null ? '--' : `${value >= 99.995 ? '100' : value.toFixed(2)}%`}</b>
					</div>
				`
			)
			.join('');
		document.getElementById('uptime-tiles').innerHTML = tiles;

		const outages = data.outages;
		document.getElementById('internet-meta').innerText = `${outages.length} outage${outages.length === 1 ? '' : 's'} in ${range}`;

		const span = data.now - data.since;
		document.getElementById('outage-strip').innerHTML = `
			<div class="lane-track">
				${outages
					.map((outage) => {
						const end = outage.ended ?? data.now;
						const left = ((Math.max(outage.started, data.since) - data.since) / span) * 100;
						const width = Math.max(((end - Math.max(outage.started, data.since)) / span) * 100, 0.6);
						return `<span class="lane-bar hard" style="left:${left.toFixed(2)}%;width:${width.toFixed(2)}%" title="${escapeHtml(`${formatTime(outage.started, true)} · ${formatDuration(end - outage.started)}`)}"></span>`;
					})
					.join('')}
			</div>
			<div class="lane-axis"><span>${escapeHtml(formatTime(data.since, true))}</span><span>Now</span></div>
		`;

		document.getElementById('outage-list').innerHTML = outages.length
			? outages
					.map((outage) => {
						const end = outage.ended ?? data.now;
						return `
							<div class="outage">
								<span class="outage-when">${escapeHtml(formatTime(outage.started, true))} to ${outage.ended ? escapeHtml(formatTime(outage.ended)) : 'now'}</span>
								<span class="outage-duration">${escapeHtml(formatDuration(end - outage.started))}</span>
								<span class="outage-reason">${escapeHtml(outage.reason ?? '')}</span>
							</div>
						`;
					})
					.join('')
			: '<div class="empty">No outages in this range.</div>';
	}

	function render(data) {
		latest = data;
		document.getElementById('trends-meta').innerText = `every ${data.bucket >= 86400000 ? 'day' : data.bucket >= 3600000 ? `${data.bucket / 3600000} h` : `${data.bucket / 60000} min`}`;
		for (const tab of document.querySelectorAll('#range-tabs button')) {
			tab.setAttribute('aria-selected', String(tab.dataset.range === data.range));
		}
		renderCharts(data);
		renderDrives(data);
		renderTimeline(data);
		renderInternet(data);
	}

	async function load() {
		clearTimeout(timer);
		try {
			const response = await fetch(`/server/history?range=${encodeURIComponent(range)}`, { credentials: 'same-origin' });
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			render(await response.json());
		} catch (error) {
			console.log(error);
			document.getElementById('trends-meta').innerText = 'Unavailable';
		}
		timer = setTimeout(load, REFRESH_MS);
	}

	document.getElementById('range-tabs').addEventListener('click', (event) => {
		const tab = event.target.closest('button[data-range]');
		if (!tab || tab.dataset.range === range) return;
		range = tab.dataset.range;
		try {
			localStorage.setItem(RANGE_KEY, range);
		} catch {}
		load();
	});

	// Charts are drawn to the pixel width they have, so a resize redraws them
	let resizeTimer = null;
	window.addEventListener('resize', () => {
		clearTimeout(resizeTimer);
		resizeTimer = setTimeout(() => latest && render(latest), 150);
	});

	load();
})();
