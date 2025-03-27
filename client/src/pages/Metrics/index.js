import React, { useState, useEffect } from 'react';
import { 
  Box, 
  CircularProgress, 
  Typography, 
  Container, 
  Paper, 
  Grid, 
  Card, 
  CardContent, 
  CardHeader,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button
} from '@mui/material';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { format, subDays } from 'date-fns';
import { metricsAPI, accountsAPI } from '../../api/api';

const MetricsPage = () => {
  // State for data
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState([]);
  const [metricsSummary, setMetricsSummary] = useState(null);
  const [growthData, setGrowthData] = useState([]);
  const [engagementData, setEngagementData] = useState([]);
  const [latestMetrics, setLatestMetrics] = useState([]);
  
  // State for UI
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 30),
    to: new Date()
  });
  const [groupBy, setGroupBy] = useState('day');
  
  // Colors for charts
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];
  
  // Load accounts on component mount
  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const response = await accountsAPI.getAccounts();
        if (response.data && response.data.data) {
          setAccounts(response.data.data);
          
          // Select first account by default if none selected
          if (selectedAccountIds.length === 0 && response.data.data.length > 0) {
            setSelectedAccountIds([response.data.data[0].id]);
          }
        }
      } catch (err) {
        console.error('Error fetching accounts:', err);
        setError('Failed to load accounts. Please try again later.');
      }
    };
    
    fetchAccounts();
  }, []);
  
  // Fetch metrics data when selection changes
  useEffect(() => {
    if (selectedAccountIds.length > 0) {
      fetchMetricsData();
    }
  }, [selectedAccountIds, dateRange, groupBy]);
  
  // Fetch metrics data
  const fetchMetricsData = async () => {
    if (selectedAccountIds.length === 0) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Format dates
      const params = {
        from: format(dateRange.from, 'yyyy-MM-dd'),
        to: format(dateRange.to, 'yyyy-MM-dd'),
        groupBy
      };
      
      // Fetch latest metrics
      const latestResponse = await metricsAPI.getMultipleAccountMetrics(selectedAccountIds, {
        limit: 1
      });
      
      if (latestResponse.data && latestResponse.data.data) {
        const latestMetricsData = [];
        
        // Format latest metrics data
        Object.keys(latestResponse.data.data).forEach(accountId => {
          const accountData = latestResponse.data.data[accountId];
          if (accountData.length > 0) {
            latestMetricsData.push(accountData[0]);
          }
        });
        
        setLatestMetrics(latestMetricsData);
      }
      
      // Fetch metrics summary
      const summaryResponse = await metricsAPI.getMetricsSummary(selectedAccountIds, params);
      
      if (summaryResponse.data && summaryResponse.data.data) {
        setMetricsSummary(summaryResponse.data.data);
      }
      
      // Fetch growth analysis
      const growthResponse = await metricsAPI.getGrowthAnalysis(selectedAccountIds, params);
      
      if (growthResponse.data && growthResponse.data.data) {
        setGrowthData(growthResponse.data.data);
      }
      
      // Fetch engagement analysis
      const engagementResponse = await metricsAPI.getEngagementAnalysis(selectedAccountIds, params);
      
      if (engagementResponse.data && engagementResponse.data.data) {
        setEngagementData(engagementResponse.data.data);
      }
      
      setLoading(false);
    } catch (err) {
      console.error('Error fetching metrics data:', err);
      setError('Failed to load metrics data. Please try again later.');
      setLoading(false);
    }
  };
  
  // Handle account selection change
  const handleAccountChange = (event) => {
    setSelectedAccountIds(event.target.value);
  };
  
  // Handle date range change
  const handleDateChange = (field, value) => {
    setDateRange(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  // Handle group by change
  const handleGroupByChange = (event) => {
    setGroupBy(event.target.value);
  };
  
  // Format number with K, M, B
  const formatNumber = (num) => {
    if (num >= 1000000000) {
      return (num / 1000000000).toFixed(1) + 'B';
    }
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num;
  };
  
  // Format percentage
  const formatPercentage = (value) => {
    return `${(value * 100).toFixed(2)}%`;
  };
  
  return (
    <Container maxWidth="xl">
      <Box mb={4}>
        <Typography variant="h4" component="h1" gutterBottom>
          Metrics Dashboard
        </Typography>
        <Typography variant="body1" color="textSecondary">
          Track and analyze the metrics of your X accounts
        </Typography>
      </Box>
      
      <Paper sx={{ p: 3, mb: 4 }}>
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel id="account-select-label">Accounts</InputLabel>
              <Select
                labelId="account-select-label"
                id="account-select"
                multiple
                value={selectedAccountIds}
                onChange={handleAccountChange}
                label="Accounts"
              >
                {accounts.map((account) => (
                  <MenuItem key={account.id} value={account.id}>
                    {account.name || account.username}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={5}>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    label="From"
                    value={dateRange.from}
                    onChange={(newValue) => handleDateChange('from', newValue)}
                    renderInput={(params) => <TextField {...params} fullWidth />}
                  />
                </LocalizationProvider>
              </Grid>
              <Grid item xs={6}>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    label="To"
                    value={dateRange.to}
                    onChange={(newValue) => handleDateChange('to', newValue)}
                    renderInput={(params) => <TextField {...params} fullWidth />}
                  />
                </LocalizationProvider>
              </Grid>
            </Grid>
          </Grid>
          
          <Grid item xs={12} md={2}>
            <FormControl fullWidth>
              <InputLabel id="group-by-label">Group By</InputLabel>
              <Select
                labelId="group-by-label"
                id="group-by-select"
                value={groupBy}
                onChange={handleGroupByChange}
                label="Group By"
              >
                <MenuItem value="hour">Hour</MenuItem>
                <MenuItem value="day">Day</MenuItem>
                <MenuItem value="week">Week</MenuItem>
                <MenuItem value="month">Month</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={1}>
            <Button 
              variant="contained" 
              color="primary" 
              fullWidth
              onClick={fetchMetricsData}
              disabled={loading || selectedAccountIds.length === 0}
            >
              {loading ? <CircularProgress size={24} /> : 'Update'}
            </Button>
          </Grid>
        </Grid>
      </Paper>
      
      {error && (
        <Paper sx={{ p: 3, mb: 4, bgcolor: 'error.light' }}>
          <Typography color="error" variant="body1">
            {error}
          </Typography>
        </Paper>
      )}
      
      {loading ? (
        <Box display="flex" justifyContent="center" mt={4} mb={4}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* Latest Metrics Summary */}
          {latestMetrics.length > 0 && (
            <Box mb={4}>
              <Typography variant="h5" component="h2" gutterBottom>
                Latest Metrics
              </Typography>
              <Grid container spacing={3}>
                {latestMetrics.map((metric, index) => {
                  const account = accounts.find(a => a.id === metric.accountId);
                  return (
                    <Grid item xs={12} md={4} key={metric.id}>
                      <Card>
                        <CardHeader 
                          title={account?.name || account?.username || 'Unknown Account'} 
                          subheader={new Date(metric.timestamp).toLocaleString()}
                        />
                        <Divider />
                        <CardContent>
                          <Grid container spacing={2}>
                            <Grid item xs={4}>
                              <Typography variant="body2" color="textSecondary">Followers</Typography>
                              <Typography variant="h6">{formatNumber(metric.metrics.followers)}</Typography>
                              {metric.growth?.followersRate && (
                                <Typography 
                                  variant="body2" 
                                  color={metric.growth.followersRate > 0 ? 'success.main' : 'error.main'}
                                >
                                  {formatPercentage(metric.growth.followersRate)}
                                </Typography>
                              )}
                            </Grid>
                            <Grid item xs={4}>
                              <Typography variant="body2" color="textSecondary">Following</Typography>
                              <Typography variant="h6">{formatNumber(metric.metrics.following)}</Typography>
                            </Grid>
                            <Grid item xs={4}>
                              <Typography variant="body2" color="textSecondary">Tweets</Typography>
                              <Typography variant="h6">{formatNumber(metric.metrics.tweets)}</Typography>
                              {metric.growth?.tweetsRate && (
                                <Typography 
                                  variant="body2" 
                                  color={metric.growth.tweetsRate > 0 ? 'success.main' : 'error.main'}
                                >
                                  {formatPercentage(metric.growth.tweetsRate)}
                                </Typography>
                              )}
                            </Grid>
                            <Grid item xs={12}>
                              <Divider sx={{ my: 1 }} />
                              <Typography variant="body2" color="textSecondary">Engagement (avg.)</Typography>
                            </Grid>
                            <Grid item xs={4}>
                              <Typography variant="body2" color="textSecondary">Likes</Typography>
                              <Typography variant="h6">
                                {formatNumber(metric.metrics.engagement?.avgLikes || 0)}
                              </Typography>
                            </Grid>
                            <Grid item xs={4}>
                              <Typography variant="body2" color="textSecondary">Retweets</Typography>
                              <Typography variant="h6">
                                {formatNumber(metric.metrics.engagement?.avgRetweets || 0)}
                              </Typography>
                            </Grid>
                            <Grid item xs={4}>
                              <Typography variant="body2" color="textSecondary">Replies</Typography>
                              <Typography variant="h6">
                                {formatNumber(metric.metrics.engagement?.avgReplies || 0)}
                              </Typography>
                            </Grid>
                          </Grid>
                        </CardContent>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
            </Box>
          )}
          
          {/* Growth Charts */}
          {growthData.length > 0 && (
            <Box mb={4}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h5" component="h2" gutterBottom>
                  Followers Growth
                </Typography>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={growthData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {selectedAccountIds.map((accountId, index) => {
                      const account = accounts.find(a => a.id === accountId);
                      return (
                        <Line 
                          key={accountId}
                          type="monotone" 
                          dataKey={`accounts.${accountId}.followers`} 
                          name={account?.name || account?.username || `Account ${index + 1}`}
                          stroke={COLORS[index % COLORS.length]} 
                          activeDot={{ r: 8 }} 
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </Paper>
            </Box>
          )}
          
          {/* Engagement Charts */}
          {engagementData.length > 0 && (
            <Box mb={4}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h5" component="h2" gutterBottom>
                  Engagement Metrics
                </Typography>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={engagementData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {selectedAccountIds.map((accountId, index) => {
                      const account = accounts.find(a => a.id === accountId);
                      return (
                        <Bar 
                          key={accountId}
                          dataKey={`accounts.${accountId}.engagement.avgLikes`} 
                          name={`${account?.name || account?.username || `Account ${index + 1}`} Likes`}
                          fill={COLORS[index % COLORS.length]} 
                        />
                      );
                    })}
                  </BarChart>
                </ResponsiveContainer>
              </Paper>
            </Box>
          )}
          
          {/* Metrics Summary */}
          {metricsSummary && (
            <Box mb={4}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h5" component="h2" gutterBottom>
                  Metrics Summary
                </Typography>
                <Grid container spacing={3}>
                  {metricsSummary.accountSummaries && Object.keys(metricsSummary.accountSummaries).map((accountId) => {
                    const summary = metricsSummary.accountSummaries[accountId];
                    const account = accounts.find(a => a.id === accountId);
                    
                    return (
                      <Grid item xs={12} md={6} key={accountId}>
                        <Card>
                          <CardHeader 
                            title={account?.name || account?.username || 'Unknown Account'} 
                            subheader={`${format(new Date(dateRange.from), 'MMM d, yyyy')} - ${format(new Date(dateRange.to), 'MMM d, yyyy')}`} 
                          />
                          <Divider />
                          <CardContent>
                            <Grid container spacing={2}>
                              <Grid item xs={6}>
                                <Typography variant="body2" color="textSecondary">Followers Growth</Typography>
                                <Typography variant="h6">
                                  {summary.growth.followers > 0 ? '+' : ''}{formatNumber(summary.growth.followers)}
                                </Typography>
                                <Typography 
                                  variant="body2" 
                                  color={summary.growth.followerPercentage > 0 ? 'success.main' : 'error.main'}
                                >
                                  {formatPercentage(summary.growth.followerPercentage)}
                                </Typography>
                              </Grid>
                              <Grid item xs={6}>
                                <Typography variant="body2" color="textSecondary">Tweet Growth</Typography>
                                <Typography variant="h6">
                                  {summary.growth.tweets > 0 ? '+' : ''}{formatNumber(summary.growth.tweets)}
                                </Typography>
                                <Typography 
                                  variant="body2" 
                                  color={summary.growth.tweetPercentage > 0 ? 'success.main' : 'error.main'}
                                >
                                  {formatPercentage(summary.growth.tweetPercentage)}
                                </Typography>
                              </Grid>
                              <Grid item xs={12}>
                                <Divider sx={{ my: 1 }} />
                                <Typography variant="body2" color="textSecondary">Average Engagement</Typography>
                              </Grid>
                              <Grid item xs={4}>
                                <Typography variant="body2" color="textSecondary">Likes</Typography>
                                <Typography variant="h6">{formatNumber(summary.engagement.avgLikes)}</Typography>
                              </Grid>
                              <Grid item xs={4}>
                                <Typography variant="body2" color="textSecondary">Retweets</Typography>
                                <Typography variant="h6">{formatNumber(summary.engagement.avgRetweets)}</Typography>
                              </Grid>
                              <Grid item xs={4}>
                                <Typography variant="body2" color="textSecondary">Replies</Typography>
                                <Typography variant="h6">{formatNumber(summary.engagement.avgReplies)}</Typography>
                              </Grid>
                            </Grid>
                          </CardContent>
                        </Card>
                      </Grid>
                    );
                  })}
                </Grid>
              </Paper>
            </Box>
          )}
        </>
      )}
    </Container>
  );
};

export default MetricsPage; 