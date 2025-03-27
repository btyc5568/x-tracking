import React, { useState } from 'react';
import { 
  Box, 
  Button, 
  TextField, 
  Typography, 
  Paper, 
  Grid,
  Alert,
  Chip,
  Autocomplete
} from '@mui/material';

const SimpleForm = ({ onAccountAdded }) => {
  const [formData, setFormData] = useState({
    username: 'testuser',
    name: 'Test User',
    url: 'https://x.com/testuser',
    priority: 1,
    tags: ['tech'] // Start with one tag as default
  });
  
  const [status, setStatus] = useState({
    loading: false,
    success: false,
    error: null,
    responseData: null
  });

  // Predefined tag options for suggestions
  const tagOptions = ['tech', 'ai', 'news', 'social', 'business', 'entertainment'];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    setStatus({
      loading: true,
      success: false,
      error: null,
      responseData: null
    });
    
    // Use actual user-selected tags, but ensure it's an array
    const userTags = Array.isArray(formData.tags) ? [...formData.tags] : [];
    
    // Create a submission object with those tags
    const dataToSubmit = {
      username: formData.username,
      name: formData.name,
      url: formData.url,
      priority: formData.priority,
      active: true,
      tags: userTags
    };
    
    console.log('Submitting form data with user tags:', dataToSubmit);
    console.log('Tags being sent:', userTags);
    
    try {
      console.log('Starting fetch call to API');
      
      // Make a direct Fetch API call
      const response = await fetch('http://localhost:3000/api/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(dataToSubmit)
      });
      
      console.log('Fetch call complete, response status:', response.status);
      
      // Even if the response isn't JSON, we still want to know the status
      let responseText;
      let data;
      
      try {
        responseText = await response.text();
        console.log('Response text:', responseText);
        
        try {
          data = JSON.parse(responseText);
          console.log('Response parsed as JSON:', data);
          console.log('Tags in response:', data?.data?.tags);
        } catch (parseError) {
          console.error('Failed to parse response as JSON:', parseError);
          data = { success: false, message: 'Invalid JSON response' };
        }
      } catch (textError) {
        console.error('Failed to get response text:', textError);
        responseText = 'Failed to read response';
        data = { success: false, message: 'Failed to read response' };
      }
      
      if (!response.ok) {
        throw new Error(data?.message || `Server error: ${response.status} ${response.statusText}`);
      }
      
      console.log('API call successful with data:', data);
      
      setStatus({
        loading: false,
        success: true,
        error: null,
        responseData: data
      });
      
      if (onAccountAdded && data && data.data) {
        onAccountAdded(data.data);
      }
      
      // Reset form after successful submission
      setFormData({
        username: '',
        name: '',
        url: '',
        priority: 1,
        tags: []
      });
    } catch (err) {
      console.error('Form submission error:', err);
      
      setStatus({
        loading: false,
        success: false,
        error: err.message || 'Failed to create account',
        responseData: null
      });
    }
  };

  return (
    <Paper sx={{ p: 3, mb: 4 }}>
      <Typography variant="h6" gutterBottom>
        Quick Add Account
      </Typography>
      
      {status.error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {status.error}
        </Alert>
      )}
      
      {status.success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Account created successfully! ID: {status.responseData?.data?.id || 'Unknown'}
        </Alert>
      )}
      
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <TextField
              required
              fullWidth
              label="Username"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              margin="normal"
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              required
              fullWidth
              label="Display Name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              margin="normal"
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              required
              fullWidth
              label="Priority"
              name="priority"
              type="number"
              value={formData.priority}
              onChange={handleInputChange}
              margin="normal"
              inputProps={{ min: 1, max: 5 }}
            />
          </Grid>
          <Grid item xs={12}>
            <Autocomplete
              multiple
              freeSolo
              options={tagOptions}
              value={formData.tags}
              onChange={(_, newValue) => {
                setFormData({ ...formData, tags: newValue });
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Tags"
                  placeholder="Add tags"
                  margin="normal"
                  helperText="Type and press Enter to add custom tags"
                />
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    label={option}
                    size="small"
                    {...getTagProps({ index })}
                  />
                ))
              }
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              required
              fullWidth
              label="Profile URL"
              name="url"
              value={formData.url}
              onChange={handleInputChange}
              margin="normal"
              placeholder="https://x.com/username"
            />
          </Grid>
        </Grid>
        
        <Button
          type="submit"
          variant="contained"
          sx={{ mt: 3 }}
          disabled={status.loading}
        >
          {status.loading ? 'Adding...' : 'Add Account'}
        </Button>
      </Box>
    </Paper>
  );
};

export default SimpleForm; 