import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { categoriesAPI } from '../../api/api';

const initialState = {
  categories: [],
  category: null,
  categoryAccounts: [],
  total: 0,
  pagination: {
    currentPage: 1,
    totalPages: 1,
    pageSize: 20,
  },
  isLoading: false,
  error: null,
};

// Get all categories
export const getCategories = createAsyncThunk(
  'categories/getCategories',
  async (params, thunkAPI) => {
    try {
      const response = await categoriesAPI.getCategories(params);
      return {
        categories: response.data.data,
        total: response.data.total,
        pagination: response.data.pagination,
      };
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to fetch categories';
      return thunkAPI.rejectWithValue(message);
    }
  }
);

// Get single category by ID
export const getCategory = createAsyncThunk(
  'categories/getCategory',
  async (id, thunkAPI) => {
    try {
      const response = await categoriesAPI.getCategory(id);
      return response.data.data;
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to fetch category';
      return thunkAPI.rejectWithValue(message);
    }
  }
);

// Create new category
export const createCategory = createAsyncThunk(
  'categories/createCategory',
  async (categoryData, thunkAPI) => {
    try {
      const response = await categoriesAPI.createCategory(categoryData);
      return response.data.data;
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to create category';
      return thunkAPI.rejectWithValue(message);
    }
  }
);

// Update category
export const updateCategory = createAsyncThunk(
  'categories/updateCategory',
  async ({ id, categoryData }, thunkAPI) => {
    try {
      const response = await categoriesAPI.updateCategory(id, categoryData);
      return response.data.data;
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to update category';
      return thunkAPI.rejectWithValue(message);
    }
  }
);

// Delete category
export const deleteCategory = createAsyncThunk(
  'categories/deleteCategory',
  async (id, thunkAPI) => {
    try {
      await categoriesAPI.deleteCategory(id);
      return id;
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to delete category';
      return thunkAPI.rejectWithValue(message);
    }
  }
);

// Get accounts in a category
export const getCategoryAccounts = createAsyncThunk(
  'categories/getCategoryAccounts',
  async ({ id, params }, thunkAPI) => {
    try {
      const response = await categoriesAPI.getCategoryAccounts(id, params);
      return {
        accounts: response.data.data,
        total: response.data.total,
        pagination: response.data.pagination,
        categoryName: response.data.category,
      };
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to fetch category accounts';
      return thunkAPI.rejectWithValue(message);
    }
  }
);

export const categorySlice = createSlice({
  name: 'categories',
  initialState,
  reducers: {
    resetCategoryState: (state) => {
      state.isLoading = false;
      state.error = null;
    },
    setPage: (state, action) => {
      state.pagination.currentPage = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // Get categories
      .addCase(getCategories.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getCategories.fulfilled, (state, action) => {
        state.isLoading = false;
        state.categories = action.payload.categories;
        state.total = action.payload.total;
        state.pagination = action.payload.pagination;
      })
      .addCase(getCategories.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Get category
      .addCase(getCategory.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getCategory.fulfilled, (state, action) => {
        state.isLoading = false;
        state.category = action.payload;
      })
      .addCase(getCategory.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Create category
      .addCase(createCategory.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createCategory.fulfilled, (state, action) => {
        state.isLoading = false;
        state.categories.unshift(action.payload);
      })
      .addCase(createCategory.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Update category
      .addCase(updateCategory.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateCategory.fulfilled, (state, action) => {
        state.isLoading = false;
        state.categories = state.categories.map((category) =>
          category._id === action.payload._id ? action.payload : category
        );
        state.category = action.payload;
      })
      .addCase(updateCategory.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Delete category
      .addCase(deleteCategory.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deleteCategory.fulfilled, (state, action) => {
        state.isLoading = false;
        state.categories = state.categories.filter(
          (category) => category._id !== action.payload
        );
      })
      .addCase(deleteCategory.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Get category accounts
      .addCase(getCategoryAccounts.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getCategoryAccounts.fulfilled, (state, action) => {
        state.isLoading = false;
        state.categoryAccounts = action.payload.accounts;
        state.total = action.payload.total;
        state.pagination = action.payload.pagination;
      })
      .addCase(getCategoryAccounts.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

export const { resetCategoryState, setPage } = categorySlice.actions;
export default categorySlice.reducer; 