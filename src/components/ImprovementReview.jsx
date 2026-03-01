import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { findWorstMoments } from '../utils/findWorstMoments';
import { drawSkeleton } from '../utils/skeletonRenderer';
import { scoreToColor } from '../utils/poseSimilarity';

/**
 * ImprovementReview — Shows the 3 worst moments side-by-side:
 * Left: reference video clip seeked to that timestamp
 * Right: user's stored skeleton wireframe rendered on canvas
 *
 * Each moment can be played as a short clip or paused.
 */
export default function ImprovementReview({ sessionData, videoFile }) {
    const worstMoments = useMemo(() => findWorstMoments(sessionData, 3, 3), [sessionData]);
    const [activeClip, setActiveClip] = useState(null); // index of currently playing clip

    if (!worstMoments || worstMoments.length === 0 || !videoFile) {
        return (
            <div className="card" style={{ marginBottom: '16px', padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <p>🎬 Improvement Review: Not enough pose data collected. Try a longer session (10+ seconds).</p>
            </div>
        );
    }

    return (
        <div style={{ marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '12px', color: '#f59e0b' }}>
                🎬 Top {worstMoments.length} Areas to Improve
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                These are the moments where your pose differed most from the reference. Compare your skeleton (right) with the reference video (left).
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {worstMoments.map((moment, idx) => (
                    <MomentCard
                        key={idx}
                        moment={moment}
                        index={idx}
                        videoFile={videoFile}
                        isActive={activeClip === idx}
                        onToggle={() => setActiveClip(activeClip === idx ? null : idx)}
                    />
                ))}
            </div>
        </div>
    );
}

function MomentCard({ moment, index, videoFile, isActive, onToggle }) {
    const videoRef = useRef(null);
    const userCanvasRef = useRef(null);
    const refCanvasRef = useRef(null);
    const rafRef = useRef(null);
    const [currentSampleIdx, setCurrentSampleIdx] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);

    const { startVideoTime, endVideoTime, avgScore, samples } = moment;

    // Set up video source
    useEffect(() => {
        if (!videoRef.current || !videoFile) return;
        const url = URL.createObjectURL(videoFile);
        videoRef.current.src = url;
        videoRef.current.currentTime = startVideoTime;
        return () => URL.revokeObjectURL(url);
    }, [videoFile, startVideoTime]);

    // Draw the user skeleton for the current sample
    const drawUserSkeleton = useCallback((sampleIdx) => {
        const canvas = userCanvasRef.current;
        if (!canvas || !samples[sampleIdx]) return;

        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;

        // Dark background
        ctx.fillStyle = '#0b0d1a';
        ctx.fillRect(0, 0, w, h);

        // Draw grid for context
        ctx.strokeStyle = 'rgba(165, 168, 208, 0.06)';
        ctx.lineWidth = 1;
        for (let x = 0; x < w; x += 40) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
        }
        for (let y = 0; y < h; y += 40) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        }

        // Draw user skeleton with score-based colors
        const sample = samples[sampleIdx];
        if (sample.userPose) {
            drawSkeleton(ctx, sample.userPose, w, h, sample.segments, '#ec4899');
        }

        // Score badge on canvas
        const score = Math.round(sample.overall);
        const color = scoreToColor(sample.overall);
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.roundRect?.(w - 80, 8, 72, 28, 8);
        ctx.fill();
        ctx.font = 'bold 14px Inter, sans-serif';
        ctx.fillStyle = color;
        ctx.textAlign = 'right';
        ctx.fillText(`${score}%`, w - 16, 28);
    }, [samples]);

    // Draw reference skeleton on canvas
    const drawRefSkeleton = useCallback((sampleIdx) => {
        const canvas = refCanvasRef.current;
        if (!canvas || !samples[sampleIdx]) return;

        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        const sample = samples[sampleIdx];
        if (sample.refPose) {
            drawSkeleton(ctx, sample.refPose, w, h, null, '#38bdf8');
        }
    }, [samples]);

    // Initial draw
    useEffect(() => {
        drawUserSkeleton(0);
        drawRefSkeleton(0);
    }, [drawUserSkeleton, drawRefSkeleton]);

    // Playback animation
    useEffect(() => {
        if (!isPlaying) {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            return;
        }

        let frameIdx = 0;
        const frameInterval = ((endVideoTime - startVideoTime) * 1000) / samples.length;
        let lastFrameTime = performance.now();

        // Start video playback
        if (videoRef.current) {
            videoRef.current.currentTime = startVideoTime;
            videoRef.current.play().catch(() => {});
        }

        const animate = (now) => {
            if (now - lastFrameTime >= frameInterval) {
                frameIdx = (frameIdx + 1) % samples.length;
                setCurrentSampleIdx(frameIdx);
                drawUserSkeleton(frameIdx);
                drawRefSkeleton(frameIdx);
                lastFrameTime = now;

                // Loop video
                if (frameIdx === 0 && videoRef.current) {
                    videoRef.current.currentTime = startVideoTime;
                }
            }
            rafRef.current = requestAnimationFrame(animate);
        };

        rafRef.current = requestAnimationFrame(animate);

        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            if (videoRef.current) videoRef.current.pause();
        };
    }, [isPlaying, startVideoTime, endVideoTime, samples, drawUserSkeleton, drawRefSkeleton]);

    // Stop video when clip ends
    useEffect(() => {
        if (!videoRef.current) return;
        const video = videoRef.current;
        const handleTimeUpdate = () => {
            if (video.currentTime >= endVideoTime) {
                video.currentTime = startVideoTime;
            }
        };
        video.addEventListener('timeupdate', handleTimeUpdate);
        return () => video.removeEventListener('timeupdate', handleTimeUpdate);
    }, [startVideoTime, endVideoTime]);

    const togglePlay = () => {
        setIsPlaying(!isPlaying);
        onToggle();
    };

    // Scrub through samples manually
    const handleScrub = (e) => {
        const idx = parseInt(e.target.value);
        setCurrentSampleIdx(idx);
        drawUserSkeleton(idx);
        drawRefSkeleton(idx);

        // Seek video to matching time
        if (videoRef.current && samples[idx]) {
            videoRef.current.currentTime = samples[idx].videoTime;
        }
    };

    const scoreColor = scoreToColor(avgScore);

    return (
        <div className="card" style={{ borderLeft: `3px solid ${scoreColor}` }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{
                        width: '28px', height: '28px', borderRadius: '50%',
                        background: scoreColor, color: '#fff', fontWeight: 800,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.85rem'
                    }}>
                        {index + 1}
                    </span>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                            Moment at {formatTime(startVideoTime)} – {formatTime(endVideoTime)}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            Average accuracy: <span style={{ color: scoreColor, fontWeight: 700 }}>{avgScore}%</span>
                        </div>
                    </div>
                </div>
                <button
                    className={`btn ${isPlaying ? 'btn-danger' : 'btn-primary'}`}
                    onClick={togglePlay}
                    style={{ padding: '6px 16px', fontSize: '0.85rem' }}
                >
                    {isPlaying ? '⏸ Pause' : '▶ Play Clip'}
                </button>
            </div>

            {/* Side-by-side comparison */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                {/* Reference video */}
                <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', background: '#000', aspectRatio: '16/10' }}>
                    <video
                        ref={videoRef}
                        playsInline
                        muted
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                    <canvas
                        ref={refCanvasRef}
                        width={640}
                        height={400}
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                    />
                    <span style={{
                        position: 'absolute', top: '8px', left: '8px',
                        padding: '2px 10px', borderRadius: '999px',
                        fontSize: '0.7rem', fontWeight: 600,
                        background: 'rgba(0,0,0,0.7)', color: '#38bdf8',
                        backdropFilter: 'blur(8px)'
                    }}>
                        📹 Reference
                    </span>
                </div>

                {/* User skeleton */}
                <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', background: '#0b0d1a', aspectRatio: '16/10' }}>
                    <canvas
                        ref={userCanvasRef}
                        width={640}
                        height={400}
                        style={{ width: '100%', height: '100%' }}
                    />
                    <span style={{
                        position: 'absolute', top: '8px', left: '8px',
                        padding: '2px 10px', borderRadius: '999px',
                        fontSize: '0.7rem', fontWeight: 600,
                        background: 'rgba(0,0,0,0.7)', color: '#ec4899',
                        backdropFilter: 'blur(8px)'
                    }}>
                        🎥 Your Pose
                    </span>
                </div>
            </div>

            {/* Scrubber */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    Frame {currentSampleIdx + 1}/{samples.length}
                </span>
                <input
                    type="range"
                    min={0}
                    max={samples.length - 1}
                    value={currentSampleIdx}
                    onChange={handleScrub}
                    style={{ flex: 1, accentColor: scoreColor }}
                />
                <span style={{ fontSize: '0.75rem', color: scoreColor, fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {Math.round(samples[currentSampleIdx]?.overall || 0)}%
                </span>
            </div>

            {/* Worst body parts in this moment */}
            <div style={{ marginTop: '10px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {getWorstSegments(samples).map((seg, i) => (
                    <span key={i} style={{
                        padding: '3px 10px', borderRadius: '999px',
                        fontSize: '0.72rem', fontWeight: 600,
                        background: `${scoreToColor(seg.avg)}20`,
                        color: scoreToColor(seg.avg),
                        border: `1px solid ${scoreToColor(seg.avg)}40`
                    }}>
                        {seg.emoji} {seg.label}: {Math.round(seg.avg)}%
                    </span>
                ))}
            </div>
        </div>
    );
}

function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function getWorstSegments(samples) {
    const segTotals = {};
    const BODY_SEGMENTS = {
        leftArm: { label: 'Left Arm', emoji: '💪' },
        rightArm: { label: 'Right Arm', emoji: '💪' },
        leftLeg: { label: 'Left Leg', emoji: '🦵' },
        rightLeg: { label: 'Right Leg', emoji: '🦵' },
        torso: { label: 'Torso', emoji: '🫁' },
        head: { label: 'Head', emoji: '🗣️' },
    };

    for (const sample of samples) {
        if (!sample.segments) continue;
        for (const [key, score] of Object.entries(sample.segments)) {
            if (score === null) continue;
            if (!segTotals[key]) segTotals[key] = { sum: 0, count: 0 };
            segTotals[key].sum += score;
            segTotals[key].count++;
        }
    }

    return Object.entries(segTotals)
        .map(([key, { sum, count }]) => ({
            key,
            avg: sum / count,
            label: BODY_SEGMENTS[key]?.label || key,
            emoji: BODY_SEGMENTS[key]?.emoji || '•',
        }))
        .sort((a, b) => a.avg - b.avg)
        .slice(0, 3);
}
