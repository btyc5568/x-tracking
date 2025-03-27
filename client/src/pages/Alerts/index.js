import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  IconButton,
  Alert,
  FormHelperText,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Notifications as NotificationsIcon,
} from '@mui/icons-material';
import DashboardLayout from '../../components/Layout/DashboardLayout';
import DataTable from '../../components/DataDisplay/DataTable';
import { alertsAPI, accountsAPI } from '../../api/api';

const Alerts = () => {
  const [alerts, setAlerts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [currentAlert, setCurrentAlert] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [formData, setFormData] = useState({
    accountId: '',
    metricType: 'followers',
    condition: 'gt',
    threshold: 0,
    timeWindow: '24h',
    notificationType: 'log',
    notificationConfig: {},
    description: '',
    active: true,
  });
  const [statusAlert, setStatusAlert] = useState({ show: false, message: '', severity: 'info' });

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch alerts
      const alertsResponse = await alertsAPI.getAlerts();
      setAlerts(alertsResponse.data.data);
      
      // Fetch accounts for the dropdown
      const accountsResponse = await accountsAPI.getAccounts();
      setAccounts(accountsResponse.data.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      setStatusAlert({
        show: true,
        message: 'Failed to fetch alerts data. Please try again.',
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenDialog = (alert = null) => {
    if (alert) {
      setCurrentAlert(alert);
      setFormData({
        accountId: alert.accountId,
        metricType: alert.metricType,
        condition: alert.condition,
        threshold: alert.threshold,
        timeWindow: alert.timeWindow,
        notificationType: alert.notificationType,
        notificationConfig: alert.notificationConfig || {},
        description: alert.description,
        active: alert.active,
      });
    } else {
      setCurrentAlert(null);
      setFormData({
        accountId: accounts.length > 0 ? accounts[0].id : '',
        metricType: 'followers',
        condition: 'gt',
        threshold: 0,
        timeWindow: '24h',
        notificationType: 'log',
        notificationConfig: {},
        description: '',
        active: true,
      });
    }
    setFormErrors({});
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: name === 'threshold' ? parseFloat(value) : value,
    });
  };

  const handleSwitchChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.checked,
    });
  };

  const validateForm = () => {
    const errors = {};
    
    if (!formData.accountId) {
      errors.accountId = 'Account is required';
    }
    
    if (!formData.metricType) {
      errors.metricType = 'Metric type is required';
    }
    
    if (isNaN(formData.threshold)) {
      errors.threshold = 'Threshold must be a number';
    }
    
    if (!formData.description.trim()) {
      errors.description = 'Description is required';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveAlert = async () => {
    if (!validateForm()) {
      return;
    }
    
    try {
      if (currentAlert) {
        // Update existing alert
        await alertsAPI.updateAlert(currentAlert.id, formData);
        setStatusAlert({
          show: true,
          message: 'Alert updated successfully',
          severity: 'success',
        });
      } else {
        // Create new alert
        await alertsAPI.createAlert(formData);
        setStatusAlert({
          show: true,
          message: 'Alert created successfully',
          severity: 'success',
        });
      }
      handleCloseDialog();
      fetchData();
    } catch (error) {
      console.error('Error saving alert:', error);
      setStatusAlert({
        show: true,
        message: 'Failed to save alert. Please try again.',
        severity: 'error',
      });
    }
  };

  const handleDeleteAlert = async (alertId) => {
    if (window.confirm('Are you sure you want to delete this alert?')) {
      try {
        await alertsAPI.deleteAlert(alertId);
        setStatusAlert({
          show: true,
          message: 'Alert deleted successfully',
          severity: 'success',
        });
        fetchData();
      } catch (error) {
        console.error('Error deleting alert:', error);
        setStatusAlert({
          show: true,
          message: 'Failed to delete alert. Please try again.',
          severity: 'error',
        });
      }
    }
  };

  const handleTestAlert = async (alertId) => {
    try {
      await alertsAPI.testAlert(alertId);
      setStatusAlert({
        show: true,
        message: 'Alert test initiated',
        severity: 'info',
      });
    } catch (error) {
      console.error('Error testing alert:', error);
      setStatusAlert({
        show: true,
        message: 'Failed to test alert. Please try again.',
        severity: 'error',
      });
    }
  };

  // Format the metric type for display
  const formatMetricType = (type) => {
    if (!type) return '';
    
    // Handle dot notation for nested metrics
    if (type.includes('.')) {
      const parts = type.split('.');
      return parts.map(part => 
        part.charAt(0).toUpperCase() + part.slice(1)
      ).join(' ');
    }
    
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  // Get account name from ID
  const getAccountName = (accountId) => {
    const account = accounts.find(a => a.id === accountId);
    return account ? account.name : 'Unknown Account';
  };

  // Format condition for display
  const formatCondition = (condition) => {
    const conditions = {
      'gt': '>',
      'lt': '<',
      'gte': '≥',
      'lte': '≤',
      'eq': '=',
      'neq': '≠',
    };
    return conditions[condition] || condition;
  };

  const columns = [
    { 
      id: 'accountId', 
      label: 'Account', 
      minWidth: 150,
      render: (accountId) => getAccountName(accountId)
    },
    { 
      id: 'metricType', 
      label: 'Metric', 
      minWidth: 120,
      render: (type) => formatMetricType(type)
    },
    { 
      id: 'condition', 
      label: 'Condition',
      minWidth: 100,
      render: (condition, row) => (
        <Box>
          <Typography variant="body2">
            {formatCondition(condition)} {row.threshold.toLocaleString()}
          </Typography>
        </Box>
      )
    },
    { 
      id: 'timeWindow', 
      label: 'Time Window', 
      minWidth: 100,
      render: (window) => {
        const windows = {
          '1h': '1 Hour',
          '6h': '6 Hours',
          '12h': '12 Hours',
          '24h': '24 Hours',
          '7d': '7 Days',
          '30d': '30 Days',
        };
        return windows[window] || window;
      }
    },
    { 
      id: 'active', 
      label: 'Status', 
      minWidth: 100,
      render: (value) => (
        <Chip 
          label={value ? 'Active' : 'Inactive'} 
          color={value ? 'success' : 'default'} 
          size="small" 
        />
      )
    },
    { 
      id: 'lastTriggered', 
      label: 'Last Triggered', 
      minWidth: 150,
      render: (value) => value ? new Date(value).toLocaleString() : 'Never'
    },
    {
      id: 'actions',
      label: 'Actions',
      minWidth: 120,
      sortable: false,
      render: (_, row) => (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton 
            size="small" 
            color="info" 
            onClick={(e) => {
              e.stopPropagation();
              handleTestAlert(row.id);
            }}
            title="Test Alert"
          >
            <NotificationsIcon fontSize="small" />
          </IconButton>
          <IconButton 
            size="small" 
            color="primary" 
            onClick={(e) => {
              e.stopPropagation();
              handleOpenDialog(row);
            }}
            title="Edit"
          >
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton 
            size="small" 
            color="error" 
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteAlert(row.id);
            }}
            title="Delete"
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      ),
    },
  ];

  return (
    <DashboardLayout>
      <Box mb={4}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h4" component="h1">
            Alerts
          </Typography>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Add Alert
          </Button>
        </Box>
        <Typography variant="body1" color="text.secondary">
          Configure alerts for important changes in account metrics
        </Typography>
      </Box>

      {statusAlert.show && (
        <Alert 
          severity={statusAlert.severity} 
          sx={{ mb: 3 }}
          onClose={() => setStatusAlert({ ...statusAlert, show: false })}
        >
          {statusAlert.message}
        </Alert>
      )}

      <DataTable
        data={alerts}
        columns={columns}
        loading={loading}
        pagination={true}
        initialOrderBy="createdAt"
        initialOrder="desc"
      />

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {currentAlert ? 'Edit Alert' : 'Add New Alert'}
        </DialogTitle>
        <DialogContent>
          <Box component="form" noValidate sx={{ mt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth error={!!formErrors.accountId}>
                  <InputLabel id="account-label">Account</InputLabel>
                  <Select
                    labelId="account-label"
                    id="accountId"
                    name="accountId"
                    value={formData.accountId}
                    label="Account"
                    onChange={handleInputChange}
                  >
                    {accounts.map((account) => (
                      <MenuItem key={account.id} value={account.id}>
                        {account.name}
                      </MenuItem>
                    ))}
                  </Select>
                  {formErrors.accountId && <FormHelperText>{formErrors.accountId}</FormHelperText>}
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth error={!!formErrors.metricType}>
                  <InputLabel id="metric-label">Metric</InputLabel>
                  <Select
                    labelId="metric-label"
                    id="metricType"
                    name="metricType"
                    value={formData.metricType}
                    label="Metric"
                    onChange={handleInputChange}
                  >
                    <MenuItem value="followers">Followers</MenuItem>
                    <MenuItem value="following">Following</MenuItem>
                    <MenuItem value="tweets">Tweets</MenuItem>
                    <MenuItem value="engagement.avgLikes">Average Likes</MenuItem>
                    <MenuItem value="engagement.avgRetweets">Average Retweets</MenuItem>
                    <MenuItem value="engagement.avgReplies">Average Replies</MenuItem>
                  </Select>
                  {formErrors.metricType && <FormHelperText>{formErrors.metricType}</FormHelperText>}
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel id="condition-label">Condition</InputLabel>
                  <Select
                    labelId="condition-label"
                    id="condition"
                    name="condition"
                    value={formData.condition}
                    label="Condition"
                    onChange={handleInputChange}
                  >
                    <MenuItem value="gt">Greater Than &gt;</MenuItem>
                    <MenuItem value="lt">Less Than &lt;</MenuItem>
                    <MenuItem value="gte">Greater Than or Equal ≥</MenuItem>
                    <MenuItem value="lte">Less Than or Equal ≤</MenuItem>
                    <MenuItem value="eq">Equal =</MenuItem>
                    <MenuItem value="neq">Not Equal ≠</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  name="threshold"
                  label="Threshold"
                  type="number"
                  fullWidth
                  value={formData.threshold}
                  onChange={handleInputChange}
                  error={!!formErrors.threshold}
                  helperText={formErrors.threshold}
                  InputProps={{
                    inputProps: { step: formData.metricType.includes('avg') ? 100 : 1000 }
                  }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel id="timeWindow-label">Time Window</InputLabel>
                  <Select
                    labelId="timeWindow-label"
                    id="timeWindow"
                    name="timeWindow"
                    value={formData.timeWindow}
                    label="Time Window"
                    onChange={handleInputChange}
                  >
                    <MenuItem value="1h">1 Hour</MenuItem>
                    <MenuItem value="6h">6 Hours</MenuItem>
                    <MenuItem value="12h">12 Hours</MenuItem>
                    <MenuItem value="24h">24 Hours</MenuItem>
                    <MenuItem value="7d">7 Days</MenuItem>
                    <MenuItem value="30d">30 Days</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  name="description"
                  label="Description"
                  fullWidth
                  value={formData.description}
                  onChange={handleInputChange}
                  error={!!formErrors.description}
                  helperText={formErrors.description}
                  placeholder="e.g., Alert when Elon Musk's followers exceed 120M"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel id="notificationType-label">Notification Type</InputLabel>
                  <Select
                    labelId="notificationType-label"
                    id="notificationType"
                    name="notificationType"
                    value={formData.notificationType}
                    label="Notification Type"
                    onChange={handleInputChange}
                  >
                    <MenuItem value="log">System Log</MenuItem>
                    <MenuItem value="email" disabled>Email (Coming Soon)</MenuItem>
                    <MenuItem value="webhook" disabled>Webhook (Coming Soon)</MenuItem>
                    <MenuItem value="slack" disabled>Slack (Coming Soon)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.active}
                      onChange={handleSwitchChange}
                      name="active"
                      color="primary"
                    />
                  }
                  label="Active"
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSaveAlert} variant="contained" color="primary">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
};

export default Alerts; 