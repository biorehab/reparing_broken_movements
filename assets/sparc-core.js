/**
 * sparc-core.js
 * Shared computation module for SPARC interactive simulations.
 *
 * Exports:
 *   gaussianSubmovement(t, mu, sigma, amplitude)
 *   minimumJerkSubmovement(t, t0, D, amplitude)
 *   computeFFT(signal, dt)
 *   computeSPARC(velocity, dt, { padFactor, fcMax, ampThreshold, magThreshold })
 *   linspace(start, stop, n)
 */

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/**
 * Generate n evenly-spaced values from start to stop (inclusive).
 * @param {number} start
 * @param {number} stop
 * @param {number} n
 * @returns {number[]}
 */
export function linspace(start, stop, n) {
  if (n < 2) return [start];
  const arr = new Array(n);
  const step = (stop - start) / (n - 1);
  for (let i = 0; i < n; i++) arr[i] = start + i * step;
  return arr;
}

// ---------------------------------------------------------------------------
// Submovement profiles
// ---------------------------------------------------------------------------

/**
 * Evaluate a Gaussian velocity submovement at each point in time array t.
 *
 * v(t) = amplitude * exp( -0.5 * ((t - mu) / sigma)^2 )
 *
 * @param {number[]} t         Time array (s)
 * @param {number}   mu        Peak time (s)
 * @param {number}   sigma     Width (s); one standard deviation
 * @param {number}   [amplitude=1]
 * @returns {number[]}
 */
export function gaussianSubmovement(t, mu, sigma, amplitude = 1) {
  const inv2s2 = 0.5 / (sigma * sigma);
  return t.map(ti => amplitude * Math.exp(-inv2s2 * (ti - mu) ** 2));
}

/**
 * Evaluate a minimum-jerk velocity submovement (Bell 1979 / Flash & Hogan 1985).
 *
 * The minimum-jerk position trajectory is:
 *   x(τ) = 10τ³ - 15τ⁴ + 6τ⁵,   τ = (t - t0) / D  ∈ [0, 1]
 *
 * Its velocity (differentiated, in units per second) is:
 *   v(τ) = (amplitude / D) * (30τ² - 60τ³ + 30τ⁴)
 *
 * Outside [t0, t0+D] the velocity is zero.
 *
 * @param {number[]} t         Time array (s)
 * @param {number}   t0        Submovement onset (s)
 * @param {number}   D         Submovement duration (s)
 * @param {number}   [amplitude=1]  Total displacement (arbitrary units)
 * @returns {number[]}
 */
export function minimumJerkSubmovement(t, t0, D, amplitude = 1) {
  return t.map(ti => {
    const tau = (ti - t0) / D;
    if (tau < 0 || tau > 1) return 0;
    return (amplitude / D) * (30 * tau ** 2 - 60 * tau ** 3 + 30 * tau ** 4);
  });
}

// ---------------------------------------------------------------------------
// Spectral analysis
// ---------------------------------------------------------------------------

/**
 * Compute the single-sided DFT magnitude spectrum of a real-valued signal.
 *
 * This is a direct (O(N²)) DFT — sufficient for the signal lengths used in
 * these simulations (N ≤ 1024). Replace with an FFT library if N grows large.
 *
 * @param {number[]} signal    Uniformly-sampled signal
 * @param {number}   dt        Sample interval (s)
 * @returns {{ freqs: number[], mag: number[], N: number, fs: number }}
 *   freqs  — frequency axis (Hz), length floor(N/2)+1
 *   mag    — magnitude (same physical units as signal × s), length floor(N/2)+1
 *   N      — number of samples used
 *   fs     — sample rate (Hz)
 */
export function computeFFT(signal, dt) {
  const N = signal.length;
  const fs = 1 / dt;
  const Nhalf = Math.floor(N / 2) + 1;
  const freqs = new Array(Nhalf);
  const mag   = new Array(Nhalf);

  for (let k = 0; k < Nhalf; k++) {
    freqs[k] = k * fs / N;
    let re = 0, im = 0;
    const angle = -2 * Math.PI * k / N;
    for (let n = 0; n < N; n++) {
      re += signal[n] * Math.cos(angle * n);
      im += signal[n] * Math.sin(angle * n);
    }
    mag[k] = Math.sqrt(re * re + im * im) * dt;
  }
  return { freqs, mag, N, fs };
}

// ---------------------------------------------------------------------------
// SPARC
// ---------------------------------------------------------------------------

/**
 * Compute the SPARC (Spectral Arc Length) smoothness measure.
 *
 * Reference: Balasubramanian et al. (2012) J Neurophysiol 108(5).
 *
 * Algorithm:
 *  1. Identify movement onset / offset via an amplitude threshold on velocity.
 *  2. Extract the movement segment and normalise:
 *        v̂(t) = v(t) / (v_peak × D)
 *     where D is the movement duration.
 *  3. Compute the magnitude spectrum V̂(f) of v̂(t).
 *  4. Normalise the spectrum so V̂(0) = 1.
 *  5. Find the frequency cutoff fc: the highest frequency at which
 *     |V̂(f)| / |V̂(0)| ≥ magThreshold (default 0.05).
 *     fc is also hard-capped at fcMax (default 20 Hz).
 *  6. SPARC = −∫₀^{fc} √(1 + (d|V̂|/df)²) df   (arc length, negated)
 *
 * @param {number[]} velocity     Speed signal (any consistent units)
 * @param {number}   dt           Sample interval (s)
 * @param {object}   [opts]
 * @param {number}   [opts.padFactor=1]      Zero-padding multiplier (power of 2 recommended)
 * @param {number}   [opts.fcMax=20]         Hard cap on frequency cutoff (Hz)
 * @param {number}   [opts.ampThreshold=0.05] Fraction of v_peak to define onset/offset
 * @param {number}   [opts.magThreshold=0.05] Fraction of DC magnitude to find fc
 * @returns {{
 *   sparc:    number,   SPARC value (≤ 0; more negative = less smooth)
 *   fc:       number,   Frequency cutoff (Hz)
 *   duration: number,   Movement duration D (s)
 *   onset:    number,   Onset index
 *   offset:   number,   Offset index
 *   vPeak:    number,   Peak velocity
 *   vNorm:    number[], Normalised velocity used for spectrum
 *   freqs:    number[], Frequency axis (Hz)
 *   magNorm:  number[], Normalised magnitude spectrum
 * }}
 */
export function computeSPARC(velocity, dt, {
  padFactor    = 4,
  fcMax        = 20,
  ampThreshold = 0.05,
  magThreshold = 0.05,
} = {}) {
  const N = velocity.length;

  // 1. Onset / offset
  const vPeak = Math.max(...velocity);
  const thresh = ampThreshold * vPeak;
  let onset = 0, offset = N - 1;
  for (let i = 0; i < N; i++)   { if (velocity[i] > thresh) { onset  = i; break; } }
  for (let i = N - 1; i >= 0; i--) { if (velocity[i] > thresh) { offset = i; break; } }
  const duration = (offset - onset) * dt;

  // 2. Normalise
  const vNorm = velocity.map(vi => vi / (vPeak * duration));

  // 3. Spectrum (with optional zero-padding)
  const Npad = padFactor > 0 ?  nextPow2(N) * (2 ** padFactor) : N;
  const padded = new Array(Npad).fill(0);
  for (let i = 0; i < N; i++) padded[i] = vNorm[i];

  const { freqs, mag } = computeFFT(padded, dt);

  // 4. Normalise spectrum
  const magPeak = mag[0];
  const magNorm = mag.map(m => m / magPeak);

  // 5. Find fc
  const Nhalf = freqs.length;
  let fc_idx = 0;
  for (let k = Nhalf - 1; k >= 0; k--) {
    if (freqs[k] <= fcMax && magNorm[k] >= magThreshold) { fc_idx = k; break; }
  }
  const fc = freqs[fc_idx];

  // 6. Arc length
  const df = freqs[1] - freqs[0];
  let arcLen = 0;
  for (let k = 1; k <= fc_idx; k++) {
    const dv = (magNorm[k] - magNorm[k - 1]) / df;
    arcLen += Math.sqrt((1 / fc) * (1 / fc) + dv * dv) * df;
  }

  return { sparc: -arcLen, fc, duration, onset, offset, vPeak, vNorm, freqs, magNorm };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function nextPow2(n) {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

// ---------------------------------------------------------------------------
// D3 chart helpers (shared across simulation pages)
// ---------------------------------------------------------------------------

/**
 * Create an SVG <g> group inside the given SVG element, offset by margin.
 * Requires d3 to be loaded as a global before the module runs.
 *
 * @param {string} svgId
 * @param {number} totalH            Total SVG height attribute (px)
 * @param {{ top, right, bottom, left }} margin
 * @returns {{ g: d3.Selection, h: number }}
 */
export function initChartGroup(svgId, totalH, margin) {
  const h = totalH - margin.top - margin.bottom;
  const g = d3.select('#' + svgId)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);
  return { g, h };
}

/**
 * Append axis placeholders and labels to a chart group.
 * Returns handles for updating scales on each render call.
 *
 * @param {d3.Selection} g
 * @param {number}       h        Inner height (px)
 * @param {string}       xLabel
 * @param {string}       yLabel
 * @returns {{ xAx: d3.Selection, yAx: d3.Selection, xLbl: d3.Selection }}
 */
export function mkAxis(g, h, xLabel, yLabel) {
  const xAx = g.append('g').attr('transform', `translate(0,${h})`);
  const yAx = g.append('g');
  g.append('text')
    .attr('transform', 'rotate(-90)').attr('x', -h / 2).attr('y', -40)
    .attr('text-anchor', 'middle').attr('font-size', 11)
    .attr('font-family', 'Menlo,Consolas,monospace').attr('fill', '#6b6560')
    .text(yLabel);
  const xLbl = g.append('text')
    .attr('y', h + 32).attr('text-anchor', 'middle')
    .attr('font-size', 11).attr('font-family', 'Menlo,Consolas,monospace')
    .attr('fill', '#6b6560').text(xLabel);
  return { xAx, yAx, xLbl };
}

/**
 * Apply consistent monospace styling to a rendered D3 axis.
 * Call after every .call(d3.axis…).
 *
 * @param {d3.Selection} sel
 */
export function styleAxis(sel) {
  sel.selectAll('text')
    .style('font-size', '11px')
    .style('font-family', 'Menlo,Consolas,monospace');
  sel.selectAll('.domain,.tick line').attr('stroke', '#ccc');
}

/**
 * Return the usable inner width of an SVG element (total width minus margins).
 *
 * @param {string} svgId
 * @param {{ left, right }} margin
 * @returns {number}
 */
export function getInnerWidth(svgId, margin) {
  return document.getElementById(svgId).getBoundingClientRect().width
    - margin.left - margin.right;
}