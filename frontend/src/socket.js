import { io } from 'socket.io-client';

export const getSocketServerUrl = () => {
  if (typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return `${window.location.protocol}//${window.location.hostname}:5000`;
  }
  return import.meta.env.VITE_SOCKET_SERVER_URL || 'http://localhost:5000';
};

export const SOCKET_SERVER_URL = getSocketServerUrl();

export const initSocket = () => {
  return io(getSocketServerUrl(), {
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    transports: ['websocket', 'polling'],
    withCredentials: true
  });
};
