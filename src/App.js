import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

function PremiumLanguageBridge() {
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
  
  // Demo state for UI showcase
  const [connectedUsers, setConnectedUsers] = useState({});
  const [messages, setMessages] = useState([]);
  const [myTranscript, setMyTranscript] = useState('');
  const [receivedTranscript, setReceivedTranscript] = useState('');
  
  // Status
  const [status, setStatus] = useState('offline');
  const [error, setError] = useState('');
  const [videoStatus, setVideoStatus] = useState('');
  const [translationStatus, setTranslationStatus] = useState('');
  
  // Video state
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [connectionState, setConnectionState] = useState('new');
  
  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  
  // Refs
  const recognitionRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const lastTranscriptRef = useRef('');
  const audioContextRef = useRef(null);

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
    
    console.log('Device detection:', { mobile, ios, userId });
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
        console.log('Audio context initialized');
        
        if (audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume().then(() => {
            console.log('Audio context resumed');
          });
        }
      } catch (error) {
        console.error('Audio context initialization failed:', error);
      }
    }
  }, []);

  // Enhanced media initialization
  const initializeMedia = useCallback(async () => {
    try {
      setVideoStatus('Requesting permissions...');
      
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
      
      console.log('Requesting media with constraints:', constraints);
      
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
      
      setVideoStatus('Media ready');
      console.log('Media initialized successfully:', { 
        video: isVideoEnabled, 
        audio: isAudioEnabled,
        tracks: stream.getTracks().length
      });
      
      return stream;
    } catch (error) {
      console.error('Media access error:', error);
      const errorMessage = `Media access failed: ${error.message}${isMobile ? ' (Mobile: Ensure HTTPS and permissions)' : ''}`;
      setError(errorMessage);
      setVideoStatus('Media failed');
      return null;
    }
  }, [isVideoEnabled, isAudioEnabled, isMobile, initializeAudioContext]);

  // Generate session code
  const generateCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

  // Translation function (demo version)
  const translateText = useCallback(async (text, fromLang, toLang) => {
    if (!text.trim() || !apiKey || fromLang === toLang) return text;
    
    try {
      setTranslationStatus('Translating...');
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
      
      setTranslationStatus('Translation complete');
      setTimeout(() => setTranslationStatus(''), 2000);
      
      console.log('Translation:', { from: text, to: translation, fromLang, toLang });
      return translation;
    } catch (error) {
      console.error('Translation error:', error);
      setTranslationStatus('Translation failed');
      setTimeout(() => setTranslationStatus(''), 3000);
      return `[Translation Error: ${text}]`;
    }
  }, [apiKey, languages]);

  // Enhanced speech synthesis
  const speakText = useCallback((text, languageCode) => {
    if (!text || isMuted || !window.speechSynthesis) return;
    
    console.log('Speaking:', { text: text.substring(0, 50), languageCode, isMobile });
    
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
    
    utterance.onstart = () => console.log('Speech started');
    utterance.onend = () => console.log('Speech ended');
    utterance.onerror = (event) => {
      console.error('Speech error:', event);
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
      console.log('Speech recognition started for:', userName);
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
        
        console.log('Final transcript from', userName + ':', cleanText);
        
        const otherUsers = getOtherUsers();
        console.log('Other users for translation:', otherUsers.map(u => u.name));
        
        if (otherUsers.length > 0) {
          setStatus('translating');
          
          // Demo: simulate translation for other users
          for (const user of otherUsers) {
            if (user.language !== userLanguage) {
              try {
                const translation = await translateText(cleanText, userLanguage, user.language);
                console.log(`Translated for ${user.name} (${user.language}):`, translation);
                
                // Demo: show translation in received transcript
                setTimeout(() => {
                  setReceivedTranscript(prev => prev + translation + ' ');
                  if (autoSpeak) {
                    speakText(translation, userLanguage);
                  }
                }, 1000);
              } catch (error) {
                console.error(`Translation failed for ${user.name}:`, error);
              }
            }
          }
          
          setStatus('online');
        }
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error for', userName + ':', event.error);
      
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
      console.log('Speech recognition ended for:', userName);
      setIsListening(false);
      if (isConnected && !error) {
        setStatus('online');
        
        // Auto-restart logic
        if (!isMobile) {
          setTimeout(() => {
            if (isConnected && recognitionRef.current === recognition) {
              try {
                recognition.start();
                console.log('Speech recognition restarted for:', userName);
              } catch (e) {
                console.log('Recognition restart failed:', e);
              }
            }
          }, 1000);
        }
      }
    };

    return recognition;
  }, [userLanguage, userName, getOtherUsers, translateText, isConnected, error, isMobile, initializeAudioContext, autoSpeak, speakText]);

  // Create session (demo version)
  const createSession = useCallback(async () => {
    if (!userName.trim()) {
      setError('Please enter your name');
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
      
      // Demo: Add current user to connected users
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
      
      setConnectedUsers({ [userId]: userData });
      
      if (isVideoEnabled && stream) {
        setVideoStatus('Video ready');
      }
      
      // Demo: Add a sample user after 2 seconds
      setTimeout(() => {
        const demoUser = {
          id: 'demo_user_123',
          name: 'Demo User',
          language: userLanguage === 'en-US' ? 'hi-IN' : 'en-US',
          isOnline: true,
          hasVideo: false,
          hasAudio: true,
          joinedAt: Date.now(),
          deviceInfo: {
            isMobile: false,
            isIOS: false
          }
        };
        
        setConnectedUsers(prev => ({
          ...prev,
          [demoUser.id]: demoUser
        }));
      }, 2000);
      
      console.log(`Session created: ${newCode} by ${userName} (${userId.substr(-4)})`);
      
    } catch (error) {
      console.error('Create session failed:', error);
      setError('Failed to create session: ' + error.message);
    }
  }, [userName, userLanguage, userId, isVideoEnabled, isAudioEnabled, isMobile, isIOS, initializeMedia]);

  // Join session (demo version)
  const joinSession = useCallback(async () => {
    if (!userName.trim() || !sessionCode.trim()) {
      setError('Please enter your name and session code');
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
      
      // Demo: Add current user to connected users
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
      
      setConnectedUsers({ [userId]: userData });
      
      if (isVideoEnabled && stream) {
        setVideoStatus('Video ready');
      }
      
      // Demo: Add a sample user after 2 seconds
      setTimeout(() => {
        const demoUser = {
          id: 'demo_user_456',
          name: 'Other User',
          language: userLanguage === 'en-US' ? 'es-ES' : 'en-US',
          isOnline: true,
          hasVideo: false,
          hasAudio: true,
          joinedAt: Date.now(),
          deviceInfo: {
            isMobile: true,
            isIOS: false
          }
        };
        
        setConnectedUsers(prev => ({
          ...prev,
          [demoUser.id]: demoUser
        }));
      }, 2000);
      
      console.log(`Joined session: ${sessionCode} as ${userName} (${userId.substr(-4)})`);
      
    } catch (error) {
      console.error('Join session failed:', error);
      setError('Failed to join session: ' + error.message);
    }
  }, [userName, sessionCode, userLanguage, userId, isVideoEnabled, isAudioEnabled, isMobile, isIOS, initializeMedia]);

  // Start listening
  const startListening = useCallback(() => {
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
        console.log('Started speech recognition for:', userName);
      } catch (error) {
        console.error('Recognition start failed:', error);
        setError('Failed to start speech recognition');
      }
    }
  }, [setupSpeechRecognition, getOtherUsers, initializeAudioContext, userName]);

  // Stop listening
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setStatus('online');
    console.log('Stopped speech recognition for:', userName);
  }, [userName]);

  // Toggle video
  const toggleVideo = useCallback(async () => {
    if (!isVideoEnabled) {
      try {
        const stream = await initializeMedia();
        if (!stream) return;
        
        setIsVideoEnabled(true);
        setVideoStatus('Video enabled');
        
        // Update user data
        setConnectedUsers(prev => ({
          ...prev,
          [userId]: {
            ...prev[userId],
            hasVideo: true
          }
        }));
      } catch (error) {
        setError('Failed to enable video: ' + error.message);
      }
    } else {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      setIsVideoEnabled(false);
      setLocalStream(null);
      setRemoteStream(null);
      setVideoStatus('');
      setConnectionState('new');
      
      // Update user data
      setConnectedUsers(prev => ({
        ...prev,
        [userId]: {
          ...prev[userId],
          hasVideo: false
        }
      }));
    }
  }, [isVideoEnabled, initializeMedia, userId, localStream]);

  // Leave session
  const leaveSession = useCallback(() => {
    console.log('Leaving session:', userName);
    
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    
    stopListening();
    
    // Reset all state
    setIsConnected(false);
    setCurrentSessionCode('');
    setConnectedUsers({});
    setMessages([]);
    setMyTranscript('');
    setReceivedTranscript('');
    setLocalStream(null);
    setRemoteStream(null);
    setIsVideoEnabled(false);
    setStatus('offline');
    setVideoStatus('');
    setTranslationStatus('');
    setConnectionState('new');
    lastTranscriptRef.current = '';
  }, [localStream, stopListening, userName]);

  // Clear transcripts
  const clearTranscripts = useCallback(() => {
    setMyTranscript('');
    setReceivedTranscript('');
    lastTranscriptRef.current = '';
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
    const initVoices = () => {
      if (speechSynthesis.getVoices().length > 0) {
        console.log('Available voices:', speechSynthesis.getVoices().length);
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
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [localStream]);

  const getStatusColor = (currentStatus) => {
    switch (currentStatus) {
      case 'online':
        return '#10b981';
      case 'listening':
        return '#3b82f6';
      case 'translating':
        return '#8b5cf6';
      case 'error':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const getConnectionColor = (state) => {
    switch (state) {
      case 'connected':
        return '#10b981';
      case 'connecting':
        return '#f59e0b';
      case 'failed':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  return (
    <div style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      minHeight: '100vh',
      background: '#fafafa',
      color: '#1f2937'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: isMobile ? '16px' : '24px' }}>
        
        {/* Header */}
        <div style={{ 
          textAlign: 'center', 
          marginBottom: isMobile ? '32px' : '48px',
          paddingTop: isMobile ? '24px' : '32px'
        }}>
          <h1 style={{
            fontSize: isMobile ? '28px' : '40px',
            fontWeight: '700',
            color: '#111827',
            marginBottom: '12px',
            letterSpacing: '-0.025em'
          }}>
            Language Bridge Pro
          </h1>
          <p style={{
            fontSize: isMobile ? '16px' : '18px',
            color: '#6b7280',
            fontWeight: '400',
            lineHeight: '1.6'
          }}>
            Real-time voice translation with video chat
          </p>
          <div style={{
            marginTop: '16px',
            padding: '12px 20px',
            background: '#fef3c7',
            border: '1px solid #fbbf24',
            borderRadius: '12px',
            color: '#92400e',
            fontSize: '14px',
            fontWeight: '500',
            maxWidth: '600px',
            margin: '16px auto 0 auto'
          }}>
            🚧 Demo Version - This showcases the premium UI design. For full functionality, integrate with Firebase or your preferred backend.
          </div>
        </div>

        {/* Status Bar */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: isMobile ? '16px' : '20px',
          marginBottom: '24px',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
          border: '1px solid #f3f4f6'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: isMobile ? '12px' : '20px',
            flexWrap: 'wrap'
          }}>
            {/* Main Status */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '12px',
              background: '#f9fafb',
              border: `1px solid ${getStatusColor(status)}20`,
              fontSize: isMobile ? '14px' : '15px',
              fontWeight: '500'
            }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: getStatusColor(status)
              }} />
              <span style={{ color: '#374151', textTransform: 'capitalize' }}>
                {status === 'offline' ? 'Offline' : 
                 status === 'online' ? 'Connected' : 
                 status === 'listening' ? 'Listening' : 
                 status === 'translating' ? 'Translating' : status}
              </span>
            </div>
            
            {/* Session Code */}
            {currentSessionCode && (
              <div style={{
                padding: '8px 16px',
                borderRadius: '12px',
                background: '#f3f4f6',
                border: '1px solid #e5e7eb',
                fontSize: isMobile ? '14px' : '15px',
                fontWeight: '600',
                color: '#374151',
                fontFamily: 'Monaco, "Lucida Console", monospace'
              }}>
                {currentSessionCode}
              </div>
            )}
            
            {/* Users Count */}
            {getOtherUsers().length > 0 && (
              <div style={{
                padding: '8px 16px',
                borderRadius: '12px',
                background: '#ecfdf5',
                border: '1px solid #d1fae5',
                fontSize: isMobile ? '14px' : '15px',
                fontWeight: '500',
                color: '#065f46'
              }}>
                {getOtherUsers().length + 1} users
              </div>
            )}

            {/* Video Status */}
            {videoStatus && (
              <div style={{
                padding: '8px 16px',
                borderRadius: '12px',
                background: '#f0f9ff',
                border: '1px solid #e0f2fe',
                fontSize: isMobile ? '13px' : '14px',
                fontWeight: '500',
                color: '#0c4a6e',
                maxWidth: isMobile ? '200px' : 'none',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {videoStatus}
              </div>
            )}

            {/* Translation Status */}
            {translationStatus && (
              <div style={{
                padding: '8px 16px',
                borderRadius: '12px',
                background: '#faf5ff',
                border: '1px solid #e9d5ff',
                fontSize: isMobile ? '13px' : '14px',
                fontWeight: '500',
                color: '#6b21a8'
              }}>
                {translationStatus}
              </div>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: '#fef2f2',
            color: '#991b1b',
            padding: isMobile ? '16px' : '20px',
            borderRadius: '12px',
            marginBottom: '24px',
            border: '1px solid #fecaca',
            fontSize: isMobile ? '14px' : '15px',
            fontWeight: '500'
          }}>
            {error}
          </div>
        )}

        {/* Setup Form */}
        {!isConnected && (
          <div style={{
            background: 'white',
            borderRadius: '20px',
            padding: isMobile ? '24px' : '32px',
            marginBottom: '32px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            border: '1px solid #f3f4f6'
          }}>
            <h3 style={{ 
              margin: '0 0 32px 0', 
              textAlign: 'center', 
              fontSize: isMobile ? '20px' : '24px',
              fontWeight: '600',
              color: '#111827'
            }}>
              Get Started
            </h3>
            
            {/* API Key */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px', 
                fontWeight: '500', 
                fontSize: '15px',
                color: '#374151'
              }}>
                Gemini API Key (Optional for demo)
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your API key (optional for UI demo)"
                style={{
                  width: '100%',
                  padding: '16px',
                  borderRadius: '12px',
                  border: '1px solid #d1d5db',
                  fontSize: '16px',
                  boxSizing: 'border-box',
                  background: '#fafafa',
                  transition: 'all 0.2s',
                  outline: 'none'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#3b82f6';
                  e.target.style.background = 'white';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#d1d5db';
                  e.target.style.background = '#fafafa';
                }}
              />
              <p style={{ 
                fontSize: '13px', 
                color: '#6b7280', 
                margin: '8px 0 0 0',
                lineHeight: '1.4'
              }}>
                Get your free API key from{' '}
                <a 
                  href="https://makersuite.google.com/app/apikey" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  style={{ color: '#3b82f6', textDecoration: 'none' }}
                >
                  Google AI Studio
                </a>
              </p>
            </div>
            
            {/* User Info */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: (window.innerWidth > 600 && !isMobile) ? '1fr 1fr' : '1fr',
              gap: '20px',
              marginBottom: '24px'
            }}>
              <div>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px', 
                  fontWeight: '500', 
                  fontSize: '15px',
                  color: '#374151'
                }}>
                  Your Name
                </label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Enter your name"
                  style={{
                    width: '100%',
                    padding: '16px',
                    borderRadius: '12px',
                    border: '1px solid #d1d5db',
                    fontSize: '16px',
                    boxSizing: 'border-box',
                    background: '#fafafa',
                    transition: 'all 0.2s',
                    outline: 'none'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#3b82f6';
                    e.target.style.background = 'white';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#d1d5db';
                    e.target.style.background = '#fafaba';
                  }}
                />
              </div>
              
              <div>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px', 
                  fontWeight: '500', 
                  fontSize: '15px',
                  color: '#374151'
                }}>
                  Your Language
                </label>
                <select
                  value={userLanguage}
                  onChange={(e) => setUserLanguage(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '16px',
                    borderRadius: '12px',
                    border: '1px solid #d1d5db',
                    fontSize: '16px',
                    boxSizing: 'border-box',
                    background: '#fafafa',
                    outline: 'none'
                  }}
                >
                  {languages.map(lang => (
                    <option key={lang.code} value={lang.code}>
                      {lang.flag} {lang.native}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Media Options */}
            <div style={{
              display: 'flex',
              gap: '16px',
              marginBottom: '32px',
              justifyContent: 'center',
              flexWrap: 'wrap'
            }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                padding: '12px 16px',
                background: '#f9fafb',
                borderRadius: '12px',
                border: '1px solid #e5e7eb',
                fontWeight: '500',
                fontSize: '15px',
                color: '#374151',
                transition: 'all 0.2s'
              }}>
                <input
                  type="checkbox"
                  checked={isVideoEnabled}
                  onChange={(e) => setIsVideoEnabled(e.target.checked)}
                  style={{ 
                    width: '16px', 
                    height: '16px',
                    accentColor: '#3b82f6'
                  }}
                />
                <span>Enable Video</span>
              </label>

              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                padding: '12px 16px',
                background: '#f9fafb',
                borderRadius: '12px',
                border: '1px solid #e5e7eb',
                fontWeight: '500',
                fontSize: '15px',
                color: '#374151',
                transition: 'all 0.2s'
              }}>
                <input
                  type="checkbox"
                  checked={isAudioEnabled}
                  onChange={(e) => setIsAudioEnabled(e.target.checked)}
                  style={{ 
                    width: '16px', 
                    height: '16px',
                    accentColor: '#3b82f6'
                  }}
                />
                <span>Enable Audio</span>
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
                  disabled={!userName.trim()}
                  style={{
                    width: '100%',
                    padding: '16px',
                    borderRadius: '12px',
                    border: 'none',
                    background: userName.trim() ? '#3b82f6' : '#d1d5db',
                    color: 'white',
                    fontWeight: '600',
                    fontSize: '16px',
                    cursor: userName.trim() ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (userName.trim()) {
                      e.target.style.background = '#2563eb';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (userName.trim()) {
                      e.target.style.background = '#3b82f6';
                    }
                  }}
                >
                  Create New Session
                </button>
              </div>
              
              <div>
                <input
                  type="text"
                  value={sessionCode}
                  onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                  placeholder="Session code"
                  style={{
                    width: '100%',
                    padding: '16px',
                    borderRadius: '12px',
                    border: '1px solid #d1d5db',
                    fontSize: '16px',
                    textAlign: 'center',
                    marginBottom: '12px',
                    boxSizing: 'border-box',
                    background: '#fafafa',
                    outline: 'none',
                    fontFamily: 'Monaco, "Lucida Console", monospace',
                    fontWeight: '600'
                  }}
                />
                <button
                  onClick={joinSession}
                  disabled={!userName.trim() || !sessionCode.trim()}
                  style={{
                    width: '100%',
                    padding: '16px',
                    borderRadius: '12px',
                    border: 'none',
                    background: (userName.trim() && sessionCode.trim()) ? '#10b981' : '#d1d5db',
                    color: 'white',
                    fontWeight: '600',
                    fontSize: '16px',
                    cursor: (userName.trim() && sessionCode.trim()) ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (userName.trim() && sessionCode.trim()) {
                      e.target.style.background = '#059669';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (userName.trim() && sessionCode.trim()) {
                      e.target.style.background = '#10b981';
                    }
                  }}
                >
                  Join Session
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Interface */}
        {isConnected && (
          <>
            {/* Video Section */}
            {(isVideoEnabled || getOtherUsers().some(u => u.hasVideo)) && (
              <div style={{
                background: 'white',
                borderRadius: '20px',
                padding: isMobile ? '20px' : '24px',
                marginBottom: '24px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                border: '1px solid #f3f4f6'
              }}>
                <h3 style={{ 
                  margin: '0 0 20px 0', 
                  textAlign: 'center', 
                  fontSize: isMobile ? '18px' : '20px',
                  fontWeight: '600',
                  color: '#111827'
                }}>
                  Video Chat
                  {connectionState !== 'new' && (
                    <span style={{
                      marginLeft: '12px',
                      padding: '4px 8px',
                      borderRadius: '8px',
                      background: getConnectionColor(connectionState) + '20',
                      color: getConnectionColor(connectionState),
                      fontSize: '12px',
                      fontWeight: '500'
                    }}>
                      {connectionState}
                    </span>
                  )}
                </h3>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: (window.innerWidth > 768 && !isMobile) ? '1fr 1fr' : '1fr',
                  gap: isMobile ? '16px' : '20px'
                }}>
                  {/* Local Video */}
                  <div style={{
                    position: 'relative',
                    background: '#000',
                    borderRadius: '16px',
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
                        height: '100%',
                        flexDirection: 'column'
                      }}>
                        <div style={{ fontSize: isMobile ? '36px' : '48px', marginBottom: '12px' }}>📹</div>
                        <div style={{ fontSize: isMobile ? '14px' : '16px', color: '#d1d5db' }}>Your video</div>
                      </div>
                    )}
                    <div style={{
                      position: 'absolute',
                      bottom: '12px',
                      left: '12px',
                      background: 'rgba(0,0,0,0.8)',
                      color: 'white',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: '500'
                    }}>
                      You {languages.find(l => l.code === userLanguage)?.flag}
                    </div>
                  </div>

                  {/* Remote Video */}
                  <div style={{
                    position: 'relative',
                    background: '#000',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    aspectRatio: '16/9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: isMobile ? '200px' : 'auto'
                  }}>
                    <div style={{
                      color: 'white',
                      textAlign: 'center',
                      padding: '20px',
                      flexDirection: 'column',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <div style={{ fontSize: isMobile ? '36px' : '48px', marginBottom: '12px' }}>👤</div>
                      <div style={{ fontSize: isMobile ? '14px' : '16px', color: '#d1d5db', textAlign: 'center' }}>
                        Remote video (Demo)
                      </div>
                    </div>
                    {getOtherUsers()[0] && (
                      <div style={{
                        position: 'absolute',
                        bottom: '12px',
                        left: '12px',
                        background: 'rgba(0,0,0,0.8)',
                        color: 'white',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: '500'
                      }}>
                        {getOtherUsers()[0].name} {languages.find(l => l.code === getOtherUsers()[0].language)?.flag}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Controls */}
            <div style={{
              background: 'white',
              borderRadius: '20px',
              padding: isMobile ? '20px' : '24px',
              marginBottom: '24px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              border: '1px solid #f3f4f6'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: isMobile ? '12px' : '16px'
              }}>
                <div style={{ 
                  display: 'flex', 
                  gap: isMobile ? '12px' : '16px', 
                  flexWrap: 'wrap',
                  alignItems: 'center'
                }}>
                  <button
                    onClick={isListening ? stopListening : startListening}
                    disabled={getOtherUsers().length === 0}
                    style={{
                      padding: '12px 24px',
                      borderRadius: '12px',
                      border: 'none',
                      background: getOtherUsers().length === 0 ? '#e5e7eb' :
                                  isListening ? '#ef4444' : '#10b981',
                      color: 'white',
                      fontWeight: '600',
                      cursor: getOtherUsers().length === 0 ? 'not-allowed' : 'pointer',
                      fontSize: '15px',
                      transition: 'all 0.2s',
                      minHeight: '44px'
                    }}
                    onMouseEnter={(e) => {
                      if (getOtherUsers().length > 0) {
                        e.target.style.transform = 'translateY(-1px)';
                        e.target.style.boxShadow = '0 4px 8px rgba(0,0,0,0.12)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = 'none';
                    }}
                  >
                    {isListening ? 'Stop' : 'Listen'}
                  </button>

                  <button
                    onClick={toggleVideo}
                    style={{
                      padding: '12px 20px',
                      borderRadius: '12px',
                      border: 'none',
                      background: isVideoEnabled ? '#3b82f6' : '#6b7280',
                      color: 'white',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      fontSize: '15px',
                      minHeight: '44px'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.transform = 'translateY(-1px)';
                      e.target.style.boxShadow = '0 4px 8px rgba(0,0,0,0.12)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = 'none';
                    }}
                  >
                    Video
                  </button>
                  
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    style={{
                      padding: '12px 20px',
                      borderRadius: '12px',
                      border: 'none',
                      background: isMuted ? '#ef4444' : '#6b7280',
                      color: 'white',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      fontSize: '15px',
                      minHeight: '44px'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.transform = 'translateY(-1px)';
                      e.target.style.boxShadow = '0 4px 8px rgba(0,0,0,0.12)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = 'none';
                    }}
                  >
                    {isMuted ? 'Muted' : 'Audio'}
                  </button>
                  
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    padding: '12px 16px',
                    background: autoSpeak ? '#ecfdf5' : '#f9fafb',
                    border: `1px solid ${autoSpeak ? '#a7f3d0' : '#e5e7eb'}`,
                    borderRadius: '12px',
                    fontWeight: '500',
                    color: autoSpeak ? '#065f46' : '#6b7280',
                    fontSize: '15px',
                    minHeight: '44px',
                    transition: 'all 0.2s'
                  }}>
                    <input
                      type="checkbox"
                      checked={autoSpeak}
                      onChange={(e) => setAutoSpeak(e.target.checked)}
                      style={{ 
                        width: '16px', 
                        height: '16px',
                        accentColor: '#10b981'
                      }}
                    />
                    <span>Auto speak</span>
                  </label>

                  <button
                    onClick={clearTranscripts}
                    style={{
                      padding: '12px 16px',
                      borderRadius: '12px',
                      border: '1px solid #d1d5db',
                      background: 'white',
                      color: '#6b7280',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      fontSize: '15px',
                      minHeight: '44px'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.borderColor = '#9ca3af';
                      e.target.style.color = '#374151';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.borderColor = '#d1d5db';
                      e.target.style.color = '#6b7280';
                    }}
                  >
                    Clear
                  </button>
                </div>
                
                <button
                  onClick={leaveSession}
                  style={{
                    padding: '12px 20px',
                    borderRadius: '12px',
                    border: '1px solid #ef4444',
                    background: 'white',
                    color: '#ef4444',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontSize: '15px',
                    minHeight: '44px'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = '#ef4444';
                    e.target.style.color = 'white';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'white';
                    e.target.style.color = '#ef4444';
                  }}
                >
                  Leave
                </button>
              </div>
              
              {getOtherUsers().length === 0 && (
                <div style={{
                  marginTop: '16px',
                  padding: '16px',
                  background: '#fffbeb',
                  borderRadius: '12px',
                  border: '1px solid #fed7aa',
                  color: '#92400e',
                  textAlign: 'center',
                  fontSize: '14px',
                  fontWeight: '500'
                }}>
                  Waiting for other users to join...
                </div>
              )}
            </div>

            {/* Communication Interface */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: (window.innerWidth > 768 && !isMobile) ? '1fr 1fr' : '1fr',
              gap: '24px',
              marginBottom: '24px'
            }}>
              {/* Your Speech */}
              <div style={{
                background: 'white',
                borderRadius: '20px',
                padding: isMobile ? '20px' : '24px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                border: '1px solid #f3f4f6'
              }}>
                <h3 style={{
                  margin: '0 0 16px 0',
                  color: '#111827',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: isMobile ? '16px' : '18px',
                  fontWeight: '600'
                }}>
                  You speak
                  <span style={{ fontSize: '14px', color: '#6b7280', fontWeight: '400' }}>
                    {languages.find(l => l.code === userLanguage)?.native}
                  </span>
                  {isListening && (
                    <span style={{
                      background: '#10b981',
                      color: 'white',
                      padding: '2px 8px',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontWeight: '600',
                      animation: 'pulse 2s infinite'
                    }}>
                      LIVE
                    </span>
                  )}
                </h3>
                <div style={{
                  background: '#f8fafc',
                  borderRadius: '12px',
                  padding: '20px',
                  minHeight: '120px',
                  border: '1px solid #e2e8f0',
                  fontSize: '15px',
                  lineHeight: '1.6',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  color: '#374151'
                }}>
                  {myTranscript || (
                    <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>
                      {isListening 
                        ? 'Listening... Start speaking' 
                        : getOtherUsers().length > 0 
                          ? 'Click "Listen" to start'
                          : 'Waiting for users...'}
                    </span>
                  )}
                </div>
                <div style={{ marginTop: '12px' }}>
                  <button
                    onClick={() => speakText(myTranscript, userLanguage)}
                    disabled={!myTranscript.trim()}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: 'none',
                      background: myTranscript.trim() ? '#10b981' : '#e5e7eb',
                      color: 'white',
                      fontWeight: '500',
                      cursor: myTranscript.trim() ? 'pointer' : 'not-allowed',
                      transition: 'all 0.2s',
                      fontSize: '14px'
                    }}
                  >
                    Replay
                  </button>
                </div>
              </div>

              {/* Received Translations */}
              <div style={{
                background: 'white',
                borderRadius: '20px',
                padding: isMobile ? '20px' : '24px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                border: '1px solid #f3f4f6'
              }}>
                <h3 style={{
                  margin: '0 0 16px 0',
                  color: '#111827',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: isMobile ? '16px' : '18px',
                  fontWeight: '600'
                }}>
                  You hear
                  <span style={{ fontSize: '14px', color: '#6b7280', fontWeight: '400' }}>
                    {languages.find(l => l.code === userLanguage)?.native}
                  </span>
                  {autoSpeak && (
                    <span style={{
                      background: '#3b82f6',
                      color: 'white',
                      padding: '2px 8px',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontWeight: '600'
                    }}>
                      AUTO
                    </span>
                  )}
                </h3>
                <div style={{
                  background: '#f0fdf4',
                  borderRadius: '12px',
                  padding: '20px',
                  minHeight: '120px',
                  border: '1px solid #dcfce7',
                  fontSize: '15px',
                  lineHeight: '1.6',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  color: '#374151'
                }}>
                  {receivedTranscript || (
                    <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>
                      Translations will appear here...
                    </span>
                  )}
                </div>
                <div style={{ marginTop: '12px' }}>
                  <button
                    onClick={() => speakText(receivedTranscript, userLanguage)}
                    disabled={!receivedTranscript.trim()}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: 'none',
                      background: receivedTranscript.trim() ? '#10b981' : '#e5e7eb',
                      color: 'white',
                      fontWeight: '500',
                      cursor: receivedTranscript.trim() ? 'pointer' : 'not-allowed',
                      transition: 'all 0.2s',
                      fontSize: '14px'
                    }}
                  >
                    Replay
                  </button>
                </div>
              </div>
            </div>

            {/* Connected Users */}
            <div style={{
              background: 'white',
              borderRadius: '20px',
              padding: isMobile ? '20px' : '24px',
              marginBottom: '24px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              border: '1px solid #f3f4f6'
            }}>
              <h3 style={{ 
                margin: '0 0 20px 0', 
                textAlign: 'center', 
                fontSize: isMobile ? '18px' : '20px',
                fontWeight: '600',
                color: '#111827'
              }}>
                Connected Users ({Object.keys(connectedUsers).length})
              </h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '16px'
              }}>
                {Object.values(connectedUsers).map((user) => (
                  <div key={user.id} style={{
                    background: user.id === userId ? '#f0f9ff' : '#f9fafb',
                    borderRadius: '16px',
                    padding: '20px',
                    border: `1px solid ${user.id === userId ? '#bfdbfe' : '#f3f4f6'}`,
                    textAlign: 'center'
                  }}>
                    <div style={{ 
                      fontWeight: '600', 
                      marginBottom: '8px',
                      fontSize: '16px',
                      color: '#111827'
                    }}>
                      {user.name} {user.id === userId && '(You)'}
                    </div>
                    <div style={{ 
                      fontSize: '14px', 
                      color: '#6b7280',
                      marginBottom: '12px'
                    }}>
                      {languages.find(l => l.code === user.language)?.flag} {' '}
                      {languages.find(l => l.code === user.language)?.native}
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'center',
                      gap: '8px',
                      marginBottom: '12px',
                      flexWrap: 'wrap'
                    }}>
                      {user.hasVideo && (
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '8px',
                          background: '#dcfce7',
                          color: '#166534',
                          fontSize: '12px',
                          fontWeight: '500'
                        }}>
                          Video
                        </span>
                      )}
                      {user.hasAudio && (
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '8px',
                          background: '#dbeafe',
                          color: '#1e40af',
                          fontSize: '12px',
                          fontWeight: '500'
                        }}>
                          Audio
                        </span>
                      )}
                      {user.deviceInfo?.isMobile && (
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '8px',
                          background: '#f3f4f6',
                          color: '#6b7280',
                          fontSize: '12px',
                          fontWeight: '500'
                        }}>
                          Mobile
                        </span>
                      )}
                    </div>
                    <div style={{
                      padding: '6px 12px',
                      borderRadius: '12px',
                      background: user.isOnline ? '#dcfce7' : '#fee2e2',
                      color: user.isOnline ? '#166534' : '#991b1b',
                      fontSize: '12px',
                      fontWeight: '600',
                      display: 'inline-block'
                    }}>
                      {user.isOnline ? 'Online' : 'Offline'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Footer */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: isMobile ? '16px' : '20px',
          marginTop: '32px',
          textAlign: 'center',
          fontSize: '14px',
          color: '#6b7280',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
          border: '1px solid #f3f4f6'
        }}>
          <div style={{ fontWeight: '600', color: '#111827', marginBottom: '4px' }}>
            Language Bridge Pro
          </div>
          <div style={{ lineHeight: '1.5' }}>
            Real-time translation powered by Gemini AI
            <br />
            Premium UI Design Demo
          </div>
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

export default PremiumLanguageBridge;