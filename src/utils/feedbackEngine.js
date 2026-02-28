/**
 * Feedback Engine — Generates grouped, actionable feedback from session data.
 */

import { BODY_SEGMENTS } from './poseSimilarity';

export function analyzeSession(sessionData) {
    if (!sessionData || sessionData.length < 3) {
        return { overallGrade: 'N/A', focusAreas: [], strengths: [], timeline: [], tips: [] };
    }

    const segmentStats = {};
    for (const key of Object.keys(BODY_SEGMENTS)) {
        const scores = sessionData.map(d => d.segments[key]).filter(v => v !== null);
        if (scores.length === 0) continue;

        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        const min = Math.min(...scores);
        const max = Math.max(...scores);
        const struggles = findStruggles(scores, 50, 5);
        const firstHalf = scores.slice(0, Math.floor(scores.length / 2));
        const secondHalf = scores.slice(Math.floor(scores.length / 2));
        const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

        segmentStats[key] = {
            avg, min, max, trend: secondAvg - firstAvg, struggles,
            label: BODY_SEGMENTS[key].label,
            emoji: BODY_SEGMENTS[key].emoji,
            consistency: 100 - (standardDeviation(scores) * 2),
        };
    }

    const sorted = Object.entries(segmentStats).sort((a, b) => a[1].avg - b[1].avg);
    const focusAreas = sorted
        .filter(([_, s]) => s.avg < 70)
        .map(([key, s]) => ({
            segment: key, ...s,
            feedback: generateSegmentFeedback(key, s),
            exercises: generateExercises(key),
        }));

    const strengths = sorted
        .filter(([_, s]) => s.avg >= 70)
        .reverse()
        .map(([key, s]) => ({
            segment: key, ...s,
            feedback: s.avg >= 85
                ? `Your ${s.label.toLowerCase()} positioning is excellent!`
                : `Your ${s.label.toLowerCase()} is good overall — minor adjustments would make it perfect.`,
        }));

    const overallScores = sessionData.map(d => d.overall);
    const overallAvg = overallScores.reduce((a, b) => a + b, 0) / overallScores.length;
    const overallGrade = getGrade(overallAvg);
    const timeline = analyzeTimeline(sessionData);
    const tips = generateTopTips(focusAreas, segmentStats, overallAvg);

    return { overallGrade, overallAvg, focusAreas, strengths, timeline, tips, segmentStats };
}

function generateSegmentFeedback(segKey, stats) {
    const label = stats.label.toLowerCase();
    const lines = [];
    if (stats.avg < 40) lines.push(`Your ${label} positioning was significantly different from the reference.`);
    else if (stats.avg < 55) lines.push(`Your ${label} needs considerable work.`);
    else lines.push(`Your ${label} was close but not consistently matching.`);

    if (stats.struggles.length > 0) lines.push(`There were ${stats.struggles.length} periods where your ${label} dropped below 50%.`);
    if (stats.trend > 5) lines.push(`Good news: your ${label} improved (+${Math.round(stats.trend)}% in second half).`);
    else if (stats.trend < -5) lines.push(`Your ${label} accuracy dropped towards the end.`);

    const specifics = {
        leftArm: 'Focus on matching the extension and angle of your left arm.',
        rightArm: 'Pay attention to your right arm\'s reach and angle.',
        leftLeg: 'Your left leg placement and kick height may need work.',
        rightLeg: 'Right leg positioning — check kick height, step width, or knee bend.',
        torso: 'Torso alignment is the foundation. Keep your core aligned with the reference.',
        head: 'Head position affects the overall look. Match your gaze and head angle.',
    };
    if (specifics[segKey]) lines.push(specifics[segKey]);
    return lines;
}

function generateExercises(segKey) {
    const exercises = {
        leftArm: [{ name: 'Arm Isolation Drill', desc: 'Practice arm movements at 0.5× speed' }, { name: 'Mirror Matching', desc: 'Pause and match arm position exactly' }],
        rightArm: [{ name: 'Arm Isolation Drill', desc: 'Practice arm movements at 0.5× speed' }, { name: 'Position Holds', desc: 'Freeze at trickiest arm positions for 5s each' }],
        leftLeg: [{ name: 'Footwork Breakdown', desc: 'Practice leg movements without arms at half speed' }, { name: 'Kick Height Check', desc: 'Compare kick height against reference' }],
        rightLeg: [{ name: 'Step Width Practice', desc: 'Focus on matching width and depth of each step' }, { name: 'Slow-Mo Leg Drill', desc: 'Run reference at 0.5× for right leg only' }],
        torso: [{ name: 'Core Alignment Check', desc: 'Dance while watching skeleton — keep torso lines green' }, { name: 'Hip-Shoulder Sync', desc: 'Rotate hips and shoulders together' }],
        head: [{ name: 'Head Position Awareness', desc: 'Practice with fixed gaze matching reference' }, { name: 'Posture Check', desc: 'Keep chin level and head centered' }],
    };
    return exercises[segKey] || [{ name: 'Slow Practice', desc: 'Practice at 0.5× speed' }];
}

function analyzeTimeline(sessionData) {
    const chunkSize = Math.max(1, Math.floor(sessionData.length / 4));
    const phases = [];
    for (let i = 0; i < sessionData.length; i += chunkSize) {
        const chunk = sessionData.slice(i, i + chunkSize);
        const avg = chunk.reduce((a, d) => a + d.overall, 0) / chunk.length;
        const startSec = Math.round((chunk[0].timestamp - sessionData[0].timestamp) / 1000);
        const endSec = Math.round((chunk[chunk.length - 1].timestamp - sessionData[0].timestamp) / 1000);

        const segTotals = {};
        for (const d of chunk) {
            for (const [k, v] of Object.entries(d.segments)) {
                if (v === null) continue;
                segTotals[k] = segTotals[k] || [];
                segTotals[k].push(v);
            }
        }
        let weakest = null, weakestAvg = 100;
        for (const [k, vals] of Object.entries(segTotals)) {
            const a = vals.reduce((s, v) => s + v, 0) / vals.length;
            if (a < weakestAvg) { weakestAvg = a; weakest = k; }
        }
        phases.push({ label: `${startSec}s–${endSec}s`, avg: Math.round(avg), weakestSegment: weakest ? BODY_SEGMENTS[weakest]?.label : null, weakestScore: Math.round(weakestAvg) });
    }
    return phases;
}

function generateTopTips(focusAreas, segmentStats, overallAvg) {
    const tips = [];
    if (focusAreas.length === 0) {
        tips.push({ icon: '🌟', text: 'Amazing work! All body parts are matching well. Try increasing the speed or a harder routine.' });
        return tips;
    }
    if (focusAreas.length >= 3) tips.push({ icon: '🎯', text: 'Multiple areas need work. Focus on ONE body part at a time at half speed.' });
    const worst = focusAreas[0];
    tips.push({ icon: '⚡', text: `Priority fix: your ${worst.label.toLowerCase()} (${Math.round(worst.avg)}%). Slow to 0.5× and practice just this area.` });

    const improving = Object.entries(segmentStats).filter(([_, s]) => s.trend > 8).map(([k, s]) => s.label);
    if (improving.length > 0) tips.push({ icon: '📈', text: `Your ${improving.join(' and ')} improved during the session!` });

    const declining = Object.entries(segmentStats).filter(([_, s]) => s.trend < -8).map(([k, s]) => s.label);
    if (declining.length > 0) tips.push({ icon: '💤', text: `Your ${declining.join(' and ')} got worse towards the end — take a break.` });

    tips.push({ icon: '💡', text: 'Pro tip: Use mirror mode if the reference dancer faces you. Use speed controls to slow down.' });
    return tips.slice(0, 5);
}

function findStruggles(scores, threshold, minLength) {
    const struggles = [];
    let start = null;
    for (let i = 0; i < scores.length; i++) {
        if (scores[i] < threshold) { if (start === null) start = i; }
        else { if (start !== null && (i - start) >= minLength) struggles.push({ start, end: i - 1 }); start = null; }
    }
    if (start !== null && (scores.length - start) >= minLength) struggles.push({ start, end: scores.length - 1 });
    return struggles;
}

function standardDeviation(arr) {
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    return Math.sqrt(arr.reduce((a, v) => a + (v - mean) ** 2, 0) / arr.length);
}

function getGrade(score) {
    if (score >= 90) return { letter: 'S', label: 'Superstar!', color: '#22c55e' };
    if (score >= 80) return { letter: 'A', label: 'Excellent', color: '#84cc16' };
    if (score >= 70) return { letter: 'B', label: 'Good Work', color: '#38bdf8' };
    if (score >= 60) return { letter: 'C', label: 'Getting There', color: '#f59e0b' };
    if (score >= 50) return { letter: 'D', label: 'Keep Practicing', color: '#f97316' };
    return { letter: 'F', label: 'Beginner — Keep Going!', color: '#ef4444' };
}
