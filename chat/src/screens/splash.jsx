import { useEffect, useLayoutEffect } from "react"
import { 
	Animated,
	SafeAreaView, 
	StatusBar, 
	Text, 
	View
} from "react-native"

function SplashScreen({ navigation }) {

	// Remove navigation.setOptions if you use stack without header for Splash
	// Or, if you use Splash as initialRoute, make sure the name matches exactly ("Splash")
useLayoutEffect(() => {
		navigation.setOptions({
			headerShown: false
		})
	}, [])
	const translateY = new Animated.Value(0)
	const duration = 800

	useEffect(() => {
		Animated.loop(
			Animated.sequence([
				Animated.timing(translateY, {
					toValue: 20,
					duration: duration,
					useNativeDriver: true
				}),
				Animated.timing(translateY, {
					toValue: 0,
					duration: duration,
					useNativeDriver: true
				})
			])
		).start()
	}, [])


	return (
		<SafeAreaView
			style={{
				flex: 1,
				alignItems: 'center',
				justifyContent: 'center',
				backgroundColor: 'black'
			}}
		>
			<StatusBar barStyle='light-content' />
			<Animated.View style={[{ transform: [{ translateY }] }]}>
				<Text style={{ color: 'white', fontSize: 32, fontWeight: 'bold' }}>
					RealtimeChat
				</Text>
			</Animated.View>
		</SafeAreaView>
	)
}

export default SplashScreen