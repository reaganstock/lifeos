import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, Play, Pause, RotateCcw, ArrowRight, CheckCircle } from 'lucide-react';
import { useAuthContext } from '../AuthProvider';
import { setUserData } from '../../utils/userStorage';

const ONBOARDING_QUESTIONS = [
  {
    id: 1,
    question: "What brought you here? What's going on in your life that made you look for a better way to stay organized?",
    focus: "Understanding your motivation and current pain points"
  },
  {
    id: 2,
    question: "What's your biggest challenge with staying on top of everything? Where do things usually fall through the cracks?",
    focus: "Identifying workflow gaps and problem areas"
  },
  {
    id: 3,
    question: "Walk me through what a typical day looks like for you right now.",
    focus: "Learning your current routine and schedule patterns"
  },
  {
    id: 4,
    question: "What would need to change for you to feel like you're actually in control of your schedule and tasks?",
    focus: "Defining your ideal productivity state"
  },
  {
    id: 5,
    question: "What are you working toward in the next few months that you don't want to lose track of?",
    focus: "Capturing important goals and projects"
  }
];

export default function VoiceMemoOnboarding() {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [recordingPhase, setRecordingPhase] = useState<'intro' | 'recording' | 'review'>('intro');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const playRecordingStartSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(1200, audioContext.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (error) {
      console.log('Audio context not available');
    }
  };

  const playRecordingStopSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(1200, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (error) {
      console.log('Audio context not available');
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        } 
      });
      
      playRecordingStartSound();
      
      audioChunksRef.current = [];
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setIsComplete(true);
        setRecordingPhase('review');
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorderRef.current.start(100);
      setIsRecording(true);
      setRecordingTime(0);
      setRecordingPhase('recording');
      
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Could not access microphone. Please check permissions and try again.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    
    playRecordingStopSound();
    
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const playRecording = () => {
    if (audioBlob) {
      const audio = new Audio(URL.createObjectURL(audioBlob));
      audioRef.current = audio;
      audio.play();
      setIsPlaying(true);
      
      audio.onended = () => {
        setIsPlaying(false);
        audioRef.current = null;
      };
    }
  };

  const pausePlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      audioRef.current = null;
    }
  };

  const deleteRecording = () => {
    setAudioBlob(null);
    setRecordingTime(0);
    setIsComplete(false);
    setRecordingPhase('intro');
  };

  const continueToDocuments = async () => {
    if (!user?.id) {
      console.error('❌ No user ID found - cannot save voice memo data');
      return;
    }
    
    if (audioBlob) {
      const audioData = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(audioBlob);
      });
      
      const recordingData = {
        audioData,
        duration: recordingTime,
        questions: ONBOARDING_QUESTIONS,
        timestamp: new Date().toISOString(),
        type: 'voice',
        quality: 'high'
      };
      
      // CRITICAL FIX: Save to user-specific localStorage instead of global
      setUserData(user.id, 'lifely_voice_memo_recording', recordingData);
      console.log('✅ Voice memo recording saved to user-specific storage for user:', user.email);
    }
    
    // CRITICAL FIX: Save onboarding type to user-specific localStorage
    setUserData(user.id, 'lifely_onboarding_type', 'voice_memo');
    setUserData(user.id, 'lifely_onboarding_progress', '/onboarding/documents');
    
    console.log('✅ Voice memo onboarding type set to "voice_memo" for user:', user.email);
    navigate('/onboarding/documents');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-lifeos-50 via-lifeos-100 to-lifeos-200 font-sans overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-20 h-20 bg-gradient-to-br from-lifeos-primary/20 to-lifeos-secondary/20 rounded-full blur-xl animate-float" style={{animationDelay: '0s'}}></div>
        <div className="absolute top-40 right-20 w-16 h-16 bg-gradient-to-br from-lifeos-secondary/30 to-purple-400/30 rounded-lg blur-lg animate-pulse" style={{animationDelay: '1s', animationDuration: '6s'}}></div>
        <div className="absolute bottom-32 left-1/4 w-12 h-12 bg-gradient-to-br from-lifeos-primary/25 to-blue-400/25 rounded-full blur-md animate-ping" style={{animationDelay: '2s', animationDuration: '8s'}}></div>
        <div className="absolute top-1/3 right-1/3 w-24 h-24 bg-gradient-to-br from-purple-400/20 to-lifeos-secondary/20 rounded-xl blur-lg animate-float-delayed"></div>
        <div className="absolute bottom-20 right-10 w-14 h-14 bg-gradient-to-br from-lifeos-primary/30 to-pink-400/30 rounded-full blur-sm animate-bounce" style={{animationDelay: '4s', animationDuration: '7s'}}></div>
        
        {/* Large Animated Gradient Orbs */}
        <div className="absolute top-1/4 left-1/2 transform -translate-x-1/2 w-96 h-96 bg-gradient-radial from-lifeos-primary/10 via-lifeos-secondary/5 to-transparent rounded-full blur-3xl animate-spin" style={{animationDuration: '20s'}}></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gradient-radial from-lifeos-secondary/15 via-purple-400/8 to-transparent rounded-full blur-2xl animate-pulse" style={{animationDuration: '15s'}}></div>
      </div>

      <div className="relative z-10 h-screen flex">
        {/* Left Side - Questions Panel */}
        <div className="w-1/2 bg-white/60 backdrop-blur-sm border-r border-white/20 flex flex-col">
          {/* Header */}
          <div className="p-8 border-b border-white/20">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 bg-gradient-to-br from-lifeos-primary to-lifeos-secondary rounded-2xl flex items-center justify-center shadow-xl transition-all duration-300 hover:scale-110 hover:rotate-6">
                <Mic className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-lifeos-dark mb-1 tracking-tight">Voice Setup</h1>
                <p className="text-lifeos-gray-400 text-lg">Tell us about your workflow so we can build your dashboard</p>
              </div>
            </div>
            
            {/* Progress indicator */}
            <div className="w-full bg-white/30 rounded-full h-2 mb-2">
              <div 
                className="bg-gradient-to-r from-lifeos-primary to-lifeos-secondary h-2 rounded-full transition-all duration-500"
                style={{ width: '100%' }}
              />
            </div>
            <p className="text-lifeos-gray-400 text-sm">
              Step 4 of 4 - Dashboard Personalization
            </p>
          </div>

          {/* Questions List */}
          <div className="flex-1 p-8 overflow-y-auto">
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-lifeos-primary/10 to-lifeos-secondary/10 border border-lifeos-primary/20 rounded-2xl p-6 group hover:scale-105 hover:shadow-xl transition-all duration-300">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-lifeos-primary to-lifeos-secondary rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 mt-1">
                    ⚡
                  </div>
                  <div>
                    <h3 className="text-lifeos-dark font-semibold mb-2 group-hover:text-lifeos-primary transition-colors duration-300">Quick & Personal</h3>
                    <p className="text-lifeos-gray-400 text-sm leading-relaxed group-hover:text-lifeos-dark transition-colors duration-300">
                      <strong>How it works:</strong> Press record and answer all 5 questions in one continuous voice memo. 
                      Speak naturally and take your time - our AI will analyze your responses to create a personalized 
                      life management system with custom categories, smart scheduling, and tailored AI assistance.
                    </p>
                  </div>
                </div>
              </div>

              {ONBOARDING_QUESTIONS.map((item, index) => (
                <div 
                  key={item.id}
                  className="bg-white/60 backdrop-blur-sm rounded-2xl border border-white/20 shadow-sm hover:shadow-xl hover:scale-105 transition-all duration-300 group cursor-pointer"
                >
                  <div className="p-6">
                    <div className="flex gap-4">
                      <div className="w-8 h-8 bg-gradient-to-r from-lifeos-primary to-lifeos-secondary rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                        {item.id}
                      </div>
                      <div className="flex-1">
                        <p className="text-lifeos-dark font-medium leading-relaxed mb-2 group-hover:text-lifeos-primary transition-colors duration-300">
                          {item.question}
                        </p>
                        <p className="text-lifeos-gray-400 text-xs uppercase tracking-wide font-medium opacity-60 group-hover:text-lifeos-secondary group-hover:opacity-100 transition-all duration-300">
                          {item.focus}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <div className="bg-white/40 backdrop-blur-sm rounded-2xl border border-white/20 p-6">
                <h3 className="text-lifeos-dark font-semibold mb-3">What happens next:</h3>
                <ul className="text-lifeos-gray-400 text-sm space-y-2">
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-lifeos-primary rounded-full"></div>
                    AI analyzes your workflow patterns
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-lifeos-secondary rounded-full"></div>
                    Creates personalized categories & templates
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-lifeos-primary rounded-full"></div>
                    Sets up your dashboard for immediate use
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Recording Interface */}
        <div className="w-1/2 flex items-center justify-center p-12 relative">
          <div className="relative z-10 w-full max-w-lg text-center">
            {recordingPhase === 'intro' && (
              <div className="space-y-12">
                <div className="space-y-6">
                  <h2 className="text-4xl md:text-5xl font-bold text-lifeos-dark mb-4 leading-tight tracking-tight">
                    Ready when{" "}
                    <span className="bg-gradient-to-r from-lifeos-primary to-lifeos-secondary bg-clip-text text-transparent">
                      you are
                    </span>
                  </h2>
                  <div className="text-lg text-lifeos-gray-400 leading-relaxed max-w-lg mx-auto space-y-3">
                    <p>💬 <strong>Talk naturally</strong> - like you're explaining your day to a friend</p>
                    <p>⏱️ <strong>Take your time</strong> - pause, think, and speak at your own pace</p>
                    <p>📝 <strong>Answer all 5 questions</strong> in one recording for best results</p>
                  </div>
                </div>

                {/* Exact Apple/Tesla Style Recording Button */}
                <div className="relative">
                  <button
                    onClick={startRecording}
                    className="group relative w-32 h-32 bg-white rounded-full shadow-2xl border-8 border-gray-300 hover:border-gray-400 transition-all duration-300 hover:shadow-3xl hover:scale-105 active:scale-95"
                  >
                    <div className="absolute inset-4 bg-red-500 rounded-full flex items-center justify-center group-hover:bg-red-400 transition-colors duration-300 shadow-inner">
                    </div>
                  </button>
                  
                  <p className="text-lifeos-dark font-medium mt-8 text-lg">Tap to start</p>
                </div>
              </div>
            )}

            {recordingPhase === 'recording' && (
              <div className="space-y-12">
                <div className="space-y-6">
                  <h2 className="text-4xl font-bold text-lifeos-dark leading-tight">
                    Listening...
                  </h2>
                  <p className="text-xl text-lifeos-gray-400 leading-relaxed">
                    Answer the questions naturally
                  </p>
                </div>

                <div className="relative">
                  <button
                    onClick={stopRecording}
                    className="relative w-32 h-32 bg-white rounded-full shadow-2xl border-8 border-red-400 transition-all duration-300"
                  >
                    <div className="absolute inset-4 bg-red-500 rounded-full flex items-center justify-center animate-pulse shadow-inner">
                    </div>
                    
                    {/* Pulsing rings */}
                    <div className="absolute inset-0 rounded-full border-4 border-red-300 animate-ping opacity-40" />
                    <div className="absolute inset-2 rounded-full border-4 border-red-400 animate-ping opacity-20" style={{animationDelay: '0.5s'}} />
                  </button>
                </div>
                
                <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-sm border border-white/20 px-8 py-4 max-w-xs mx-auto">
                  <div className="text-3xl font-mono font-light text-red-500 mb-1">
                    {formatTime(recordingTime)}
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-lifeos-gray-400 text-sm font-medium">Recording</span>
                  </div>
                </div>
              </div>
            )}

            {recordingPhase === 'review' && isComplete && (
              <div className="space-y-8">
                <div className="text-center space-y-4">
                  <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center mx-auto shadow-2xl">
                    <CheckCircle className="w-10 h-10 text-white" />
                  </div>
                  <h2 className="text-4xl font-bold text-lifeos-dark leading-tight">Perfect!</h2>
                  <p className="text-xl text-lifeos-gray-400">Recorded {formatTime(recordingTime)} of insights</p>
                </div>

                <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-sm border border-white/20 p-8 space-y-6">
                  <h3 className="text-lifeos-dark font-semibold text-center text-lg">Review recording</h3>
                  
                  <div className="flex justify-center gap-4">
                    <button
                      onClick={isPlaying ? pausePlayback : playRecording}
                      className="w-16 h-16 bg-white rounded-full shadow-lg border-2 border-gray-200 hover:border-lifeos-primary/50 flex items-center justify-center transition-all duration-200 hover:scale-105 hover:shadow-xl group"
                    >
                      {isPlaying ? (
                        <Pause className="w-6 h-6 text-lifeos-primary" />
                      ) : (
                        <Play className="w-6 h-6 text-lifeos-primary ml-0.5" />
                      )}
                    </button>
                    
                    <button
                      onClick={deleteRecording}
                      className="w-16 h-16 bg-white rounded-full shadow-lg border-2 border-gray-200 hover:border-gray-300 flex items-center justify-center transition-all duration-200 hover:scale-105 hover:shadow-xl group"
                    >
                      <RotateCcw className="w-6 h-6 text-lifeos-gray-400 group-hover:text-lifeos-dark" />
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <button
                    onClick={continueToDocuments}
                    className="w-full bg-gradient-to-r from-lifeos-primary to-lifeos-secondary hover:from-lifeos-primary/90 hover:to-lifeos-secondary/90 text-white py-4 px-8 rounded-xl font-semibold text-lg transition-all duration-300 hover:scale-105 shadow-xl hover:shadow-2xl hover:shadow-lifeos-primary/25 flex items-center justify-center gap-3"
                  >
                    Build My Dashboard
                    <ArrowRight className="w-5 h-5" />
                  </button>
                  
                  <p className="text-lifeos-gray-400 text-sm text-center">
                    We'll create your personalized workspace
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}