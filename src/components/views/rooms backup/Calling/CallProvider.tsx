import React, { useEffect } from 'react';
import ReduxProvider from './redux/ReduxProvider';
// import SocketInitializer from './SocketInitializer';
import CallUI from './components/CallUI';
import { initializeSocketIfNeeded } from './socketInitializer';
import { testAction } from './redux/actions';
import store from './redux/store';

/**
 * CallProvider is the main component that wraps all the call-related functionality.
 * It initializes the socket connection, provides Redux store, and renders the call UI.
 */
const CallProvider: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  useEffect(() => {
    // Initialize socket when component mounts
    const socket = initializeSocketIfNeeded();
    console.log("Socket initialized in CallProvider:", socket ? "success" : "failed");
    
    // Dispatch a test action to verify Redux is connected and DevTools can see it
    store.dispatch(testAction({ message: "CallProvider initialized" }));
    
    // Clean up when component unmounts
    return () => {
      // No need to do anything here as cleanup is handled in SocketInitializer
    };
  }, []);
  
  return (
    <ReduxProvider>
      {/* <SocketInitializer /> */}
      {children}
      <CallUI />
    </ReduxProvider>
  );
};

export default CallProvider; 