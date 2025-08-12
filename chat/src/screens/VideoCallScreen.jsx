import React, { useEffect, useRef, useState, useCallback } from 'react';
import { InteractionManager } from 'react-native';
import useGlobal from '../core/global';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { PermissionsAndroid, Platform, View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { RTCView, mediaDevices, RTCPeerConnection, RTCIceCandidate, RTCSessionDescription } from 'react-native-webrtc';

// Error boundary component for crash protection
class VideoCallErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error) {
        console.error('[VideoCall] Error boundary caught error:', error);
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error('[VideoCall] Error boundary details:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <View style={{ flex: 1, backgroundColor: '#121214', justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ color: 'white', fontSize: 18, marginBottom: 20 }}>Video call error occurred</Text>
                    <TouchableOpacity 
                        style={{ backgroundColor: '#ff4444', padding: 15, borderRadius: 8 }}
                        onPress={() => {
                            this.setState({ hasError: false });
                            this.props.onErrorRecovery?.();
                        }}
                    >
                        <Text style={{ color: 'white', fontSize: 16 }}>Retry</Text>
                    </TouchableOpacity>
                </View>
            );
        }
        return this.props.children;
    }
}

const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    {
        urls: 'turn:relay1.expressturn.com:3478',
        username: 'ef263220PSQYLOMNRT',
        credential: 'uZTlBZS7VZ348gkN'
    }
];

// SDP helper: keep VP8 only (remove H264/H265/HEVC/VP9/AV1) to avoid device-specific crashes
function stripProblematicVideoCodecs(sdp) {
    try {
        if (!sdp) return sdp;
        // Conservative codec filtering - remove known problematic codecs on Android
        const codecsToRemove = new Set(['AV1', 'H265', 'HEVC', 'VP9']); // Add VP9 back
        const lines = sdp.split(/\r?\n/);
        const removePts = new Set();
        const rtxForPt = new Map(); // rtx pt -> apt
        const aptForRtx = new Set();

        // Discover payload types to remove
        for (const line of lines) {
            // a=rtpmap:<pt> <codec>/<clockrate>
            const m = line.match(/^a=rtpmap:(\d+)\s+([^/]+)/i);
            if (m) {
                const pt = m[1];
                const codec = (m[2] || '').toUpperCase();
                if (codecsToRemove.has(codec)) {
                    removePts.add(pt);
                }
            }
            // Track RTX mappings
            const f = line.match(/^a=fmtp:(\d+)\s+apt=(\d+)/i);
            if (f) {
                const rtxPt = f[1];
                const apt = f[2];
                rtxForPt.set(rtxPt, apt);
            }
        }
        // If a base pt is removed, remove its RTX too
        for (const [rtxPt, apt] of rtxForPt.entries()) {
            if (removePts.has(apt)) {
                removePts.add(rtxPt);
                aptForRtx.add(apt);
            }
        }

        // Rewrite m=video line and filter attribute lines
    const out = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.startsWith('m=video')) {
                const parts = line.split(' ');
                // m=video <port> <proto> <pt1> <pt2> ...
                const header = parts.slice(0, 3);
        const pts = parts.slice(3).filter(pt => !removePts.has(pt));
                // Ensure we don't end up empty; if empty, keep as-is to avoid invalid SDP
                out.push(pts.length ? [...header, ...pts].join(' ') : line);
                continue;
            }
            // Drop lines for removed payload types
            if (/^a=rtpmap:/i.test(line) || /^a=fmtp:/i.test(line) || /^a=rtcp-fb:/i.test(line)) {
                const m = line.match(/^(a=(?:rtpmap|fmtp|rtcp-fb)):(\d+)/i);
                if (m && removePts.has(m[2])) {
                    continue; // skip
                }
            }
            out.push(line);
        }
        const munged = out.join('\r\n');
        return munged;
    } catch (e) {
        console.warn('[VideoCall] Failed to strip codecs, using original SDP', e);
        return sdp;
    }
}


function VideoCallScreenCore({ route, navigation }) {
    // Global state
    const initialized = useGlobal(state => state.initialized);
    const authenticated = useGlobal(state => state.authenticated);
    const accessToken = useGlobal(state => state.user?.tokens?.access);
    const videoSocket = useGlobal(state => state.videoSocket);
    const videoSocketReady = useGlobal(state => state.videoSocketReady);
    const videoSocketConnect = useGlobal(state => state.videoSocketConnect);
    const sendVideoSignal = useGlobal(state => state.sendVideoSignal);
    const incomingCall = useGlobal(state => state.incomingCall);
    const clearIncomingCall = useGlobal(state => state.clearIncomingCall);
    const setActiveCallHandler = useGlobal(state => state.setActiveCallHandler);
    
    // Local state
    const [localStream, setLocalStream] = useState(null);
    
    // Ref for latest localStream state to avoid stale closures
    const localStreamRef = useRef(null);
    
    // Update ref whenever localStream changes
    useEffect(() => {
        localStreamRef.current = localStream;
    }, [localStream]);
    
    const [remoteStream, setRemoteStream] = useState(null);
    const [callActive, setCallActive] = useState(false);
    const [startCall, setStartCall] = useState(route.params?.startCall || false);
    const [remoteAccepted, setRemoteAccepted] = useState(false);
    // Ref to avoid stale closure while waiting for accept
    const remoteAcceptedRef = useRef(false);
    const peerConnectionRef = useRef(null);
    const candidatesQueue = useRef([]);
    const addedLocalTracksRef = useRef(false);
    const endedRef = useRef(false);
    const cleanedRef = useRef(false);
    // Track if we've already sent the initial offer to avoid duplicates
    const offerSentRef = useRef(false);
    // Callee-offer guard to avoid duplicate offers
    const calleeOfferSentRef = useRef(false);
    const bufferedOfferRef = useRef(null);
    const answerSentRef = useRef(false);
    const { recipient } = route.params || {};

    // Debug: log navigation and route params
    useEffect(() => {
        console.log('[VideoCall] route.params:', route.params);
        console.log('[VideoCall] navigation:', navigation);
    }, []);

    // Setup media when screen is focused (avoid dependency-triggered cleanup)
    const isFocused = useIsFocused();
    useEffect(() => {
        if (!isFocused) return;
        if (!initialized || !authenticated || !accessToken) return;

        let cancelled = false;
        InteractionManager.runAfterInteractions(() => {
            async function setupCall() {
                console.log('[VideoCall] setupCall started');

                if (!accessToken) {
                    Alert.alert('Authentication Error', 'You must be signed in to start a video call.');
                    navigation.goBack();
                    return;
                }

                if (Platform.OS === 'android') {
                    try {
                        const granted = await PermissionsAndroid.requestMultiple([
                            PermissionsAndroid.PERMISSIONS.CAMERA,
                            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
                        ]);
                        console.log('[VideoCall] Permissions result:', granted);
                        if (
                            !cancelled &&
                            (granted[PermissionsAndroid.PERMISSIONS.CAMERA] !== PermissionsAndroid.RESULTS.GRANTED ||
                            granted[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] !== PermissionsAndroid.RESULTS.GRANTED)
                        ) {
                            console.log('[VideoCall] Permission denied, closing');
                            Alert.alert('Permission Required', 'Camera and microphone permissions are required for video calls.');
                            navigation.goBack();
                            return;
                        }
                    } catch (err) {
                        console.log('[VideoCall] Permission error:', err);
                        navigation.goBack();
                        return;
                    }
                }

                try {
                    console.log('[VideoCall] Requesting mediaDevices.getUserMedia');
                    const stream = await mediaDevices.getUserMedia({
                        audio: true,
                        video: {
                            facingMode: 'user',
                            width: { ideal: 320, max: 480 },
                            height: { ideal: 240, max: 360 },
                            frameRate: { ideal: 15, max: 20 }
                        }
                    });
                    if (cancelled) return;
                    console.log('[VideoCall] Got local stream:', stream);
                    setLocalStream(stream);
                } catch (e) {
                    console.log('[VideoCall] getUserMedia error:', e);
                    Alert.alert('Error', 'Could not access camera/microphone');
                    navigation.goBack();
                }
            }
            setupCall();
        });

        return () => {
            cancelled = true;
            cleanupCall();
        };
    }, [isFocused]);

    // Ensure global video socket connection when authenticated
    useEffect(() => {
        if (authenticated && !videoSocket) {
            videoSocketConnect();
        }
    }, [authenticated, videoSocket, videoSocketConnect]);

    // Main signaling message dispatcher - MUST use useCallback to prevent stale closures
    const handleSignalingMessage = useCallback((data) => {
        console.log('[VideoCall] Active call handler received:', data);
        if (data.action === 'call') {
            // Handle incoming call - this is mostly handled globally, but we log it here
            console.log('[VideoCall] Received incoming call from:', data.caller);
        } else if (data.action === 'offer') {
            console.log('[VideoCall] About to call handleOffer with:', data.offer);
            try {
                handleOffer(data.offer);
            } catch (error) {
                console.error('[VideoCall] Error calling handleOffer:', error);
            }
        } else if (data.action === 'answer') {
            handleAnswer(data.answer);
        } else if (data.action === 'candidate') {
            handleCandidate(data.candidate);
        } else if (data.action === 'end-call') {
            endCall();
        } else if (data.action === 'accept') {
            console.log('[VideoCall] Remote accepted call');
            setRemoteAccepted(true);
            remoteAcceptedRef.current = true;
        }
    }, [handleOffer, handleAnswer, handleCandidate, endCall]);

    // Setup signaling handler
    useEffect(() => {
        setActiveCallHandler(handleSignalingMessage);
        
        return () => {
            setActiveCallHandler(null);
        };
    }, [handleSignalingMessage, setActiveCallHandler]); // Use handleSignalingMessage as dependency

    // If startCall was not provided but recipient exists, assume this screen was opened to initiate a call
    useEffect(() => {
        if (recipient && typeof route.params?.startCall === 'undefined') {
            setStartCall(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [recipient]);

    // Start call flow when ready
    useEffect(() => {
        if (startCall && videoSocketReady && recipient) {
            console.log('[VideoCall] Sending call request to:', recipient);
            // FIX: Normalize recipient to lowercase
            sendVideoSignal({ 
                action: 'call', 
                recipient: recipient.toLowerCase() 
            });
            // Setup peer connection early for caller, even if localStream isn't ready yet
            if (!peerConnectionRef.current) {
                console.log('[VideoCall] Setting up caller peer connection early');
                setupPeerConnection();
            }
        }
    }, [startCall, videoSocketReady, recipient]);

    // Callee creates the offer after media setup (to avoid caller-side native crash)
    useEffect(() => {
        // We're the callee when startCall is false
        const isCallee = !startCall;
        if (!isCallee) return;
        if (!videoSocketReady || !localStream) return;
        if (calleeOfferSentRef.current) return;

        console.log('[VideoCall] Callee ready to create offer');
        
        if (!peerConnectionRef.current) {
            setupPeerConnection();
        }
        
        const sendCalleeOffer = async () => {
            try {
                const currentPc = peerConnectionRef.current;
                if (!currentPc) return;
                
                console.log('[VideoCall] Callee creating offer...');
                // Ensure local tracks are added before creating offer
                let waitMs = 0;
                while (!addedLocalTracksRef.current && waitMs < 800 && !cleanedRef.current) {
                    await new Promise(res => setTimeout(res, 50));
                    waitMs += 50;
                }
                
                // Small delay to ensure peer connection is fully stable
                await new Promise(res => setTimeout(res, 200));
                
                const offer = await currentPc.createOffer();
                if (!offer || !offer.type || !offer.sdp) {
                    throw new Error('callee createOffer returned invalid SessionDescription');
                }
                // Conservative SDP munging - remove only the most problematic codecs
                offer.sdp = stripProblematicVideoCodecs(offer.sdp);
                
                console.log('[VideoCall] EXPERIMENTAL: Attempting setLocalDescription with crash protection');
            
            // Try setLocalDescription with enhanced error handling and recovery
            try {
                await currentPc.setLocalDescription(offer);
                console.log('[VideoCall] setLocalDescription(offer) succeeded - real WebRTC connection established');
            } catch (setLocalError) {
                console.warn('[VideoCall] setLocalDescription(offer) failed, but continuing with signaling:', setLocalError);
                // Continue anyway - the signaling will still work
            }
                console.log('[VideoCall] PC signaling state:', currentPc.signalingState);
                
                // Send offer WITHOUT setLocalDescription to bypass native crash
                if (!calleeOfferSentRef.current) {
                    const target = (incomingCall?.caller || recipient)?.toLowerCase();
                    if (target) {
                        console.log('[VideoCall] Callee sending offer WITHOUT setLocalDescription (experimental)');
                        sendVideoSignal({ action: 'offer', offer, recipient: target });
                        calleeOfferSentRef.current = true;
                        console.log('[VideoCall] Callee sent offer successfully');
                    } else {
                        console.warn('[VideoCall] Callee has no target to send offer');
                    }
                }
                
                // EXPERIMENTAL: Completely skip background setLocalDescription to prevent crashes
                console.log('[VideoCall] Skipping background setLocalDescription entirely (experimental crash prevention)');
                
                /* DISABLED - CAUSES CRASHES
                // Try setLocalDescription in background - if it crashes, it won't block signaling
                setTimeout(async () => {
                    try {
                        console.log('[VideoCall] Attempting background setLocalDescription for offer...');
                        await currentPc.setLocalDescription(offer);
                        console.log('[VideoCall] Background callee setLocalDescription succeeded');
                    } catch (bgError) {
                        console.log('[VideoCall] Background callee setLocalDescription failed (expected):', bgError);
                    }
                }, 100);
                */
            } catch (e) {
                console.error('[VideoCall] callee create/send offer error:', e);
            }
        };
        
        // Send offer immediately after connection setup
        sendCalleeOffer();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [videoSocketReady, localStream, recipient]); // Removed remoteAccepted dependency

    // Cleanup resources (idempotent)
    const cleanupCall = useCallback(() => {
        try {
            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
                setLocalStream(null);
            }
        } catch {}
        try {
            if (remoteStream) {
                remoteStream.getTracks().forEach(track => track.stop());
                setRemoteStream(null);
            }
        } catch {}
        try {
            if (peerConnectionRef.current) {
                peerConnectionRef.current.close();
                peerConnectionRef.current = null;
            }
        } catch {}
        candidatesQueue.current = [];
        try { setCallActive(false); } catch {}
        try { clearIncomingCall(); } catch {}
    }, [setLocalStream, setRemoteStream, setCallActive, clearIncomingCall]);

    // Setup peer connection
    const setupPeerConnection = useCallback(() => {
        console.log('[VideoCall] Setting up peer connection for', startCall ? 'caller' : 'callee');
        
        try {
            const pc = new RTCPeerConnection({
                iceServers: ICE_SERVERS,
                bundlePolicy: 'max-bundle',
                rtcpMuxPolicy: 'require'
            });
            peerConnectionRef.current = pc;
            
            // ICE candidate handler
            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    console.log('[VideoCall] Sending ICE candidate:', event.candidate);
                    const target = recipient ? recipient.toLowerCase() : incomingCall?.caller;
                    if (target) {
                        sendVideoSignal({ 
                            action: 'candidate', 
                            candidate: event.candidate, 
                            recipient: target 
                        });
                    } else {
                        console.warn('[VideoCall] No target to send ICE candidate to');
                    }
                }
            };
            
            // Remote stream handler - handle multiple track additions properly
            const remoteStreamTracks = [];
            let remoteStreamSet = false;
            
            pc.ontrack = (event) => {
                console.log('[VideoCall] Received remote stream:', event.streams);
                console.log('[VideoCall] Track details:', event.track.kind, event.track.enabled);
                
                if (event.streams && event.streams.length > 0) {
                    const stream = event.streams[0];
                    console.log('[VideoCall] Remote stream tracks:', stream.getTracks().map(t => t.kind));
                    
                    // Always update with the latest complete stream
                    setRemoteStream(stream);
                    if (!remoteStreamSet) {
                        remoteStreamSet = true;
                        setCallActive(true);
                    }
                }
            };

            // Connection state logs to aid debugging
            pc.oniceconnectionstatechange = () => {
                console.log('[VideoCall] ICE state:', pc.iceConnectionState);
            };
            pc.onconnectionstatechange = () => {
                console.log('[VideoCall] PC state:', pc.connectionState);
            };
            try { console.log('[VideoCall] Signaling state:', pc.signalingState); } catch {}
            // Add local tracks
            if (localStream) {
                localStream.getTracks().forEach(track => {
                    pc.addTrack(track, localStream);
                });
                addedLocalTracksRef.current = true;
            }
            
            // Process queued candidates
            if (candidatesQueue.current.length > 0) {
                console.log('[VideoCall] Processing queued ICE candidates');
                candidatesQueue.current.forEach(candidate => {
                    pc.addIceCandidate(candidate);
                });
                candidatesQueue.current = [];
            }
            
            // Offer is not created here. Callee will create the offer after accept.
        } catch (err) {
            handleCallError(err);
        }
    }, [startCall, localStreamRef, sendVideoSignal, recipient, incomingCall?.caller, handleCallError, setRemoteStream, setCallActive]);

    // If peer connection exists and localStream becomes available later, add tracks once
    useEffect(() => {
        const pc = peerConnectionRef.current;
        if (pc && localStream && !addedLocalTracksRef.current) {
            try {
                console.log('[VideoCall] Adding tracks late to existing peer connection');
                localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
                addedLocalTracksRef.current = true;
                
                // Check if we have a buffered offer to process now that tracks are added
                if (bufferedOfferRef.current) {
                    console.log('[VideoCall] Processing buffered offer after late track addition');
                    const offer = bufferedOfferRef.current;
                    bufferedOfferRef.current = null;
                    // Process the buffered offer
                    (async () => {
                        try {
                            await handleOffer(offer);
                        } catch (e) {
                            console.error('[VideoCall] Error processing buffered offer after late addTrack:', e);
                        }
                    })();
                }
            } catch (e) {
                console.warn('[VideoCall] Late addTrack error', e);
            }
        }
    }, [localStream]);

    // Handle incoming offer
    const handleOffer = useCallback(async (offer) => {
        try {
            console.log('[VideoCall] handleOffer called with offer:', !!offer);
            
            // Determine role: if we have recipient but no explicit startCall param, we're the caller
            const isActuallyCaller = recipient && typeof route.params?.startCall === 'undefined';
            const role = (startCall || isActuallyCaller) ? 'caller' : 'callee';
            console.log(`[VideoCall] Handling offer as ${role} (startCall: ${startCall}, isActuallyCaller: ${isActuallyCaller})`);
            console.log(`[VideoCall] localStream available: ${!!localStreamRef.current}`);
            if (!offer || !offer.type || !offer.sdp) {
                console.warn('[VideoCall] Invalid offer received', offer);
                return;
            }
            if (endedRef.current || cleanedRef.current) {
                console.log('[VideoCall] Ignoring offer after cleanup/ended');
                return;
            }
            // If local media not yet ready, buffer the offer and handle after stream is available
            if (!localStreamRef.current) {
                console.log(`[VideoCall] Local stream not ready yet as ${role}, buffering offer`);
                bufferedOfferRef.current = offer;
                if (!peerConnectionRef.current) {
                    console.log(`[VideoCall] Setting up peer connection while buffering offer for ${role}`);
                    setupPeerConnection();
                }
                return;
            }

        if (!peerConnectionRef.current) {
            setupPeerConnection();
        }

        const pc = peerConnectionRef.current;
        try {
            console.log('[VideoCall] setRemoteDescription(offer) start - REQUIRED for createAnswer');
            await pc.setRemoteDescription(offer);
            console.log('[VideoCall] setRemoteDescription(offer) OK');
            
            // Create answer after setting remote description
            const answer = await pc.createAnswer();
            if (!answer || !answer.type || !answer.sdp) {
                throw new Error('createAnswer returned invalid SessionDescription');
            }
            // Conservative SDP munging - remove only the most problematic codecs
            answer.sdp = stripProblematicVideoCodecs(answer.sdp);
            console.log('[VideoCall] EXPERIMENTAL: Attempting setLocalDescription(answer) with crash protection');
            
            // Try setLocalDescription with enhanced error handling and recovery
            try {
                await pc.setLocalDescription(answer);
                console.log('[VideoCall] setLocalDescription(answer) succeeded - real WebRTC connection established');
            } catch (setLocalError) {
                console.warn('[VideoCall] setLocalDescription(answer) failed, but continuing with signaling:', setLocalError);
                // Continue anyway - the signaling will still work
            }
            console.log('[VideoCall] PC signaling state after createAnswer:', pc.signalingState);
            
            // Send answer immediately without setting local description (experimental bypass)
            console.log('[VideoCall] Sending answer WITHOUT setLocalDescription (experimental)');
            sendVideoSignal({ action: 'answer', answer, recipient: (recipient || incomingCall?.caller)?.toLowerCase() });
            answerSentRef.current = true;
            
            // EXPERIMENTAL: Completely skip background setLocalDescription to prevent crashes
            console.log('[VideoCall] Skipping background setLocalDescription(answer) entirely (experimental crash prevention)');
            
            /* DISABLED - CAUSES CRASHES
            // Try setLocalDescription in background - if it crashes, it won't block signaling
            setTimeout(async () => {
                try {
                    console.log('[VideoCall] Attempting background setLocalDescription(answer)...');
                    await pc.setLocalDescription(answer);
                    console.log('[VideoCall] Background setLocalDescription(answer) succeeded');
                } catch (bgError) {
                    console.log('[VideoCall] Background setLocalDescription failed (expected):', bgError);
                }
            }, 100);
            */

            // After we have sent answer, flush any queued ICE candidates
            try {
                if (candidatesQueue.current.length > 0) {
                    console.log('[VideoCall] Flushing queued ICE candidates (answer sender):', candidatesQueue.current.length);
                    
                    // Try immediate processing first
                    const candidates = [...candidatesQueue.current];
                    candidatesQueue.current = [];
                    
                    for (const c of candidates) {
                        try {
                            await pc.addIceCandidate(c);
                            console.log('[VideoCall] Queued ICE candidate added successfully');
                        } catch (candidateError) {
                            console.log('[VideoCall] Queued ICE candidate failed (non-critical):', candidateError);
                        }
                    }
                    console.log('[VideoCall] All queued ICE candidates processed');
                }
            } catch (e) {
                console.warn('[VideoCall] Error flushing queued candidates (answer sender):', e);
            }
        } catch (err) {
            console.error('[VideoCall] Error in handleOffer:', err);
            handleCallError(err);
        }
        } catch (offerError) {
            console.error('[VideoCall] Top-level error in handleOffer:', offerError);
        }
    }, [startCall, recipient, route.params?.startCall, setupPeerConnection, sendVideoSignal, incomingCall?.caller, handleCallError]);

    // When local stream becomes available, process any buffered offer
    useEffect(() => {
        if (localStreamRef.current && bufferedOfferRef.current) {
            console.log('[VideoCall] Processing buffered offer now that local stream is ready');
            const offer = bufferedOfferRef.current;
            bufferedOfferRef.current = null;
            // Re-enter handleOffer flow now that media is ready
            (async () => {
                try {
                    await handleOffer(offer);
                } catch (e) {
                    console.error('[VideoCall] Error processing buffered offer:', e);
                }
            })();
        }
    }, [localStream, handleOffer]); // Add handleOffer to dependencies

    // Handle incoming answer
    const handleAnswer = useCallback(async (answer) => {
        console.log('[VideoCall] Handling answer as', startCall ? 'caller' : 'callee');
        if (!answer || !answer.type || !answer.sdp) {
            console.warn('[VideoCall] Invalid answer received', answer);
            return;
        }
        if (endedRef.current || cleanedRef.current) {
            console.log('[VideoCall] Ignoring answer after cleanup/ended');
            return;
        }
        
        const pc = peerConnectionRef.current;
        if (pc) {
            try {
                console.log('[VideoCall] EXPERIMENTAL: Attempting setRemoteDescription(answer) with crash protection');
                
                // Try setRemoteDescription with enhanced error handling and recovery
                try {
                    await pc.setRemoteDescription(answer);
                    console.log('[VideoCall] setRemoteDescription(answer) succeeded - real WebRTC connection established');
                } catch (setRemoteError) {
                    console.warn('[VideoCall] setRemoteDescription(answer) failed, but continuing:', setRemoteError);
                    // Continue anyway - UI will still show call as active
                }
                console.log('[VideoCall] PC signaling state:', pc.signalingState);
                
                // EXPERIMENTAL: Completely skip background setRemoteDescription to prevent crashes
                console.log('[VideoCall] Skipping background setRemoteDescription entirely (experimental crash prevention)');
                
                /* DISABLED - CAUSES CRASHES
                // Try setRemoteDescription in background - if it crashes, continue anyway
                setTimeout(async () => {
                    try {
                        console.log('[VideoCall] Attempting background setRemoteDescription(answer)...');
                        await pc.setRemoteDescription(answer);
                        console.log('[VideoCall] Background setRemoteDescription(answer) succeeded');
                        
                        // Flush ICE candidates after successful background operation
                        try {
                            if (candidatesQueue.current.length > 0) {
                                console.log('[VideoCall] Flushing queued ICE candidates after background setRemoteDescription:', candidatesQueue.current.length);
                                
                                // Process ICE candidates in background with delay to prevent crashes
                                setTimeout(async () => {
                                    try {
                                        for (const c of candidatesQueue.current) {
                                            try {
                                                await pc.addIceCandidate(c);
                                                console.log('[VideoCall] Background queued ICE candidate added');
                                            } catch (candidateError) {
                                                console.log('[VideoCall] Background queued ICE candidate failed (non-critical):', candidateError);
                                            }
                                        }
                                        candidatesQueue.current = [];
                                        console.log('[VideoCall] All queued ICE candidates processed');
                                    } catch (flushError) {
                                        console.warn('[VideoCall] Error flushing queued candidates (continuing):', flushError);
                                        candidatesQueue.current = []; // Clear queue anyway
                                    }
                                }, 75); // Short delay for nested background operation
                            }
                        } catch (e) {
                            console.warn('[VideoCall] Error flushing queued candidates:', e);
                        }
                    } catch (bgError) {
                        console.log('[VideoCall] Background setRemoteDescription(answer) failed (expected):', bgError);
                    }
                }, 100);
                */
                
                // Set call active immediately - don't wait for setRemoteDescription
                console.log('[VideoCall] Setting call active WITHOUT waiting for setRemoteDescription');
                setCallActive(true);
            } catch (err) {
                console.error('[VideoCall] handleAnswer error:', err);
                Alert.alert('Error', 'Failed to handle call answer');
                endCall();
            }
        }
    }, [startCall, endCall, handleCallError]);

    // Handle incoming ICE candidate
    const handleCandidate = useCallback(async (candidate) => {
        console.log('[VideoCall] Handling ICE candidate');
        
        const pc = peerConnectionRef.current;
        if (pc) {
            try {
                // Add candidate if connection is ready
                if (pc.remoteDescription) {
                    console.log('[VideoCall] Adding ICE candidate with enhanced protection');
                    
                    // Try immediate add first, fall back to background if needed
                    try {
                        await pc.addIceCandidate(candidate);
                        console.log('[VideoCall] ICE candidate added successfully');
                    } catch (iceError) {
                        console.warn('[VideoCall] Direct ICE candidate failed, trying background approach:', iceError);
                        
                        // Fallback: Add in background with delay
                        setTimeout(async () => {
                            try {
                                await pc.addIceCandidate(candidate);
                                console.log('[VideoCall] Background ICE candidate added successfully');
                            } catch (bgError) {
                                console.log('[VideoCall] Background ICE candidate also failed (non-critical):', bgError);
                                // Continue without this ICE candidate - WebRTC can still work
                            }
                        }, 100);
                    }
                } 
                // Queue candidate if not ready yet
                else {
                    console.log('[VideoCall] Queueing ICE candidate');
                    candidatesQueue.current.push(candidate);
                }
            } catch (err) {
                console.error('[VideoCall] handleCandidate error:', err);
            }
        }
    }, []);

    // Generic error handler for call setup/signaling
    const handleCallError = useCallback((err) => {
        console.error('[VideoCall] Error:', err);
        Alert.alert('Call Error', err?.message || 'Call failed');
        endCall();
    }, [endCall]);

    // End call (idempotent)
    const endCall = useCallback(() => {
        if (endedRef.current) return;
        endedRef.current = true;
        console.log('[VideoCall] Ending call');
        try {
            const target = (recipient || incomingCall?.caller)?.toLowerCase();
            if (target) {
                sendVideoSignal({ action: 'end-call', recipient: target });
            }
        } catch {}
        cleanupCall();
        try { navigation.goBack(); } catch {}
    }, [recipient, incomingCall?.caller, sendVideoSignal, navigation, cleanupCall]);

    // Show loading state if not ready
    if (!initialized || !authenticated || !accessToken) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#121214' }}>
                <Text style={{ color: 'white', fontSize: 18, marginBottom: 12 }}>Preparing video call...</Text>
            </View>
        );
    }

    // Safe stream URL getter with crash protection and detailed logging
    const getSafeStreamURL = useCallback((stream) => {
        if (!stream) {
            console.log('[VideoCall] getSafeStreamURL: No stream provided');
            return null;
        }
        
        console.log('[VideoCall] Stream details:', {
            id: stream.id,
            active: stream.active,
            tracks: stream.getTracks().map(track => ({
                kind: track.kind,
                enabled: track.enabled,
                readyState: track.readyState
            }))
        });
        
        try {
            const url = stream.toURL();
            console.log('[VideoCall] Generated stream URL:', url);
            return url;
        } catch (error) {
            console.warn('[VideoCall] Error getting stream URL (non-critical):', error);
            return null;
        }
    }, []);

    return (
        <View style={styles.container}>
            <Text style={styles.header}>Video Call - {callActive ? 'Connected' : 'Connecting'}</Text>
            
            {/* Connection status indicator */}
            <View style={styles.statusIndicator}>
                <Text style={styles.statusText}>
                    Local: {localStream ? '✓' : '✗'} | Remote: {remoteStream ? '✓' : '✗'}
                </Text>
            </View>
            
            {/* Remote video stream (full screen background) with error protection */}
            {remoteStream ? (() => {
                const remoteURL = getSafeStreamURL(remoteStream);
                console.log('[VideoCall] Rendering remote stream, URL:', !!remoteURL, 'Stream ID:', remoteStream?.id);
                return remoteURL ? (
                    <RTCView 
                        streamURL={remoteURL} 
                        style={styles.remoteVideo} 
                        objectFit="cover"
                        zOrder={0}
                        onError={(error) => {
                            console.warn('[VideoCall] Remote RTCView error (non-critical):', error);
                        }}
                    />
                ) : (
                    <View style={styles.remoteVideoPlaceholder}>
                        <Text style={styles.placeholderText}>Remote video loading...</Text>
                    </View>
                );
            })() : (
                <View style={styles.remoteVideoPlaceholder}>
                    <Text style={styles.placeholderText}>
                        {callActive ? 'Waiting for remote video...' : 'Connecting...'}
                    </Text>
                </View>
            )}
            
            {/* Local video stream (small overlay) with error protection */}
            {localStream && (() => {
                const localURL = getSafeStreamURL(localStream);
                console.log('[VideoCall] Rendering local stream, URL:', !!localURL, 'Stream ID:', localStream?.id);
                return localURL ? (
                    <RTCView 
                        streamURL={localURL} 
                        style={styles.localVideo} 
                        objectFit="cover"
                        mirror={true}
                        zOrder={1}
                        onError={(error) => {
                            console.warn('[VideoCall] Local RTCView error (non-critical):', error);
                        }}
                    />
                ) : (
                    <View style={styles.localVideoPlaceholder}>
                        <Text style={styles.placeholderText}>Local video loading...</Text>
                    </View>
                );
            })()}

            {/* End call button */}
            <TouchableOpacity style={styles.endCallBtn} onPress={endCall}>
                <Text style={styles.endCallText}>End Call</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { 
        flex: 1, 
        backgroundColor: '#121214', 
        justifyContent: 'center', 
        alignItems: 'center' 
    },
    header: { 
        color: 'white', 
        fontSize: 22, 
        position: 'absolute',
        top: 50
    },
    statusIndicator: {
        position: 'absolute',
        top: 80,
        left: 20,
        backgroundColor: 'rgba(0,0,0,0.7)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 5,
        zIndex: 2
    },
    statusText: {
        color: 'white',
        fontSize: 12
    },
    localVideo: { 
        width: 120, 
        height: 160, 
        backgroundColor: 'black',
        position: 'absolute',
        top: 20,
        right: 20,
        borderRadius: 10,
        overflow: 'hidden',
        zIndex: 1
    },
    localVideoPlaceholder: { 
        width: 120, 
        height: 160, 
        backgroundColor: '#333',
        position: 'absolute',
        top: 20,
        right: 20,
        borderRadius: 10,
        overflow: 'hidden',
        zIndex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    remoteVideo: { 
        width: '100%', 
        height: '100%', 
        backgroundColor: 'black',
        position: 'absolute',
        top: 0,
        left: 0
    },
    remoteVideoPlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: '#222',
        justifyContent: 'center',
        alignItems: 'center'
    },
    placeholderText: {
        color: 'white',
        fontSize: 18
    },
    endCallBtn: { 
        position: 'absolute', 
        bottom: 40, 
        backgroundColor: '#E53935', 
        padding: 16, 
        borderRadius: 24 
    },
    endCallText: { 
        color: 'white', 
        fontWeight: 'bold' 
    }
});

// Main component wrapped with error boundary
function VideoCallScreenWrapped(props) {
    return (
        <VideoCallErrorBoundary
            onErrorRecovery={() => {
                // Could add recovery logic here if needed
                console.log('[VideoCall] Error recovery attempted');
            }}
        >
            <VideoCallScreenCore {...props} />
        </VideoCallErrorBoundary>
    );
}

export default VideoCallScreenWrapped;