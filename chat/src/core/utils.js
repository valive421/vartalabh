// Utility functions for logging and image URL handling in the app.
import ProfileImage from "../assets/default_pp.png";
import { Platform } from "react-native"; // Add missing Platform import
const adress = '10.0.2.2:8000'; // removed trailing slash


function log(){
    for (let i = 0; i < arguments.length; i++) {
        let arg = arguments[i];
        if (typeof arg === 'object') {
            arg = JSON.stringify(arg, null, 2);
        }
        console.log(`[${Platform.OS}]`, arg);
    }
}

function thumbnail(url){
    if(!url) return ProfileImage;
    // Ensure only one slash between host and path
    let cleanUrl = url.startsWith('/') ? url : '/' + url;
    return{
        uri : 'http://' + adress + cleanUrl
    }
}

function formatTime(dateString) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    
    // If same day, show time
    if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // If within a week, show day of week
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 7);
    if (date > weekAgo) {
        return date.toLocaleDateString([], { weekday: 'short' });
    }
    
    // Otherwise show date
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default {
    log,
    thumbnail,
    formatTime  // Added formatTime function
};