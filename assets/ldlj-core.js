/**
 * ldlj-core.js
 * Shared computation module for LDLJ (Log Dimensionless Jerk) simulations.
 *
 * Jerk convention:
 *   j(t) = d³x/dt³ = d²v/dt²
 *   Computed via the second-order central-difference of the speed signal:
 *     j[i] ≈ (v[i+1] − 2·v[i] + v[i−1]) / dt²
 *
 * Duration convention:
 *   Movement duration T must be supplied by the caller from simulation
 *   parameters (exact known value). T significantly affects the measure
 *   magnitude and should not be estimated from a threshold.
 *   Onset and offset indices are supplied for the same reason.
 *
 * Exports — submovement profiles:
 *   mjtVelocity(t, t_start, T_sub, amplitude)
 *   gaussianVelocity(t, mu, sigma, amplitude)
 *
 * Exports — building blocks:
 *   findOnsetOffset(velocity, ampThreshold)
 *   computeJerkIntegrals(velocity, dt, onset, offset)
 *
 * Exports — individual measures (pre-computed integrals + exact T):
 *   computeMJ(IAJ, T, vPeak)
 *   computeDLJ(ISJ, T, vPeak)
 *   computeLDLJ(ISJ, T, vPeak)
 *   computeSDLJ(ISJ, T, vPeak)
 *
 * Exports — convenience wrapper:
 *   computeAllMeasures(velocity, dt, onset, offset, T)
 */

// ---------------------------------------------------------------------------
// Submovement velocity profiles
// ---------------------------------------------------------------------------

/**
 * Evaluate a minimum-jerk velocity submovement on a time array.
 *
 * The minimum-jerk position profile x(τ) = 10τ³ − 15τ⁴ + 6τ⁵, τ = (t − t_start)/T_sub,
 * produces a velocity:
 *   v(τ) = (amplitude / T_sub) · (30τ² − 60τ³ + 30τ⁴)
 *
 * The total displacement ∫v dt = amplitude (the position change).
 * Outside [t_start, t_start + T_sub] the velocity is exactly zero.
 *
 * @param {number[]} t          Time array (s)
 * @param {number}   t_start    Submovement onset (s)
 * @param {number}   T_sub      Submovement duration (s)
 * @param {number}   [amplitude=1]  Total displacement (position change, a.u.)
 * @returns {number[]}
 */
export function mjtVelocity(t, t_start, T_sub, amplitude = 1) {
  return t.map(ti => {
    const tau = (ti - t_start) / T_sub;
    if (tau < 0 || tau > 1) return 0;
    return (amplitude / T_sub) * (30 * tau ** 2 - 60 * tau ** 3 + 30 * tau ** 4);
  });
}

/**
 * Evaluate a Gaussian velocity submovement on a time array.
 *
 * v(t) = amplitude · exp(−0.5 · ((t − mu) / sigma)²)
 *
 * Unlike MJT, the Gaussian does not go to zero at the boundaries of the
 * submovement window; its tails extend (exponentially small) to ±∞.
 * A practical choice is sigma = T_sub / 6 so that the bell is contained
 * within ±3σ = ±T_sub/2 around the peak.
 *
 * @param {number[]} t          Time array (s)
 * @param {number}   mu         Peak time (s)
 * @param {number}   sigma      Width (s); one standard deviation
 * @param {number}   [amplitude=1]  Peak speed (a.u.)
 * @returns {number[]}
 */
export function gaussianVelocity(t, mu, sigma, amplitude = 1) {
  const inv2s2 = 0.5 / (sigma * sigma);
  return t.map(ti => amplitude * Math.exp(-inv2s2 * (ti - mu) ** 2));
}

// ---------------------------------------------------------------------------
// Onset / offset detection  (threshold-based, for unknown/noisy movements)
// ---------------------------------------------------------------------------

/**
 * Find movement onset and offset indices via an amplitude threshold.
 *
 * For simulated movements where timing is exactly known, prefer supplying
 * onset/offset directly from the simulation parameters.
 *
 * @param {number[]} velocity
 * @param {number}   [ampThreshold=0.05]  Fraction of peak speed
 * @returns {{ onset: number, offset: number, vPeak: number }}
 *   onset   Start time (s)
 *   offset  End time (s)
 */
export function findOnsetOffset(velocity, dt, ampThreshold = 0.05) {
  const N = velocity.length;
  const vPeak = Math.max(...velocity);
  const thresh = ampThreshold * vPeak;
  let i0 = 0, i1 = N - 1;
  for (let i = 0; i < N; i++)       if (velocity[i] >= thresh) { i0 = i; break; }
  for (let i = N - 1; i >= 0; i--)  if (velocity[i] >= thresh) { i1 = i; break; }
  return { onset: i0 * dt, offset: i1 * dt, vPeak };
}

// ---------------------------------------------------------------------------
// Jerk integrals
// ---------------------------------------------------------------------------

/**
 * Compute jerk integrals and displacement over the segment [onset, offset].
 *
 * Jerk at interior sample i (= d²v/dt² = d³x/dt³):
 *   j[i] = (v[i+1] − 2·v[i] + v[i−1]) / dt²
 *
 * The two boundary samples (i = onset, i = offset) are excluded from the
 * jerk sum because one neighbour lies outside the movement window.
 *
 * @param {number[]} velocity
 * @param {number}   dt        Sample interval (s)
 * @param {number}   onset     Start time of the movement (s)
 * @param {number}   offset    End time of the movement (s)
 * @returns {{ ISJ: number, IAJ: number, D: number, vPeak: number }}
 *   ISJ    ∫j² dt   integrated squared jerk
 *   IAJ    ∫|j| dt  integrated absolute jerk
 *   D      ∫v  dt   displacement
 *   vPeak           peak speed within segment
 */
export function computeJerkIntegrals(velocity, dt, onset, offset) {
  const N  = velocity.length;
  const i0 = Math.max(0,     Math.round(onset  / dt));
  const i1 = Math.min(N - 1, Math.round(offset / dt));
  let ISJ = 0, IAJ = 0, D = 0, vPeak = 0;

  for (let i = i0; i <= i1; i++) {
    D += velocity[i] * dt;
    if (velocity[i] > vPeak) vPeak = velocity[i];
  }
  for (let i = Math.max(1, i0); i <= Math.min(N - 2, i1); i++) {
    const j = (velocity[i + 1] - 2 * velocity[i] + velocity[i - 1]) / (dt * dt);
    ISJ += j * j * dt;
    IAJ += Math.abs(j) * dt;
  }
  return { ISJ, IAJ, D, vPeak };
}

// ---------------------------------------------------------------------------
// Individual jerk measures
// ---------------------------------------------------------------------------

/**
 * Mean jerk normalised by duration and peak speed.
 *   MJ = −(IAJ / T) / v_peak
 * @param {number} IAJ    ∫|j| dt
 * @param {number} T      Movement duration (s)  ← supply from simulation
 * @param {number} vPeak  Peak speed (a.u.)
 * @returns {number}
 */
export function computeMJ(IAJ, T, vPeak) {
  return -(IAJ / T) / vPeak;
}

/**
 * Dimensionless jerk (negated: more smooth → larger value).
 *   DLJ = −(T³ / v_peak²) · ISJ
 * @param {number} ISJ    ∫j² dt
 * @param {number} T      Movement duration (s)  ← supply from simulation
 * @param {number} vPeak  Peak speed (a.u.)
 * @returns {number}
 */
export function computeDLJ(ISJ, T, vPeak) {
  return -((T ** 3 / vPeak ** 2) * ISJ);
}

/**
 * Log dimensionless jerk.
 *   LDLJ = −log((T³ / v_peak²) · ISJ)
 * @param {number} ISJ    ∫j² dt
 * @param {number} T      Movement duration (s)  ← supply from simulation
 * @param {number} vPeak  Peak speed (a.u.)
 * @returns {number}
 */
export function computeLDLJ(ISJ, T, vPeak) {
  return -Math.log((T ** 3 / vPeak ** 2) * ISJ);
}

/**
 * Square-root dimensionless jerk.
 *   SDLJ = −√((T³ / v_peak²) · ISJ)
 * @param {number} ISJ    ∫j² dt
 * @param {number} T      Movement duration (s)  ← supply from simulation
 * @param {number} vPeak  Peak speed (a.u.)
 * @returns {number}
 */
export function computeSDLJ(ISJ, T, vPeak) {
  return -Math.sqrt((T ** 3 / vPeak ** 2) * ISJ);
}

// ---------------------------------------------------------------------------
// Convenience wrapper
// ---------------------------------------------------------------------------

/**
 * Compute all four jerk measures from a velocity signal.
 *
 * onset, offset, and T must come from simulation parameters, not from
 * threshold detection, because T strongly influences the measure values.
 *
 * @param {number[]} velocity
 * @param {number}   dt        Sample interval (s)
 * @param {number}   onset     Movement start time (s)  ← supply from simulation
 * @param {number}   offset    Movement end time (s)    ← supply from simulation
 * @param {number}   T         Exact movement duration (s)
 * @returns {{
 *   mj: number, dlj: number, ldlj: number, sdlj: number,
 *   ISJ: number, IAJ: number, D: number, vPeak: number
 * }}
 */
export function computeAllMeasures(velocity, dt, onset, offset, T) {
  const { ISJ, IAJ, D, vPeak } = computeJerkIntegrals(velocity, dt, onset, offset);
  return {
    mj:   computeMJ(IAJ, T, vPeak),
    dlj:  computeDLJ(ISJ, T, vPeak),
    ldlj: computeLDLJ(ISJ, T, vPeak),
    sdlj: computeSDLJ(ISJ, T, vPeak),
    ISJ, IAJ, D, vPeak,
  };
}

// ---------------------------------------------------------------------------
// Noise and filtering utilities  (reusable across noise simulation pages)
// ---------------------------------------------------------------------------

/**
 * Draw one sample from a standard normal distribution (Box-Muller transform).
 * @returns {number}
 */
export function randn() {
  let u;
  do { u = Math.random(); } while (u === 0);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random());
}

/**
 * Compute coefficients for a 2nd-order Butterworth low-pass filter.
 * Uses the bilinear transform with pre-warping: wc = tan(π·fc/fs).
 *
 * @param {number} fc  Cut-off frequency (Hz)
 * @param {number} fs  Sample rate (Hz)
 * @returns {{ b: number[], a: number[] }}
 */
export function butter2Coeffs(fc, fs) {
  const wc  = Math.tan(Math.PI * fc / fs);
  const wc2 = wc * wc;
  const k   = 1 + Math.SQRT2 * wc + wc2;
  return {
    b: [wc2 / k, 2 * wc2 / k, wc2 / k],
    a: [1, 2 * (wc2 - 1) / k, (1 - Math.SQRT2 * wc + wc2) / k],
  };
}

/**
 * Apply a 2nd-order IIR filter (causal, single forward pass).
 * @param {number[]} b  Feed-forward coefficients (length 3)
 * @param {number[]} a  Feedback coefficients     (length 3, a[0] = 1)
 * @param {number[]} x  Input signal
 * @returns {number[]}
 */
export function applyIIR(b, a, x) {
  const y = new Array(x.length).fill(0);
  for (let n = 0; n < x.length; n++) {
    y[n] = b[0] * x[n];
    if (n >= 1) y[n] += b[1] * x[n - 1] - a[1] * y[n - 1];
    if (n >= 2) y[n] += b[2] * x[n - 2] - a[2] * y[n - 2];
  }
  return y;
}

/**
 * Zero-lag (forward–backward) IIR filter with odd-reflection end padding.
 * Mirrors scipy.signal.filtfilt with default settings.
 *
 * @param {number[]} b  Feed-forward coefficients
 * @param {number[]} a  Feedback coefficients
 * @param {number[]} x  Input signal
 * @returns {number[]}
 */
export function filtfilt(b, a, x) {
  const pad = Math.min(Math.floor(x.length / 4), 30);
  const px  = [];
  for (let i = pad; i >= 1; i--) px.push(2 * x[0] - x[Math.min(i, x.length - 1)]);
  for (const v of x) px.push(v);
  for (let i = x.length - 2; i >= x.length - 1 - pad; i--) px.push(2 * x[x.length - 1] - x[Math.max(0, i)]);
  let y = applyIIR(b, a, px);
  y = [...y].reverse();
  y = applyIIR(b, a, y);
  y = [...y].reverse();
  return y.slice(pad, pad + x.length);
}
