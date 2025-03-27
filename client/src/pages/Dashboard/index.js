import React, { useEffect, useState } from 'react';
import { Grid, Box, Typography, Button, Chip, Divider } from '@mui/material';
import { 
  People as PeopleIcon, 
  Visibility as VisibilityIcon, 
  Favorite as FavoriteIcon,
  Repeat as RepeatIcon, 
  PlayArrow as PlayArrowIcon,
  Stop as StopIcon,
  Comment as CommentIcon
} from '@mui/icons-material';
import DashboardLayout from '../../components/Layout/DashboardLayout';
import StatCard from '../../components/Stats/StatCard';
import MetricsChart from '../../components/Charts/MetricsChart';
import DataTable from '../../components/DataDisplay/DataTable';
import { accountsAPI, metricsAPI, scraperAPI } from '../../api/api';

const Dashboard = () => {
  const [accounts, setAccounts] = useState([]);
  const [metrics, setMetrics] = useState([]);
  const [scraperStatus, setScraperStatus] = useState({
    isRunning: false,
    isInitialized: false,
    lastUpdated: null
  });
  const [loading, setLoading] = useState({
    accounts: true,
    metrics: true,
    scraper: true
  });

  const fetchData = async () => {
    try {
      setLoading({ accounts: true, metrics: true, scraper: true });
      
      // Fetch accounts
      const accountsResponse = await accountsAPI.getAccounts();
      setAccounts(accountsResponse.data.data);
      
      // Fetch metrics
      const metricsResponse = await metricsAPI.getLatestMetrics();
      setMetrics(metricsResponse.data.data);
      
      // Fetch scraper status
      const scraperResponse = await scraperAPI.getStatus();
      setScraperStatus(scraperResponse.data.data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading({ accounts: false, metrics: false, scraper: false });
    }
  };

  useEffect(() => {
    fetchData();
    
    // Refresh data every 30 seconds
    const interval = setInterval(() => {
      fetchData();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // Calculate total metrics across all accounts
  const totalMetrics = metrics.reduce((acc, metric) => {
    acc.followers += metric.metrics.followers || 0;
    acc.following += metric.metrics.following || 0;
    acc.tweets += metric.metrics.tweets || 0;
    acc.avgLikes += metric.metrics.engagement?.avgLikes || 0;
    acc.avgRetweets += metric.metrics.engagement?.avgRetweets || 0;
    acc.avgReplies += metric.metrics.engagement?.avgReplies || 0;
    return acc;
  }, { 
    followers: 0, 
    following: 0, 
    tweets: 0, 
    avgLikes: 0, 
    avgRetweets: 0, 
    avgReplies: 0 
  });
  
  // If we have metrics, calculate the average engagement
  if (metrics.length > 0) {
    totalMetrics.avgLikes = Math.round(totalMetrics.avgLikes / metrics.length);
    totalMetrics.avgRetweets = Math.round(totalMetrics.avgRetweets / metrics.length);
    totalMetrics.avgReplies = Math.round(totalMetrics.avgReplies / metrics.length);
  }

  // Prepare chart data
  const accountsWithHighestFollowers = [...accounts]
    .sort((a, b) => {
      const metricA = metrics.find(m => m.accountId === a.id)?.metrics.followers || 0;
      const metricB = metrics.find(m => m.accountId === b.id)?.metrics.followers || 0;
      return metricB - metricA;
    })
    .slice(0, 5);

  // Format account data for the table
  const accountTableData = accounts.map(account => {
    const accountMetrics = metrics.find(m => m.accountId === account.id)?.metrics || {
      followers: 0,
      following: 0,
      tweets: 0,
      engagement: { avgLikes: 0, avgRetweets: 0, avgReplies: 0 }
    };
    
    return {
      ...account,
      followers: accountMetrics.followers,
      following: accountMetrics.following,
      tweets: accountMetrics.tweets,
      avgLikes: accountMetrics.engagement?.avgLikes || 0,
      avgRetweets: accountMetrics.engagement?.avgRetweets || 0,
      avgReplies: accountMetrics.engagement?.avgReplies || 0,
    };
  });

  const accountColumns = [
    { id: 'name', label: 'Name', minWidth: 150 },
    { id: 'username', label: 'Username', minWidth: 120 },
    { 
      id: 'tags', 
      label: 'Tags', 
      minWidth: 150,
      render: (tags) => (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {tags.map((tag) => (
            <Chip key={tag} label={tag} size="small" />
          ))}
        </Box>
      )
    },
    { 
      id: 'followers', 
      label: 'Followers', 
      minWidth: 100, 
      align: 'right',
      render: (value) => value.toLocaleString()
    },
    { 
      id: 'avgLikes', 
      label: 'Avg. Likes', 
      minWidth: 100, 
      align: 'right',
      render: (value) => value.toLocaleString()
    },
    { 
      id: 'priority', 
      label: 'Priority', 
      minWidth: 80, 
      align: 'center',
      render: (value) => (
        <Chip 
          label={value} 
          size="small" 
          color={value === 1 ? 'primary' : value === 2 ? 'secondary' : 'default'} 
        />
      )
    },
  ];

  const handleToggleScraper = async () => {
    try {
      if (scraperStatus.isRunning) {
        await scraperAPI.stopScraper();
      } else {
        await scraperAPI.startScraper();
      }
      // Refresh scraper status
      const response = await scraperAPI.getStatus();
      setScraperStatus(response.data.data);
    } catch (error) {
      console.error('Error toggling scraper:', error);
    }
  };

  return (
    <DashboardLayout>
      <Box mb={4}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h4" component="h1">
            Dashboard
          </Typography>
          <Button
            variant="contained"
            color={scraperStatus.isRunning ? "error" : "primary"}
            startIcon={scraperStatus.isRunning ? <StopIcon /> : <PlayArrowIcon />}
            onClick={handleToggleScraper}
            disabled={loading.scraper}
          >
            {scraperStatus.isRunning ? "Stop Scraper" : "Start Scraper"}
          </Button>
        </Box>
        
        <Typography variant="body1" color="text.secondary">
          {scraperStatus.isRunning ? 
            "Scraper is running and collecting data" : 
            "Scraper is currently stopped"
          }
          {scraperStatus.lastUpdated && 
            ` • Last updated: ${new Date(scraperStatus.lastUpdated).toLocaleString()}`
          }
        </Typography>
      </Box>

      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard 
            title="Total Followers" 
            value={totalMetrics.followers} 
            icon={<PeopleIcon />}
            color="#1a73e8"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard 
            title="Total Accounts" 
            value={accounts.length} 
            icon={<VisibilityIcon />}
            color="#8e44ad"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard 
            title="Avg. Likes" 
            value={totalMetrics.avgLikes} 
            icon={<FavoriteIcon />}
            color="#e74c3c"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard 
            title="Avg. Retweets" 
            value={totalMetrics.avgRetweets} 
            icon={<RepeatIcon />}
            color="#27ae60"
          />
        </Grid>
      </Grid>

      <Divider sx={{ mb: 4 }} />

      <Typography variant="h5" mb={3}>
        Top Accounts
      </Typography>

      <DataTable 
        data={accountTableData}
        columns={accountColumns}
        loading={loading.accounts || loading.metrics}
        pagination={true}
        initialOrderBy="followers"
        initialOrder="desc"
        onRowClick={(row) => {
          // Navigate to account details page (to be implemented)
          console.log("Navigate to account:", row.id);
        }}
      />
    </DashboardLayout>
  );
};

export default Dashboard; 