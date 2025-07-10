import React from 'react';
import { Provider } from 'react-redux';
import store from './store';

/**
 * Redux Provider component to wrap your application with the Redux store
 */
const ReduxProvider: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  return <Provider store={store}>{children}</Provider>;
};

export default ReduxProvider; 