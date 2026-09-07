
import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { OrderStatus } from '../types';
import { PIE_CHART_COLORS } from '../constants';

interface PieChartData {
    name: string;
    value: number;
    originalStatus: OrderStatus;
}

interface OrderStatusPieChartProps {
    data: PieChartData[];
}

const OrderStatusPieChart: React.FC<OrderStatusPieChartProps> = ({ data }) => {
    const filteredData = data.filter(item => item.value > 0);

    return (
        <ResponsiveContainer width="100%" height="100%">
            <PieChart>
                <Pie
                    data={filteredData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius="80%"
                    fill="#8884d8"
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                >
                    {filteredData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_CHART_COLORS[entry.originalStatus]} />
                    ))}
                </Pie>
                <Tooltip />
                <Legend />
            </PieChart>
        </ResponsiveContainer>
    );
};

export default OrderStatusPieChart;
