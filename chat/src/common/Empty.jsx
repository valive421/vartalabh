import Icon from "react-native-vector-icons/FontAwesome";
import { View, Text } from "react-native";

function Empty({ icon, message, centered = true }) {
	return (
		<View
			style={{
				flex: 1,
				justifyContent: centered ? 'center' : 'flex-start',
				alignItems: 'center',
				paddingVertical: 120
			}}
		>
			<Icon
				name={icon}
				color='#d0d0d0'
				size={90}
				style={{
					marginBottom: 16
				}}
			/>
			<Text
				style={{
					color: '#c3c3c3',
					fontSize: 16
				}}
			>
				{message}
			</Text>
		</View>
	)
}

export default Empty