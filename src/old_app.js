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
  const [userId] = useState(() => `user_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`);
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
  const processedSignalingIds = useRef(new Set());
  const audioContextRef = useRef(null);
  const pendingIceCandidates = useRef([]);
  const callInProgress = useRef(false);

  // Languages
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
    
    console.log('📱 Device detection:', { mobile, ios, userId });
  }, [userId]);

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

  // Enhanced media initialization
  const initializeMedia = useCallback(async () => {
    try {
      setVideoStatus('🎥 Requesting permissions...');
      setPermissionStatus('📋 Checking permissions...');
      
      initializeAudioContext();
      
      const constraints = {
        video: isVideoEnabled ? {
          width: { ideal: isMobile ? 640 : 1280 },
          height: { ideal: isMobile ? 480 : 720 },
          frameRate: { ideal: isMobile ? 15 : 30 },
          facingMode: 'user'
        } : false,
        audio: isAudioEnabled ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: isMobile ? 16000 : 44100,
          channelCount: 1
        } : false
      };
      
      console.log('📱 Requesting media with constraints:', constraints);
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        if (isMobile) {
          localVideoRef.current.setAttribute('playsinline', true);
          localVideoRef.current.setAttribute('autoplay', true);
          localVideoRef.current.setAttribute('muted', true);
        }
      }
      
      setVideoStatus('✅ Media ready');
      setPermissionStatus('✅ Permissions granted');
      console.log('✅ Media initialized successfully:', { 
        video: isVideoEnabled, 
        audio: isAudioEnabled,
        tracks: stream.getTracks().length
      });
      
      return stream;
    } catch (error) {
      console.error('❌ Media access error:', error);
      const errorMessage = `Media access failed: ${error.message}${isMobile ? ' (Mobile: Ensure HTTPS and permissions)' : ''}`;
      setError(errorMessage);
      setVideoStatus('❌ Media failed');
      setPermissionStatus('❌ Access denied');
      return null;
    }
  }, [isVideoEnabled, isAudioEnabled, isMobile, initializeAudioContext]);

  // Send signaling data with room-based targeting
  const sendSignalingData = useCallback(async (data) => {
    if (!currentSessionCode) return;
    
    try {
      const signalingMessage = {
        id: `${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        senderId: userId,
        senderName: userName,
        data: data,
        timestamp: Date.now()
      };
      
      await push(ref(database, `sessions/${currentSessionCode}/webrtc`), signalingMessage);
      console.log('📡 Sent signaling:', data.type, 'ID:', signalingMessage.id);
    } catch (error) {
      console.error('❌ Failed to send signaling:', error);
    }
  }, [currentSessionCode, userId, userName]);

  // Setup peer connection with enhanced handling
  const setupPeerConnection = useCallback(async (stream) => {
    console.log('🔗 Setting up peer connection...');
    
    // Close existing connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      console.log('🔄 Closed existing peer connection');
    }

    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ],
      iceCandidatePoolSize: 10
    };
    
    const pc = new RTCPeerConnection(configuration);
    peerConnectionRef.current = pc;
    setPeerConnection(pc);
    setConnectionState('connecting');
    
    // Add local stream tracks
    if (stream) {
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
        console.log('➕ Added local track:', track.kind);
      });
    }
    
    // Handle remote stream
    pc.ontrack = (event) => {
      console.log('📹 Received remote track:', event.track.kind);
      const [remoteStream] = event.streams;
      console.log('📺 Remote stream received with', remoteStream.getTracks().length, 'tracks');
      
      setRemoteStream(remoteStream);
      
      if (remoteVideoRef.current && remoteStream) {
        remoteVideoRef.current.srcObject = remoteStream;
        
        if (isMobile) {
          remoteVideoRef.current.setAttribute('playsinline', true);
          remoteVideoRef.current.setAttribute('autoplay', true);
          
          setTimeout(() => {
            if (remoteVideoRef.current) {
              remoteVideoRef.current.play().catch(e => {
                console.log('📹 Remote video autoplay blocked:', e.message);
              });
            }
          }, 500);
        }
      }
      
      setVideoStatus('✅ Remote video connected');
      setConnectionState('connected');
    };
    
    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('🧊 Generated ICE candidate:', event.candidate.type);
        sendSignalingData({
          type: 'ice-candidate',
          candidate: event.candidate
        });
      } else {
        console.log('🧊 ICE gathering complete');
      }
    };

    // Connection state monitoring
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log('🔗 Connection state changed to:', state);
      setConnectionState(state);
      
      if (state === 'connected') {
        setVideoStatus('✅ Video call connected');
        callInProgress.current = true;
        setError('');
      } else if (state === 'disconnected') {
        setVideoStatus('⚠️ Connection lost');
        callInProgress.current = false;
      } else if (state === 'failed') {
        setVideoStatus('❌ Connection failed');
        callInProgress.current = false;
        // Retry after delay
        setTimeout(() => {
          if (isVideoEnabled && localStream) {
            console.log('🔄 Retrying connection...');
            initiateCall();
          }
        }, 3000);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('❄️ ICE connection state:', pc.iceConnectionState);
    };

    // Process any pending ICE candidates
    pendingIceCandidates.current.forEach(candidate => {
      pc.addIceCandidate(candidate).catch(e => {
        console.error('❌ Error adding pending ICE candidate:', e);
      });
    });
    pendingIceCandidates.current = [];
    
    return pc;
  }, [sendSignalingData, isVideoEnabled, localStream, isMobile]);

  // Initiate video call
  const initiateCall = useCallback(async () => {
    if (callInProgress.current) {
      console.log('📞 Call already in progress, skipping...');
      return;
    }

    const pc = peerConnectionRef.current;
    if (!pc) {
      console.error('❌ No peer connection available for call');
      return;
    }

    try {
      console.log('📞 Creating offer...');
      setVideoStatus('📞 Creating offer...');
      callInProgress.current = true;
      
      const offer = await pc.createOffer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: true
      });
      
      await pc.setLocalDescription(offer);
      console.log('📞 Local description set, sending offer...');
      
      await sendSignalingData({
        type: 'offer',
        offer: offer
      });
      
      console.log('✅ Offer sent successfully');
      setVideoStatus('📞 Offer sent, waiting for answer...');
    } catch (error) {
      console.error('❌ Error creating offer:', error);
      setVideoStatus('❌ Failed to create offer');
      callInProgress.current = false;
    }
  }, [sendSignalingData]);

  // Handle received offer
  const handleOffer = useCallback(async (offer, senderId) => {
    console.log('📞 Handling offer from:', senderId);
    
    const pc = peerConnectionRef.current;
    if (!pc) {
      console.error('❌ No peer connection for offer');
      return;
    }

    try {
      setVideoStatus('📞 Processing offer...');
      
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      console.log('📞 Remote description set from offer');
      
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      console.log('📞 Answer created and local description set');
      
      await sendSignalingData({
        type: 'answer',
        answer: answer
      });
      
      console.log('✅ Answer sent to:', senderId);
      setVideoStatus('✅ Answer sent');
      callInProgress.current = true;
    } catch (error) {
      console.error('❌ Error handling offer:', error);
      setVideoStatus('❌ Failed to handle offer');
    }
  }, [sendSignalingData]);

  // Handle received answer
  const handleAnswer = useCallback(async (answer, senderId) => {
    console.log('✅ Handling answer from:', senderId);
    
    const pc = peerConnectionRef.current;
    if (!pc) {
      console.error('❌ No peer connection for answer');
      return;
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      console.log('✅ Remote description set from answer');
      setVideoStatus('✅ Call established');
    } catch (error) {
      console.error('❌ Error handling answer:', error);
      setVideoStatus('❌ Failed to handle answer');
    }
  }, []);

  // Handle ICE candidate
  const handleIceCandidate = useCallback(async (candidate, senderId) => {
    console.log('🧊 Handling ICE candidate from:', senderId);
    
    const pc = peerConnectionRef.current;
    if (!pc || pc.remoteDescription === null) {
      console.log('🧊 Buffering ICE candidate (no remote description yet)');
      pendingIceCandidates.current.push(candidate);
      return;
    }

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('🧊 ICE candidate added successfully');
    } catch (error) {
      console.error('❌ Error adding ICE candidate:', error);
    }
  }, []);

  // Generate session code
  const generateCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

  // Translation function
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
        throw new Error(`API Error: ${response.status}`);
      }
      
      const data = await response.json();
      let translation = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      
      if (!translation) {
        throw new Error('Empty translation response');
      }
      
      translation = translation.replace(/^["']|["']$/g, '');
      
      setTranslationStatus('✅ Translation complete');
      setTimeout(() => setTranslationStatus(''), 2000);
      
      console.log('✅ Translation:', { from: text, to: translation, fromLang, toLang });
      return translation;
    } catch (error) {
      console.error('❌ Translation error:', error);
      setTranslationStatus('❌ Translation failed');
      setTimeout(() => setTranslationStatus(''), 3000);
      return `[Translation Error: ${text}]`;
    }
  }, [apiKey, languages]);

  // Enhanced speech synthesis
  const speakText = useCallback((text, languageCode) => {
    if (!text || isMuted || !window.speechSynthesis) return;
    
    console.log('🗣️ Speaking:', { text: text.substring(0, 50), languageCode, isMobile });
    
    initializeAudioContext();
    speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = languageCode;
    utterance.rate = isMobile ? 0.8 : 0.9;
    utterance.volume = 0.8;
    utterance.pitch = 1.0;
    
    const voices = speechSynthesis.getVoices();
    const langCode = languageCode.split('-')[0];
    
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
    }
    
    utterance.onstart = () => console.log('🗣️ Speech started');
    utterance.onend = () => console.log('🗣️ Speech ended');
    utterance.onerror = (event) => {
      console.error('❌ Speech error:', event);
      if (isMobile && event.error === 'synthesis-failed') {
        setTimeout(() => speechSynthesis.speak(utterance), 1000);
      }
    };
    
    if (isIOS) {
      setTimeout(() => speechSynthesis.speak(utterance), 100);
    } else {
      speechSynthesis.speak(utterance);
    }
  }, [isMuted, isMobile, isIOS, initializeAudioContext]);

  // Send translation message
  const sendTranslationMessage = useCallback(async (originalText, translatedTexts) => {
    if (!currentSessionCode) return;

    const messageData = {
      messageId: `${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      senderId: userId,
      senderName: userName,
      originalText: originalText,
      originalLang: userLanguage,
      translatedTexts: translatedTexts,
      timestamp: Date.now(),
      type: 'translation'
    };
    
    try {
      await push(ref(database, `sessions/${currentSessionCode}/messages`), messageData);
      console.log('✅ Translation message sent:', messageData.messageId);
    } catch (error) {
      console.error('❌ Failed to send translation:', error);
    }
  }, [currentSessionCode, userId, userName, userLanguage]);

  // Enhanced speech recognition
  const setupSpeechRecognition = useCallback(() => {
    if (!window.webkitSpeechRecognition && !window.SpeechRecognition) {
      setError('Speech recognition not supported. Please use Chrome or Safari.');
      return null;
    }

    const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = !isMobile;
    recognition.interimResults = true;
    recognition.lang = userLanguage;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setStatus('listening');
      setError('');
      console.log('🎤 Speech recognition started for:', userName);
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

      if (interimTranscript) {
        setMyTranscript(prev => lastTranscriptRef.current + interimTranscript);
      }

      if (finalTranscript.trim()) {
        const cleanText = finalTranscript.trim();
        lastTranscriptRef.current += cleanText + ' ';
        setMyTranscript(lastTranscriptRef.current);
        
        console.log('🗣️ Final transcript from', userName + ':', cleanText);
        
        const otherUsers = getOtherUsers();
        console.log('👥 Other users for translation:', otherUsers.map(u => u.name));
        
        if (otherUsers.length > 0) {
          setStatus('translating');
          
          const translatedTexts = {};
          
          // Translate for each other user's language
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
          
          // Send translations
          if (Object.keys(translatedTexts).length > 0) {
            await sendTranslationMessage(cleanText, translatedTexts);
          }
          
          setStatus('online');
        }
      }
    };

    recognition.onerror = (event) => {
      console.error('❌ Speech recognition error for', userName + ':', event.error);
      
      if (event.error === 'no-speech') return;
      
      let errorMessage = '';
      switch (event.error) {
        case 'network':
          errorMessage = 'Network error during speech recognition';
          break;
        case 'not-allowed':
          errorMessage = 'Microphone access denied. Please grant permissions.';
          break;
        case 'audio-capture':
          errorMessage = 'No microphone found.';
          break;
        default:
          errorMessage = `Speech recognition error: ${event.error}`;
      }
      
      setError(errorMessage);
    };

    recognition.onend = () => {
      console.log('🎤 Speech recognition ended for:', userName);
      setIsListening(false);
      if (isConnected && !error) {
        setStatus('online');
        
        // Auto-restart logic
        if (!isMobile) {
          setTimeout(() => {
            if (isConnected && recognitionRef.current === recognition) {
              try {
                recognition.start();
                console.log('🔄 Speech recognition restarted for:', userName);
              } catch (e) {
                console.log('❌ Recognition restart failed:', e);
              }
            }
          }, 1000);
        }
      }
    };

    return recognition;
  }, [userLanguage, userName, getOtherUsers, translateText, sendTranslationMessage, isConnected, error, isMobile, initializeAudioContext]);

  // Handle received messages
  const handleReceivedMessage = useCallback((message) => {
    if (message.senderId === userId) return;
    if (processedMessageIds.current.has(message.messageId)) return;
    
    processedMessageIds.current.add(message.messageId);
    console.log('📨 Processing message from', message.senderName + ':', message.messageId);
    
    if (message.type === 'translation') {
      const translationForMe = message.translatedTexts[userLanguage];
      
      if (translationForMe) {
        console.log('🔄 Translation for me:', translationForMe);
        
        setReceivedTranscript(prev => prev + translationForMe + ' ');
        
        if (autoSpeak) {
          setTimeout(() => {
            speakText(translationForMe, userLanguage);
          }, 500);
        }
        
        setTranslationStatus(`📨 From: ${message.senderName}`);
        setTimeout(() => setTranslationStatus(''), 3000);
      }
    }
  }, [userId, userLanguage, autoSpeak, speakText]);

  // Setup Firebase listeners
  const setupFirebaseListeners = useCallback((sessionCode) => {
    console.log('🔥 Setting up Firebase listeners for:', sessionCode);
    
    processedMessageIds.current.clear();
    processedSignalingIds.current.clear();
    
    // Listen to users
    const usersRef = ref(database, `sessions/${sessionCode}/users`);
    const unsubscribeUsers = onValue(usersRef, (snapshot) => {
      const users = snapshot.val() || {};
      setConnectedUsers(users);
      
      const userList = Object.values(users);
      const onlineUsers = userList.filter(u => u.isOnline);
      const videoUsers = onlineUsers.filter(u => u.hasVideo);
      
      console.log('👥 Users updated:', {
        total: userList.length,
        online: onlineUsers.length,
        video: videoUsers.length,
        users: onlineUsers.map(u => `${u.name} (${u.id.substr(-4)})`)
      });
      
      // Video call logic - simplified
      if (isVideoEnabled && peerConnectionRef.current && !callInProgress.current) {
        const otherVideoUsers = videoUsers.filter(u => u.id !== userId);
        
        if (otherVideoUsers.length > 0) {
          // Always let the user with smaller ID initiate
          const shouldInitiate = userId < otherVideoUsers[0].id;
          
          if (shouldInitiate) {
            console.log('🚀 Initiating video call as primary user...');
            setVideoStatus('🚀 Initiating call...');
            setTimeout(() => {
              initiateCall();
            }, 2000);
          } else {
            console.log('⏳ Waiting for incoming video call...');
            setVideoStatus('⏳ Waiting for call...');
          }
        }
      }
    });
    unsubscribersRef.current.push(unsubscribeUsers);
    
    // Listen to translation messages
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
    
    // Listen to WebRTC signaling
    const webrtcRef = ref(database, `sessions/${sessionCode}/webrtc`);
    const unsubscribeWebRTC = onValue(webrtcRef, (snapshot) => {
      const signalingData = snapshot.val() || {};
      const signalingList = Object.values(signalingData)
        .filter(signal => signal.senderId !== userId)
        .filter(signal => !processedSignalingIds.current.has(signal.id))
        .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      
      console.log('📡 Processing', signalingList.length, 'new signaling messages');
      
      signalingList.forEach(signal => {
        processedSignalingIds.current.add(signal.id);
        const { data, senderId, senderName } = signal;
        
        console.log('📡 Processing signaling from', senderName + ':', data.type);
        
        if (data.type === 'offer') {
          handleOffer(data.offer, senderId);
        } else if (data.type === 'answer') {
          handleAnswer(data.answer, senderId);
        } else if (data.type === 'ice-candidate') {
          handleIceCandidate(data.candidate, senderId);
        }
      });
    });
    unsubscribersRef.current.push(unsubscribeWebRTC);
    
  }, [userId, isVideoEnabled, initiateCall, handleOffer, handleAnswer, handleIceCandidate, handleReceivedMessage]);

  // Create session
  const createSession = useCallback(async () => {
    if (!userName.trim() || !apiKey.trim()) {
      setError('Please enter your name and Gemini API key');
      return;
    }
    
    try {
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
      lastTranscriptRef.current = '';
      processedMessageIds.current.clear();
      processedSignalingIds.current.clear();
      callInProgress.current = false;
      
      const userData = {
        id: userId,
        name: userName,
        language: userLanguage,
        isOnline: true,
        hasVideo: isVideoEnabled,
        hasAudio: isAudioEnabled,
        joinedAt: Date.now(),
        deviceInfo: {
          isMobile,
          isIOS,
          userAgent: navigator.userAgent.substring(0, 100)
        }
      };
      
      await set(ref(database, `sessions/${newCode}/users/${userId}`), userData);
      
      if (isVideoEnabled && stream) {
        await setupPeerConnection(stream);
        setVideoStatus('📹 Video ready');
      }
      
      setupFirebaseListeners(newCode);
      
      console.log(`✅ Session created: ${newCode} by ${userName} (${userId.substr(-4)})`);
      
    } catch (error) {
      console.error('❌ Create session failed:', error);
      setError('Failed to create session: ' + error.message);
    }
  }, [userName, userLanguage, userId, apiKey, isVideoEnabled, isAudioEnabled, isMobile, isIOS, initializeMedia, setupPeerConnection, setupFirebaseListeners]);

  // Join session
  const joinSession = useCallback(async () => {
    if (!userName.trim() || !sessionCode.trim() || !apiKey.trim()) {
      setError('Please enter your name, session code, and API key');
      return;
    }
    
    try {
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
      lastTranscriptRef.current = '';
      processedMessageIds.current.clear();
      processedSignalingIds.current.clear();
      callInProgress.current = false;
      
      const userData = {
        id: userId,
        name: userName,
        language: userLanguage,
        isOnline: true,
        hasVideo: isVideoEnabled,
        hasAudio: isAudioEnabled,
        joinedAt: Date.now(),
        deviceInfo: {
          isMobile,
          isIOS,
          userAgent: navigator.userAgent.substring(0, 100)
        }
      };
      
      await set(ref(database, `sessions/${sessionCode}/users/${userId}`), userData);
      
      if (isVideoEnabled && stream) {
        await setupPeerConnection(stream);
        setVideoStatus('📹 Video ready');
      }
      
      setupFirebaseListeners(sessionCode);
      
      console.log(`✅ Joined session: ${sessionCode} as ${userName} (${userId.substr(-4)})`);
      
    } catch (error) {
      console.error('❌ Join session failed:', error);
      setError('Failed to join session: ' + error.message);
    }
  }, [userName, sessionCode, userLanguage, userId, apiKey, isVideoEnabled, isAudioEnabled, isMobile, isIOS, initializeMedia, setupPeerConnection, setupFirebaseListeners]);

  // Start listening
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
    
    initializeAudioContext();
    
    const recognition = setupSpeechRecognition();
    if (recognition) {
      recognitionRef.current = recognition;
      try {
        recognition.start();
        console.log('🎤 Started speech recognition for:', userName);
      } catch (error) {
        console.error('❌ Recognition start failed:', error);
        setError('Failed to start speech recognition');
      }
    }
  }, [apiKey, setupSpeechRecognition, getOtherUsers, isMobile, initializeAudioContext, userName]);

  // Stop listening
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setStatus('online');
    console.log('🛑 Stopped speech recognition for:', userName);
  }, [userName]);

  // Toggle video
  const toggleVideo = useCallback(async () => {
    if (!isVideoEnabled) {
      try {
        const stream = await initializeMedia();
        if (!stream) return;
        
        setIsVideoEnabled(true);
        
        if (currentSessionCode) {
          await update(ref(database, `sessions/${currentSessionCode}/users/${userId}`), {
            hasVideo: true
          });
        }

        if (isConnected) {
          await setupPeerConnection(stream);
          setVideoStatus('📹 Video enabled');
        }
      } catch (error) {
        setError('Failed to enable video: ' + error.message);
      }
    } else {
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
      callInProgress.current = false;
      
      if (currentSessionCode) {
        await update(ref(database, `sessions/${currentSessionCode}/users/${userId}`), {
          hasVideo: false
        });
      }
    }
  }, [isVideoEnabled, initializeMedia, currentSessionCode, userId, isConnected, setupPeerConnection, localStream]);

  // Leave session
  const leaveSession = useCallback(() => {
    console.log('🚪 Leaving session:', userName);
    
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
    
    stopListening();
    
    unsubscribersRef.current.forEach(unsubscribe => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    });
    unsubscribersRef.current = [];
    
    if (currentSessionCode) {
      remove(ref(database, `sessions/${currentSessionCode}/users/${userId}`));
    }
    
    // Reset all state
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
    setConnectionState('new');
    lastTranscriptRef.current = '';
    processedMessageIds.current.clear();
    processedSignalingIds.current.clear();
    callInProgress.current = false;
    pendingIceCandidates.current = [];
  }, [localStream, remoteStream, stopListening, currentSessionCode, userId, userName]);

  // Clear transcripts
  const clearTranscripts = useCallback(() => {
    setMyTranscript('');
    setReceivedTranscript('');
    lastTranscriptRef.current = '';
    processedMessageIds.current.clear();
  }, []);

  // Handle video click for mobile
  const handleVideoClick = useCallback((videoRef) => {
    if (videoRef.current && isMobile) {
      videoRef.current.play().catch(e => {
        console.log('Video play failed:', e);
      });
    }
  }, [isMobile]);

  // Effects
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

  useEffect(() => {
    return () => {
      unsubscribersRef.current.forEach(unsubscribe => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      });
      
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      if (remoteStream) {
        remoteStream.getTracks().forEach(track => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
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
              📱 Mobile optimized • {isIOS ? 'iOS Safari' : 'Chrome'} recommended • ID: {userId.substr(-4)}
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
              background: connectionState === 'connected' ? '#dcfce7' : '#f0f9ff',
              color: connectionState === 'connected' ? '#166534' : '#1e40af',
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
                  fontSize: '16px',
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
                minHeight: '44px'
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
                  📹 Video Chat {connectionState !== 'new' && `(${connectionState})`}
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
                            ? (connectionState === 'connecting' ? 'Connecting to remote video...' : 
                               isMobile ? 'Tap to play when connected' : 'Waiting for video connection...') 
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
                      {user.deviceInfo?.isMobile && ' 📱'} • {user.id.substr(-4)}
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