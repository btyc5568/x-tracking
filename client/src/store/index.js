import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/authSlice';
import accountReducer from '../features/accounts/accountSlice';
import categoryReducer from '../features/categories/categorySlice';

const store = configureStore({
  reducer: {
    auth: authReducer,
    accounts: accountReducer,
    categories: categoryReducer,
  },
});

export default store; 