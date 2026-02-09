import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';

interface SparklineProps {
    data: number[];
    color?: string;
    width?: number | string;
    height?: number | string;
}

export const Sparkline = ({ data, color = '#14f195', width = '100%', height = 30 }: SparklineProps) => {
    // Recharts expects an array of objects
    const chartData = data.map((val, i) => ({ val, i }));

    return (
        <div style={{ width, height, opacity: 0.8 }}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                    <YAxis hide domain={['auto', 'auto']} />
                    <Line
                        type="monotone"
                        dataKey="val"
                        stroke={color}
                        strokeWidth={1.5}
                        dot={false}
                        isAnimationActive={false}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};
