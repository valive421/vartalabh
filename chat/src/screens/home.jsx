import { SafeAreaView } from "react-native-safe-area-context";
import { Text, View, Image, TouchableOpacity } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import RequestScreen from "./Request";
import FriendsScreen from "./Friends";
import ProfileScreen from "./profile";
import { use, useEffect, useLayoutEffect } from "react";
import Icon from "react-native-vector-icons/FontAwesome";
import useGlobalStore from "../core/global";
import utils from "../core/utils";
const Tab = createBottomTabNavigator();

function HomeScreen({ navigation }) {
   const socketconnect = useGlobalStore((state) => state.socketconnect);
   const socketclose = useGlobalStore((state) => state.socketclose);
   const user = useGlobalStore((state) => state.user);
    const unreadMessages = useGlobalStore((state) => state.unreadMessages);

    // Calculate total unread count
    const unreadCount = Object.values(unreadMessages || {}).reduce((a, b) => a + b, 0);

	useLayoutEffect(() => {
		navigation.setOptions({ headerShown: false });
	}, []);
  
   useEffect(() => {
	socketconnect();
	return () => {
		socketclose();
	};
   }, []);

	return (
		<SafeAreaView style={{ flex: 1 }}>
			{/* Magnifying glass icon at top right */}
			<TouchableOpacity
				style={{
					position: "absolute",
					top: 18,
					right: 24,
					zIndex: 100,
					backgroundColor: "rgba(30,30,35,0.7)",
					borderRadius: 20,
					padding: 6,
				}}
				onPress={() => navigation.navigate("Search")}
			>
				<Icon name="search" size={24} color="#fff" />
			</TouchableOpacity>
			{/* Tab navigator */}
			<Tab.Navigator
				screenOptions={({ route }) => ({
					
					headerLeft: () => (
						<View style={{ marginRight: 10 }}>
							<Image
													source={utils.thumbnail(user.thumbnail)}
													style={styles.avatar}
												/>
						</View>
					),
					tabBarIcon: ({ color, size, focused }) => {
						let iconName;
						let showBadge = false;
						if (route.name === "request") iconName = "bell";
						else if (route.name === "friends") {
							iconName = "users";
							showBadge = unreadCount > 0;
						}
						else if (route.name === "profile") iconName = "user";
						return (
							<View>
								<Icon
									name={iconName}
									size={size ?? 28}
									color={focused ? "#ff453a" : "#aaa"}
									style={{ opacity: focused ? 1 : 0.7 }}
								/>
								{showBadge && (
									<View style={{
										position: "absolute",
										top: -4,
										right: -8,
										backgroundColor: "#ff453a",
										borderRadius: 8,
										minWidth: 16,
										height: 16,
										justifyContent: "center",
										alignItems: "center",
										paddingHorizontal: 3,
									}}>
										<Text style={{
											color: "#fff",
											fontSize: 10,
											fontWeight: "bold",
										}}>
											{unreadCount}
										</Text>
									</View>
								)}
							</View>
						);
					},
					tabBarActiveTintColor: "#ff453a",
					tabBarInactiveTintColor: "#aaa",
					tabBarStyle: {
						backgroundColor: "rgba(30,30,35,0.7)",
						borderTopWidth: 0,
						elevation: 0,
						marginHorizontal: 16,
						marginBottom: 16,
						borderRadius: 24,
						height: 64,
						position: "absolute",
						left: 0,
						right: 0,
						shadowColor: "#000",
						shadowOpacity: 0.18,
						shadowRadius: 16,
						shadowOffset: { width: 0, height: 4 },
						borderWidth: 1,
						borderColor: "rgba(60,60,70,0.2)",
					},
					tabBarItemStyle: {
						borderRadius: 16,
						marginHorizontal: 4,
					},
					tabBarLabelStyle: {
						fontWeight: "bold",
						fontSize: 13,
					},
				})}
			>
				<Tab.Screen name="request" component={RequestScreen} />
				<Tab.Screen name="friends" component={FriendsScreen} />
				<Tab.Screen name="profile" component={ProfileScreen} />
			</Tab.Navigator>
		</SafeAreaView>
	);
}

// Add styles for avatar
const styles = {
    avatar: {
        width: 30,
        height: 30,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: "#222",
    },
};

export default HomeScreen;



