import React, { useState } from 'react';
import { Box, Button, TextField, Typography, Container, Alert } from '@mui/material';
import axios from 'axios';

const TestPage = () => {
  const [formData, setFormData] = useState({
    username: 'testuser',
    name: 'Test User',
    url: 'https://x.com/testuser'
  });
  
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    
    console.log('Test form submit with data:', formData);
    
    try {
      // Make a direct axios call without using our API client
      const response = await axios.post(
        'http://localhost:3000/api/accounts',
        formData,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('Direct API response:', response);
      setResult(response.data);
    } catch (err) {
      console.error('Test form error:', err);
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Box mt={5} mb={3}>
        <Typography variant="h4" component="h1" gutterBottom>
          API Test Page
        </Typography>
        <Typography variant="body1" color="textSecondary">
          Use this page to test a direct API call to create an account
        </Typography>
      </Box>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      {result && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Account created successfully!
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </Alert>
      )}
      
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <TextField
          margin="normal"
          required
          fullWidth
          id="username"
          label="Username"
          name="username"
          value={formData.username}
          onChange={handleInputChange}
        />
        <TextField
          margin="normal"
          required
          fullWidth
          id="name"
          label="Display Name"
          name="name"
          value={formData.name}
          onChange={handleInputChange}
        />
        <TextField
          margin="normal"
          required
          fullWidth
          id="url"
          label="Profile URL"
          name="url"
          value={formData.url}
          onChange={handleInputChange}
        />
        
        <Button
          type="submit"
          fullWidth
          variant="contained"
          sx={{ mt: 3, mb: 2 }}
          disabled={loading}
        >
          {loading ? 'Sending...' : 'Test Create Account'}
        </Button>
      </Box>
    </Container>
  );
};

export default TestPage; 