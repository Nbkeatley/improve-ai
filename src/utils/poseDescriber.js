/**
 * PoseScript-style Posecode Engine
 * 
 * Extracts meaningful pose descriptions from MediaPipe 33-keypoint landmarks
 * by computing joint angles, relative positions, and spatial relationships.
 * Inspired by the PoseScript paper (ECCV 2022) posecode extraction approach.
 * 
 * Works with normalized or raw landmarks (x, y, z, visibility).
 */

// MediaPipe landmark indices
const LM = {
    NOSE: 0,
    LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
    LEFT_ELBOW: 13, RIGHT_ELBOW: 14,
    LEFT_WRIST: 15, RIGHT_WRIST: 16,
    LEFT_HIP: 23, RIGHT_HIP: 24,
    LEFT_KNEE: 25, RIGHT_KNEE: 26,
    LEFT_ANKLE: 27, RIGHT_ANKLE: 28,
};

function angle3(a, b, c) {
    const ba = { x: a.x - b.x, y: a.y - b.y };
    const bc = { x: c.x - b.x, y: c.y - b.y };
    const dot = ba.x * bc.x + ba.y * bc.y;
    const magBA = Math.sqrt(ba.x ** 2 + ba.y ** 2);
    const magBC = Math.sqrt(bc.x ** 2 + bc.y ** 2);
    if (magBA < 0.001 || magBC < 0.001) return null;
    const cosAngle = Math.max(-1, Math.min(1, dot / (magBA * magBC)));
    return (Math.acos(cosAngle) * 180) / Math.PI;
}

function vis(lm, ...indices) {
    return indices.every(i => (lm[i]?.visibility || 0) >= 0.4);
}

function midY(lm, a, b) {
    return (lm[a].y + lm[b].y) / 2;
}

/**
 * Extract posecodes — structured pose features
 */
function extractPosecodes(landmarks) {
    if (!landmarks || landmarks.length < 33) return null;
    const lm = landmarks;
    const codes = [];

    // === ARM POSECODES ===
    for (const side of ['left', 'right']) {
        const S = side === 'left' ? LM.LEFT_SHOULDER : LM.RIGHT_SHOULDER;
        const E = side === 'left' ? LM.LEFT_ELBOW : LM.RIGHT_ELBOW;
        const W = side === 'left' ? LM.LEFT_WRIST : LM.RIGHT_WRIST;
        const H = side === 'left' ? LM.LEFT_HIP : LM.RIGHT_HIP;
        const label = side === 'left' ? 'Left arm' : 'Right arm';
        const seg = side === 'left' ? 'leftArm' : 'rightArm';

        if (!vis(lm, S, E, W)) continue;

        const elbowAngle = angle3(lm[S], lm[E], lm[W]);

        // Elbow bend
        if (elbowAngle !== null) {
            if (elbowAngle < 60) codes.push({ segment: seg, code: 'arm_tightly_bent', desc: `${label} is tightly bent at the elbow` });
            else if (elbowAngle < 100) codes.push({ segment: seg, code: 'arm_bent', desc: `${label} is bent at roughly 90°` });
            else if (elbowAngle > 155) codes.push({ segment: seg, code: 'arm_straight', desc: `${label} is fully extended` });
        }

        // Arm height relative to shoulder
        if (lm[W].y < lm[S].y - 0.05) {
            if (lm[W].y < lm[LM.NOSE].y) codes.push({ segment: seg, code: 'arm_overhead', desc: `${label} is raised overhead` });
            else codes.push({ segment: seg, code: 'arm_raised', desc: `${label} is raised above shoulder level` });
        } else if (lm[W].y > lm[H].y) {
            codes.push({ segment: seg, code: 'arm_dropped', desc: `${label} is hanging down by the side` });
        }

        // Arm extension outward (horizontal)
        const xDist = Math.abs(lm[W].x - lm[S].x);
        if (xDist > 0.15 && Math.abs(lm[W].y - lm[S].y) < 0.08) {
            codes.push({ segment: seg, code: 'arm_extended_sideways', desc: `${label} is extended out to the side` });
        }

        // Hand crossing body midline
        const midX = (lm[LM.LEFT_SHOULDER].x + lm[LM.RIGHT_SHOULDER].x) / 2;
        if (side === 'left' && lm[W].x > midX + 0.05) {
            codes.push({ segment: seg, code: 'arm_crossed', desc: `${label} is crossed over the body` });
        }
        if (side === 'right' && lm[W].x < midX - 0.05) {
            codes.push({ segment: seg, code: 'arm_crossed', desc: `${label} is crossed over the body` });
        }
    }

    // === LEG POSECODES ===
    for (const side of ['left', 'right']) {
        const H = side === 'left' ? LM.LEFT_HIP : LM.RIGHT_HIP;
        const K = side === 'left' ? LM.LEFT_KNEE : LM.RIGHT_KNEE;
        const A = side === 'left' ? LM.LEFT_ANKLE : LM.RIGHT_ANKLE;
        const label = side === 'left' ? 'Left leg' : 'Right leg';
        const seg = side === 'left' ? 'leftLeg' : 'rightLeg';

        if (!vis(lm, H, K, A)) continue;

        const kneeAngle = angle3(lm[H], lm[K], lm[A]);

        if (kneeAngle !== null) {
            if (kneeAngle < 90) codes.push({ segment: seg, code: 'knee_deep_bend', desc: `${label} is deeply bent (plié/squat position)` });
            else if (kneeAngle < 140) codes.push({ segment: seg, code: 'knee_bent', desc: `${label} has a bent knee` });
            else if (kneeAngle > 165) codes.push({ segment: seg, code: 'leg_straight', desc: `${label} is straight and extended` });
        }

        // Leg raised (knee above hip height is impressive)
        if (lm[K].y < lm[H].y - 0.03) {
            codes.push({ segment: seg, code: 'leg_raised', desc: `${label} is raised with knee above hip level` });
        }

        // Leg extended sideways
        const hipMidX = (lm[LM.LEFT_HIP].x + lm[LM.RIGHT_HIP].x) / 2;
        const legSpread = Math.abs(lm[A].x - hipMidX);
        if (legSpread > 0.15) {
            codes.push({ segment: seg, code: 'leg_spread', desc: `${label} is extended outward (wide stance)` });
        }
    }

    // === TORSO POSECODES ===
    if (vis(lm, LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_HIP, LM.RIGHT_HIP)) {
        const shoulderMidY = midY(lm, LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER);
        const hipMidY = midY(lm, LM.LEFT_HIP, LM.RIGHT_HIP);
        const shoulderMidX = (lm[LM.LEFT_SHOULDER].x + lm[LM.RIGHT_SHOULDER].x) / 2;
        const hipMidX = (lm[LM.LEFT_HIP].x + lm[LM.RIGHT_HIP].x) / 2;

        // Forward/backward lean
        const xTilt = shoulderMidX - hipMidX;
        if (Math.abs(xTilt) > 0.04) {
            codes.push({
                segment: 'torso',
                code: xTilt > 0 ? 'torso_lean_right' : 'torso_lean_left',
                desc: `Torso is leaning to the ${xTilt > 0 ? 'right' : 'left'}`
            });
        }

        // Shoulder tilt
        const shoulderTilt = lm[LM.LEFT_SHOULDER].y - lm[LM.RIGHT_SHOULDER].y;
        if (Math.abs(shoulderTilt) > 0.04) {
            codes.push({
                segment: 'torso',
                code: 'shoulders_tilted',
                desc: `Shoulders are tilted (${shoulderTilt > 0 ? 'left shoulder lower' : 'right shoulder lower'})`
            });
        }

        // Compact/crouching posture
        const torsoHeight = Math.abs(hipMidY - shoulderMidY);
        if (torsoHeight < 0.08) {
            codes.push({ segment: 'torso', code: 'torso_compact', desc: 'Body is in a compact/crouched position' });
        }
    }

    // === HEAD POSECODES ===
    if (vis(lm, LM.NOSE, LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER)) {
        const shoulderMidX = (lm[LM.LEFT_SHOULDER].x + lm[LM.RIGHT_SHOULDER].x) / 2;
        const shoulderMidY_ = midY(lm, LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER);

        const headTiltX = lm[LM.NOSE].x - shoulderMidX;
        if (Math.abs(headTiltX) > 0.05) {
            codes.push({
                segment: 'head',
                code: 'head_tilted',
                desc: `Head is tilted to the ${headTiltX > 0 ? 'right' : 'left'}`
            });
        }

        // Head dropped/tucked
        if (lm[LM.NOSE].y > shoulderMidY_ + 0.02) {
            codes.push({ segment: 'head', code: 'head_dropped', desc: 'Head is dropped/looking down' });
        }
    }

    return codes;
}

/**
 * Compare ref and user posecodes and generate descriptive feedback
 * Returns an object with:
 *   - descriptions: Array of {segment, text} for display
 *   - posecodes: Raw posecodes for both ref and user (for LLM context)
 */
export function describePoseDifference(refLandmarks, userLandmarks) {
    const refCodes = extractPosecodes(refLandmarks);
    const userCodes = extractPosecodes(userLandmarks);

    if (!refCodes || !userCodes) return null;

    const descriptions = [];

    // Find posecodes in ref but NOT in user (things user is missing)
    const userCodeSet = new Set(userCodes.map(c => `${c.segment}:${c.code}`));
    const refCodeSet = new Set(refCodes.map(c => `${c.segment}:${c.code}`));

    for (const rc of refCodes) {
        const key = `${rc.segment}:${rc.code}`;
        if (!userCodeSet.has(key)) {
            descriptions.push({
                segment: rc.segment,
                text: `Reference shows: ${rc.desc} — try to match this`,
                type: 'missing',
            });
        }
    }

    // Find posecodes in user but NOT in ref (things user is doing wrong)
    for (const uc of userCodes) {
        const key = `${uc.segment}:${uc.code}`;
        if (!refCodeSet.has(key)) {
            descriptions.push({
                segment: uc.segment,
                text: `Your pose: ${uc.desc} — but the reference doesn't do this here`,
                type: 'extra',
            });
        }
    }

    return {
        descriptions,
        refPosecodes: refCodes,
        userPosecodes: userCodes,
    };
}

/**
 * Generate a concise real-time coaching label for display overlay.
 * Returns the single most important feedback string, or null.
 */
export function getRealtimeCoachingLabel(refLandmarks, userLandmarks, segmentScores) {
    const diff = describePoseDifference(refLandmarks, userLandmarks);
    if (!diff || diff.descriptions.length === 0) return null;

    // Find the worst segment
    let worstSeg = null;
    let worstScore = 100;
    if (segmentScores) {
        for (const [key, score] of Object.entries(segmentScores)) {
            if (score !== null && score < worstScore) {
                worstScore = score;
                worstSeg = key;
            }
        }
    }

    // Prioritize feedback for the worst segment
    if (worstSeg && worstScore < 70) {
        const segFeedback = diff.descriptions.find(d => d.segment === worstSeg);
        if (segFeedback) return segFeedback.text;
    }

    // Otherwise return the first mismatch
    return diff.descriptions[0]?.text || null;
}

/**
 * Get a compact voice-friendly coaching cue (for speech synthesis)
 */
export function getVoiceCoachingCue(refLandmarks, userLandmarks, segmentScores) {
    const diff = describePoseDifference(refLandmarks, userLandmarks);
    if (!diff || diff.descriptions.length === 0) return null;

    // Find worst segment feedback
    let worstSeg = null;
    let worstScore = 100;
    if (segmentScores) {
        for (const [key, score] of Object.entries(segmentScores)) {
            if (score !== null && score < worstScore) {
                worstScore = score;
                worstSeg = key;
            }
        }
    }

    // Build a voice-friendly cue from ref posecodes for the worst segment
    if (worstSeg) {
        const refForSeg = diff.refPosecodes.filter(c => c.segment === worstSeg);
        if (refForSeg.length > 0) {
            // Take the most specific posecode
            return refForSeg[0].desc;
        }
    }

    return diff.descriptions[0]?.text || null;
}

/**
 * Serialize posecodes for a moment into a compact text summary for LLM context.
 */
export function serializePosecodesForLLM(refLandmarks, userLandmarks) {
    const diff = describePoseDifference(refLandmarks, userLandmarks);
    if (!diff) return '';

    const lines = [];
    if (diff.refPosecodes.length > 0) {
        lines.push('Reference pose: ' + diff.refPosecodes.map(c => c.desc).join('; '));
    }
    if (diff.userPosecodes.length > 0) {
        lines.push('Your pose: ' + diff.userPosecodes.map(c => c.desc).join('; '));
    }
    if (diff.descriptions.length > 0) {
        lines.push('Differences: ' + diff.descriptions.map(d => d.text).join('; '));
    }
    return lines.join('\n');
}
