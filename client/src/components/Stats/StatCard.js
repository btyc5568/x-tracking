import React from 'react';
import { Box, Card, CardContent, Typography, useTheme } from '@mui/material';
import { ArrowUpward, ArrowDownward } from '@mui/icons-material';

const StatCard = ({ title, value, icon, change, changeText, color }) => {
  const theme = useTheme();
  
  // Determine color based on positive/negative change
  const isPositive = change > 0;
  const changeColor = isPositive ? theme.palette.success.main : theme.palette.error.main;
  
  // Format large numbers with commas
  const formatValue = (val) => {
    if (val >= 1000000) {
      return (val / 1000000).toFixed(1) + 'M';
    } else if (val >= 1000) {
      return (val / 1000).toFixed(1) + 'K';
    }
    return val.toLocaleString();
  };

  return (
    <Card elevation={0} sx={{ height: '100%' }}>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Typography variant="subtitle2" color="text.secondary">
            {title}
          </Typography>
          {icon && (
            <Box
              sx={{
                backgroundColor: color ? `${color}20` : `${theme.palette.primary.main}20`,
                borderRadius: '50%',
                p: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {React.cloneElement(icon, { 
                sx: { 
                  color: color || theme.palette.primary.main,
                  fontSize: 20
                } 
              })}
            </Box>
          )}
        </Box>
        
        <Typography variant="h4" component="div" fontWeight="bold" mb={1}>
          {typeof value === 'number' ? formatValue(value) : value}
        </Typography>
        
        {change !== undefined && (
          <Box display="flex" alignItems="center">
            {isPositive ? (
              <ArrowUpward sx={{ color: changeColor, fontSize: 16, mr: 0.5 }} />
            ) : (
              <ArrowDownward sx={{ color: changeColor, fontSize: 16, mr: 0.5 }} />
            )}
            <Typography variant="body2" sx={{ color: changeColor, fontWeight: 'medium' }}>
              {Math.abs(change)}%
            </Typography>
            {changeText && (
              <Typography variant="body2" color="text.secondary" sx={{ ml: 0.5 }}>
                {changeText}
              </Typography>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default StatCard; 