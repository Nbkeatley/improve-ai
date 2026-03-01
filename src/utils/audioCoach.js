/**
 * Audio Coach — Real-time voice feedback using Web Speech API
 */

const COOLDOWN_MS = 4000;
const SCORE_THRESHOLD_SPEAK = 55;
const SCORE_THRESHOLD_PRAISE = 85;

let lastSpeakTime = 0;
let lastSpokenSegment = null;
let enabled = true;

const SEGMENT_TO_JOINTS = {
    leftArm: { primary: [15, 13], label: 'left arm' },
    rightArm: { primary: [16, 14], label: 'right arm' },
    leftLeg: { primary: [27, 25], label: 'left leg' },
    rightLeg: { primary: [28, 26], label: 'right leg' },
    torso: { primary: [11, 23], label: 'torso' },
    head: { primary: [0, 11], label: 'head' },
};

function analyzeDifference(refLandmarks, userLandmarks, segmentKey) {
    const seg = SEGMENT_TO_JOINTS[segmentKey];
    if (!seg) return null;

    const [tipIdx, baseIdx] = seg.primary;
    const ref = refLandmarks[tipIdx];
    const user = userLandmarks[tipIdx];
    const refBase = refLandmarks[baseIdx];
    const userBase = userLandmarks[baseIdx];

    if (!ref || !user || !refBase || !userBase) return null;
    if ((ref.visibility || 0) < 0.4 || (user.visibility || 0) < 0.4) return null;

    const refRelY = ref.y - refBase.y;
    const userRelY = user.y - userBase.y;
    const refRelX = ref.x - refBase.x;
    const userRelX = user.x - userBase.x;

    const yDiff = userRelY - refRelY;
    const xDiff = userRelX - refRelX;
    const label = seg.label;
    const absY = Math.abs(yDiff);
    const absX = Math.abs(xDiff);

    if (absY > absX && absY > 0.04) {
        return yDiff > 0 ? `Raise your ${label} higher` : `Lower your ${label} a bit`;
    } else if (absX > 0.04) {
        return xDiff > 0 ? `Bring your ${label} more to the left` : `Extend your ${label} more to the right`;
    }
    return `Adjust your ${label} position`;
}

export function generateVoiceCue(comparison, refLandmarks, userLandmarks, posecodeVoiceCue) {
    if (!enabled || !comparison) return;
    const now = Date.now();
    if (now - lastSpeakTime < COOLDOWN_MS) return;

    let worstSeg = null;
    let worstScore = 100;
    for (const [key, score] of Object.entries(comparison.segments)) {
        if (score === null) continue;
        if (score < worstScore) { worstScore = score; worstSeg = key; }
    }

    if (worstScore >= SCORE_THRESHOLD_SPEAK) {
        if (comparison.overall >= SCORE_THRESHOLD_PRAISE && now - lastSpeakTime > 8000) {
            speak("Great form! You're nailing it!");
            lastSpeakTime = now;
        }
        return;
    }

    if (worstSeg === lastSpokenSegment && now - lastSpeakTime < COOLDOWN_MS * 2) return;

    // Prefer PoseScript-style voice cue over simple directional feedback
    let message = posecodeVoiceCue || null;
    if (!message && refLandmarks && userLandmarks) {
        message = analyzeDifference(refLandmarks, userLandmarks, worstSeg);
    }
    if (!message) {
        const label = SEGMENT_TO_JOINTS[worstSeg]?.label || worstSeg;
        message = `Watch your ${label}`;
    }

    speak(message);
    lastSpeakTime = now;
    lastSpokenSegment = worstSeg;
}

function speak(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    utterance.pitch = 1.0;
    utterance.volume = 0.85;
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v =>
        v.name.includes('Samantha') || v.name.includes('Karen') ||
        v.name.includes('Daniel') || v.name.includes('Google')
    );
    if (preferred) utterance.voice = preferred;
    window.speechSynthesis.speak(utterance);
}

export function setAudioCoachEnabled(val) {
    enabled = val;
    if (!val) window.speechSynthesis?.cancel();
}

export function resetAudioCoach() {
    lastSpeakTime = 0;
    lastSpokenSegment = null;
    window.speechSynthesis?.cancel();
}
