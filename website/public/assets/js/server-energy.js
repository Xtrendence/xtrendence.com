// Energy panel for /server, from the plugs' own meters through the lights tool
(() => {
	const RANGE_KEY = 'server-energy-range';
	const SVG = 'http://www.w3.org/2000/svg';
	const COLORS = ['#4bc0c8', '#c779d0', '#feac5e', '#6fd39b', '#86a8ff', '#f08a8a', '#e6d36f', '#9be3d6'];

	let range = '1d';
	try {
		range = localStorage.getItem(RANGE_KEY) || range;
	} catch {}
	let latest = null;

	const escapeHtml = (value) =>
		String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

	function formatEnergy(wh) {
		if (wh === null || wh === undefined) return '--';
		if (wh >= 1000) return `${(wh / 1000).toFixed(wh >= 10000 ? 1 : 2)} kWh`;
		return `${Math.round(wh)} Wh`;
	}

	const formatPower = (w) => (w === null || w === undefined ? '--' : `${w >= 100 ? Math.round(w) : w.toFixed(1)} W`);

	function formatTime(time, daily) {
		return new Date(time).toLocaleString('en-GB', daily ? { day: 'numeric', month: 'short' } : { weekday: 'short', hour: '2-digit', minute: '2-digit' });
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

	// One line per entry in lines, each [{ t, wh }], with a shared hover that lists every line at that time
	function drawLines(container, lines, data, { area = false } = {}) {
		container.innerHTML = '';
		const width = Math.max(200, container.clientWidth);
		const height = 150;
		const pad = { top: 8, right: 6, bottom: 20, left: 52 };
		const plotW = width - pad.left - pad.right;
		const plotH = height - pad.top - pad.bottom;
		const daily = data.bucket >= 86400000;
		const since = data.since;
		const end = Math.max(data.now, since + data.bucket);

		const values = lines.flatMap((line) => line.points.map((p) => p[1]));
		const max = niceMax(Math.max(...values, 0) * 1.1);
		const x = (t) => pad.left + ((t - since) / (end - since)) * plotW;
		const y = (v) => pad.top + plotH - (Math.min(v, max) / max) * plotH;

		const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, width, height, class: 'chart-svg', role: 'img', 'aria-label': 'Energy over time' });
		for (const fraction of [0, 0.5, 1]) {
			const gy = pad.top + plotH - fraction * plotH;
			svg.append(el('line', { x1: pad.left, x2: width - pad.right, y1: gy, y2: gy, class: 'chart-grid-line' }));
			const label = el('text', { x: pad.left - 6, y: gy + 3, class: 'chart-axis', 'text-anchor': 'end' });
			label.textContent = formatEnergy(max * fraction);
			svg.append(label);
		}
		const startLabel = el('text', { x: pad.left, y: height - 4, class: 'chart-axis' });
		startLabel.textContent = formatTime(since, true);
		const endLabel = el('text', { x: width - pad.right, y: height - 4, class: 'chart-axis', 'text-anchor': 'end' });
		endLabel.textContent = 'Now';
		svg.append(startLabel, endLabel);

		for (const line of lines) {
			if (!line.points.length) continue;
			const path = line.points.map((p, i) => `${i ? 'L' : 'M'}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join('');
			if (area) {
				const base = pad.top + plotH;
				svg.append(el('path', { d: `${path}L${x(line.points.at(-1)[0]).toFixed(1)},${base}L${x(line.points[0][0]).toFixed(1)},${base}Z`, class: 'chart-area' }));
			}
			svg.append(el('path', { d: path, class: 'chart-line energy-line', style: `stroke:${line.color}` }));
		}

		if (!values.length) {
			const empty = el('text', { x: pad.left + plotW / 2, y: pad.top + plotH / 2, class: 'chart-axis', 'text-anchor': 'middle' });
			empty.textContent = 'Collecting data';
			svg.append(empty);
		}

		const cross = el('line', { y1: pad.top, y2: pad.top + plotH, class: 'chart-cross', visibility: 'hidden' });
		const dots = lines.map((line) => el('circle', { r: 3.5, class: 'chart-dot', style: `fill:${line.color}`, visibility: 'hidden' }));
		const hit = el('rect', { x: pad.left, y: pad.top, width: plotW, height: plotH, class: 'chart-hit' });
		svg.append(cross, ...dots, hit);
		container.append(svg);

		const tip = document.createElement('div');
		tip.className = 'chart-tip energy-tip';
		tip.hidden = true;
		container.append(tip);

		const times = [...new Set(lines.flatMap((line) => line.points.map((p) => p[0])))].sort((a, b) => a - b);

		hit.addEventListener('pointermove', (event) => {
			if (!times.length) return;
			const box = svg.getBoundingClientRect();
			const px = ((event.clientX - box.left) / box.width) * width;
			const t = since + ((px - pad.left) / plotW) * (end - since);
			const nearest = times.reduce((best, time) => (Math.abs(time - t) < Math.abs(best - t) ? time : best), times[0]);
			const cx = x(nearest);
			cross.setAttribute('x1', cx);
			cross.setAttribute('x2', cx);
			cross.setAttribute('visibility', 'visible');

			const rows = [];
			lines.forEach((line, index) => {
				const point = line.points.find((p) => p[0] === nearest);
				if (!point) {
					dots[index].setAttribute('visibility', 'hidden');
					return;
				}
				dots[index].setAttribute('cx', cx);
				dots[index].setAttribute('cy', y(point[1]));
				dots[index].setAttribute('visibility', 'visible');
				rows.push(`<span class="energy-tip-row"><i style="background:${line.color}"></i>${lines.length > 1 ? `${escapeHtml(line.name)} ` : ''}<b>${escapeHtml(formatEnergy(point[1]))}</b></span>`);
			});
			tip.innerHTML = `${rows.join('')}<span>${escapeHtml(formatTime(nearest, daily))}${daily ? '' : ', that hour'}</span>`;
			tip.hidden = false;
			const left = (cx / width) * box.width;
			tip.style.left = `${Math.min(Math.max(left, 80), box.width - 80)}px`;
		});
		hit.addEventListener('pointerleave', () => {
			cross.setAttribute('visibility', 'hidden');
			for (const dot of dots) dot.setAttribute('visibility', 'hidden');
			tip.hidden = true;
		});
	}

	function render(data) {
		latest = data;
		for (const tab of document.querySelectorAll('#energy-ranges button')) {
			tab.setAttribute('aria-selected', String(tab.dataset.range === data.range));
		}

		// The hour or day still running is only partly counted, so the lines stop before it rather than dip
		const finished = (series) => series.filter(([time]) => time + data.bucket <= data.now);
		const plugs = data.plugs.map((plug, index) => ({ ...plug, color: COLORS[index % COLORS.length], finished: finished(plug.series) }));
		const daily = data.bucket >= 86400000;
		const hours = (data.now - data.since) / 3600000;
		const drawing = plugs.reduce((sum, plug) => sum + (plug.powerW ?? 0), 0);
		const month = plugs.reduce((sum, plug) => sum + (plug.monthWh ?? 0), 0);
		const failing = plugs.filter((plug) => plug.error);

		const synced = Math.max(0, ...plugs.map((plug) => plug.syncedAt ?? 0));
		document.getElementById('energy-meta').innerText = [
			`${plugs.length} plug${plugs.length === 1 ? '' : 's'}`,
			failing.length ? `${failing.length} not reporting` : null,
			synced ? `synced ${formatTime(synced)}` : null,
		]
			.filter(Boolean)
			.join(', ');
		document.getElementById('energy-tiles').innerHTML = [
			['Used', formatEnergy(data.totalWh)],
			['Drawing now', formatPower(drawing)],
			['Average draw', formatPower(hours > 0 ? data.totalWh / hours : null)],
			['This month', formatEnergy(month)],
		]
			.map(([label, value]) => `<div class="uptime-tile"><span class="uptime-label">${label}</span><b>${escapeHtml(value)}</b></div>`)
			.join('');

		document.getElementById('energy-unit').innerText = daily ? 'per day' : 'per hour';
		document.getElementById('energy-legend').innerHTML = plugs
			.map(
				(plug) => `
					<span class="energy-key" title="${escapeHtml(plug.error ?? `Synced ${plug.syncedAt ? formatTime(plug.syncedAt) : 'not yet'}`)}">
						<i style="background:${plug.color}"></i>
						<span class="energy-key-name">${escapeHtml(plug.name)}</span>
						<span class="energy-key-value">${escapeHtml(formatEnergy(plug.totalWh))} · ${escapeHtml(formatPower(plug.powerW))}${data.totalWh > 0 ? ` · ${Math.round((plug.totalWh / data.totalWh) * 100)}%` : ''}</span>
					</span>
				`
			)
			.join('');

		drawLines(
			document.getElementById('energy-plugs-chart'),
			plugs.map((plug) => ({ name: plug.name, color: plug.color, points: plug.finished })),
			data
		);

		// Buckets line up across plugs, so the combined line is the sum at each one
		const totals = new Map();
		for (const plug of plugs) {
			for (const [time, wh] of plug.finished) totals.set(time, (totals.get(time) ?? 0) + wh);
		}
		const combined = [...totals.entries()].sort((a, b) => a[0] - b[0]);
		const peak = combined.reduce((best, point) => (point[1] > best[1] ? point : best), [0, 0]);
		document.getElementById('energy-total').innerText = formatEnergy(data.totalWh);
		document.getElementById('energy-total-sub').innerText = combined.length
			? `peak ${formatEnergy(peak[1])} ${daily ? 'on' : 'at'} ${formatTime(peak[0], daily)}`
			: 'No data yet';
		drawLines(document.getElementById('energy-total-chart'), [{ name: 'All plugs', color: 'var(--accent-fill)', points: combined }], data, { area: true });
	}

	async function load() {
		try {
			const response = await fetch(`/server/energy?range=${range}`, { credentials: 'same-origin' });
			const data = await response.json();
			if (!response.ok) throw new Error(data?.error ?? `HTTP ${response.status}`);
			render(data);
		} catch (error) {
			document.getElementById('energy-meta').innerText = error.message;
		}
	}

	document.getElementById('energy-ranges').addEventListener('click', (event) => {
		const tab = event.target.closest('button[data-range]');
		if (!tab || tab.dataset.range === range) return;
		range = tab.dataset.range;
		try {
			localStorage.setItem(RANGE_KEY, range);
		} catch {}
		load();
	});

	// Owner only, the button is not rendered for share viewers
	const syncButton = document.getElementById('energy-sync');
	if (syncButton) {
		const label = syncButton.querySelector('.action-label');
		syncButton.addEventListener('click', async () => {
			syncButton.disabled = true;
			syncButton.classList.add('loading');
			label.innerText = 'Syncing';
			let text = 'Synced';
			try {
				const response = await fetch('/server/energy/sync', { method: 'POST', credentials: 'same-origin' });
				const data = await response.json().catch(() => ({}));
				if (!response.ok) throw new Error(data?.error ?? `HTTP ${response.status}`);
				await load();
			} catch (error) {
				text = 'Failed';
				syncButton.title = error.message;
			}
			syncButton.classList.remove('loading');
			label.innerText = text;
			setTimeout(() => {
				label.innerText = 'Sync now';
				syncButton.disabled = false;
			}, 2500);
		});
	}

	let resizeTimer = null;
	window.addEventListener('resize', () => {
		clearTimeout(resizeTimer);
		resizeTimer = setTimeout(() => latest && render(latest), 150);
	});

	load();
	setInterval(load, 5 * 60 * 1000);
})();
