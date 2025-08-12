import { create } from "zustand";
import secure from './secure';
import api from './api';
import utils from './utils';
const adress = '10.0.2.2:8000';

// Socket response handlers (unchanged)
function responseMessageDelivered(set, get, data) {
    set(state => {
        const updatedMessages = (state.messagesList || []).map(msg =>
            msg.id === data.message_id ? { ...msg, status: data.status } : msg
        );
        return { messagesList: [...updatedMessages] };
    });
}

function responseThumbnail(set, get, data) {
    if (data && data.thumbnail) {
        console.log("Received thumbnail URL from backend:", data.thumbnail);
    }
    set((state) => ({
        user: data
    }));
}

function responseMessageRead(set, get, data) {
    set(state => {
        const updatedMessages = (state.messagesList || []).map(msg =>
            msg.id === data.message_id ? { ...msg, status: data.status } : msg
        );
        return { messagesList: updatedMessages };
    });
}

function responseSearch(set, get, data) {
    set({ searchList: data });
}

function responseRequest(set, get, data) {
    const user = get().user;
    const searchList = [...get().searchList];
    const requestList = [...get().requestList];
    let updated = false;

    if (user.username === data.sender.username) {
        const searchIndex = searchList.findIndex(
            u => u.username === data.receiver.username
        );
        if (searchIndex >= 0) {
            searchList[searchIndex].status = 'pending_them';
            updated = true;
        }
        requestList.push(data);
        updated = true;
    }
    else if (user.username === data.receiver.username) {
        const searchIndex = searchList.findIndex(
            u => u.username === data.sender.username
        );
        if (searchIndex >= 0) {
            searchList[searchIndex].status = 'pending_me';
            updated = true;
        }
        requestList.push(data);
        updated = true;
    }

    if (updated) {
        set({ searchList, requestList });
    }
}

function responseRequestList(set, get, data) {
   set((state) => ({
        requestList: data
    }));
}

function responseRequestAccept(set, get, data) {
    const requestList = get().requestList.filter(request => request.id !== data.id);
    const searchList = [...get().searchList].map(user => {
        if (user.username === data.sender.username || 
            user.username === data.receiver.username) {
            return {...user, status: 'connected'};
        }
        return user;
    });
    set({ requestList, searchList });
}

function responseFriendList(set, get, data) {
    console.log("Received friend list:", data);
    set({ FriendList: data });
}

function responseMessageList(set, get, data) {
    const currentUser = get().user;
    const processedMessages = Array.isArray(data.messages) ? data.messages.map(message => {
        const is_me = message.sender && currentUser && message.sender.username === currentUser.username;
        return {
            ...message,
            is_me
        };
    }) : [];
    
    set({ 
        messagesList: processedMessages,
        messagesNext: data.next
    });
}

function responseMessageSend(set, get, data) {
    const currentUser = get().user;
    const newMessage = {
        ...data,
        is_me: data.sender && currentUser && data.sender.username === currentUser.username,
        connection_id: data.connection
    };
    const messagesList = [newMessage, ...(get().messagesList || [])];

    const activeConnectionId = get().activeConnectionId;
    if (
        !newMessage.is_me &&
        data.connection &&
        activeConnectionId !== data.connection
    ) {
        const unreadMessages = { ...(get().unreadMessages || {}) };
        unreadMessages[data.connection] = (unreadMessages[data.connection] || 0) + 1;
        set({ unreadMessages });
    }

    set({ messagesList });
}

function responseMessageTyping(set, get, data) {
    const currentUser = get().user;
    if (data.username !== currentUser.username) {
        set({ 
            messagesTyping: new Date(),
            typingUser: data.username,
            messagesTypingConnectionId: data.connection_id
        });
        console.log(`User ${data.username} is typing...`);

        if (get()._typingTimeout) {
            clearTimeout(get()._typingTimeout);
        }
        const timeout = setTimeout(() => {
            set({
                messagesTyping: null,
                typingUser: null,
                messagesTypingConnectionId: null,
                _typingTimeout: null
            });
        }, 2000);
        set({ _typingTimeout: timeout });
    }
}

function responseUserStatus(set, get, data) {
    const { username, online } = data;
    const FriendList = (get().FriendList || []).map(item => {
        if (item.friend && item.friend.username === username) {
            return {
                ...item,
                online
            };
        }
        return item;
    });
    set({ FriendList });
}

const useGlobalStore = create((set, get) => ({
    // Video call state
    videoSocket: null,
    videoSocketReady: false,
    incomingCall: null,
    activeCallHandler: null,
    // Buffer for signaling messages that arrive before handler is attached
    pendingVideoSignals: [],
    
    // Set active call handler and flush any pending signals
    setActiveCallHandler: (handler) => {
        set({ activeCallHandler: handler });
        if (handler) {
            const pending = get().pendingVideoSignals || [];
            if (pending.length) {
                // Flush in order
                pending.forEach(msg => {
                    try { handler(msg); } catch (e) { console.warn('[VideoCall] handler flush error', e); }
                });
                set({ pendingVideoSignals: [] });
            }
        }
    },
    
    // Connect to video signaling WebSocket (global, persistent)
    videoSocketConnect: async () => {
        try {
            // Close previous socket if exists
            if (get().videoSocket) {
                get().videoSocket.close();
            }
            const tokens = await secure.getSecureData('tokens');
            if (!tokens?.access) {
                throw new Error('No access token available');
            }
            const wsUrl = `ws://${adress}/ws/video/?token=${tokens.access}`;
            const ws = new WebSocket(wsUrl);
            set({ videoSocket: ws, videoSocketReady: false });
            
            ws.onopen = () => {
                utils.log('[VideoCall] WebSocket connected');
                set({ videoSocketReady: true });
                // Send ping to verify connection
                ws.send(JSON.stringify({ action: 'ping' }));
            };
            
            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                console.log('[global.js] WebSocket received:', data);
                
                // Global call handling
                if (data.action === 'call') {
                    console.log('[global.js] Setting incomingCall:', data);
                    // FIX: Normalize username to lowercase
                    set({ 
                        incomingCall: {
                            caller: data.caller.toLowerCase(),
                            recipient: data.recipient,
                            recipientOnline: data.recipient_online
                        }
                    });
                }
                
                // Active call handling with buffering for early messages
                const { activeCallHandler } = get();
                if (activeCallHandler) {
                    try {
                        activeCallHandler(data);
                    } catch (e) {
                        console.warn('[VideoCall] activeCallHandler error', e);
                    }
                } else if (['offer', 'answer', 'candidate', 'end-call', 'accept'].includes(data.action)) {
                    // Buffer until handler is set by the call screen
                    const buf = get().pendingVideoSignals || [];
                    set({ pendingVideoSignals: [...buf, data] });
                }
            };
            
            ws.onerror = (err) => {
                utils.log('[VideoCall] WebSocket error:', err);
                set({ videoSocket: null, videoSocketReady: false });
            };
            
            ws.onclose = (e) => {
                utils.log('[VideoCall] WebSocket closed:', e);
                set({ videoSocket: null, videoSocketReady: false });

                // Attempt reconnect if still authenticated
                if (get().authenticated) {
                    setTimeout(() => get().videoSocketConnect(), 3000);
                }
            };
        } catch (error) {
            console.error('[VideoCall] videoSocketConnect error:', error);
            set({ videoSocket: null, videoSocketReady: false });
        }
    },

    // Send video signaling data
    sendVideoSignal: (data) => {
        // FIX: Normalize recipient to lowercase before sending
        if (data.recipient) {
            data.recipient = data.recipient.toLowerCase();
        }
        const ws = get().videoSocket;
        if (ws && get().videoSocketReady) {
            ws.send(JSON.stringify(data));
        } else {
            utils.log('[VideoCall] Tried to send signal but socket not ready');
        }
    },

    // Clear incoming call notification
    clearIncomingCall: () => set({ incomingCall: null }),

    // Initial state
    initialized: false,
    authenticated: false,
    user: {},
    socket: null,
    unreadMessages: {},
    activeConnectionId: null,

    // Initialize global store
    init: async () => {
        try {
            const credentials = await secure.getSecureData('credentials');
            if (!credentials) {
                set({ initialized: true });
                return;
            }

            const response = await api.post('signin/', {
                username: credentials.username,
                password: credentials.password
            });

            if (response) {
                const user = response.data.user;
                utils.log("Sign-in successful:", response.data);
                set({
                    initialized: true,
                    authenticated: true,
                    user: {
                        ...user,
                        tokens: response.data.tokens
                    },
                });
                await secure.storeSecureData('tokens', response.data.tokens);

                // Connect to video signaling after successful silent sign-in
                get().videoSocketConnect();
            }
        } catch (error) {
            console.error("Error initializing global store:", error);
            set({ initialized: true });
        }
    },

    // Login handler
    login: async (credentials, user, tokens) => {
        try {
            await secure.storeSecureData('credentials', credentials);
            await secure.storeSecureData('tokens', tokens);
            utils.log('Global login:', user);
            set({ authenticated: true, user: user });

            // Connect to video signaling on login
            get().videoSocketConnect();
        } catch (error) {
            console.error("Login error:", error);
            throw error;
        }
    },

    // Logout handler
    logout: async () => {
        try {
            await secure.removeSecureData('credentials');
            await secure.removeSecureData('tokens');
            set(state => {
                if (state.socket) {
                    state.socket.close();
                }
                if (state.videoSocket) {
                    state.videoSocket.close();
                }
                return { 
                    authenticated: false, 
                    user: {}, 
                    tokens: null, 
                    socket: null,
                    videoSocket: null,
                    videoSocketReady: false
                };
            });
        } catch (error) {
            console.error("Logout error:", error);
        }
    },

    // Connect to chat WebSocket
    socketconnect: async () => {
        try {
            const tokens = await secure.getSecureData('tokens');
            if (!tokens?.access) {
                throw new Error("No access token available");
            }

            const socket = new WebSocket(`ws://${adress}/chat/?token=${tokens.access}`);
            
            socket.onopen = () => {
                utils.log("WebSocket connection established");
                set({ socket });
                socket.send(JSON.stringify({
                    source : 'request.list'
                })),
                socket.send(JSON.stringify({
                    source : 'friend.list'
                }))
            };

            socket.onmessage = (event) => {
                const data = JSON.parse(event.data);
                utils.log("WebSocket message received:", data);
                const responses = {
                    'thumbnail': responseThumbnail,
                    'search': responseSearch,
                    "request.connect": responseRequest,
                    "request.list": responseRequestList,
                    'request.accept': responseRequestAccept,
                    "friend.list": responseFriendList,
                    "message.list": responseMessageList,
                    "message.send": responseMessageSend,
                    "message.typing": responseMessageTyping,
                    "user.status": responseUserStatus,
                    "message.read": responseMessageRead,
                    "message.delivered": responseMessageDelivered,
                };
                const resp = responses[data.source];
                if (!resp){
                    utils.log('data.source " '+ data.source + '" not found');
                    return;
                }
                resp(set,get,data.data)
            };

            socket.onerror = (error) => {
                utils.log("WebSocket error:", error);
                set({ socket: null });
            };

            socket.onclose = () => {
                utils.log("WebSocket connection closed");
                set({ socket: null });
            };

        } catch (error) {
            console.error("WebSocket connection error:", error);
            throw error;
        }
    },

    // Close chat socket
    socketclose: () => {
        set(state => {
            if (state.socket) {
                state.socket.close();
            }
            return { socket: null };
        });
    },

    // Thumbnail upload
    uploadTHumbnail: (file) => {
        const socket = get().socket;
        if (socket && socket.readyState === 1 && file && file.base64) {
            socket.send(JSON.stringify({
                source: 'thumbnail',
                base64: file.base64,
                filename: file.fileName
            }));
        } else {
            console.warn("WebSocket not connected or file invalid");
        }
    },

    // Search
    searchList: [],
    searchUsers: async (query) => {
        if(query){
            const socket = get().socket;
            socket.send(JSON.stringify({
                source: 'search',
                query: query
            }));
        }
        else {
            set({ searchList: [] });
        }
    },

    // Connection requests
    requestList: [],
    requestConnect : async (username) => {
        if(username){
            const socket = get().socket;
            socket.send(JSON.stringify({
                source: 'request.connect',
                username: username
            }));
        }
    },
    requestAccept : async (username) => {
        if(username){
            const socket = get().socket;
            socket.send(JSON.stringify({
                source: 'request.accept',
                username: username
            }));
        }
    },
    
    // Friends list
    FriendList : null,

    // Messaging
    messagesList: [],
    messagesNext: null,
    messagesTyping: null,
    typingUser: null,
    messagesTypingConnectionId: null,
    _typingTimeout: null,
    
    // Load messages
    messageList: (connectionId, next = null) => {
        const socket = get().socket;
        if (socket && socket.readyState === 1) {
            socket.send(JSON.stringify({
                source: 'message.list',
                connection_id: connectionId,
                next: next
            }));
        }
    },
    
    // Send message
    messageSend: (connectionId, text) => {
        const socket = get().socket;
        if (socket && socket.readyState === 1) {
            socket.send(JSON.stringify({
                source: 'message.send',
                connection_id: connectionId,
                text: text
            }));
        }
    },
    
    // Send typing indicator
    messageType: (username) => {
        const socket = get().socket;
        if (socket && socket.readyState === 1) {
            socket.send(JSON.stringify({
                source: 'message.typing',
                username: username
            }));
        }
    },
    
    // Clear unread messages
    clearUnread: (connectionId) => {
        const unreadMessages = { ...(get().unreadMessages || {}) };
        if (connectionId && unreadMessages[connectionId]) {
            unreadMessages[connectionId] = 0;
            set({ unreadMessages });
        }
    },
    
    // Set active connection
    setActiveConnection: (connectionId) => set({ activeConnectionId: connectionId }),
}));

export default useGlobalStore;