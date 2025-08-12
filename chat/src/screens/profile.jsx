import { SafeAreaView } from "react-native-safe-area-context";
import { View, Text, StyleSheet, Image, TouchableOpacity } from "react-native";
import { launchImageLibrary } from 'react-native-image-picker';
import Icon from "react-native-vector-icons/MaterialIcons";
import useGlobalStore from "../core/global";
import utils from "../core/utils";

function ProfileScreen() {
    const {  logout } = useGlobalStore();
    const uploadThumbnail = useGlobalStore(state => state.uploadTHumbnail); // fix: get correct function
    const user = useGlobalStore(state => state.user); // fix: get correct function
    
    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.container}>
                {/* Profile Avatar */}
                <TouchableOpacity
                    style={styles.avatarWrap}
                    onPress={() => {
                        launchImageLibrary({ includeBase64: true }, (response) => {
                            if (!response.didCancel && response.assets && response.assets.length > 0) {
                                const file = response.assets[0];
                                uploadThumbnail(file);
                            }
                            console.log('launchImageLibrary', response);
                        });
                    }}
                >
                    <Image
                        source={utils.thumbnail(user.thumbnail)}
                        style={styles.avatar}
                    />
                </TouchableOpacity>
                {/* Username */}
                <Text style={styles.username}>@{user.username}</Text>
                {/* Full Name */}
                <View style={styles.card}>
                    <Text style={styles.label}>Full Name</Text>
                    <Text style={styles.value}>{user.first_name} {user.last_name}</Text>
                </View>
                {/* Username */}
                <View style={styles.card}>
                    <Text style={styles.label}>Username</Text>
                    <Text style={styles.value}>{user.username}</Text>
                </View>
                {/* Logout Button */}
                <View style={styles.logoutWrap}>
                    <Text style={styles.logoutBtn} onPress={logout}>
                        <Icon name="logout" size={20} color="#ff453a" /> Logout
                    </Text>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    logoutWrap: {
        marginTop: 32,
        alignItems: 'center',
    },
    logoutBtn: {
        color: '#ff453a',
        fontWeight: 'bold',
        fontSize: 16,
        paddingVertical: 10,
        paddingHorizontal: 32,
        backgroundColor: 'rgba(30,30,35,0.7)',
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#ff453a',
        shadowOpacity: 0.2,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        textAlign: 'center',
    },
    safe: {
        flex: 1,
        backgroundColor: '#18181b',
    },
    container: {
        flex: 1,
        alignItems: 'center',
        paddingTop: 48,
        backgroundColor: 'rgba(24,24,27,0.85)',
    },
    avatarWrap: {
        marginBottom: 16,
        borderRadius: 60,
        padding: 4,
        backgroundColor: 'rgba(40,40,45,0.4)',
        shadowColor: '#000',
        shadowOpacity: 0.4,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 4 },
    },
    avatar: {
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 2,
        borderColor: '#222',
    },
    username: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 8,
        textAlign: 'center',
        letterSpacing: 1,
    },
    card: {
        width: '90%',
        backgroundColor: 'rgba(30,30,35,0.6)',
        borderRadius: 18,
        padding: 18,
        marginVertical: 8,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 2 },
        borderWidth: 1,
        borderColor: 'rgba(60,60,70,0.2)',
    },
    label: {
        color: '#aaa',
        fontSize: 14,
        marginBottom: 4,
    },
    value: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '500',
    },
});

export default ProfileScreen;