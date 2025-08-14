import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { View, Text, StyleSheet, Image, TouchableOpacity } from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import useGlobalStore from "../core/global";
import utils from "../core/utils";

function RequestScreen() {
    const requestList = useGlobalStore(state => state.requestList);
    const user = useGlobalStore(state => state.user);
    const requestAccept = useGlobalStore(state => state.requestAccept);


    const handleAccept = (username) => {
        console.log("Accepted request", username);
        requestAccept(username);
    };
    const handleDecline = (username) => {
        console.log("Declined request", username);
        // requestDecline(username);
    };

    if (requestList === null) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#20d080" />
            </View>
        );
    }

    // Split requests into received and sent
    const receivedRequests = requestList.filter(req => req.receiver?.username === user.username);
    const sentRequests = requestList.filter(req => req.sender?.username === user.username);

    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.headerRow}>
                <Image source={require("../assets/default_pp.png")} style={styles.headerAvatar} />
                <Text style={styles.headerTitle}>Requests</Text>
                <Icon name="search" size={24} color="#222" style={styles.headerIcon} />
            </View>
            <View style={styles.listWrap}>
                {receivedRequests.length === 0 && sentRequests.length === 0 ? (
                    <View style={styles.nothingContainer}>
                        <View style={styles.glassCard}>
                            
                            <Text style={styles.nothingSub}>No friend requests yet</Text>
                        </View>
                    </View>
                ) : (
                    <View style={styles.listContainer}>
                        {receivedRequests.length > 0 && (
                            <>
                                {receivedRequests.map((req, idx) => (
                                    <View key={`received-${idx}`} style={styles.card}>
                                        <Image
                                            source={utils.thumbnail(req.sender?.thumbnail)}
                                            style={styles.avatar}
                                        />
                                        <View style={styles.infoWrap}>
                                            <Text style={styles.name}>{req.sender?.first_name} {req.sender?.last_name}</Text>
                                            <Text style={styles.message}>sent you a friend request</Text>
                                            <Text style={styles.time}>7m ago</Text>
                                        </View>
                                        <TouchableOpacity
                                            style={styles.acceptBtn}
                                            onPress={() => handleAccept(req.sender.username)}
                                        >
                                            <Text style={styles.acceptText}>Accept</Text>
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </>
                        )}
                        {sentRequests.length > 0 && (
                            <>
                                {sentRequests.map((req, idx) => (
                                    <View key={`sent-${idx}`} style={styles.card}>
                                        <Image
                                            source={utils.thumbnail(req.receiver?.thumbnail)}
                                            style={styles.avatar}
                                        />
                                        <View style={styles.infoWrap}>
                                            <Text style={styles.name}>{req.receiver?.first_name} {req.receiver?.last_name}</Text>
                                            <Text style={styles.message}>you sent a friend request</Text>
                                            <Text style={styles.time}>{req.accepted ? "Accepted" : "Pending"}</Text>
                                        </View>
                                    </View>
                                ))}
                            </>
                        )}
                    </View>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: '#18181b',
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 18,
        paddingTop: 18,
        paddingBottom: 8,
        backgroundColor: 'transparent',
    },
    headerAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        marginRight: 10,
    },
    headerTitle: {
        flex: 1,
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
        letterSpacing: 1,
    },
    headerIcon: {
        marginLeft: 10,
    },
    listWrap: {
        flex: 1,
        paddingHorizontal: 12,
        marginTop: 8,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(30,30,35,0.7)',
        borderRadius: 20,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 2 },
        borderWidth: 1,
        borderColor: 'rgba(60,60,70,0.2)',
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        marginRight: 14,
    },
    infoWrap: {
        flex: 1,
        justifyContent: 'center',
    },
    name: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
        marginBottom: 2,
    },
    message: {
        color: '#ccc',
        fontSize: 14,
        marginBottom: 2,
    },
    time: {
        color: '#ff453a',
        fontSize: 12,
    },
    acceptBtn: {
        backgroundColor: '#222',
        borderRadius: 16,
        paddingVertical: 8,
        paddingHorizontal: 18,
        marginLeft: 10,
        shadowColor: '#ff453a',
        shadowOpacity: 0.15,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
    },
    acceptText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 15,
    },
    nothingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    glassCard: {
        borderRadius: 24,
        padding: 20,
        marginBottom: 16,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.18)',
        shadowColor: '#fff',
        shadowOpacity: 0.1,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 2 },
    },
    nothingText: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 8,
        letterSpacing: 2,
    },
    nothingSub: {
        fontSize: 18,
        color: '#bbb',
        textAlign: 'center',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#101010',
    },
});

export default RequestScreen;