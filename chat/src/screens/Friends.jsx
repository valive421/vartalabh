import { ActivityIndicator, FlatList, SafeAreaView, Text, TouchableOpacity, View, StyleSheet } from "react-native"
import Cell from "../common/Cell"
import Empty from "../common/Empty"
import { useEffect } from "react";
import useGlobal from "../core/global"
import Thumbnail from "../common/Thumbnail"
import utils from "../core/utils"

function formatUpdatedTime(updated) {
	if (!updated) return '';
	const now = new Date();
	const date = new Date(updated);
	const diffMs = now - date;
	const diffSec = Math.floor(diffMs / 1000);
	const diffMin = Math.floor(diffSec / 60);
	const diffHr = Math.floor(diffMin / 60);
	const diffDay = Math.floor(diffHr / 24);

	if (diffSec < 60) return 'just now';
	if (diffMin < 60) return `${diffMin} min ago`;
	if (diffHr < 2) return '1 hr ago';
	if (diffHr < 24) return `${diffHr} hr ago`;
	if (diffDay === 1) return 'yesterday';
	if (diffDay < 7) return 'last week';
	return 'old';
}
function FriendRow({ navigation, item, unread, latestMessage, onClearUnread }) {
	// Extract friend properties safely
	const firstName = item.friend?.first_name || '';
	const lastName = item.friend?.last_name || '';
	const username = item.friend?.username || '';
	const thumbnail = item.friend?.thumbnail || null;

	// Use latestMessage for preview if available
	const previewText = latestMessage?.text || (typeof item.preview === 'string' ? item.preview : '');
	// Robust online status logic (copied from Message.jsx)
	const FriendList = useGlobal(state => state.FriendList) || [];
	let isOnline = false;
	if (item.friend && item.friend.username) {
		const match = FriendList.find(
			f => f.friend && f.friend.username === item.friend.username
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
		if (typeof item.friend?.online === "boolean") {
			isOnline = item.friend.online;
		} else if (typeof item.friend?.online === "string") {
			isOnline = item.friend.online.toLowerCase() === "true";
		} else if (typeof item.friend?.online === "number") {
			isOnline = item.friend.online === 1;
		}
	}

	return (
		<View style={styles.rowOuter}>
			<TouchableOpacity 
				onPress={() => {
					navigation.navigate('Messages', item);
					if (onClearUnread) onClearUnread(item.id);
				}}
				style={[styles.friendRowContainer, unread ? styles.unreadHighlight : null]}
			>
				<View style={styles.avatarContainer}>
					<Thumbnail url={thumbnail} size={48} />
					<View style={[styles.activeIndicator, isOnline ? styles.onlineIndicator : styles.offlineIndicator]} />
				</View>
				<View style={styles.contentContainer}>
					<View style={styles.nameContainer}>
						<Text style={styles.nameText}>{firstName} {lastName}</Text>
						<Text style={styles.usernameText}>@{username}</Text>
					</View>
					<Text numberOfLines={1} style={[styles.previewText, unread ? styles.unreadPreviewText : null]}>{previewText}</Text>
					{item.updated && (
						<View style={styles.timeContainer}>
							<Text style={styles.timeText}>{formatUpdatedTime(item.updated)}</Text>
						</View>
					)}
				</View>
			</TouchableOpacity>
			<TouchableOpacity
				style={styles.videoCallButton}
				onPress={() => {
					navigation.navigate('VideoCallScreen', {
						recipient: username,
						connectionId: item.id
					});
				}}
			>
				<Text style={styles.videoCallButtonIcon}>📞</Text>
			</TouchableOpacity>
		</View>
	);
}

function FriendsScreen({ navigation }) {
	const friendList = useGlobal(state => state.FriendList);
	const unreadMessages = useGlobal(state => state.unreadMessages);
	const messagesList = useGlobal(state => state.messagesList);
	const clearUnread = useGlobal(state => state.clearUnread);

	// Map connection_id to latest unread message
	const latestUnread = {};
	if (Array.isArray(messagesList)) {
		messagesList.forEach(msg => {
			// Use msg.connection_id for mapping
			if (!msg.is_me && unreadMessages[msg.connection_id] > 0) {
				latestUnread[msg.connection_id] = msg;
			}
		});
	}

	// Show loading indicator
	if (friendList === null) {
		return (
			<SafeAreaView style={styles.loadingContainer}>
				<View style={styles.loadingGlass}>
					<ActivityIndicator size="large" color="#E53935" />
					<Text style={styles.loadingText}>Loading conversations...</Text>
				</View>
			</SafeAreaView>
		);
	}

	// Show empty if no requests
	if (!friendList || friendList.length === 0) {
		return (
			<SafeAreaView style={styles.container}>
				<View style={styles.headerContainer}>
					<Text style={styles.headerTitle}>Conversations</Text>
				</View>
				<View style={styles.emptyStateContainer}>
					<View style={styles.emptyGlass}>
						<Empty 
							icon='forum' 
							message='No conversations yet'
							style={{
								iconColor: 'rgba(229, 57, 53, 0.7)', // Changed to red
								textColor: 'rgba(255, 255, 255, 0.9)'
							}}
						/>
					</View>
				</View>
			</SafeAreaView>
		);
	}

	// Show friend list
	return (
		<SafeAreaView style={styles.container}>
			<View style={styles.headerContainer}>
				<Text style={styles.headerTitle}>Conversations</Text>
			</View>
			<FlatList
				style={styles.listContainer}
				contentContainerStyle={styles.listContent}
				data={friendList}
				renderItem={({ item }) => (
					<FriendRow
						navigation={navigation}
						item={item}
						unread={!!unreadMessages[item.id]}
						latestMessage={latestUnread[item.id]}
						onClearUnread={clearUnread}
					/>
				)}
				keyExtractor={item => item.id.toString()}
				showsVerticalScrollIndicator={false}
				ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
			/>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	rowOuter: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 12,
		paddingVertical: 8,
		backgroundColor: 'rgba(30,30,38,0.7)',
		borderRadius: 16,
		marginBottom: 8,
		marginHorizontal: 8,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.08,
		shadowRadius: 4,
	},
	friendRowContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		flex: 1,
		paddingVertical: 0,
		backgroundColor: 'transparent',
	},
	avatarContainer: {
		marginRight: 12,
		position: 'relative',
	},
	activeIndicator: {
		position: 'absolute',
		bottom: 4,
		right: 4,
		width: 12,
		height: 12,
		borderRadius: 6,
		backgroundColor: '#bbb',
		borderWidth: 2,
		borderColor: '#fff',
	},
	onlineIndicator: {
		backgroundColor: '#4CAF50', // green
		shadowColor: '#4CAF50',
	},
	offlineIndicator: {
		backgroundColor: '#E53935', // red
	},
	friendRowContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		flex: 1,
		paddingVertical: 0,
		backgroundColor: 'transparent',
	},
	avatarContainer: {
		marginRight: 12,
		position: 'relative',
	},
	videoCallButtonIcon: {
		fontSize: 20,
		color: 'white',
		fontWeight: 'bold',
	},
	container: {
		flex: 1,
		backgroundColor: '#121214',
	},
	headerContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: 20,
		shadowOffset: { width: 0, height: 0 },
		shadowOpacity: 0.6,
		shadowRadius: 4,
	},
	contentContainer: {
		flex: 1,
		marginLeft: 16,
	},
	nameContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: 4,
	},
	nameText: {
		fontSize: 17,
		fontWeight: '600',
		color: 'rgba(255, 255, 255, 0.95)',
		letterSpacing: 0.3,
	},
	usernameText: {
		fontSize: 13,
		color: 'rgba(229, 57, 53, 0.85)', // Changed to red
		marginLeft: 8,
		fontWeight: '500',
	},
	previewText: {
		fontSize: 14,
		color: 'rgba(210, 210, 215, 0.75)',
		marginBottom: 6,
	},
	timeContainer: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	timeText: {
		fontSize: 12,
		color: 'rgba(170, 170, 180, 0.6)',
	},
	loadingContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		backgroundColor: '#121214',
	},
	loadingGlass: {
		padding: 24,
		borderRadius: 20,
		backgroundColor: 'rgba(30, 30, 38, 0.7)',
		borderWidth: 1,
		borderColor: 'rgba(255, 255, 255, 0.1)',
		alignItems: 'center',
	},
	loadingText: {
		marginTop: 16,
		fontSize: 15,
		color: 'rgba(255, 255, 255, 0.7)',
		fontWeight: '500',
	},
	emptyStateContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		padding: 20,
	},
	emptyGlass: {
		padding: 30,
		borderRadius: 24,
		backgroundColor: 'rgba(30, 30, 38, 0.7)',
		borderWidth: 1,
		borderColor: 'rgba(255, 255, 255, 0.1)',
		width: '90%',
		alignItems: 'center',
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.2,
		shadowRadius: 8,
	},
	unreadHighlight: {
		backgroundColor: 'rgba(229, 57, 53, 0.12)', // subtle red highlight
		borderRadius: 18,
	},
	unreadPreviewText: {
		fontWeight: 'bold',
		color: '#E53935',
	},
	videoCallButton: {
		backgroundColor: '#E53935',
		padding: 10,
		borderRadius: 20,
		margin: 10,
		alignItems: 'center',
		justifyContent: 'center',
	},
	videoCallButtonText: {
		color: 'white',
		fontWeight: 'bold',
	},
});

export default FriendsScreen