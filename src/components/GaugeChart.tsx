'use client';

import React from 'react';

interface GaugeChartProps {
    value: number;
    max: number;
    label: string;
    color: string;
    size?: number;
    unit?: string;
}

export default function GaugeChart({ value, max, label, color, size = 140, unit = '' }: GaugeChartProps) {
    const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
    const strokeWidth = 10;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius * 0.75; // 270 degrees
    const offset = circumference - (percentage / 100) * circumference;

    const getStatusColor = () => {
        if (percentage >= 90) return '#ef4444';
        if (percentage >= 70) return '#f59e0b';
        return color;
    };

    const center = size / 2;
    const startAngle = 135;
    const endAngle = 405;

    const polarToCartesian = (angle: number) => {
        const rad = (angle * Math.PI) / 180;
        return {
            x: center + radius * Math.cos(rad),
            y: center + radius * Math.sin(rad),
        };
    };

    const start = polarToCartesian(startAngle);
    const end = polarToCartesian(endAngle);

    const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;

    const bgPath = `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;

    return (
        <div className="gauge-container">
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                {/* Background arc */}
                <path
                    d={bgPath}
                    fill="none"
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                />
                {/* Value arc */}
                <path
                    d={bgPath}
                    fill="none"
                    stroke={getStatusColor()}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    style={{
                        transition: 'stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.3s ease',
                        filter: `drop-shadow(0 0 6px ${getStatusColor()}40)`,
                    }}
                />
                {/* Center text */}
                <text
                    x={center}
                    y={center - 4}
                    textAnchor="middle"
                    fill="var(--text-primary)"
                    fontSize="22"
                    fontWeight="700"
                    fontFamily="Inter, sans-serif"
                >
                    {percentage.toFixed(0)}%
                </text>
                <text
                    x={center}
                    y={center + 16}
                    textAnchor="middle"
                    fill="var(--text-tertiary)"
                    fontSize="11"
                    fontFamily="Inter, sans-serif"
                >
                    {value.toLocaleString()}{unit} / {max.toLocaleString()}{unit}
                </text>
            </svg>
            <span className="gauge-label">{label}</span>
        </div>
    );
}
