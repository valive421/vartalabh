import React, { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Dimensions } from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import api from "../core/api"; // Adjust the import path as needed
import utils from "../core/utils";

const { width } = Dimensions.get("window");

function SignupScreen({ navigation }) {
    const [form, setForm] = useState({
        username: "",
        firstName: "",
        lastName: "",
        password: "",
        confirmPassword: "",
        agree: false,
    });
    const [errors, setErrors] = useState({});

    function validate() {
        let newErrors = {};
        if (!form.username.trim()) newErrors.username = "Username is required";
        if (!form.firstName.trim()) newErrors.firstName = "First name is required";
        if (!form.lastName.trim()) newErrors.lastName = "Last name is required";
        if (!form.password) newErrors.password = "Password is required";
        else if (form.password.length < 6) newErrors.password = "Password must be at least 6 characters";
        if (!form.confirmPassword) newErrors.confirmPassword = "Confirm your password";
        else if (form.password !== form.confirmPassword) newErrors.confirmPassword = "Passwords do not match";
        if (!form.agree) newErrors.agree = "You must agree to the terms";
        return newErrors;
    }

    function handleSignup() {
        console.log("Signing up with:", form);
        const newErrors = validate();
        setErrors(newErrors);
        if (Object.keys(newErrors).length === 0) {
            api.post('signup/', {
                username: form.username,
                password: form.password,
                first_name: form.firstName,
                last_name: form.lastName
            }).then((response) => {
                utils.log("Sign-up successful:", response.data);
                // Store user and tokens in global state
                const credentials = { 
                    username: form.username, 
                    password: form.password, 
                    tokens: response.data.tokens 
                };
                const { login } = require('../core/global').default.getState();
                login(credentials, {
                    ...response.data.user,
                    tokens: response.data.tokens
                }, response.data.tokens);
                // No need to navigate, global state will trigger navigation
            }).catch((error) => {
                utils.log("Sign-up failed:", error);
            });
        }
    }

    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.container}>
                {/* Back Button */}
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <MaterialIcons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>

                {/* Title */}
                <Text style={styles.title}>
                    <MaterialIcons name="person-add" size={22} color="#fff" /> Create Account
                </Text>
                <Text style={styles.subtitle}>
                    <MaterialIcons name="chat-bubble-outline" size={16} color="#aaa" /> Join the conversation
                </Text>

                {/* Form */}
                <View style={styles.formContainer}>
                    {/* Username */}
                    <View style={styles.inputRow}>
                        <Icon name="user" size={18} color="#888" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Username"
                            placeholderTextColor="#aaa"
                            value={form.username}
                            onChangeText={v => setForm(f => ({ ...f, username: v }))}
                        />
                    </View>
                    {errors.username && <Text style={styles.error}>{errors.username}</Text>}
                    {/* First Name */}
                    <View style={styles.inputRow}>
                        <Icon name="user" size={18} color="#888" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="First name"
                            placeholderTextColor="#aaa"
                            value={form.firstName}
                            onChangeText={v => setForm(f => ({ ...f, firstName: v }))}
                        />
                    </View>
                    {errors.firstName && <Text style={styles.error}>{errors.firstName}</Text>}
                    {/* Last Name */}
                    <View style={styles.inputRow}>
                        <Icon name="user" size={18} color="#888" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Last name"
                            placeholderTextColor="#aaa"
                            value={form.lastName}
                            onChangeText={v => setForm(f => ({ ...f, lastName: v }))}
                        />
                    </View>
                    {errors.lastName && <Text style={styles.error}>{errors.lastName}</Text>}
                    {/* Password */}
                    <View style={styles.inputRow}>
                        <MaterialIcons name="lock" size={18} color="#888" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Password"
                            placeholderTextColor="#aaa"
                            secureTextEntry={true}
                            value={form.password}
                            onChangeText={v => setForm(f => ({ ...f, password: v }))}
                        />
                    </View>
                    {errors.password && <Text style={styles.error}>{errors.password}</Text>}
                    {/* Confirm Password */}
                    <View style={styles.inputRow}>
                        <MaterialIcons name="lock" size={18} color="#888" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Confirm password"
                            placeholderTextColor="#aaa"
                            secureTextEntry={true}
                            value={form.confirmPassword}
                            onChangeText={v => setForm(f => ({ ...f, confirmPassword: v }))}
                        />
                    </View>
                    {errors.confirmPassword && <Text style={styles.error}>{errors.confirmPassword}</Text>}

                    {/* Checkbox */}
                    <View style={styles.checkboxContainer}>
                        <TouchableOpacity
                            style={styles.checkbox}
                            onPress={() => setForm(f => ({ ...f, agree: !f.agree }))}
                        >
                            <View style={[styles.checkboxBox, form.agree && styles.checkboxChecked]}>
                                {form.agree && <MaterialIcons name="check" size={16} color="#ff453a" />}
                            </View>
                        </TouchableOpacity>
                        <Text style={styles.termsText}>
                            <MaterialIcons name="policy" size={14} color="#888" /> I agree to the <Text style={styles.link}>Terms of Service</Text> and <Text style={styles.link}>Privacy Policy</Text>
                        </Text>
                    </View>
                    {errors.agree && <Text style={styles.error}>{errors.agree}</Text>}

                    {/* Create Account Button */}
                    <TouchableOpacity style={styles.createBtn} onPress={handleSignup}>
                        <MaterialIcons name="person-add" size={20} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={styles.createText}>Create Account</Text>
                    </TouchableOpacity>
                </View>

                {/* Already have account */}
                <View style={styles.bottomRow}>
                    <Text style={styles.bottomText}>
                        <MaterialIcons name="person" size={16} color="#aaa" /> Already have an account?{" "}
                    </Text>
                    <TouchableOpacity onPress={() => navigation.navigate("SignIn")}>
                        <Text style={styles.link} >Sign in</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: "#000",
    },
    container: {
        flex: 1,
        paddingHorizontal: 24,
        justifyContent: "center",
    },
    backButton: {
        position: "absolute",
        top: 20,
        left: 20,
        zIndex: 10,
        padding: 10,
    },
    title: {
        fontSize: 24,
        fontWeight: "bold",
        color: "#fff",
        textAlign: "center",
        marginBottom: 6,
    },
    subtitle: {
        color: "#aaa",
        fontSize: 14,
        textAlign: "center",
        marginBottom: 28,
    },
    formContainer: {
        width: "100%",
    },
    inputRow: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#111",
        borderColor: "#333",
        borderWidth: 1,
        borderRadius: 12,
        height: 48,
        marginBottom: 20,
        paddingHorizontal: 16,
    },
    inputIcon: {
        marginRight: 8,
    },
    input: {
        flex: 1,
        color: "#fff",
        fontSize: 15,
    },
    checkboxContainer: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 24,
    },
    checkbox: {
        marginRight: 10,
    },
    checkboxBox: {
        width: 20,
        height: 20,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: "#fff",
        alignItems: "center",
        justifyContent: "center",
    },
    checkboxChecked: {
        backgroundColor: "#fff",
    },
    termsText: {
        color: "#ccc",
        fontSize: 13,
        flexShrink: 1,
    },
    link: {
        color: "#f44",
        fontWeight: "bold",
        textDecorationLine: "underline",
    },
    createBtn: {
        backgroundColor: "#f44",
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: "center",
        shadowColor: "#f44",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.6,
        shadowRadius: 10,
        elevation: 6,
        flexDirection: "row",
        justifyContent: "center",
    },
    createText: {
        color: "#fff",
        fontWeight: "bold",
        fontSize: 16,
    },
    bottomRow: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        marginTop: 28,
    },
    bottomText: {
        color: "#aaa",
        fontSize: 14,
    },
    error: {
        color: "#ff453a",
        fontSize: 13,
        marginBottom: 8,
        marginLeft: 4,
    },
});

export default SignupScreen;
