import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, push, set, onValue, update, remove, serverTimestamp } from 'firebase/database';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDVXUVwiel_rb1Z7T4xFktArycVvjc1Nfs",
  authDomain: "voicetranslate-e446d.firebaseapp.com",
  databaseURL: "https://voicetranslate-e446d-default-rtdb.firebaseio.com",
  projectId: "voicetranslate-e446d",
  storageBucket: "voicetranslate-e446d.firebasestorage.app",
  messagingSenderId: "672126549267",
  appId: "1:672126549267:web:ebd535ac880aead5242ee6",
  measurementId: "G-L8DTTXJGJN"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

function LanguageBridgeWithVideo() {
  // User state
  const [userId] = useState(() => `user_${Math.random().toString(36).substr(2, 9)}`);
  const [userName, setUserName] = useState('');
  const [userLanguage, setUserLanguage] = useState('hi-IN');
  const [sessionCode, setSessionCode] = useState('');
  const [currentSessionCode, setCurrentSessionCode] = useState('');
  
  // App state
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  
  // Messages and users
  const [messages, setMessages] = useState([]);
  const [connectedUsers, setConnectedUsers] = useState({});
  const [myTranscript, setMyTranscript] = useState('');
  const [receivedTranscript, setReceivedTranscript] = useState('');
  
  // Status
  const [status, setStatus] = useState('offline');
  const [error, setError] = useState('');
  const [videoStatus, setVideoStatus] = useState('');
  const [translationStatus, setTranslationStatus] = useState('');
  const [permissionStatus, setPermissionStatus] = useState('');
  
  // Video state
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [peerConnection, setPeerConnection] = useState(null);
  const [isCallInitiator, setIsCallInitiator] = useState(false);
  const [connectionState, setConnectionState] = useState('new');
  
  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  
  // Refs
  const recognitionRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const lastTranscriptRef = useRef('');
  const unsubscribersRef = useRef([]);
  const peerConnectionRef = useRef(null);
  const processedMessageIds = useRef(new Set());
  const iceCandidatesBuffer = useRef([]);
  const audioContextRef = useRef(null);

  // Languages with better organization (memoized to prevent re-renders)
  const languages = useMemo(() => [
    { code: 'hi-IN', name: 'Hindi', native: 'हिंदी', flag: '🇮🇳' },
    { code: 'te-IN', name: 'Telugu', native: 'తెలుగు', flag: '🇮🇳' },
    { code: 'en-US', name: 'English', native: 'English', flag: '🇺🇸' },
    { code: 'ta-IN', name: 'Tamil', native: 'தமிழ்', flag: '🇮🇳' },
    { code: 'kn-IN', name: 'Kannada', native: 'ಕನ್ನಡ', flag: '🇮🇳' },
    { code: 'ml-IN', name: 'Malayalam', native: 'മലയാളം', flag: '🇮🇳' },
    { code: 'mr-IN', name: 'Marathi', native: 'मराठी', flag: '🇮🇳' },
    { code: 'gu-IN', name: 'Gujarati', native: 'ગુજરાતી', flag: '🇮🇳' },
    { code: 'bn-IN', name: 'Bengali', native: 'বাংলা', flag: '🇮🇳' },
    { code: 'pa-IN', name: 'Punjabi', native: 'ਪੰਜਾਬੀ', flag: '🇮🇳' },
    { code: 'es-ES', name: 'Spanish', native: 'Español', flag: '🇪🇸' },
    { code: 'fr-FR', name: 'French', native: 'Français', flag: '🇫🇷' },
    { code: 'de-DE', name: 'German', native: 'Deutsch', flag: '🇩🇪' },
    { code: 'ja-JP', name: 'Japanese', native: '日本語', flag: '🇯🇵' },
    { code: 'ko-KR', name: 'Korean', native: '한국어', flag: '🇰🇷' },
    { code: 'ar-SA', name: 'Arabic', native: 'العربية', flag: '🇸🇦' },
    { code: 'zh-CN', name: 'Chinese', native: '中文', flag: '🇨🇳' },
    { code: 'ru-RU', name: 'Russian', native: 'Русский', flag: '🇷🇺' },
    { code: 'pt-BR', name: 'Portuguese', native: 'Português', flag: '🇧🇷' },
    { code: 'it-IT', name: 'Italian', native: 'Italiano', flag: '🇮🇹' }
  ], []);

  // Detect mobile and iOS
  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    const mobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
    const ios = /iphone|ipad|ipod/i.test(userAgent);
    
    setIsMobile(mobile);
    setIsIOS(ios);
    
    console.log('📱 Device detection:', { mobile, ios, userAgent });
  }, []);

  // Get other users who are online
  const getOtherUsers = useCallback(() => {
    return Object.values(connectedUsers).filter(user => user.id !== userId && user.isOnline);
  }, [connectedUsers, userId]);

  // Initialize audio context for mobile
  const initializeAudioContext = useCallback(() => {
    if (!audioContextRef.current && (window.AudioContext || window.webkitAudioContext)) {
      try {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        console.log('🎵 Audio context initialized');
        
        // Resume audio context on user interaction (required for iOS)
        if (audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume().then(() => {
            console.log('🎵 Audio context resumed');
          });
        }
      } catch (error) {
        console.error('❌ Audio context initialization failed:', error);
      }
    }
  }, []);

  // Enhanced media initialization for mobile
  const initializeMedia = useCallback(async () => {
    try {
      setVideoStatus('🎥 Requesting permissions...');
      setPermissionStatus('📋 Checking permissions...');
      
      // Initialize audio context first (especially important for iOS)
      initializeAudioContext();
      
      // Mobile-optimized constraints
      const constraints = {
        video: isVideoEnabled ? {
          width: { ideal: isMobile ? 640 : 1280 },
          height: { ideal: isMobile ? 480 : 720 },
          frameRate: { ideal: isMobile ? 15 : 30 },
          facingMode: 'user' // Front camera for mobile
        } : false,
        audio: isAudioEnabled ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          // Mobile-specific audio settings
          sampleRate: isMobile ? 16000 : 44100,
          channelCount: 1
        } : false
      };
      
      console.log('📱 Media constraints:', constraints);
      
      // Request permissions explicitly on mobile
      if (isMobile) {
        try {
          const permissions = [];
          if (isAudioEnabled) permissions.push('microphone');
          if (isVideoEnabled) permissions.push('camera');
          
          for (const permission of permissions) {
            const result = await navigator.permissions.query({ name: permission });
            console.log(`🔐 ${permission} permission:`, result.state);
            setPermissionStatus(`🔐 ${permission}: ${result.state}`);
          }
        } catch (permError) {
          console.log('⚠️ Permission API not supported, proceeding with getUserMedia');
        }
      }
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        // Ensure video plays on mobile
        if (isMobile) {
          localVideoRef.current.setAttribute('playsinline', true);
          localVideoRef.current.setAttribute('autoplay', true);
          localVideoRef.current.setAttribute('muted', true);
        }
      }
      
      setVideoStatus('✅ Media initialized');
      setPermissionStatus('✅ Permissions granted');
      console.log('✅ Media initialized:', { 
        video: isVideoEnabled, 
        audio: isAudioEnabled,
        tracks: stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled }))
      });
      
      return stream;
    } catch (error) {
      console.error('❌ Media access error:', error);
      let errorMessage = 'Cannot access camera/microphone. ';
      
      if (error.name === 'NotAllowedError') {
        errorMessage += 'Please grant permissions and try again.';
        setPermissionStatus('❌ Permissions denied');
      } else if (error.name === 'NotFoundError') {
        errorMessage += 'No camera/microphone found.';
        setPermissionStatus('❌ Device not found');
      } else if (error.name === 'NotReadableError') {
        errorMessage += 'Device is busy or unavailable.';
        setPermissionStatus('❌ Device busy');
      } else {
        errorMessage += error.message;
        setPermissionStatus('❌ Unknown error');
      }
      
      if (isMobile) {
        errorMessage += ' On mobile, ensure you\'re using HTTPS and have granted browser permissions.';
      }
      
      setError(errorMessage);
      setVideoStatus('❌ Media access failed');
      return null;
    }
  }, [isVideoEnabled, isAudioEnabled, isMobile, initializeAudioContext]);

  // Send WebRTC signaling data through Firebase
  const sendSignalingData = useCallback(async (data) => {
    if (!currentSessionCode) return;
    
    try {
      const signalingData = {
        senderId: userId,
        senderName: userName,
        targetId: data.targetId || 'broadcast',
        data: data,
        timestamp: serverTimestamp()
      };
      
      await push(ref(database, `sessions/${currentSessionCode}/signaling`), signalingData);
      console.log('📡 Signaling data sent:', data.type, 'to:', data.targetId || 'broadcast');
    } catch (error) {
      console.error('❌ Failed to send signaling data:', error);
    }
  }, [currentSessionCode, userId, userName]);

  // Enhanced WebRTC setup with better mobile support
  const setupPeerConnection = useCallback(async (stream, targetUserId = null) => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    // Enhanced STUN/TURN configuration for better connectivity
    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' }
      ],
      iceCandidatePoolSize: 10,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require'
    };
    
    const pc = new RTCPeerConnection(configuration);
    peerConnectionRef.current = pc;
    setPeerConnection(pc);
    setConnectionState('connecting');
    
    // Add local stream tracks
    if (stream) {
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
        console.log('➕ Added track to peer connection:', track.kind, track.enabled);
      });
    }
    
    // Handle remote stream
    pc.ontrack = (event) => {
      console.log('📹 Received remote track:', event.track.kind);
      const [remoteStream] = event.streams;
      setRemoteStream(remoteStream);
      
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        
        // Ensure remote video plays on mobile
        if (isMobile) {
          remoteVideoRef.current.setAttribute('playsinline', true);
          remoteVideoRef.current.setAttribute('autoplay', true);
          
          // Force play on mobile
          setTimeout(() => {
            if (remoteVideoRef.current) {
              remoteVideoRef.current.play().catch(e => {
                console.log('Remote video autoplay blocked, user interaction required');
              });
            }
          }, 100);
        }
      }
      
      setVideoStatus('📹 Remote video connected');
      setConnectionState('connected');
    };
    
    // Handle ICE candidates with buffering
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('🧊 ICE candidate generated:', event.candidate.type);
        sendSignalingData({
          type: 'ice-candidate',
          candidate: event.candidate,
          targetId: targetUserId
        });
      } else {
        console.log('🧊 ICE gathering complete');
      }
    };

    // Enhanced connection state handling
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log('🔗 Connection state changed:', state);
      setConnectionState(state);
      
      if (state === 'connected') {
        setVideoStatus('✅ Video call connected');
        setError('');
      } else if (state === 'disconnected') {
        setVideoStatus('⚠️ Connection lost, reconnecting...');
        // Attempt to reconnect
        setTimeout(() => {
          if (pc.connectionState === 'disconnected') {
            console.log('🔄 Attempting to reconnect...');
            createOffer(targetUserId);
          }
        }, 3000);
      } else if (state === 'failed') {
        setVideoStatus('❌ Connection failed');
        setError('Video connection failed. Please try again.');
        // Restart connection
        setTimeout(() => {
          if (isVideoEnabled) {
            setupPeerConnection(stream, targetUserId);
          }
        }, 5000);
      } else if (state === 'connecting') {
        setVideoStatus('🔄 Connecting...');
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('❄️ ICE connection state:', pc.iceConnectionState);
      
      if (pc.iceConnectionState === 'failed') {
        console.log('❄️ ICE connection failed, restarting...');
        pc.restartIce();
      }
    };

    // Handle buffered ICE candidates
    iceCandidatesBuffer.current.forEach(candidate => {
      pc.addIceCandidate(candidate).catch(e => {
        console.error('❌ Error adding buffered ICE candidate:', e);
      });
    });
    iceCandidatesBuffer.current = [];
    
    return pc;
  }, [sendSignalingData, isVideoEnabled, isMobile]);

  // Create offer for video call
  const createOffer = useCallback(async (targetUserId = null) => {
    const pc = peerConnectionRef.current;
    if (!pc) return;

    try {
      console.log('📞 Creating offer for:', targetUserId || 'broadcast');
      setVideoStatus('📞 Creating call offer...');
      
      const offer = await pc.createOffer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: true
      });
      
      await pc.setLocalDescription(offer);
      
      await sendSignalingData({
        type: 'offer',
        offer: offer,
        targetId: targetUserId
      });
      
      console.log('✅ Offer sent');
      setVideoStatus('📞 Call offer sent');
    } catch (error) {
      console.error('❌ Error creating offer:', error);
      setVideoStatus('❌ Failed to create offer');
      setError('Failed to create video call offer');
    }
  }, [sendSignalingData]);

  // Handle received offer
  const handleOffer = useCallback(async (offer, senderId) => {
    const pc = peerConnectionRef.current;
    if (!pc) return;

    try {
      console.log('📞 Received offer from:', senderId);
      setVideoStatus('📞 Received call, answering...');
      
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      await sendSignalingData({
        type: 'answer',
        answer: answer,
        targetId: senderId
      });
      
      console.log('✅ Answer sent to:', senderId);
      setVideoStatus('✅ Call answered');
    } catch (error) {
      console.error('❌ Error handling offer:', error);
      setVideoStatus('❌ Failed to answer call');
      setError('Failed to answer video call');
    }
  }, [sendSignalingData]);

  // Handle received answer
  const handleAnswer = useCallback(async (answer, senderId) => {
    const pc = peerConnectionRef.current;
    if (!pc) return;

    try {
      console.log('✅ Received answer from:', senderId);
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      setVideoStatus('✅ Call established');
    } catch (error) {
      console.error('❌ Error handling answer:', error);
      setVideoStatus('❌ Failed to establish call');
      setError('Failed to establish video call');
    }
  }, []);

  // Handle ICE candidate with improved error handling
  const handleIceCandidate = useCallback(async (candidate, senderId) => {
    const pc = peerConnectionRef.current;
    
    if (!pc) {
      // Buffer ICE candidates if peer connection not ready
      iceCandidatesBuffer.current.push(candidate);
      console.log('🧊 Buffering ICE candidate from:', senderId);
      return;
    }

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('🧊 ICE candidate added from:', senderId);
    } catch (error) {
      console.error('❌ Error adding ICE candidate:', error);
    }
  }, []);

  // Generate session code
  const generateCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

  // Enhanced translation with better error handling
  const translateText = useCallback(async (text, fromLang, toLang) => {
    if (!text.trim() || !apiKey || fromLang === toLang) return text;
    
    try {
      setTranslationStatus('🤖 Translating...');
      const fromLangInfo = languages.find(l => l.code === fromLang);
      const toLangInfo = languages.find(l => l.code === toLang);
      
      const prompt = `Translate this text from ${fromLangInfo?.name || fromLang} to ${toLangInfo?.name || toLang}. 
      Maintain the natural tone and context. Return ONLY the translation without quotes or explanations:
      
      "${text}"`;
      
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { 
              temperature: 0.2, 
              maxOutputTokens: 512,
              topP: 0.8,
              topK: 40
            }
          })
        }
      );

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} - ${response.statusText}`);
      }
      
      const data = await response.json();
      let translation = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      
      if (!translation) {
        throw new Error('Empty translation response');
      }
      
      // Clean up translation (remove quotes, explanations)
      translation = translation.replace(/^["']|["']$/g, '');
      
      setTranslationStatus('✅ Translation complete');
      setTimeout(() => setTranslationStatus(''), 2000);
      
      console.log('✅ Translation:', { from: text, to: translation, fromLang, toLang });
      return translation;
    } catch (error) {
      console.error('❌ Translation error:', error);
      setError(`Translation failed: ${error.message}`);
      setTranslationStatus('❌ Translation failed');
      setTimeout(() => setTranslationStatus(''), 3000);
      return `[Translation Error: ${text}]`;
    }
  }, [apiKey, languages]);

  // Enhanced speech synthesis with mobile optimizations
  const speakText = useCallback((text, languageCode) => {
    if (!text || isMuted || !window.speechSynthesis) return;
    
    console.log('🗣️ Speaking:', { text, languageCode, isMobile });
    
    // Initialize audio context on user interaction (important for mobile)
    initializeAudioContext();
    
    // Stop any ongoing speech
    speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = languageCode;
    utterance.rate = isMobile ? 0.8 : 0.9; // Slightly slower on mobile
    utterance.volume = 0.8;
    utterance.pitch = 1.0;
    
    // Mobile-optimized voice selection
    const voices = speechSynthesis.getVoices();
    const langCode = languageCode.split('-')[0];
    
    // Prefer local voices on mobile, cloud voices on desktop
    let preferredVoice;
    if (isMobile) {
      preferredVoice = voices.find(v => 
        (v.lang === languageCode || v.lang.startsWith(langCode)) && v.localService
      ) || voices.find(v => 
        v.lang === languageCode || v.lang.startsWith(langCode)
      );
    } else {
      preferredVoice = voices.find(v => 
        v.lang === languageCode || v.lang.startsWith(langCode)
      );
    }
    
    if (preferredVoice) {
      utterance.voice = preferredVoice;
      console.log('🎵 Using voice:', preferredVoice.name, 'Local:', preferredVoice.localService);
    }
    
    utterance.onstart = () => {
      console.log('🗣️ Speech started');
    };
    
    utterance.onend = () => {
      console.log('🗣️ Speech ended');
    };
    
    utterance.onerror = (event) => {
      console.error('❌ Speech synthesis error:', event);
      // On mobile, sometimes speech fails silently - try again
      if (isMobile && event.error === 'synthesis-failed') {
        setTimeout(() => {
          console.log('🔄 Retrying speech on mobile...');
          speechSynthesis.speak(utterance);
        }, 1000);
      }
    };
    
    // On iOS, speech synthesis needs user interaction
    if (isIOS) {
      const speakWithDelay = () => {
        setTimeout(() => {
          speechSynthesis.speak(utterance);
        }, 100);
      };
      speakWithDelay();
    } else {
      speechSynthesis.speak(utterance);
    }
  }, [isMuted, isMobile, isIOS, initializeAudioContext]);

  // Send translation message to Firebase
  const sendTranslationMessage = useCallback(async (originalText, translatedTexts) => {
    if (!currentSessionCode) return;

    const messageData = {
      senderId: userId,
      senderName: userName,
      originalText: originalText,
      originalLang: userLanguage,
      translatedTexts: translatedTexts,
      timestamp: serverTimestamp(),
      type: 'translation',
      messageId: `${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    
    try {
      await push(ref(database, `sessions/${currentSessionCode}/messages`), messageData);
      console.log('✅ Translation message sent:', messageData);
    } catch (error) {
      console.error('❌ Failed to send translation message:', error);
      setError('Failed to send translation message');
    }
  }, [currentSessionCode, userId, userName, userLanguage]);

  // Enhanced speech recognition with mobile support
  const setupSpeechRecognition = useCallback(() => {
    if (!window.webkitSpeechRecognition && !window.SpeechRecognition) {
      setError('Speech recognition not supported. Please use Chrome or Safari browser.');
      return null;
    }

    const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
    const recognition = new SpeechRecognition();
    
    // Mobile-optimized settings
    recognition.continuous = !isMobile; // On mobile, use shorter sessions
    recognition.interimResults = true;
    recognition.lang = userLanguage;
    recognition.maxAlternatives = 1;
    
    // Mobile-specific settings
    if (isMobile) {
      recognition.continuous = false; // Better for mobile battery
      recognition.maxAlternatives = 1;
    }

    recognition.onstart = () => {
      setIsListening(true);
      setStatus('listening');
      setError('');
      console.log('🎤 Speech recognition started');
      
      // Initialize audio context on start (mobile requirement)
      initializeAudioContext();
    };

    recognition.onresult = async (event) => {
      let finalTranscript = '';
      let interimTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }

      // Update interim results
      if (interimTranscript) {
        setMyTranscript(prev => lastTranscriptRef.current + interimTranscript);
      }

      // Process final results
      if (finalTranscript.trim()) {
        const cleanText = finalTranscript.trim();
        lastTranscriptRef.current += cleanText + ' ';
        setMyTranscript(lastTranscriptRef.current);
        
        console.log('🗣️ Final transcript:', cleanText);
        
        // Get all other users and their languages
        const otherUsers = getOtherUsers();
        console.log('👥 Other users for translation:', otherUsers);
        
        if (otherUsers.length > 0) {
          setStatus('translating');
          
          // Create translations for each user's language
          const translatedTexts = {};
          
          for (const user of otherUsers) {
            if (user.language !== userLanguage) {
              try {
                const translation = await translateText(cleanText, userLanguage, user.language);
                translatedTexts[user.language] = translation;
                console.log(`✅ Translated for ${user.name} (${user.language}):`, translation);
              } catch (error) {
                console.error(`❌ Translation failed for ${user.name}:`, error);
                translatedTexts[user.language] = `[Translation Error: ${cleanText}]`;
              }
            }
          }
          
          // Send translations to Firebase
          if (Object.keys(translatedTexts).length > 0) {
            await sendTranslationMessage(cleanText, translatedTexts);
          }
          
          setStatus('online');
        } else {
          console.log('👤 No other users to translate for');
        }
      }
    };

    recognition.onerror = (event) => {
      console.error('❌ Speech recognition error:', event.error);
      
      if (event.error === 'no-speech') {
        // Don't show error for no speech
        return;
      }
      
      let errorMessage = '';
      switch (event.error) {
        case 'network':
          errorMessage = 'Network error during speech recognition';
          break;
        case 'not-allowed':
          errorMessage = 'Microphone access denied. Please grant permissions.';
          if (isMobile) {
            errorMessage += ' On mobile, ensure location is HTTPS.';
          }
          break;
        case 'audio-capture':
          errorMessage = 'No microphone found or audio capture failed.';
          break;
        case 'aborted':
          errorMessage = 'Speech recognition was aborted.';
          break;
        default:
          errorMessage = `Speech recognition error: ${event.error}`;
      }
      
      setError(errorMessage);
    };

    recognition.onend = () => {
      setIsListening(false);
      if (isConnected && !error) {
        setStatus('online');
        
        // Auto-restart on mobile with user interaction
        if (isMobile) {
          // Don't auto-restart on mobile to save battery
          console.log('🔋 Speech recognition ended (mobile - manual restart required)');
        } else {
          // Auto-restart on desktop
          setTimeout(() => {
            if (isConnected && recognitionRef.current === recognition) {
              try {
                recognition.start();
                console.log('🔄 Speech recognition restarted');
              } catch (e) {
                console.log('❌ Recognition restart failed:', e);
              }
            }
          }, 1000);
        }
      }
    };

    return recognition;
  }, [userLanguage, getOtherUsers, translateText, sendTranslationMessage, isConnected, error, isMobile, initializeAudioContext]);

  // Handle received translation messages
  const handleReceivedMessage = useCallback((message) => {
    // Skip our own messages
    if (message.senderId === userId) return;
    
    // Skip already processed messages
    if (processedMessageIds.current.has(message.messageId)) return;
    processedMessageIds.current.add(message.messageId);
    
    console.log('📨 Received message:', message);
    
    if (message.type === 'translation') {
      // Get the translation for our language
      const translationForMe = message.translatedTexts[userLanguage];
      
      if (translationForMe) {
        console.log('🔄 Translation for me:', translationForMe);
        
        // Update received transcript
        setReceivedTranscript(prev => prev + translationForMe + ' ');
        
        // Auto speak the translation
        if (autoSpeak) {
          setTimeout(() => {
            speakText(translationForMe, userLanguage);
          }, 500);
        }
        
        // Show in status
        setTranslationStatus(`📨 Received: ${message.senderName}`);
        setTimeout(() => setTranslationStatus(''), 3000);
      }
    }
  }, [userId, userLanguage, autoSpeak, speakText]);

  // Setup Firebase listeners with enhanced signaling
  const setupFirebaseListeners = useCallback((sessionCode) => {
    // Clear processed messages when setting up new listeners
    processedMessageIds.current.clear();
    
    // Listen to users
    const usersRef = ref(database, `sessions/${sessionCode}/users`);
    const unsubscribeUsers = onValue(usersRef, (snapshot) => {
      const users = snapshot.val() || {};
      setConnectedUsers(users);
      console.log('👥 Users updated:', Object.keys(users).length, 'users connected');
      
      // Enhanced video call initiation
      const otherUsers = Object.values(users).filter(u => u.id !== userId && u.hasVideo && u.isOnline);
      if (otherUsers.length > 0 && isVideoEnabled && peerConnectionRef.current) {
        // More sophisticated call initiation based on user ID comparison
        const shouldInitiate = userId > otherUsers[0].id; // Consistent ordering
        if (shouldInitiate && !isCallInitiator) {
          console.log('🚀 Initiating video call to:', otherUsers[0].name);
          setIsCallInitiator(true);
          setTimeout(() => createOffer(otherUsers[0].id), 2000);
        }
      }
    });
    unsubscribersRef.current.push(unsubscribeUsers);
    
    // Listen to messages with real-time processing
    const messagesRef = ref(database, `sessions/${sessionCode}/messages`);
    const unsubscribeMessages = onValue(messagesRef, (snapshot) => {
      const messagesData = snapshot.val() || {};
      const messagesList = Object.values(messagesData)
        .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      
      setMessages(messagesList);
      
      // Process new messages
      messagesList.forEach(message => {
        handleReceivedMessage(message);
      });
    });
    unsubscribersRef.current.push(unsubscribeMessages);
    
    // Enhanced WebRTC signaling listener
    const signalingRef = ref(database, `sessions/${sessionCode}/signaling`);
    const unsubscribeSignaling = onValue(signalingRef, (snapshot) => {
      const signalingData = snapshot.val() || {};
      const signalingList = Object.values(signalingData)
        .filter(signal => signal.senderId !== userId) // Only process signals from other users
        .filter(signal => !signal.targetId || signal.targetId === 'broadcast' || signal.targetId === userId) // Only for me
        .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      
      // Process signaling data
      signalingList.forEach(signal => {
        const { data, senderId } = signal;
        console.log('📡 Processing signaling:', data.type, 'from:', senderId);
        
        if (data.type === 'offer') {
          handleOffer(data.offer, senderId);
        } else if (data.type === 'answer') {
          handleAnswer(data.answer, senderId);
        } else if (data.type === 'ice-candidate') {
          handleIceCandidate(data.candidate, senderId);
        }
      });
    });
    unsubscribersRef.current.push(unsubscribeSignaling);
    
  }, [userId, isVideoEnabled, createOffer, handleOffer, handleAnswer, handleIceCandidate, isCallInitiator, handleReceivedMessage]);

  // Create session with enhanced setup
  const createSession = useCallback(async () => {
    if (!userName.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!apiKey.trim()) {
      setError('Please enter Gemini API key');
      return;
    }
    
    try {
      // Initialize media if video is enabled
      let stream = null;
      if (isVideoEnabled) {
        stream = await initializeMedia();
        if (!stream) return;
      }
      
      const newCode = generateCode();
      setCurrentSessionCode(newCode);
      setIsConnected(true);
      setStatus('online');
      setError('');
      setMessages([]);
      setMyTranscript('');
      setReceivedTranscript('');
      setIsCallInitiator(false);
      lastTranscriptRef.current = '';
      processedMessageIds.current.clear();
      iceCandidatesBuffer.current = [];
      
      // Add user to Firebase session
      const userData = {
        id: userId,
        name: userName,
        language: userLanguage,
        isOnline: true,
        hasVideo: isVideoEnabled,
        hasAudio: isAudioEnabled,
        joinedAt: serverTimestamp(),
        deviceInfo: {
          isMobile,
          isIOS,
          userAgent: navigator.userAgent.substring(0, 100)
        }
      };
      
      await set(ref(database, `sessions/${newCode}/users/${userId}`), userData);
      
      // Setup video if enabled
      if (isVideoEnabled && stream) {
        await setupPeerConnection(stream);
        setVideoStatus('📹 Waiting for other users...');
      }
      
      // Setup Firebase listeners
      setupFirebaseListeners(newCode);
      
      console.log(`✅ Session created: ${newCode}`);
      
    } catch (error) {
      console.error('❌ Create session failed:', error);
      setError('Failed to create session: ' + error.message);
    }
  }, [userName, userLanguage, userId, apiKey, isVideoEnabled, isAudioEnabled, isMobile, isIOS, initializeMedia, setupPeerConnection, setupFirebaseListeners]);

  // Join session with enhanced setup
  const joinSession = useCallback(async () => {
    if (!userName.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!sessionCode.trim()) {
      setError('Please enter session code');
      return;
    }
    if (!apiKey.trim()) {
      setError('Please enter Gemini API key');
      return;
    }
    
    try {
      // Initialize media if video is enabled
      let stream = null;
      if (isVideoEnabled) {
        stream = await initializeMedia();
        if (!stream) return;
      }
      
      setCurrentSessionCode(sessionCode);
      setIsConnected(true);
      setStatus('online');
      setError('');
      setMessages([]);
      setMyTranscript('');
      setReceivedTranscript('');
      setIsCallInitiator(false);
      lastTranscriptRef.current = '';
      processedMessageIds.current.clear();
      iceCandidatesBuffer.current = [];
      
      // Add user to Firebase session
      const userData = {
        id: userId,
        name: userName,
        language: userLanguage,
        isOnline: true,
        hasVideo: isVideoEnabled,
        hasAudio: isAudioEnabled,
        joinedAt: serverTimestamp(),
        deviceInfo: {
          isMobile,
          isIOS,
          userAgent: navigator.userAgent.substring(0, 100)
        }
      };
      
      await set(ref(database, `sessions/${sessionCode}/users/${userId}`), userData);
      
      // Setup video if enabled
      if (isVideoEnabled && stream) {
        await setupPeerConnection(stream);
        setVideoStatus('📹 Joining video call...');
      }
      
      // Setup Firebase listeners
      setupFirebaseListeners(sessionCode);
      
      console.log(`✅ Joined session: ${sessionCode}`);
      
    } catch (error) {
      console.error('❌ Join session failed:', error);
      setError('Failed to join session: ' + error.message);
    }
  }, [userName, sessionCode, userLanguage, userId, apiKey, isVideoEnabled, isAudioEnabled, isMobile, isIOS, initializeMedia, setupPeerConnection, setupFirebaseListeners]);

  // Enhanced start listening with mobile support
  const startListening = useCallback(() => {
    if (!apiKey.trim()) {
      setError('Please enter Gemini API key');
      return;
    }
    
    const otherUsers = getOtherUsers();
    if (otherUsers.length === 0) {
      setError('No other users connected to translate for');
      return;
    }
    
    // Initialize audio context first (required for mobile)
    initializeAudioContext();
    
    const recognition = setupSpeechRecognition();
    if (recognition) {
      recognitionRef.current = recognition;
      try {
        recognition.start();
        console.log('🎤 Started speech recognition');
      } catch (error) {
        console.error('❌ Recognition start failed:', error);
        setError('Failed to start speech recognition. ' + (isMobile ? 'On mobile, tap to enable microphone.' : ''));
      }
    }
  }, [apiKey, setupSpeechRecognition, getOtherUsers, isMobile, initializeAudioContext]);

  // Stop listening
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setStatus('online');
    console.log('🛑 Stopped speech recognition');
  }, []);

  // Enhanced toggle video with mobile support
  const toggleVideo = useCallback(async () => {
    if (!isVideoEnabled) {
      // Turn on video
      try {
        const stream = await initializeMedia();
        if (!stream) return;
        
        setIsVideoEnabled(true);
        
        // Update in Firebase
        if (currentSessionCode) {
          await update(ref(database, `sessions/${currentSessionCode}/users/${userId}`), {
            hasVideo: true
          });
        }

        // Setup peer connection if connected
        if (isConnected) {
          const otherUsers = getOtherUsers();
          if (otherUsers.length > 0) {
            await setupPeerConnection(stream, otherUsers[0].id);
            setVideoStatus('📹 Video enabled, connecting...');
            
            // Initiate call if appropriate
            if (userId > otherUsers[0].id) {
              setTimeout(() => createOffer(otherUsers[0].id), 1000);
            }
          }
        }
      } catch (error) {
        setError('Failed to enable video: ' + error.message);
      }
    } else {
      // Turn off video
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      setIsVideoEnabled(false);
      setLocalStream(null);
      setRemoteStream(null);
      setVideoStatus('');
      setConnectionState('new');
      
      // Update in Firebase
      if (currentSessionCode) {
        await update(ref(database, `sessions/${currentSessionCode}/users/${userId}`), {
          hasVideo: false
        });
      }
    }
  }, [isVideoEnabled, initializeMedia, currentSessionCode, userId, isConnected, getOtherUsers, setupPeerConnection, createOffer, localStream]);

  // Leave session with complete cleanup
  const leaveSession = useCallback(() => {
    // Stop media
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (remoteStream) {
      remoteStream.getTracks().forEach(track => track.stop());
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    // Stop listening
    stopListening();
    
    // Clear Firebase listeners
    unsubscribersRef.current.forEach(unsubscribe => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    });
    unsubscribersRef.current = [];
    
    // Remove user from Firebase
    if (currentSessionCode) {
      remove(ref(database, `sessions/${currentSessionCode}/users/${userId}`));
    }
    
    // Reset state
    setIsConnected(false);
    setCurrentSessionCode('');
    setConnectedUsers({});
    setMessages([]);
    setMyTranscript('');
    setReceivedTranscript('');
    setLocalStream(null);
    setRemoteStream(null);
    setPeerConnection(null);
    setIsVideoEnabled(false);
    setStatus('offline');
    setVideoStatus('');
    setTranslationStatus('');
    setPermissionStatus('');
    setIsCallInitiator(false);
    setConnectionState('new');
    lastTranscriptRef.current = '';
    processedMessageIds.current.clear();
    iceCandidatesBuffer.current = [];
  }, [localStream, remoteStream, stopListening, currentSessionCode, userId]);

  // Clear transcripts
  const clearTranscripts = useCallback(() => {
    setMyTranscript('');
    setReceivedTranscript('');
    lastTranscriptRef.current = '';
    processedMessageIds.current.clear();
  }, []);

  // Force video play on mobile (user interaction required)
  const handleVideoClick = useCallback((videoRef) => {
    if (videoRef.current && isMobile) {
      videoRef.current.play().catch(e => {
        console.log('Video play failed:', e);
      });
    }
  }, [isMobile]);

  // Effect to handle media when video state changes
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
      if (isMobile) {
        localVideoRef.current.setAttribute('playsinline', true);
        localVideoRef.current.setAttribute('autoplay', true);
        localVideoRef.current.setAttribute('muted', true);
      }
    }
  }, [localStream, isMobile]);

  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
      if (isMobile) {
        remoteVideoRef.current.setAttribute('playsinline', true);
        remoteVideoRef.current.setAttribute('autoplay', true);
        
        // Auto-play might fail on mobile, so set up click handler
        setTimeout(() => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.play().catch(e => {
              console.log('Remote video autoplay blocked on mobile');
            });
          }
        }, 100);
      }
    }
  }, [remoteStream, isMobile]);

  // Initialize voices for speech synthesis
  useEffect(() => {
    const initVoices = () => {
      if (speechSynthesis.getVoices().length > 0) {
        console.log('🎵 Available voices:', speechSynthesis.getVoices().length);
      }
    };
    
    initVoices();
    speechSynthesis.addEventListener('voiceschanged', initVoices);
    
    return () => {
      speechSynthesis.removeEventListener('voiceschanged', initVoices);
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cleanup listeners on unmount
      unsubscribersRef.current.forEach(unsubscribe => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      });
      
      // Stop media streams
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      if (remoteStream) {
        remoteStream.getTracks().forEach(track => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      
      // Close audio context
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [localStream, remoteStream]);

  return (
    <div style={{
      fontFamily: 'system-ui, -apple-system, sans-serif',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: isMobile ? '10px' : '20px'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: isMobile ? '20px' : '30px' }}>
          <h1 style={{
            color: 'white',
            fontSize: isMobile ? '2rem' : '2.5rem',
            marginBottom: '10px',
            textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
          }}>
            🌍 Language Bridge Pro
          </h1>
          <p style={{
            color: 'rgba(255,255,255,0.9)',
            fontSize: isMobile ? '1rem' : '1.1rem'
          }}>
            Real-time voice translation with video chat • Join with a code • Speak naturally
          </p>
          {isMobile && (
            <p style={{
              color: 'rgba(255,255,255,0.8)',
              fontSize: '0.9rem',
              marginTop: '10px'
            }}>
              📱 Mobile optimized • Best on HTTPS • {isIOS ? 'iOS Safari' : 'Chrome'} recommended
            </p>
          )}
        </div>

        {/* Enhanced Status Bar */}
        <div style={{
          background: 'rgba(255,255,255,0.95)',
          borderRadius: '15px',
          padding: isMobile ? '10px' : '15px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: isMobile ? '10px' : '20px',
          flexWrap: 'wrap'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '20px',
            background: status === 'online' ? '#dcfce7' : 
                       status === 'listening' ? '#fef3c7' : 
                       status === 'translating' ? '#e0e7ff' : 
                       status === 'error' ? '#fee2e2' : '#f3f4f6',
            color: status === 'online' ? '#166534' : 
                   status === 'listening' ? '#92400e' : 
                   status === 'translating' ? '#3730a3' : 
                   status === 'error' ? '#dc2626' : '#6b7280',
            fontSize: isMobile ? '14px' : '16px'
          }}>
            <span>
              {status === 'online' ? '🟢' : 
               status === 'listening' ? '🎤' : 
               status === 'translating' ? '🤖' : 
               status === 'error' ? '🔴' : '⚪'}
            </span>
            <span style={{ fontWeight: 'bold', textTransform: 'capitalize' }}>
              {status}
            </span>
          </div>
          
          {currentSessionCode && (
            <div style={{
              padding: '8px 16px',
              borderRadius: '20px',
              background: '#e0e7ff',
              color: '#3730a3',
              fontWeight: 'bold',
              fontSize: isMobile ? '14px' : '16px'
            }}>
              📋 {currentSessionCode}
            </div>
          )}
          
          {getOtherUsers().length > 0 && (
            <div style={{
              padding: '8px 16px',
              borderRadius: '20px',
              background: '#ecfdf5',
              color: '#065f46',
              fontWeight: 'bold',
              fontSize: isMobile ? '14px' : '16px'
            }}>
              👥 {getOtherUsers().length + 1} users
            </div>
          )}

          {isConnected && (
            <div style={{
              padding: '8px 16px',
              borderRadius: '20px',
              background: isListening ? '#fef3c7' : '#f3f4f6',
              color: isListening ? '#92400e' : '#6b7280',
              fontWeight: 'bold',
              fontSize: isMobile ? '14px' : '16px'
            }}>
              {isListening ? '🎙️ Live' : '🎙️ Ready'}
            </div>
          )}

          {videoStatus && (
            <div style={{
              padding: '8px 16px',
              borderRadius: '20px',
              background: '#f0f9ff',
              color: '#1e40af',
              fontWeight: 'bold',
              fontSize: isMobile ? '12px' : '14px',
              maxWidth: isMobile ? '200px' : 'none',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {videoStatus}
            </div>
          )}

          {translationStatus && (
            <div style={{
              padding: '8px 16px',
              borderRadius: '20px',
              background: '#fef3c7',
              color: '#92400e',
              fontWeight: 'bold',
              fontSize: isMobile ? '12px' : '14px'
            }}>
              {translationStatus}
            </div>
          )}

          {permissionStatus && (
            <div style={{
              padding: '8px 16px',
              borderRadius: '20px',
              background: '#ede9fe',
              color: '#6b21a8',
              fontWeight: 'bold',
              fontSize: isMobile ? '12px' : '14px'
            }}>
              {permissionStatus}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: '#fee2e2',
            color: '#dc2626',
            padding: isMobile ? '12px' : '16px',
            borderRadius: '12px',
            marginBottom: '20px',
            textAlign: 'center',
            fontWeight: 'bold',
            border: '2px solid #fca5a5',
            fontSize: isMobile ? '14px' : '16px'
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Setup Form */}
        {!isConnected && (
          <div style={{
            background: 'rgba(255,255,255,0.95)',
            borderRadius: '20px',
            padding: isMobile ? '20px' : '30px',
            marginBottom: '30px'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px', textAlign: 'center', fontSize: isMobile ? '1.2rem' : '1.5rem' }}>
              🚀 Get Started
            </h3>
            
            {/* API Key */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: isMobile ? '14px' : '16px' }}>
                🔑 Gemini API Key:
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                style={{
                  width: '100%',
                  padding: isMobile ? '14px' : '12px',
                  borderRadius: '8px',
                  border: '2px solid #d1d5db',
                  fontSize: isMobile ? '16px' : '16px', // 16px prevents zoom on iOS
                  boxSizing: 'border-box'
                }}
              />
              <p style={{ fontSize: '12px', color: '#6b7280', margin: '5px 0 0 0' }}>
                Get your free API key from{' '}
                <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>
                  Google AI Studio
                </a>
              </p>
            </div>
            
            {/* User Info */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: (window.innerWidth > 600 && !isMobile) ? '1fr 1fr' : '1fr',
              gap: '15px',
              marginBottom: '20px'
            }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: isMobile ? '14px' : '16px' }}>
                  👤 Your Name:
                </label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Enter your name"
                  style={{
                    width: '100%',
                    padding: isMobile ? '14px' : '12px',
                    borderRadius: '8px',
                    border: '2px solid #d1d5db',
                    fontSize: '16px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: isMobile ? '14px' : '16px' }}>
                  🗣️ Your Language:
                </label>
                <select
                  value={userLanguage}
                  onChange={(e) => setUserLanguage(e.target.value)}
                  style={{
                    width: '100%',
                    padding: isMobile ? '14px' : '12px',
                    borderRadius: '8px',
                    border: '2px solid #d1d5db',
                    fontSize: '16px',
                    boxSizing: 'border-box'
                  }}
                >
                  {languages.map(lang => (
                    <option key={lang.code} value={lang.code}>
                      {lang.flag} {lang.native} ({lang.name})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Media Options */}
            <div style={{
              display: 'flex',
              gap: isMobile ? '15px' : '20px',
              marginBottom: '20px',
              justifyContent: 'center',
              flexWrap: 'wrap'
            }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                padding: isMobile ? '14px 16px' : '12px 16px',
                background: '#f3f4f6',
                borderRadius: '12px',
                fontWeight: 'bold',
                fontSize: isMobile ? '14px' : '16px',
                minHeight: '44px' // Touch-friendly size
              }}>
                <input
                  type="checkbox"
                  checked={isVideoEnabled}
                  onChange={(e) => setIsVideoEnabled(e.target.checked)}
                  style={{ transform: isMobile ? 'scale(1.2)' : 'scale(1)' }}
                />
                <span>📹 Enable Video</span>
              </label>

              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                padding: isMobile ? '14px 16px' : '12px 16px',
                background: '#f3f4f6',
                borderRadius: '12px',
                fontWeight: 'bold',
                fontSize: isMobile ? '14px' : '16px',
                minHeight: '44px'
              }}>
                <input
                  type="checkbox"
                  checked={isAudioEnabled}
                  onChange={(e) => setIsAudioEnabled(e.target.checked)}
                  style={{ transform: isMobile ? 'scale(1.2)' : 'scale(1)' }}
                />
                <span>🎤 Enable Audio</span>
              </label>
            </div>
            
            {/* Session Actions */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: (window.innerWidth > 600 && !isMobile) ? '1fr 1fr' : '1fr',
              gap: '20px'
            }}>
              <div>
                <button
                  onClick={createSession}
                  disabled={!userName.trim() || !apiKey.trim()}
                  style={{
                    width: '100%',
                    padding: isMobile ? '18px 16px' : '16px',
                    borderRadius: '12px',
                    border: 'none',
                    background: (userName.trim() && apiKey.trim()) 
                      ? 'linear-gradient(135deg, #10b981, #047857)' 
                      : '#d1d5db',
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: isMobile ? '16px' : '16px',
                    cursor: (userName.trim() && apiKey.trim()) ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s',
                    minHeight: '44px'
                  }}
                >
                  🚀 Create New Session
                </button>
              </div>
              
              <div>
                <input
                  type="text"
                  value={sessionCode}
                  onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                  placeholder="Enter session code (e.g., ABC123)"
                  style={{
                    width: '100%',
                    padding: isMobile ? '14px' : '12px',
                    borderRadius: '8px',
                    border: '2px solid #d1d5db',
                    fontSize: '16px',
                    textAlign: 'center',
                    marginBottom: '10px',
                    boxSizing: 'border-box'
                  }}
                />
                <button
                  onClick={joinSession}
                  disabled={!userName.trim() || !sessionCode.trim() || !apiKey.trim()}
                  style={{
                    width: '100%',
                    padding: isMobile ? '18px 16px' : '16px',
                    borderRadius: '12px',
                    border: 'none',
                    background: (userName.trim() && sessionCode.trim() && apiKey.trim()) 
                      ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)' 
                      : '#d1d5db',
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: isMobile ? '16px' : '16px',
                    cursor: (userName.trim() && sessionCode.trim() && apiKey.trim()) ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s',
                    minHeight: '44px'
                  }}
                >
                  🔗 Join Session
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Interface */}
        {isConnected && (
          <>
            {/* Enhanced Video Section */}
            {(isVideoEnabled || getOtherUsers().some(u => u.hasVideo)) && (
              <div style={{
                background: 'rgba(255,255,255,0.95)',
                borderRadius: '20px',
                padding: isMobile ? '15px' : '20px',
                marginBottom: '20px'
              }}>
                <h3 style={{ margin: '0 0 15px 0', textAlign: 'center', fontSize: isMobile ? '1.1rem' : '1.3rem' }}>
                  📹 Video Chat {connectionState && `(${connectionState})`}
                </h3>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: (window.innerWidth > 768 && !isMobile) ? '1fr 1fr' : '1fr',
                  gap: isMobile ? '15px' : '20px'
                }}>
                  {/* Local Video */}
                  <div style={{
                    position: 'relative',
                    background: '#000',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    aspectRatio: '16/9',
                    minHeight: isMobile ? '200px' : 'auto'
                  }}>
                    {localStream ? (
                      <video
                        ref={localVideoRef}
                        autoPlay
                        muted
                        playsInline
                        onClick={() => handleVideoClick(localVideoRef)}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          cursor: isMobile ? 'pointer' : 'default'
                        }}
                      />
                    ) : (
                      <div style={{
                        color: 'white',
                        textAlign: 'center',
                        padding: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%'
                      }}>
                        <div>
                          <div style={{ fontSize: isMobile ? '36px' : '48px', marginBottom: '10px' }}>📹</div>
                          <div style={{ fontSize: isMobile ? '14px' : '16px' }}>Your video will appear here</div>
                        </div>
                      </div>
                    )}
                    <div style={{
                      position: 'absolute',
                      bottom: '10px',
                      left: '10px',
                      background: 'rgba(0,0,0,0.7)',
                      color: 'white',
                      padding: '5px 10px',
                      borderRadius: '15px',
                      fontSize: isMobile ? '12px' : '14px',
                      fontWeight: 'bold'
                    }}>
                      You ({languages.find(l => l.code === userLanguage)?.flag})
                    </div>
                  </div>

                  {/* Remote Video */}
                  <div style={{
                    position: 'relative',
                    background: '#000',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    aspectRatio: '16/9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: isMobile ? '200px' : 'auto'
                  }}>
                    {remoteStream ? (
                      <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        onClick={() => handleVideoClick(remoteVideoRef)}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          cursor: isMobile ? 'pointer' : 'default'
                        }}
                      />
                    ) : (
                      <div style={{
                        color: 'white',
                        textAlign: 'center',
                        padding: '20px'
                      }}>
                        <div style={{ fontSize: isMobile ? '36px' : '48px', marginBottom: '10px' }}>👤</div>
                        <div style={{ fontSize: isMobile ? '14px' : '16px' }}>
                          {getOtherUsers().some(u => u.hasVideo) 
                            ? (isMobile ? 'Tap to play when connected' : 'Connecting to remote video...') 
                            : 'Waiting for other users to enable video...'}
                        </div>
                      </div>
                    )}
                    {getOtherUsers()[0] && (
                      <div style={{
                        position: 'absolute',
                        bottom: '10px',
                        left: '10px',
                        background: 'rgba(0,0,0,0.7)',
                        color: 'white',
                        padding: '5px 10px',
                        borderRadius: '15px',
                        fontSize: isMobile ? '12px' : '14px',
                        fontWeight: 'bold'
                      }}>
                        {getOtherUsers()[0].name} ({languages.find(l => l.code === getOtherUsers()[0].language)?.flag})
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Enhanced Controls */}
            <div style={{
              background: 'rgba(255,255,255,0.95)',
              borderRadius: '20px',
              padding: isMobile ? '15px' : '20px',
              marginBottom: '20px'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: isMobile ? '10px' : '15px'
              }}>
                <div style={{ 
                  display: 'flex', 
                  gap: isMobile ? '10px' : '15px', 
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  width: isMobile ? '100%' : 'auto'
                }}>
                  <button
                    onClick={isListening ? stopListening : startListening}
                    disabled={getOtherUsers().length === 0}
                    style={{
                      padding: isMobile ? '14px 20px' : '12px 24px',
                      borderRadius: '12px',
                      border: 'none',
                      background: getOtherUsers().length === 0 ? '#d1d5db' :
                                  isListening ? 'linear-gradient(135deg, #ef4444, #dc2626)' 
                                              : 'linear-gradient(135deg, #10b981, #047857)',
                      color: 'white',
                      fontWeight: 'bold',
                      cursor: getOtherUsers().length === 0 ? 'not-allowed' : 'pointer',
                      fontSize: isMobile ? '14px' : '16px',
                      transition: 'all 0.2s',
                      minHeight: '44px',
                      flexShrink: 0
                    }}
                  >
                    {isListening ? '🛑 Stop' : '🎤 Listen'}
                  </button>

                  <button
                    onClick={toggleVideo}
                    style={{
                      padding: isMobile ? '14px 18px' : '12px 20px',
                      borderRadius: '12px',
                      border: 'none',
                      background: isVideoEnabled ? '#10b981' : '#6b7280',
                      color: 'white',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      fontSize: isMobile ? '14px' : '16px',
                      minHeight: '44px',
                      flexShrink: 0
                    }}
                  >
                    📹 {isVideoEnabled ? 'On' : 'Off'}
                  </button>
                  
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    style={{
                      padding: isMobile ? '14px 18px' : '12px 20px',
                      borderRadius: '12px',
                      border: 'none',
                      background: isMuted ? '#ef4444' : '#3b82f6',
                      color: 'white',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      fontSize: isMobile ? '14px' : '16px',
                      minHeight: '44px',
                      flexShrink: 0
                    }}
                  >
                    {isMuted ? '🔇' : '🔊'}
                  </button>
                  
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    padding: isMobile ? '14px 16px' : '12px 16px',
                    background: autoSpeak ? '#dcfce7' : '#f3f4f6',
                    borderRadius: '12px',
                    fontWeight: 'bold',
                    color: autoSpeak ? '#166534' : '#6b7280',
                    fontSize: isMobile ? '14px' : '16px',
                    minHeight: '44px',
                    flexShrink: 0
                  }}>
                    <input
                      type="checkbox"
                      checked={autoSpeak}
                      onChange={(e) => setAutoSpeak(e.target.checked)}
                      style={{ transform: isMobile ? 'scale(1.2)' : 'scale(1)' }}
                    />
                    <span>🗣️ Auto</span>
                  </label>

                  <button
                    onClick={clearTranscripts}
                    style={{
                      padding: isMobile ? '14px 18px' : '12px 20px',
                      borderRadius: '12px',
                      border: '2px solid #f59e0b',
                      background: 'transparent',
                      color: '#f59e0b',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      fontSize: isMobile ? '14px' : '16px',
                      minHeight: '44px',
                      flexShrink: 0
                    }}
                  >
                    🗑️
                  </button>
                </div>
                
                <button
                  onClick={leaveSession}
                  style={{
                    padding: isMobile ? '14px 18px' : '12px 20px',
                    borderRadius: '12px',
                    border: '2px solid #dc2626',
                    background: 'transparent',
                    color: '#dc2626',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontSize: isMobile ? '14px' : '16px',
                    minHeight: '44px',
                    width: isMobile ? '100%' : 'auto',
                    marginTop: isMobile ? '10px' : '0'
                  }}
                >
                  🚪 Leave
                </button>
              </div>
              
              {getOtherUsers().length === 0 && (
                <div style={{
                  marginTop: '15px',
                  padding: isMobile ? '12px' : '10px',
                  background: '#fef3c7',
                  borderRadius: '8px',
                  color: '#92400e',
                  textAlign: 'center',
                  fontSize: isMobile ? '14px' : '14px',
                  fontWeight: 'bold'
                }}>
                  ⏳ Waiting for other users to join for translation...
                </div>
              )}
              
              {isMobile && isListening && (
                <div style={{
                  marginTop: '15px',
                  padding: '12px',
                  background: '#e0e7ff',
                  borderRadius: '8px',
                  color: '#3730a3',
                  textAlign: 'center',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}>
                  📱 Tap "Stop" to pause listening (saves battery)
                </div>
              )}
            </div>

            {/* Enhanced Communication Interface */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: (window.innerWidth > 768 && !isMobile) ? '1fr 1fr' : '1fr',
              gap: '20px',
              marginBottom: '20px'
            }}>
              {/* Your Speech */}
              <div style={{
                background: 'rgba(255,255,255,0.95)',
                borderRadius: '15px',
                padding: isMobile ? '15px' : '20px'
              }}>
                <h3 style={{
                  margin: '0 0 15px 0',
                  color: '#3b82f6',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: isMobile ? '1rem' : '1.2rem'
                }}>
                  🗣️ You speak {languages.find(l => l.code === userLanguage)?.native}
                  {isListening && (
                    <span style={{
                      background: '#10b981',
                      color: 'white',
                      padding: '4px 8px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      animation: 'pulse 2s infinite'
                    }}>
                      LIVE
                    </span>
                  )}
                </h3>
                <div style={{
                  background: '#f0f9ff',
                  borderRadius: '12px',
                  padding: isMobile ? '15px' : '20px',
                  minHeight: isMobile ? '100px' : '120px',
                  border: '2px solid #0ea5e9',
                  fontSize: isMobile ? '14px' : '16px',
                  lineHeight: '1.6',
                  maxHeight: '200px',
                  overflowY: 'auto'
                }}>
                  {myTranscript || (
                    <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>
                      {isListening 
                        ? `🎤 Listening... Speak in ${languages.find(l => l.code === userLanguage)?.native}` 
                        : getOtherUsers().length > 0 
                          ? 'Click "Listen" to start speaking...'
                          : 'Waiting for other users to join...'}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button
                    onClick={() => speakText(myTranscript, userLanguage)}
                    disabled={!myTranscript.trim()}
                    style={{
                      padding: isMobile ? '10px 16px' : '8px 16px',
                      borderRadius: '8px',
                      border: 'none',
                      background: myTranscript.trim() ? '#10b981' : '#d1d5db',
                      color: 'white',
                      fontWeight: 'bold',
                      cursor: myTranscript.trim() ? 'pointer' : 'not-allowed',
                      transition: 'all 0.2s',
                      fontSize: isMobile ? '14px' : '14px',
                      minHeight: '40px'
                    }}
                  >
                    🔊 Repeat
                  </button>
                </div>
              </div>

              {/* Received Translations */}
              <div style={{
                background: 'rgba(255,255,255,0.95)',
                borderRadius: '15px',
                padding: isMobile ? '15px' : '20px'
              }}>
                <h3 style={{
                  margin: '0 0 15px 0',
                  color: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: isMobile ? '1rem' : '1.2rem'
                }}>
                  👂 You hear {languages.find(l => l.code === userLanguage)?.native}
                  {autoSpeak && (
                    <span style={{
                      background: '#10b981',
                      color: 'white',
                      padding: '4px 8px',
                      borderRadius: '12px',
                      fontSize: '12px'
                    }}>
                      AUTO
                    </span>
                  )}
                </h3>
                <div style={{
                  background: '#ecfdf5',
                  borderRadius: '12px',
                  padding: isMobile ? '15px' : '20px',
                  minHeight: isMobile ? '100px' : '120px',
                  border: '2px solid #a7f3d0',
                  fontSize: isMobile ? '14px' : '16px',
                  lineHeight: '1.6',
                  maxHeight: '200px',
                  overflowY: 'auto'
                }}>
                  {receivedTranscript || (
                    <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>
                      Translations from other users will appear here...
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button
                    onClick={() => speakText(receivedTranscript, userLanguage)}
                    disabled={!receivedTranscript.trim()}
                    style={{
                      padding: isMobile ? '10px 16px' : '8px 16px',
                      borderRadius: '8px',
                      border: 'none',
                      background: receivedTranscript.trim() ? '#10b981' : '#d1d5db',
                      color: 'white',
                      fontWeight: 'bold',
                      cursor: receivedTranscript.trim() ? 'pointer' : 'not-allowed',
                      transition: 'all 0.2s',
                      fontSize: isMobile ? '14px' : '14px',
                      minHeight: '40px'
                    }}
                  >
                    🔊 Repeat
                  </button>
                </div>
              </div>
            </div>

            {/* Connected Users */}
            <div style={{
              background: 'rgba(255,255,255,0.95)',
              borderRadius: '15px',
              padding: isMobile ? '15px' : '20px',
              marginBottom: '20px'
            }}>
              <h3 style={{ margin: '0 0 15px 0', textAlign: 'center', fontSize: isMobile ? '1.1rem' : '1.3rem' }}>
                👥 Connected Users ({Object.keys(connectedUsers).length})
              </h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '15px'
              }}>
                {Object.values(connectedUsers).map((user) => (
                  <div key={user.id} style={{
                    background: user.id === userId ? '#eff6ff' : '#f8fafc',
                    borderRadius: '12px',
                    padding: '15px',
                    border: `2px solid ${user.id === userId ? '#3b82f6' : '#e2e8f0'}`,
                    textAlign: 'center'
                  }}>
                    <div style={{ 
                      fontWeight: 'bold', 
                      marginBottom: '8px',
                      fontSize: isMobile ? '15px' : '16px'
                    }}>
                      {user.name} {user.id === userId && '(You)'}
                    </div>
                    <div style={{ 
                      fontSize: isMobile ? '13px' : '14px', 
                      color: '#6b7280',
                      marginBottom: '8px'
                    }}>
                      {languages.find(l => l.code === user.language)?.flag} {' '}
                      {languages.find(l => l.code === user.language)?.native}
                      {user.deviceInfo?.isMobile && ' 📱'}
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'center',
                      gap: '8px',
                      marginBottom: '8px',
                      flexWrap: 'wrap'
                    }}>
                      {user.hasVideo && (
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: '8px',
                          background: '#dcfce7',
                          color: '#166534',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}>
                          📹 Video
                        </span>
                      )}
                      {user.hasAudio && (
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: '8px',
                          background: '#dbeafe',
                          color: '#1e40af',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}>
                          🎤 Audio
                        </span>
                      )}
                    </div>
                    <div style={{
                      padding: '4px 8px',
                      borderRadius: '12px',
                      background: user.isOnline ? '#dcfce7' : '#fee2e2',
                      color: user.isOnline ? '#166534' : '#dc2626',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}>
                      {user.isOnline ? '🟢 Online' : '🔴 Offline'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Messages */}
            {messages.length > 0 && (
              <div style={{
                background: 'rgba(255,255,255,0.95)',
                borderRadius: '15px',
                padding: isMobile ? '15px' : '20px'
              }}>
                <h3 style={{ margin: '0 0 15px 0', textAlign: 'center', fontSize: isMobile ? '1.1rem' : '1.3rem' }}>
                  💬 Conversation History ({messages.length} messages)
                </h3>
                <div style={{
                  maxHeight: isMobile ? '250px' : '300px',
                  overflowY: 'auto',
                  background: '#f8fafc',
                  borderRadius: '12px',
                  padding: '15px'
                }}>
                  {messages.slice(-10).map((msg, index) => (
                    <div key={index} style={{
                      marginBottom: '15px',
                      padding: '15px',
                      borderRadius: '12px',
                      background: msg.senderId === userId ? '#eff6ff' : '#ecfdf5',
                      border: `1px solid ${msg.senderId === userId ? '#bfdbfe' : '#a7f3d0'}`
                    }}>
                      <div style={{
                        fontWeight: 'bold',
                        color: msg.senderId === userId ? '#1e40af' : '#065f46',
                        marginBottom: '8px',
                        fontSize: isMobile ? '13px' : '14px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap'
                      }}>
                        <span>{msg.senderName}:</span>
                        <span style={{ fontSize: '12px', fontWeight: 'normal', opacity: 0.7 }}>
                          {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : 'Now'}
                        </span>
                      </div>
                      <div style={{ marginBottom: '8px', fontSize: isMobile ? '14px' : '15px' }}>
                        "{msg.originalText}"
                      </div>
                      {msg.translatedTexts && (
                        <div style={{
                          fontSize: isMobile ? '12px' : '13px',
                          color: '#6b7280',
                          fontStyle: 'italic',
                          paddingTop: '8px',
                          borderTop: '1px solid #e5e7eb'
                        }}>
                          {Object.entries(msg.translatedTexts).map(([lang, translation]) => (
                            <div key={lang} style={{ marginBottom: '2px' }}>
                              🔄 {languages.find(l => l.code === lang)?.flag} "{translation}"
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <div style={{
          background: 'rgba(255,255,255,0.9)',
          borderRadius: '15px',
          padding: isMobile ? '12px' : '15px',
          marginTop: '20px',
          textAlign: 'center',
          fontSize: isMobile ? '12px' : '14px',
          color: '#6b7280'
        }}>
          <strong>🌍 Real-time language translation with video chat</strong> powered by Gemini AI
          <br />
          <span style={{ fontSize: isMobile ? '11px' : '12px' }}>
            Enhanced with WebRTC for video calling • Works best in Chrome/Edge browsers
            {isMobile && ' • Mobile optimized for touch'}
          </span>
        </div>

        <style jsx>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}</style>
      </div>
    </div>
  );
}

export default LanguageBridgeWithVideo;