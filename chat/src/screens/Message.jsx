import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react"
import { 
    Animated, 
    Easing, 
    FlatList, 
    InputAccessoryView, 
    Keyboard, 
    KeyboardAvoidingView,
    Platform, 
    SafeAreaView, 
    Text, 
    TextInput, 
    TouchableOpacity, 
    View 
} from "react-native"
import MaterialIcons from "react-native-vector-icons/MaterialIcons"
import useGlobal from "../core/global"
import utils from "../core/utils"
import Thumbnail from "../common/Thumbnail"



function MessageHeader({ friend }) {
	// Get first and last name safely
	const firstName = friend?.first_name || '';
	const lastName = friend?.last_name || '';
	const username = friend?.username || '';
	// Get online status from FriendList if available
	const FriendList = useGlobal(state => state.FriendList) || [];
	let isOnline = false;
	if (friend && friend.username) {
		const match = FriendList.find(
			f => f.friend && f.friend.username === friend.username
		);
		if (match && typeof match.online !== "undefined") {
			if (typeof match.online === "boolean") {
				isOnline = match.online;
			} else if (typeof match.online === "string") {
				isOnline = match.online.toLowerCase() === "true";
			} else if (typeof match.online === "number") {
				isOnline = match.online === 1;
			}
		}
	} else {
		// fallback to friend.online if not found in FriendList
		if (typeof friend.online === "boolean") {
			isOnline = friend.online;
		} else if (typeof friend.online === "string") {
			isOnline = friend.online.toLowerCase() === "true";
		} else if (typeof friend.online === "number") {
			isOnline = friend.online === 1;
		}
	}
	return  (
		<View
			style={{
				flex: 1, 
				flexDirection: 'row', 
				alignItems: 'center'
			}}
		>
			<Thumbnail
				url={friend.thumbnail}
				size={30}
			/>
			<View style={{ marginLeft: 10 }}>
				<Text
					style={{
						color: '#202020',
						fontSize: 17,
						fontWeight: 'bold'
					}}
				>
					{firstName} {lastName}
				</Text>
				{username && (
					<Text
						style={{
							color: '#707070',
							fontSize: 12
						}}
					>
						@{username}
					</Text>
				)}
				<Text style={{
					marginLeft: 8,
					color: isOnline ? '#4CAF50' : '#E53935',
					fontWeight: 'bold',
					fontSize: 13,
				}}>
					{isOnline ? "Online" : "Offline"}
				</Text>
			</View>
		</View>
	)
}




function MessageBubbleMe({ text }) {
	return (
		<View
			style={{
				flexDirection: 'row',
				padding: 4,
				paddingRight: 12
			}}
		>
			<View style={{ flex: 1}} />
			<View
				style={{
					backgroundColor: 'rgba(229, 57, 53, 0.85)', // Red theme
					borderRadius: 21,
					maxWidth: '75%',
					paddingHorizontal: 16,
					paddingVertical: 12,
					justifyContent: 'center',
					marginRight: 8,
					minHeight: 42,
					borderWidth: 0.5,
					borderColor: 'rgba(255, 255, 255, 0.1)', // Subtle border
				}}
			>
				<Text
					style={{
						color: 'white',
						fontSize: 16,
						lineHeight: 18
					}}
				>
					{text}
				</Text>
			</View>
			
		</View>
	)
}




function MessageTypingAnimation({ offset }) {
	const y = useRef(new Animated.Value(0)).current

	useEffect(() => {
		const total = 1000
		const bump = 200

		const animation = Animated.loop(
			Animated.sequence([
				Animated.delay(bump * offset),
				Animated.timing(y, {
					toValue: 1,
					duration: bump,
					easing: Easing.linear,
					useNativeDriver: true
				}),
				Animated.timing(y, {
					toValue: 0,
					duration: bump,
					easing: Easing.linear,
					useNativeDriver: true
				}),
				Animated.delay(total - bump * 2 - bump * offset),
			])
		)
		animation.start()
		return () => {
			animation.stop()
		}
	}, [])

	const translateY = y.interpolate({
		inputRange: [0, 1],
		outputRange: [0, -8]
	})

	return (
		<Animated.View
			style={{
				width: 8,
				height: 8,
				marginHorizontal: 1.5,
				borderRadius: 4,
				backgroundColor: '#606060',
				transform: [{ translateY }]
			}}
		/>
	)
}




// Update MessageBubble to remove sender name
function MessageBubble({ index, message, friend, connectionId }) {
	const messagesTyping = useGlobal(state => state.messagesTyping)
	const typingUser = useGlobal(state => state.typingUser)
	const messagesTypingConnectionId = useGlobal(state => state.messagesTypingConnectionId)
	const currentUser = useGlobal(state => state.user)
	
	// Format timestamp with a check to ensure function exists
	const formatTimestamp = (dateString) => {
		if (!dateString) return '';
		
		// Use a simple fallback if formatTime isn't available
		if (!utils.formatTime) {
			const date = new Date(dateString);
			return date.toLocaleTimeString();
		}
		
		return utils.formatTime(dateString);
	};

	// Show typing indicator only if the other user is typing in this chat
	if (index === 0) {
		if (
			messagesTyping &&
			typingUser &&
			friend &&
			friend.username === typingUser &&
			connectionId === messagesTypingConnectionId
		) {
			return <MessageBubbleFriend typing={true} />;
		}
		return null;
	}

	// Only process real messages
	if (!message || message.id === -1) {
		return null;
	}

	// Determine if this message is from the current user
	const isMine = Boolean(
		message.is_me || 
		(currentUser?.username && message.sender?.username === currentUser.username)
	);

	// If this message is NOT mine, and status is delivered, send read event
	useEffect(() => {
		if (!isMine && message.status === 'delivered') {
			// Send message.read event via WebSocket
			const socket = useGlobal.getState().socket;
			if (socket && socket.readyState === 1) {
				socket.send(JSON.stringify({
					source: 'message.read',
					message_id: message.id
				}));
			}
		}
	}, [isMine, message.status, message.id]);

	// Render the appropriate message bubble based on who sent it
	if (isMine) {
		// Dot indicator logic
		let dotColor = 'gray';
		let dotCount = 1;
		if (message.status === 'delivered') dotCount = 2;
		if (message.status === 'read') {
			dotCount = 2;
			dotColor = 'green';
		}
		return (
			<View style={{ marginBottom: 8 }}>
				<MessageBubbleMe text={message.text || ''} />
				<View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginRight: 24, marginTop: 2 }}>
					{[...Array(dotCount)].map((_, i) => (
						<View key={i} style={{
							width: 7,
							height: 7,
							borderRadius: 4,
							backgroundColor: dotColor,
							marginLeft: i === 0 ? 0 : 3
						}} />
					))}
					{message.created && (
						<Text style={{
							color: 'rgba(150, 150, 160, 0.6)',
							fontSize: 11,
							textAlign: 'right',
							marginLeft: 6
						}}>{formatTimestamp(message.created)}</Text>
					)}
				</View>
			</View>
		);
	} else {
		// Show received message without sender name
		return (
			<View style={{ marginBottom: 12 }}>
				<MessageBubbleFriend text={message.text || ''} />
				{message.created && (
					<Text style={{
						color: 'rgba(150, 150, 160, 0.6)',
						fontSize: 11,
						marginLeft: 16,
						marginTop: 2
					}}>{formatTimestamp(message.created)}</Text>
				)}
			</View>
		);
	}
}

// Remove thumbnails from MessageBubbleFriend
function MessageBubbleFriend({ text='', typing=false }) {
	return (
		<View
			style={{
				flexDirection: 'row',
				padding: 4,
				paddingLeft: 16
			}}
		>
			<View
				style={{
					backgroundColor: 'rgba(40, 40, 45, 0.75)', 
					borderRadius: 21,
					maxWidth: '75%',
					paddingHorizontal: 16,
					paddingVertical: 12,
					justifyContent: 'center',
					minHeight: 42,
					borderWidth: 0.5,
					borderColor: 'rgba(255, 255, 255, 0.1)', 
				}}
			>
				{typing ? (
					<View style={{ flexDirection: 'row' }}>
						<MessageTypingAnimation offset={0} />
						<MessageTypingAnimation offset={1} />
						<MessageTypingAnimation offset={2} />
					</View>
				) : (
					<Text
						style={{
							color: 'rgba(255, 255, 255, 0.9)', 
							fontSize: 16,
							lineHeight: 18
						}}
					>
						{text}
					</Text>
				)}
				
			</View>
			<View style={{ flex: 1}} />
		</View>
	)
}


function MessageInput({ message, setMessage, onSend, style = {}, onFocus, onBlur }) {
	return (
		<View
			style={[{
				paddingHorizontal: 10,
				paddingBottom: 10,
				backgroundColor: 'rgba(25, 25, 30, 0.9)',
				flexDirection: 'row',
				alignItems: 'center',
				paddingTop: 8,
				borderTopWidth: 0.5,
				borderTopColor: 'rgba(80, 80, 90, 0.3)',
			}, style]}
		>
			<TextInput
				placeholder="Message..."
				placeholderTextColor='rgba(150, 150, 160, 0.7)'
				value={message}
				onChangeText={setMessage}
				onFocus={onFocus}
				onBlur={onBlur}
				style={{
					flex: 1,
					paddingHorizontal: 18,
					borderWidth: 1,
					borderRadius: 25,
					borderColor: 'rgba(80, 80, 90, 0.6)',
					backgroundColor: 'rgba(40, 40, 45, 0.7)',
					height: 50,
					color: 'white'
				}}
				autoCapitalize="none"
			/>
			<TouchableOpacity 
				onPress={onSend} 
				style={{
					width: 48,
					height: 48,
					borderRadius: 24,
					backgroundColor: 'rgba(40, 40, 45, 0.9)',
					justifyContent: 'center',
					alignItems: 'center',
					marginLeft: 8,
					borderWidth: 1,
					borderColor: 'rgba(229, 57, 53, 0.3)'
				}}
			>
				<MaterialIcons
					name="send"
					size={22}
					color="#E53935"
				/>
			</TouchableOpacity>
		</View>
	)
}



function MessagesScreen({ navigation, route }) {
	const [message, setMessage] = useState('')
	const [inputFocused, setInputFocused] = useState(false)
	const [loading, setLoading] = useState(false);
	const [loadingMore, setLoadingMore] = useState(false);
	const [keyboardHeight, setKeyboardHeight] = useState(0); // <-- add this line
	const [allMessages, setAllMessages] = useState([]);
	const [hasMore, setHasMore] = useState(true);
	typingTimeoutRef = useRef(null)
	const flatListRef = useRef(null) // <-- add this line
	const messageType = useGlobal(state => state.messageType)
	const currentUser = useGlobal(state => state.user)
	const friend = route?.params?.friend || {}
	const connectionId = route?.params?.id;
	const setActiveConnection = useGlobal(state => state.setActiveConnection);

	const messagesList = useGlobal(state => state.messagesList) || [];
	useEffect(() => {
		console.log('[DEBUG] messagesList updated:', messagesList.map(m => ({id: m.id, status: m.status})));
	}, [messagesList]);
	const messagesNext = useGlobal(state => state.messagesNext);

	const messageList = useGlobal(state => state.messageList); // <-- this is the function
	const messageSend = useGlobal(state => state.messageSend);

	// Set up keyboard listeners
	useEffect(() => {
		const keyboardWillShowListener = Keyboard.addListener(
			Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
			(e) => {
				const keyboardHeight = e.endCoordinates.height;
				setKeyboardHeight(keyboardHeight);
				// Scroll to top to show latest message when keyboard opens
				if (flatListRef.current && messagesList.length > 0) {
					setTimeout(() => {
						flatListRef.current.scrollToOffset({ offset: 0, animated: true });
					}, 100);
				}
			}
		);
		
		const keyboardWillHideListener = Keyboard.addListener(
			Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
			() => {
				setKeyboardHeight(0);
			}
		);

		return () => {
			keyboardWillShowListener.remove();
			keyboardWillHideListener.remove();
		};
	}, [messagesList])

	// Update the header 
	useLayoutEffect(() => {
		// Only set header if friend is available
		if (friend && Object.keys(friend).length > 0) {
			navigation.setOptions({
				headerTitle: () => (
					<View style={{ flexDirection: 'row', alignItems: 'center' }}>
						<MessageHeader friend={friend} />
						<TouchableOpacity
							style={{
								backgroundColor: '#E53935',
								marginLeft: 12,
								borderRadius: 20,
								width: 36,
								height: 36,
								alignItems: 'center',
								justifyContent: 'center',
								shadowColor: '#E53935',
								shadowOffset: { width: 0, height: 2 },
								shadowOpacity: 0.15,
								shadowRadius: 4,
							}}
							onPress={() => navigation.navigate('VideoCallScreen', {
								recipient: friend?.username,
								connectionId: connectionId // ensure this is available in scope
							})}
						>
							<Text style={{ fontSize: 20, color: 'white', fontWeight: 'bold' }}>📞</Text>
						</TouchableOpacity>
					</View>
				)
			})
		}
	}, [friend])

	useEffect(() => {
		// Only fetch messages if connectionId is available and messageList function exists
		if (connectionId && typeof messageList === 'function') {
			setLoading(true)
			try {
				messageList(connectionId)
			} catch (err) {
				console.error('Error loading messages:', err)
			}
		}
	}, [connectionId, messageList])

	// Listen for messagesList changes to turn off loading
	useEffect(() => {
		if (loading) setLoading(false);
		if (loadingMore) setLoadingMore(false);
	}, [messagesList]);

	// Instead of prepending, append older messages to the end
	useEffect(() => {
		// On initial load, set allMessages to the first batch
		if (messagesList && messagesList.length > 0 && !loadingMore) {
			setAllMessages(messagesList);
			setHasMore(!!messagesNext);
		}
	}, [messagesList]);

	const handleLoadMore = () => {
		if (messagesNext && connectionId && typeof messageList === 'function' && !loadingMore && hasMore) {
			setLoadingMore(true);
			messageList(connectionId, messagesNext);
		}
	};

	// When new messages are loaded (pagination), append them to allMessages
	useEffect(() => {
		if (loadingMore && messagesList && messagesList.length > 0) {
			setAllMessages(prev => {
				// Avoid duplicates
				const existingIds = new Set(prev.map(m => m.id));
				const newMessages = messagesList.filter(m => !existingIds.has(m.id));
				return [...prev, ...newMessages];
			});
			setHasMore(!!messagesNext);
		}
	}, [messagesList, loadingMore]);

	// Update allMessages when a new message is sent
	useEffect(() => {
		if (messagesList && messagesList.length > 0 && messagesList[0].is_me) {
			setAllMessages(prev => {
				// Avoid duplicates
				const existingIds = new Set(prev.map(m => m.id));
				const newMessages = messagesList.filter(m => !existingIds.has(m.id));
				return [...newMessages, ...prev];
			});
		}
	}, [messagesList]);

	// Show a loading state or placeholder if messageList function doesn't exist
	if (!messageList) {
		return (
			<SafeAreaView style={{ flex: 1, backgroundColor: '#121214', justifyContent: 'center', alignItems: 'center' }}>
				<Text style={{ color: 'white' }}>Message functionality not available</Text>
			</SafeAreaView>
		)
	}
	if (loading) {
		return (
			<SafeAreaView style={{ flex: 1, backgroundColor: '#121214', justifyContent: 'center', alignItems: 'center' }}>
				<Text style={{ color: 'white' }}>Loading messages...</Text>
			</SafeAreaView>
		);
	}

	// Mark messages as read when they become visible in the chat, with debug logging
	const handleViewableItemsChanged = ({ viewableItems }) => {
		const socket = useGlobal.getState().socket;
		viewableItems.forEach(({ item }) => {
			if (item && item.id && item.status === 'delivered' && !item.is_me) {
				console.log('[DEBUG] Marking message as read:', item.id, item.text);
				if (socket && socket.readyState === 1) {
					socket.send(JSON.stringify({
						source: 'message.read',
						message_id: item.id
					}));
					console.log('[DEBUG] Sent message.read event for:', item.id);
				} else {
					console.log('[DEBUG] Socket not ready for message.read:', item.id);
				}
			}
		});
	};

	const onType = (value) => {
		setMessage(value);
		// Only send typing event if input is focused and messageType exists
		if (inputFocused && friend?.username && typeof messageType === 'function') {
			messageType(friend.username);
			// Debounce: clear previous timeout and set new one
			if (typingTimeoutRef.current) {
				clearTimeout(typingTimeoutRef.current);
			}
			typingTimeoutRef.current = setTimeout(() => {
				useGlobal.setState({
					messagesTyping: null,
					typingUser: null,
					messagesTypingConnectionId: null
				});
			}, 2000);
		}
	};

	const onSend = () => {
		// Only send if message is valid, connectionId exists and messageSend function exists
		if (!connectionId || typeof messageSend !== 'function') return;
		const cleaned = message.replace(/\s+/g, ' ').trim();
		if (cleaned.length === 0) return;
		console.log("Sending message with connection ID:", connectionId);
		messageSend(connectionId, cleaned);
		setMessage('');
	};

	return (
		<SafeAreaView style={{ flex: 1, backgroundColor: '#121214' }}>
			{/* Log connection ID when component renders */}
			{console.log("Current connection ID:", connectionId)}
            
			{/* Replace KeyboardAvoidingView with a simpler approach */}
			<View style={{ flex: 1, position: 'relative' }}>
				{/* Messages list */}
				<FlatList
					ref={flatListRef}
					style={{ flex: 1 }}
					contentContainerStyle={{
						paddingTop: 30,
						paddingBottom: Platform.OS === 'ios' ? 0 : 70,
					}}
					data={allMessages && allMessages.length > 0 ? [{id: -1}, ...allMessages] : [{id: -1}]}
					inverted={true}
					keyExtractor={item => String(item.id || 'typing')}
					onEndReached={handleLoadMore}
					onEndReachedThreshold={0.2}
					onViewableItemsChanged={handleViewableItemsChanged}
					viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
					renderItem={({ item, index}) => (
						<MessageBubble
							index={index}
							message={item}
							friend={friend}
							connectionId={connectionId}
						/>
					)}
					ListFooterComponent={loadingMore ? (
						<View style={{ padding: 16, alignItems: 'center' }}>
							<Text style={{ color: 'white' }}>Loading more messages...</Text>
						</View>
					) : null}
				/>
				{/* Message input - conditionally render based on platform */}
				<MessageInput 
					message={message}
					setMessage={onType}
					onSend={onSend}
					onFocus={() => setInputFocused(true)}
					onBlur={() => setInputFocused(false)}
				/>
				{/* Video call button is now in the header */}
			</View>
		</SafeAreaView>
	);
}

export default MessagesScreen;