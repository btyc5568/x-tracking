import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { accountsAPI, scraperAPI } from '../../api/api';

const initialState = {
  accounts: [],
  account: null,
  total: 0,
  pagination: {
    currentPage: 1,
    totalPages: 1,
    pageSize: 10,
  },
  isLoading: false,
  error: null,
  scrapeStatus: {
    isLoading: false,
    success: false,
    error: null,
  },
};

// Get accounts with optional filtering
export const getAccounts = createAsyncThunk(
  'accounts/getAccounts',
  async (params, thunkAPI) => {
    try {
      const response = await accountsAPI.getAccounts(params);
      return {
        accounts: response.data.data,
        total: response.data.total,
        pagination: response.data.pagination,
      };
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to fetch accounts';
      return thunkAPI.rejectWithValue(message);
    }
  }
);

// Get single account by ID
export const getAccount = createAsyncThunk(
  'accounts/getAccount',
  async (id, thunkAPI) => {
    try {
      const response = await accountsAPI.getAccount(id);
      return response.data.data;
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to fetch account';
      return thunkAPI.rejectWithValue(message);
    }
  }
);

// Create new account
export const createAccount = createAsyncThunk(
  'accounts/createAccount',
  async (accountData, thunkAPI) => {
    try {
      const response = await accountsAPI.createAccount(accountData);
      return response.data.data;
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to create account';
      return thunkAPI.rejectWithValue(message);
    }
  }
);

// Update account
export const updateAccount = createAsyncThunk(
  'accounts/updateAccount',
  async ({ id, accountData }, thunkAPI) => {
    try {
      const response = await accountsAPI.updateAccount(id, accountData);
      return response.data.data;
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to update account';
      return thunkAPI.rejectWithValue(message);
    }
  }
);

// Delete account
export const deleteAccount = createAsyncThunk(
  'accounts/deleteAccount',
  async (id, thunkAPI) => {
    try {
      await accountsAPI.deleteAccount(id);
      return id;
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to delete account';
      return thunkAPI.rejectWithValue(message);
    }
  }
);

// Bulk import accounts
export const bulkImportAccounts = createAsyncThunk(
  'accounts/bulkImport',
  async (accountsData, thunkAPI) => {
    try {
      const response = await accountsAPI.bulkImport(accountsData);
      return response.data;
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to import accounts';
      return thunkAPI.rejectWithValue(message);
    }
  }
);

// Scrape account data
export const scrapeAccount = createAsyncThunk(
  'accounts/scrapeAccount',
  async (id, thunkAPI) => {
    try {
      const response = await scraperAPI.scrapeAccount(id);
      return response.data.data;
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to scrape account';
      return thunkAPI.rejectWithValue(message);
    }
  }
);

export const accountSlice = createSlice({
  name: 'accounts',
  initialState,
  reducers: {
    resetAccountState: (state) => {
      state.isLoading = false;
      state.error = null;
    },
    resetScrapeStatus: (state) => {
      state.scrapeStatus = {
        isLoading: false,
        success: false,
        error: null,
      };
    },
    setPage: (state, action) => {
      state.pagination.currentPage = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // Get accounts
      .addCase(getAccounts.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getAccounts.fulfilled, (state, action) => {
        state.isLoading = false;
        state.accounts = action.payload.accounts;
        state.total = action.payload.total;
        state.pagination = action.payload.pagination;
      })
      .addCase(getAccounts.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Get account
      .addCase(getAccount.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getAccount.fulfilled, (state, action) => {
        state.isLoading = false;
        state.account = action.payload;
      })
      .addCase(getAccount.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Create account
      .addCase(createAccount.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createAccount.fulfilled, (state, action) => {
        state.isLoading = false;
        state.accounts.unshift(action.payload);
      })
      .addCase(createAccount.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Update account
      .addCase(updateAccount.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateAccount.fulfilled, (state, action) => {
        state.isLoading = false;
        state.accounts = state.accounts.map((account) =>
          account._id === action.payload._id ? action.payload : account
        );
        state.account = action.payload;
      })
      .addCase(updateAccount.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Delete account
      .addCase(deleteAccount.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deleteAccount.fulfilled, (state, action) => {
        state.isLoading = false;
        state.accounts = state.accounts.filter(
          (account) => account._id !== action.payload
        );
      })
      .addCase(deleteAccount.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Bulk import accounts
      .addCase(bulkImportAccounts.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(bulkImportAccounts.fulfilled, (state, action) => {
        state.isLoading = false;
        state.accounts = [...state.accounts, ...action.payload.data];
      })
      .addCase(bulkImportAccounts.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Scrape account data
      .addCase(scrapeAccount.pending, (state) => {
        state.scrapeStatus.isLoading = true;
        state.scrapeStatus.error = null;
        state.scrapeStatus.success = false;
      })
      .addCase(scrapeAccount.fulfilled, (state, action) => {
        state.scrapeStatus.isLoading = false;
        state.scrapeStatus.success = true;
        state.account = action.payload.account;
        
        // Update account in accounts list if present
        if (state.accounts.length > 0) {
          state.accounts = state.accounts.map((account) =>
            account._id === action.payload.account._id
              ? action.payload.account
              : account
          );
        }
      })
      .addCase(scrapeAccount.rejected, (state, action) => {
        state.scrapeStatus.isLoading = false;
        state.scrapeStatus.error = action.payload;
      });
  },
});

export const { resetAccountState, resetScrapeStatus, setPage } = accountSlice.actions;
export default accountSlice.reducer; 