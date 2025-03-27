import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Autocomplete,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import DashboardLayout from '../../components/Layout/DashboardLayout';
import DataTable from '../../components/DataDisplay/DataTable';
import { accountsAPI, scraperAPI } from '../../api/api';

const Accounts = () => {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [currentAccount, setCurrentAccount] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [formData, setFormData] = useState({
    username: '',
    name: '',
    url: '',
    priority: 2,
    active: true,
    tags: [],
  });
  const [alert, setAlert] = useState({ show: false, message: '', severity: 'info' });

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const response = await accountsAPI.getAccounts();
      setAccounts(response.data.data);
    } catch (error) {
      console.error('Error fetching accounts:', error);
      setAlert({
        show: true,
        message: 'Failed to fetch accounts. Please try again.',
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleOpenDialog = (account = null) => {
    if (account) {
      setCurrentAccount(account);
      setFormData({
        username: account.username,
        name: account.name,
        url: account.url,
        tags: account.tags || [],
        priority: account.priority,
        active: account.active,
      });
    } else {
      setCurrentAccount(null);
      setFormData({
        username: '',
        name: '',
        url: '',
        priority: 2,
        active: true,
        tags: [],
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
      [name]: value,
    });
  };

  const validateForm = () => {
    const errors = {};
    
    if (!formData.username.trim()) {
      errors.username = 'Username is required';
    }
    
    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    }
    
    if (!formData.url.trim()) {
      errors.url = 'URL is required';
    } else if (!formData.url.startsWith('https://')) {
      errors.url = 'URL must start with https://';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveAccount = async () => {
    try {
      console.log('Saving account with data:', formData);
      
      // Validate form data
      if (!validateForm()) {
        console.log('Validation failed with errors:', formErrors);
        return;
      }
      
      // Ensure tags is always an array of strings
      const userTags = Array.isArray(formData.tags) 
        ? formData.tags
            .map(tag => String(tag).trim())
            .filter(tag => tag && tag.length > 0) 
        : [];
      
      console.log('User selected tags for submission:', userTags);
      
      // Prepare data to submit
      const dataToSubmit = {
        ...formData,
        tags: userTags
      };
      
      console.log('Submitting account data with tags array:', dataToSubmit.tags);
      
      let response;
      
      // Use the API client instead of direct fetch
      if (currentAccount) {
        // Update existing account
        response = await accountsAPI.updateAccount(currentAccount.id, dataToSubmit);
        console.log('Account updated:', response.data);
      } else {
        // Create new account
        response = await accountsAPI.createAccount(dataToSubmit);
        console.log('Account created:', response.data);
      }
      
      // Handle success
      handleCloseDialog();
      fetchAccounts();
      setAlert({
        show: true,
        severity: 'success',
        message: `Account ${currentAccount ? 'updated' : 'created'} successfully`
      });
    } catch (error) {
      console.error('Error saving account:', error);
      setAlert({
        show: true,
        severity: 'error',
        message: error.response?.data?.message || error.message || 'Failed to save account'
      });
    }
  };

  const handleDeleteAccount = async (accountId) => {
    if (window.confirm('Are you sure you want to delete this account?')) {
      try {
        await accountsAPI.deleteAccount(accountId);
        setAlert({
          show: true,
          message: 'Account deleted successfully',
          severity: 'success',
        });
        fetchAccounts();
      } catch (error) {
        console.error('Error deleting account:', error);
        setAlert({
          show: true,
          message: 'Failed to delete account. Please try again.',
          severity: 'error',
        });
      }
    }
  };

  const handleScrapeAccount = async (accountId) => {
    try {
      await scraperAPI.scrapeAccount(accountId);
      setAlert({
        show: true,
        message: 'Account scraping initiated',
        severity: 'success',
      });
    } catch (error) {
      console.error('Error scraping account:', error);
      setAlert({
        show: true,
        message: 'Failed to initiate scraping. Please try again.',
        severity: 'error',
      });
    }
  };

  const columns = [
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
      id: 'priority', 
      label: 'Priority', 
      minWidth: 100,
      render: (value) => (
        <Chip 
          label={value} 
          size="small" 
          color={value === 1 ? 'primary' : value === 2 ? 'secondary' : 'default'} 
        />
      )
    },
    {
      id: 'actions',
      label: 'Actions',
      minWidth: 150,
      sortable: false,
      render: (_, row) => (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton 
            size="small" 
            color="primary" 
            onClick={(e) => {
              e.stopPropagation();
              handleScrapeAccount(row.id);
            }}
            title="Scrape Now"
          >
            <RefreshIcon fontSize="small" />
          </IconButton>
          <IconButton 
            size="small" 
            color="info" 
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
              handleDeleteAccount(row.id);
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
            Accounts
          </Typography>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Add Account
          </Button>
        </Box>
        <Typography variant="body1" color="text.secondary">
          Manage the X accounts you are tracking
        </Typography>
      </Box>

      {alert.show && (
        <Alert 
          severity={alert.severity} 
          sx={{ mb: 3 }}
          onClose={() => setAlert({ ...alert, show: false })}
        >
          {alert.message}
        </Alert>
      )}

      <DataTable
        data={accounts}
        columns={columns}
        loading={loading}
        pagination={true}
        initialOrderBy="priority"
        initialOrder="asc"
        onRowClick={(row) => {
          navigate(`/accounts/${row.id}`);
        }}
      />

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {currentAccount ? 'Edit Account' : 'Add New Account'}
        </DialogTitle>
        <DialogContent>
          <Box component="form" noValidate sx={{ mt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  name="username"
                  label="Username"
                  fullWidth
                  value={formData.username}
                  onChange={handleInputChange}
                  error={!!formErrors.username}
                  helperText={formErrors.username}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  name="name"
                  label="Display Name"
                  fullWidth
                  value={formData.name}
                  onChange={handleInputChange}
                  error={!!formErrors.name}
                  helperText={formErrors.name}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  name="url"
                  label="Profile URL"
                  fullWidth
                  value={formData.url}
                  onChange={handleInputChange}
                  error={!!formErrors.url}
                  helperText={formErrors.url}
                  placeholder="https://twitter.com/username"
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <Autocomplete
                  multiple
                  freeSolo
                  options={['ai', 'tech', 'politics', 'space', 'science', 'finance', 'crypto', 'business', 'entertainment']}
                  value={Array.isArray(formData.tags) ? formData.tags : []}
                  onChange={(_, newValue) => {
                    // Ensure we always have an array of strings
                    const processedTags = newValue
                      .map(tag => typeof tag === 'string' ? tag.trim() : tag)
                      .filter(tag => tag && String(tag).length > 0);
                    
                    console.log('Setting tags:', processedTags);
                    setFormData({ ...formData, tags: processedTags });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.target.value) {
                      // Prevent default to avoid form submission
                      e.preventDefault();
                      
                      // Get current value
                      const value = e.target.value.trim();
                      
                      if (value && !formData.tags.includes(value)) {
                        // Add the tag manually
                        const newTags = [...formData.tags, value];
                        console.log('Adding tag on Enter:', value, newTags);
                        setFormData({ ...formData, tags: newTags });
                        
                        // Clear the input - need to access Autocomplete internals
                        // This is a bit of a hack but works for demonstration
                        setTimeout(() => {
                          const input = document.querySelector('input[name="tags-input"]');
                          if (input) input.value = '';
                        }, 10);
                      }
                    }
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      name="tags-input"
                      label="Tags"
                      placeholder="Type a tag and press Enter"
                      helperText="Type a tag (e.g. 'crypto') and press Enter to add it"
                    />
                  )}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip
                        key={option}
                        label={option}
                        size="small"
                        {...getTagProps({ index })}
                      />
                    ))
                  }
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel id="priority-label">Priority</InputLabel>
                  <Select
                    labelId="priority-label"
                    id="priority"
                    name="priority"
                    value={formData.priority}
                    label="Priority"
                    onChange={handleInputChange}
                  >
                    <MenuItem value={1}>High</MenuItem>
                    <MenuItem value={2}>Medium</MenuItem>
                    <MenuItem value={3}>Low</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel id="active-label">Status</InputLabel>
                  <Select
                    labelId="active-label"
                    id="active"
                    name="active"
                    value={formData.active}
                    label="Status"
                    onChange={handleInputChange}
                  >
                    <MenuItem value={true}>Active</MenuItem>
                    <MenuItem value={false}>Inactive</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} color="secondary">
            Cancel
          </Button>
          <Button 
            onClick={() => {
              console.log('Save button clicked');
              try {
                handleSaveAccount();
              } catch (error) {
                console.error('Error in save button handler:', error);
                setAlert({
                  show: true,
                  severity: 'error',
                  message: 'Error saving account: ' + (error.message || 'Unknown error')
                });
              }
            }} 
            color="primary" 
            variant="contained"
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
};

export default Accounts; 