import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { BODY_SEGMENTS, scoreToColor } from '../utils/poseSimilarity';
import { analyzeSession } from '../utils/feedbackEngine';
import ImprovementReview from './ImprovementReview';

/**
 * Session Summary — Shows grouped mistake analysis with actionable feedback,
 * plus the new Improvement Review showing the 3 worst moments.
 */
export default function SessionSummary({ sessionData, videoFile, onClose }) {
    const analysis = useMemo(() => analyzeSession(sessionData), [sessionData]);

    const chartData = useMemo(() => {
        if (!sessionData || sessionData.length === 0) return [];
        const sampleInterval = Math.max(1, Math.floor(sessionData.length / 50));
        const startTime = sessionData[0].timestamp;
        return sessionData
            .filter((_, i) => i % sampleInterval === 0)
            .map((d) => ({
                time: `${Math.round((d.timestamp - startTime) / 1000)}s`,
                score: Math.round(d.overall)
            }));
    }, [sessionData]);

    if (!analysis || analysis.overallGrade === 'N/A') {
        return (
            <div className="card fade-in">
                <div className="card-title">Session Summary</div>
                <p style={{ color: 'var(--text-muted)' }}>Not enough data for feedback. Try a longer session!</p>
            </div>
        );
    }

    const { overallGrade, overallAvg, focusAreas, strengths, timeline, tips } = analysis;

    return (
        <div className="fade-in" id="session-summary">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '1.5rem' }}>📊 Session Feedback</h2>
                {onClose && <button className="btn btn-outline" onClick={onClose}>← Back to Practice</button>}
            </div>

            {/* Overall Grade */}
            <div className="card" style={{ textAlign: 'center', marginBottom: '16px', padding: '32px' }}>
                <div style={{ fontSize: '4rem', fontWeight: 900, color: overallGrade.color }}>{overallGrade.letter}</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 600, color: overallGrade.color }}>{overallGrade.label}</div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Average accuracy: {Math.round(overallAvg)}%
                </div>
            </div>

            {/* ─── NEW: Improvement Review (Top 3 Worst Moments) ─── */}
            <ImprovementReview sessionData={sessionData} videoFile={videoFile} />

            {/* Key Takeaways */}
            <div className="card" style={{ marginBottom: '16px', border: '1px solid rgba(168,85,247,0.2)', background: 'var(--gradient-brand-subtle)' }}>
                <div className="card-title">🎯 Key Takeaways</div>
                {tips.map((tip, i) => (
                    <div key={i} style={{
                        display: 'flex', gap: '12px', alignItems: 'flex-start',
                        padding: '10px 0', borderBottom: i < tips.length - 1 ? '1px solid var(--border)' : 'none'
                    }}>
                        <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{tip.icon}</span>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>{tip.text}</p>
                    </div>
                ))}
            </div>

            {/* Focus Areas */}
            {focusAreas.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '12px', color: '#ef4444' }}>
                        🔴 Areas to Focus On ({focusAreas.length})
                    </h3>
                    {focusAreas.map((area, i) => (
                        <div key={i} className="card" style={{ marginBottom: '12px', borderLeft: `3px solid ${scoreToColor(area.avg)}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ fontSize: '1.4rem' }}>{area.emoji}</span>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '1rem' }}>{area.label}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                            {area.trend > 5 ? '📈 Improving' : area.trend < -5 ? '📉 Declining' : '➡️ Steady'}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: scoreToColor(area.avg) }}>
                                        {Math.round(area.avg)}%
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        Low: {Math.round(area.min)}% / High: {Math.round(area.max)}%
                                    </div>
                                </div>
                            </div>
                            <div style={{ marginBottom: '12px' }}>
                                {area.feedback.map((line, j) => (
                                    <p key={j} style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 6px 0' }}>{line}</p>
                                ))}
                            </div>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                {area.exercises.map((ex, j) => (
                                    <div key={j} style={{
                                        flex: '1 1 200px', padding: '10px 14px',
                                        background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
                                        borderRadius: '10px'
                                    }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--accent-1)' }}>💪 {ex.name}</div>
                                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>{ex.desc}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Strengths */}
            {strengths.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '12px', color: '#22c55e' }}>
                        🟢 Your Strengths ({strengths.length})
                    </h3>
                    <div className="card">
                        {strengths.map((s, i) => (
                            <div key={i} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '10px 0', borderBottom: i < strengths.length - 1 ? '1px solid var(--border)' : 'none'
                            }}>
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                    <span>{s.emoji}</span>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{s.label}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{s.feedback}</div>
                                    </div>
                                </div>
                                <span style={{ fontWeight: 800, fontSize: '1.1rem', color: scoreToColor(s.avg) }}>
                                    {Math.round(s.avg)}%
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Timeline */}
            {timeline.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '12px' }}>⏱ Performance Timeline</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(timeline.length, 4)}, 1fr)`, gap: '8px' }}>
                        {timeline.map((phase, i) => (
                            <div key={i} className="card" style={{ textAlign: 'center', padding: '14px' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>{phase.label}</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: scoreToColor(phase.avg) }}>{phase.avg}%</div>
                                {phase.weakestSegment && (
                                    <div style={{ fontSize: '0.7rem', color: scoreToColor(phase.weakestScore), marginTop: '4px' }}>
                                        Weakest: {phase.weakestSegment}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Chart */}
            {chartData.length > 2 && (
                <div className="card">
                    <div className="card-title">Accuracy Over Time</div>
                    <div className="chart-container">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(165,168,208,0.08)" />
                                <XAxis dataKey="time" tick={{ fill: '#6b6e99', fontSize: 11 }} />
                                <YAxis domain={[0, 100]} tick={{ fill: '#6b6e99', fontSize: 11 }} />
                                <Tooltip contentStyle={{
                                    background: '#161940', border: '1px solid rgba(165,168,208,0.15)',
                                    borderRadius: '10px', color: '#f0f0ff'
                                }} />
                                <Line type="monotone" dataKey="score" stroke="#a855f7" strokeWidth={2} dot={false} name="Accuracy %" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}
        </div>
    );
}
