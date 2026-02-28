/**
 * Find the N worst (lowest-scoring) non-overlapping time windows in session data.
 *
 * Algorithm:
 * 1. Compute a rolling average over a sliding window of `windowSamples` samples
 * 2. Find the window with the absolute lowest average score
 * 3. Mark that window (+ guard zone) as used
 * 4. Repeat for the next worst, skipping overlapping windows
 *
 * @param {Array} sessionData - Array of comparison results with { overall, timestamp, videoTime, refPose, userPose }
 * @param {number} count - Number of worst moments to find (default 3)
 * @param {number} windowSec - Window duration in seconds (default 3)
 * @returns {Array} Array of { startVideoTime, endVideoTime, avgScore, samples, centerIndex }
 */
export function findWorstMoments(sessionData, count = 3, windowSec = 3) {
    if (!sessionData || sessionData.length < 5) return [];

    // Filter to only entries that have videoTime and pose data
    const validData = sessionData.filter(d =>
        d.videoTime !== undefined && d.refPose && d.userPose
    );

    if (validData.length < 5) return [];

    // Estimate sample rate from timestamps
    const totalDurationMs = validData[validData.length - 1].timestamp - validData[0].timestamp;
    const avgSampleIntervalMs = totalDurationMs / (validData.length - 1);
    const windowSamples = Math.max(3, Math.round((windowSec * 1000) / avgSampleIntervalMs));

    // Compute rolling averages
    const rollingAvgs = [];
    for (let i = 0; i <= validData.length - windowSamples; i++) {
        const window = validData.slice(i, i + windowSamples);
        const avg = window.reduce((sum, d) => sum + d.overall, 0) / window.length;
        rollingAvgs.push({
            index: i,
            avg,
            startVideoTime: window[0].videoTime,
            endVideoTime: window[window.length - 1].videoTime,
            samples: window,
        });
    }

    if (rollingAvgs.length === 0) return [];

    // Sort by score ascending (worst first)
    rollingAvgs.sort((a, b) => a.avg - b.avg);

    // Pick non-overlapping windows
    const results = [];
    const usedIndices = new Set();
    const guardZone = Math.max(windowSamples, Math.round(windowSamples * 1.5)); // prevent overlap

    for (const candidate of rollingAvgs) {
        if (results.length >= count) break;

        // Check if this window overlaps with any already selected
        let overlaps = false;
        for (let i = candidate.index; i < candidate.index + windowSamples; i++) {
            if (usedIndices.has(i)) {
                overlaps = true;
                break;
            }
        }
        if (overlaps) continue;

        // Mark indices as used (with guard zone)
        for (let i = Math.max(0, candidate.index - guardZone); i < Math.min(validData.length, candidate.index + windowSamples + guardZone); i++) {
            usedIndices.add(i);
        }

        const centerIndex = candidate.index + Math.floor(windowSamples / 2);

        results.push({
            startVideoTime: candidate.startVideoTime,
            endVideoTime: candidate.endVideoTime,
            avgScore: Math.round(candidate.avg * 10) / 10,
            samples: candidate.samples,
            centerIndex,
        });
    }

    // Sort results chronologically
    results.sort((a, b) => a.startVideoTime - b.startVideoTime);

    return results;
}
