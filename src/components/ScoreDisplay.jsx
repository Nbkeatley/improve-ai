import { BODY_SEGMENTS, scoreToColor, scoreToLabel, scoreToGrade } from '../utils/poseSimilarity';

export default function ScoreDisplay({ comparison, coachingLabel }) {
    if (!comparison) {
        return (
            <div className="card score-bar" id="score-display">
                <div className="score-ring">
                    <span className="score-number" style={{ color: 'var(--text-muted)', fontSize: '1.5rem' }}>—</span>
                </div>
                <div>
                    <div className="card-title" style={{ marginBottom: '8px' }}>Similarity Score</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                        Load a reference video and start dancing to see your score
                    </div>
                </div>
                <div className="score-grade" style={{ opacity: 0.3 }}>—</div>
            </div>
        );
    }

    const { overall, segments } = comparison;
    const color = scoreToColor(overall);
    const label = scoreToLabel(overall);
    const grade = scoreToGrade(overall);

    return (
        <div className="fade-in" id="score-display">
            <div className="card score-bar">
                <div className="score-ring" style={{ '--score-pct': `${overall}%` }}>
                    <div>
                        <div className="score-number" style={{ color }}>{Math.round(overall)}</div>
                        <div className="score-label" style={{ color }}>{label}</div>
                    </div>
                </div>

                <div className="segments-grid">
                    {Object.entries(BODY_SEGMENTS).map(([key, seg]) => {
                        const score = segments[key];
                        const segColor = scoreToColor(score);
                        return (
                            <div className="segment-item" key={key}>
                                <div className="segment-emoji">{seg.emoji}</div>
                                <div className="segment-label">{seg.label}</div>
                                <div className="segment-score" style={{ color: segColor }}>
                                    {score !== null ? Math.round(score) : '—'}
                                </div>
                                <div className="segment-bar">
                                    <div className="segment-bar-fill" style={{ width: `${score || 0}%`, background: segColor }} />
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="score-grade" style={{ color }}>{grade}</div>
            </div>

            {/* PoseScript coaching label */}
            {coachingLabel && (
                <div className="card" style={{
                    marginTop: '8px',
                    padding: '10px 16px',
                    borderLeft: '3px solid #a855f7',
                    background: 'linear-gradient(135deg, rgba(168,85,247,0.08), rgba(236,72,153,0.05))',
                    fontSize: '0.88rem',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.5,
                    animation: 'fadeIn 0.3s ease'
                }}>
                    <span style={{ marginRight: '8px' }}>🎯</span>
                    {coachingLabel}
                </div>
            )}
        </div>
    );
}
