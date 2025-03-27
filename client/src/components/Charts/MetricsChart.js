import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
} from 'recharts';
import { Box, Card, CardContent, Typography, useTheme } from '@mui/material';

const MetricsChart = ({
  title,
  data = [],
  dataKeys = [], // Array of objects: [{key: 'followers', name: 'Followers', color: '#8884d8'}]
  type = 'line', // 'line' or 'area'
  height = 400,
  yAxisFormatter = (value) => value.toLocaleString(),
  tooltipFormatter = (value) => value.toLocaleString(),
  xAxisDataKey = 'timestamp',
  xAxisFormatter = (value) => new Date(value).toLocaleDateString(),
}) => {
  const theme = useTheme();

  const renderChart = () => {
    const commonProps = {
      data,
      margin: { top: 10, right: 30, left: 20, bottom: 20 },
    };

    if (type === 'area') {
      return (
        <AreaChart {...commonProps}>
          <defs>
            {dataKeys.map((dataKey) => (
              <linearGradient key={dataKey.key} id={`color-${dataKey.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={dataKey.color} stopOpacity={0.8} />
                <stop offset="95%" stopColor={dataKey.color} stopOpacity={0.1} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
          <XAxis 
            dataKey={xAxisDataKey}
            tickFormatter={xAxisFormatter}
            tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
            axisLine={{ stroke: '#E0E0E0' }}
            tickLine={false}
          />
          <YAxis 
            tickFormatter={yAxisFormatter}
            tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={tooltipFormatter}
            labelFormatter={(value) => new Date(value).toLocaleString()}
            contentStyle={{ 
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 4,
              boxShadow: theme.shadows[3],
            }}
          />
          <Legend />
          {dataKeys.map((dataKey) => (
            <Area
              key={dataKey.key}
              type="monotone"
              dataKey={dataKey.key}
              name={dataKey.name}
              stroke={dataKey.color}
              fillOpacity={1}
              fill={`url(#color-${dataKey.key})`}
              activeDot={{ r: 8 }}
            />
          ))}
        </AreaChart>
      );
    }

    return (
      <LineChart {...commonProps}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
        <XAxis 
          dataKey={xAxisDataKey}
          tickFormatter={xAxisFormatter}
          tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
          axisLine={{ stroke: '#E0E0E0' }}
          tickLine={false}
        />
        <YAxis 
          tickFormatter={yAxisFormatter}
          tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={tooltipFormatter}
          labelFormatter={(value) => new Date(value).toLocaleString()}
          contentStyle={{ 
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 4,
            boxShadow: theme.shadows[3],
          }}
        />
        <Legend />
        {dataKeys.map((dataKey) => (
          <Line
            key={dataKey.key}
            type="monotone"
            dataKey={dataKey.key}
            name={dataKey.name}
            stroke={dataKey.color}
            strokeWidth={2}
            dot={{ stroke: dataKey.color, strokeWidth: 2, r: 4, fill: 'white' }}
            activeDot={{ r: 8 }}
          />
        ))}
      </LineChart>
    );
  };

  return (
    <Card elevation={0} sx={{ height, width: '100%' }}>
      <CardContent>
        {title && (
          <Box mb={2}>
            <Typography variant="h6" component="div">
              {title}
            </Typography>
          </Box>
        )}
        <ResponsiveContainer width="100%" height={height - 80}>
          {renderChart()}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default MetricsChart; 