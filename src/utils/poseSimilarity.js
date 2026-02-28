/**
 * Pose Similarity Scorer — Cosine similarity between normalized limb vectors.
 */

import { normalizePose } from './poseNormalizer';

export const BODY_SEGMENTS = {
    leftArm: { pairs: [[11, 13], [13, 15]], label: 'Left Arm', weight: 1.5, emoji: '💪' },
    rightArm: { pairs: [[12, 14], [14, 16]], label: 'Right Arm', weight: 1.5, emoji: '💪' },
    leftLeg: { pairs: [[23, 25], [25, 27]], label: 'Left Leg', weight: 1.5, emoji: '🦵' },
    rightLeg: { pairs: [[24, 26], [26, 28]], label: 'Right Leg', weight: 1.5, emoji: '🦵' },
    torso: { pairs: [[11, 12], [11, 23], [12, 24], [23, 24]], label: 'Torso', weight: 1.0, emoji: '🫁' },
    head: { pairs: [[0, 11], [0, 12]], label: 'Head', weight: 0.5, emoji: '🗣️' },
};

function vecBetween(a, b) {
    return { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
}

function cosineSim(v1, v2) {
    const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
    const mag1 = Math.sqrt(v1.x ** 2 + v1.y ** 2 + v1.z ** 2);
    const mag2 = Math.sqrt(v2.x ** 2 + v2.y ** 2 + v2.z ** 2);
    if (mag1 < 0.0001 || mag2 < 0.0001) return 0;
    return dot / (mag1 * mag2);
}

export function comparePoses(refLandmarks, userLandmarks) {
    const refNorm = normalizePose(refLandmarks);
    const userNorm = normalizePose(userLandmarks);

    if (!refNorm || !userNorm) return null;

    const segmentScores = {};

    for (const [name, seg] of Object.entries(BODY_SEGMENTS)) {
        let totalSim = 0;
        let validPairs = 0;

        for (const [a, b] of seg.pairs) {
            const minVis = Math.min(
                refNorm[a].visibility, refNorm[b].visibility,
                userNorm[a].visibility, userNorm[b].visibility
            );
            if (minVis < 0.4) continue;

            const refVec = vecBetween(refNorm[a], refNorm[b]);
            const userVec = vecBetween(userNorm[a], userNorm[b]);
            totalSim += cosineSim(refVec, userVec);
            validPairs++;
        }

        segmentScores[name] = validPairs === 0
            ? null
            : Math.max(0, Math.min(100, ((totalSim / validPairs + 1) / 2) * 100));
    }

    let weightedSum = 0;
    let weightTotal = 0;
    for (const [name, score] of Object.entries(segmentScores)) {
        if (score === null) continue;
        const weight = BODY_SEGMENTS[name].weight;
        weightedSum += score * weight;
        weightTotal += weight;
    }

    return {
        overall: weightTotal > 0 ? Math.round((weightedSum / weightTotal) * 10) / 10 : 0,
        segments: segmentScores,
        timestamp: Date.now()
    };
}

export function scoreToColor(score) {
    if (score === null) return '#64748b';
    if (score >= 85) return '#22c55e';
    if (score >= 70) return '#84cc16';
    if (score >= 55) return '#f59e0b';
    if (score >= 40) return '#f97316';
    return '#ef4444';
}

export function scoreToLabel(score) {
    if (score === null) return 'N/A';
    if (score >= 85) return 'Perfect!';
    if (score >= 70) return 'Good';
    if (score >= 55) return 'Close';
    if (score >= 40) return 'Off';
    return 'Way Off';
}

export function scoreToGrade(score) {
    if (score === null) return '—';
    if (score >= 90) return 'S';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'F';
}
