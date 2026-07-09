import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_URL } from '../config/api';
import { useAuth } from './AuthContext';
import { getToken } from '../services/storage';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState({});
  const [incomingCall, setIncomingCall] = useState(null);

  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setConnected(false);
      return;
    }

    async function connect() {
      const token = await getToken();
      const socket = io(SOCKET_URL, {
        auth: { token },
        transports: ['websocket'],
      });

      socket.on('connect', () => setConnected(true));
      socket.on('disconnect', () => setConnected(false));

      socket.on('user:online', ({ userId }) => {
        setOnlineUsers(prev => ({ ...prev, [userId]: 'online' }));
      });

      socket.on('user:offline', ({ userId, lastSeen }) => {
        setOnlineUsers(prev => ({ ...prev, [userId]: 'offline', [`${userId}_lastSeen`]: lastSeen }));
      });

      socket.on('call:incoming', (data) => {
        setIncomingCall(data);
      });

      socket.on('call:answered', () => {
        setIncomingCall(null);
      });

      socket.on('call:ended', () => {
        setIncomingCall(null);
      });

      socketRef.current = socket;
    }

    connect();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [user]);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, connected, onlineUsers, incomingCall, setIncomingCall }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
