import React, { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import api from "../core/api"; // Adjust the import path as needed
import utils from "../core/utils";

function SigninScreen({ navigation }) {
    const [showPassword, setShowPassword] = useState(false);

   const [password, setPassword] = useState("");
   const [username, setUsername] = useState("");
   const [passworderror, setPasswordError] = useState("");
   const [usernameerror, setUsernameError] = useState("");

function handleSignin() {
        console.log("Signing in with:", username, password);

   const failusername = !username
   if (failusername) {
       setUsernameError("Username is required");
   }

   const failpassword = !password
   if (failpassword) {
       setPasswordError("Password is required");
   }
    if (failusername || failpassword) {
        return;
    }
    console.log("Signing in with:", username, password);
    api.post('signin/', {
        username,
        password
    }).then((response) => {
        utils.log("Sign-in successful:", response.data);
        // Store user and tokens in global state
        const credentials = { username, password, tokens: response.data.tokens };
        const { login } = require('../core/global').default.getState();
        login(credentials, {
            ...response.data.user,
            tokens: response.data.tokens
        }, response.data.tokens);
        // Optionally navigate to Home
       // navigation.replace('Home');
    }).catch((error) => {
        utils.log("Sign-in failed:", error);
    });
}

    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.container}>
                {/* Logo */}
                <View style={styles.logoWrap}>
                    <View style={styles.logo}>
                        <MaterialIcons name="chat-bubble" size={32} color="#fff" />
                    </View>
                </View>
                {/* Title */}
                <Text style={styles.title}>
                    <MaterialIcons name="lock" size={22} color="#fff" /> NEXUS
                </Text>
                <Text style={styles.subtitle}>
                    <MaterialIcons name="security" size={16} color="#aaa" /> Connect beyond boundaries
                </Text>

                {/* Username Input */}
                <View style={styles.inputWrap}>
                    <Icon name="user" size={18} color="#888" style={styles.inputIcon} />
                    <TextInput
                        style={styles.input}
                        placeholder="Username"
                        placeholderTextColor="#888"
                        value={username}
                        onChangeText={setUsername}
                    />
                    {usernameerror ? (
                        <Text style={{ color: "#ff453a", fontSize: 12, marginTop: 2 }}>{usernameerror}</Text>
                    ) : null}
                </View>

                {/* Password Input */}
                <View style={styles.inputWrap}>
                    <MaterialIcons name="lock" size={18} color="#888" style={styles.inputIcon} />
                    <TextInput
                        style={styles.input}
                        placeholder="Password"
                        placeholderTextColor="#888"
                        secureTextEntry={!showPassword}
                        value={password}
                        onChangeText={setPassword}
                    />
                    {passworderror ? (
                        <Text style={{ color: "#ff453a", fontSize: 12, marginTop: 2 }}>{passworderror}</Text>
                    ) : null}
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                        <MaterialIcons name={showPassword ? "visibility-off" : "visibility"} size={18} color="#888" />
                    </TouchableOpacity>
                </View>

                {/* Forgot Password */}
                <TouchableOpacity style={styles.forgotBtn}>
                    <Text style={styles.forgotText}>
                        <MaterialIcons name="help-outline" size={14} color="#ff453a" /> Forgot password?
                    </Text>
                </TouchableOpacity>

                {/* Sign In Button */}
                <TouchableOpacity style={styles.signinBtn} onPress={handleSignin}>
                    <MaterialIcons name="login" size={18} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.signinText}>Sign In</Text>
                </TouchableOpacity>

                {/* Divider */}
                <View style={styles.dividerRow}>
                    <View style={styles.divider} />
                    <Text style={styles.dividerText}>
                        <MaterialIcons name="swap-horiz" size={14} color="#888" /> or
                    </Text>
                    <View style={styles.divider} />
                </View>

                {/* Register Link */}
                <View style={styles.bottomRow}>
                    <Text style={styles.bottomText}>
                        <MaterialIcons name="person-add" size={14} color="#888" /> Don't have an account?{" "}
                    </Text>
                    <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
                        <Text style={styles.link}>Sign up</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: "#000" },
    container: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
    },
    logoWrap: {
        marginBottom: 24,
        alignItems: "center",
    },
    logo: {
        width: 64,
        height: 64,
        borderRadius: 20,
        backgroundColor: "#ff453a",
        shadowColor: "#ff453a",
        shadowOpacity: 0.4,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 4 },
        marginBottom: 8,
    },
    title: {
        fontSize: 28,
        fontWeight: "bold",
        color: "#fff",
        letterSpacing: 1,
        marginBottom: 4,
        textAlign: "center",
    },
    subtitle: {
        color: "#aaa",
        marginBottom: 32,
        textAlign: "center",
    },
    inputWrap: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(30,30,30,0.7)",
        borderRadius: 12,
        paddingHorizontal: 16,
        marginBottom: 16,
        width: "100%",
        height: 48,
        borderWidth: 1,
        borderColor: "#222",
    },
    inputIcon: {
        marginRight: 8,
    },
    input: {
        flex: 1,
        color: "#fff",
        fontSize: 16,
    },
    forgotBtn: {
        alignSelf: "flex-end",
        marginBottom: 16,
    },
    forgotText: {
        color: "#ff453a",
        fontWeight: "500",
        fontSize: 13,
    },
    signinBtn: {
        backgroundColor: "#ff453a",
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: "center",
        width: "100%",
        marginBottom: 16,
        shadowColor: "#ff453a",
        shadowOpacity: 0.3,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        flexDirection: "row",
        justifyContent: "center",
    },
    signinText: {
        color: "#fff",
        fontWeight: "bold",
        fontSize: 16,
        letterSpacing: 1,
    },
    dividerRow: {
        flexDirection: "row",
        alignItems: "center",
        marginVertical: 12,
        width: "100%",
    },
    divider: {
        flex: 1,
        height: 1,
        backgroundColor: "#222",
    },
    dividerText: {
        color: "#888",
        marginHorizontal: 8,
        fontSize: 13,
    },
    googleBtn: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(30,30,30,0.7)",
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 16,
        width: "100%",
        marginBottom: 16,
        borderWidth: 1,
        borderColor: "#222",
    },
    googleIcon: {
        marginRight: 12,
    },
    googleText: {
        color: "#fff",
        fontWeight: "bold",
        fontSize: 15,
    },
    bottomRow: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        marginTop: 8,
    },
    bottomText: {
        color: "#888",
        fontSize: 13,
    },
    link: {
        color: "#ff453a",
        fontWeight: "bold",
        fontSize: 13,
    },
});

export default SigninScreen;