import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import { Item } from '../types';
import { GeminiLiveService } from '../services/geminiLiveService';

interface VoiceChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: Item[];
  onAddItem: (item: Item) => void;
  onRefreshItems: () => void;
}

const VoiceChatModal: React.FC<VoiceChatModalProps> = ({
  isOpen,
  onClose,
  items,
  onAddItem,
  onRefreshItems
}) => {
  // Core states
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  // Audio reactive states
  const [audioLevel, setAudioLevel] = useState(0);
  const [voiceIntensity, setVoiceIntensity] = useState(0);
  
  // Refs
  const geminiLiveService = useRef<any>(null);
  const animationFrameRef = useRef<number>();
  const orbRef = useRef<HTMLDivElement>(null);
  const waterfallCanvasRef = useRef<HTMLCanvasElement>(null);
  const itemsRef = useRef(items);
  const onRefreshItemsRef = useRef(onRefreshItems);

  // Update refs when props change
  useEffect(() => {
    itemsRef.current = items;
    onRefreshItemsRef.current = onRefreshItems;
  }, [items, onRefreshItems]);

  // Martian waterfall animation inside orb
  useEffect(() => {
    if (!waterfallCanvasRef.current || !isOpen) return;

    const canvas = waterfallCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 200;
    canvas.width = size;
    canvas.height = size;

    // Waterfall particles
    const particles: Array<{
      x: number;
      y: number;
      speed: number;
      opacity: number;
      size: number;
    }> = [];

    // Create Martian waterfall particles
    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * size,
        y: Math.random() * size,
        speed: Math.random() * 2 + 1,
        opacity: Math.random() * 0.8 + 0.2,
        size: Math.random() * 3 + 1
      });
    }

    let time = 0;
    const animate = () => {
      time += 0.02;
      ctx.clearRect(0, 0, size, size);

      // Create circular mask
      ctx.save();
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.clip();

      // Martian waterfall gradient background
      const gradient = ctx.createLinearGradient(0, 0, 0, size);
      gradient.addColorStop(0, 'rgba(147, 51, 234, 0.1)');
      gradient.addColorStop(0.3, 'rgba(147, 51, 234, 0.3)');
      gradient.addColorStop(0.7, 'rgba(147, 51, 234, 0.5)');
      gradient.addColorStop(1, 'rgba(147, 51, 234, 0.8)');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);

      // Animate waterfall particles
      particles.forEach((particle, index) => {
        // Update position
        particle.y += particle.speed * (1 + voiceIntensity * 0.5);
        
        // Reset particle when it goes off screen
        if (particle.y > size + 10) {
          particle.y = -10;
          particle.x = Math.random() * size;
        }

        // Add voice-reactive horizontal movement
        particle.x += Math.sin(time + index * 0.1) * 0.5 * voiceIntensity;

        // Draw particle with Martian purple glow
        const alpha = particle.opacity * (0.6 + voiceIntensity * 0.4);
        ctx.fillStyle = `rgba(147, 51, 234, ${alpha})`;
        ctx.shadowColor = 'rgba(147, 51, 234, 0.8)';
        ctx.shadowBlur = particle.size * 2;
        
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
        
        // Add trailing effect
        ctx.fillStyle = `rgba(147, 51, 234, ${alpha * 0.3})`;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y - particle.speed * 3, particle.size * 0.7, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.restore();
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isOpen, voiceIntensity]);

  const connectToGemini = useCallback(async () => {
    try {
      setIsConnecting(true);
      setConnectionError(null);
      
      const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('API key not found. Please check your .env file.');
      }

      geminiLiveService.current = new GeminiLiveService();

      // Set up event listeners
      geminiLiveService.current.onTranscript((transcript: any) => {
        if (transcript.text && transcript.text.trim()) {
          if (!transcript.isUser) {
            setIsSpeaking(true);
            setTimeout(() => setIsSpeaking(false), 2000);
          }
        }
      });

      geminiLiveService.current.onListeningState((isActive: boolean) => {
        setIsListening(isActive);
      });

      geminiLiveService.current.onFunctionCall(async (functionCall: any) => {
        onRefreshItemsRef.current();
      });

      const config = {
        model: 'gemini-2.0-flash-live-001',
        apiKey,
        items: itemsRef.current,
        categories: [],
        onRefreshItems: onRefreshItemsRef.current
      };

      await geminiLiveService.current.connect(config);
      setIsConnected(true);
      setIsConnecting(false);
      
      // Auto-start listening
      setTimeout(async () => {
        if (geminiLiveService.current) {
          try {
            await geminiLiveService.current.startListening();
          } catch (error) {
            console.error('Auto-start listening failed:', error);
          }
        }
      }, 1000);
      
    } catch (error) {
      console.error('Connection failed:', error);
      setConnectionError(error instanceof Error ? error.message : 'Connection failed');
      setIsConnecting(false);
      setIsConnected(false);
    }
  }, []);

  // Initialize service when modal opens
  useEffect(() => {
    if (isOpen && !geminiLiveService.current && !isConnecting) {
      connectToGemini();
    }
    
    return () => {
      if (geminiLiveService.current) {
        geminiLiveService.current.disconnect();
        geminiLiveService.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isOpen]);

  // Voice-reactive animation - ChatGPT style
  useEffect(() => {
    if (isListening || isSpeaking) {
      const animate = () => {
        // Simulate voice intensity with realistic patterns
        const baseIntensity = isListening || isSpeaking ? 0.3 : 0;
        const randomVariation = Math.random() * 0.7;
        const smoothVariation = Math.sin(Date.now() * 0.01) * 0.2;
        
        setVoiceIntensity(baseIntensity + randomVariation + smoothVariation);
        setAudioLevel(prev => {
          const target = (isListening || isSpeaking) ? Math.random() * 100 : 0;
          return prev + (target - prev) * 0.15;
        });
        
        animationFrameRef.current = requestAnimationFrame(animate);
      };
      animate();
    } else {
      setVoiceIntensity(0);
      setAudioLevel(0);
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isListening, isSpeaking]);

  const toggleListening = async () => {
    if (!geminiLiveService.current || !isConnected) {
      if (!isConnected && !isConnecting) {
        connectToGemini();
      }
      return;
    }

    try {
      if (isListening) {
        await geminiLiveService.current.stopListening();
      } else {
        await geminiLiveService.current.startListening();
      }
    } catch (error) {
      console.error('Error toggling listening:', error);
    }
  };

  const handleClose = () => {
    if (geminiLiveService.current) {
      geminiLiveService.current.disconnect();
      geminiLiveService.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
    setIsListening(false);
    setIsSpeaking(false);
    onClose();
  };

  if (!isOpen) return null;

  // Calculate orb scale based on voice activity - ChatGPT style protrusion
  const getOrbScale = () => {
    if (isListening || isSpeaking) {
      return 1 + (voiceIntensity * 0.3); // Protrudes outward when speaking/listening
    }
    return 1; // Centered when idle
  };

  const getOrbOpacity = () => {
    if (isConnecting) return 0.6;
    if (!isConnected) return 0.3;
    if (isListening || isSpeaking) return 0.9 + (voiceIntensity * 0.1);
    return 0.7;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black">
      
      {/* Tesla/Apple minimalist close button */}
      <button
        onClick={handleClose}
        className="absolute top-6 right-6 z-10 w-8 h-8 rounded-full bg-white/10 backdrop-blur-sm text-white/60 hover:text-white hover:bg-white/20 transition-all duration-200 flex items-center justify-center"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Main interface - centered orb */}
      <div className="absolute inset-0 flex items-center justify-center">
        
        {/* The Orb - ChatGPT style with voice reactivity */}
        <div 
          ref={orbRef}
          onClick={toggleListening}
          className="relative cursor-pointer transition-transform duration-200 ease-out"
          style={{
            transform: `scale(${getOrbScale()})`,
          }}
        >
          
          {/* Main orb container */}
          <div 
            className="relative w-48 h-48 rounded-full transition-all duration-300 ease-out"
            style={{
              background: `radial-gradient(circle at 30% 30%, rgba(147, 51, 234, ${getOrbOpacity()}) 0%, rgba(147, 51, 234, ${getOrbOpacity() * 0.7}) 50%, rgba(147, 51, 234, ${getOrbOpacity() * 0.3}) 100%)`,
              boxShadow: `
                0 0 60px rgba(147, 51, 234, ${getOrbOpacity() * 0.6}),
                inset 0 0 60px rgba(255, 255, 255, 0.1)
              `,
              border: '1px solid rgba(147, 51, 234, 0.3)',
            }}
          >
            
            {/* Martian waterfall interior */}
            <canvas
              ref={waterfallCanvasRef}
              className="absolute inset-0 rounded-full"
              style={{
                mixBlendMode: 'screen',
                opacity: 0.8,
              }}
            />
            
            {/* Glass reflection effect */}
            <div 
              className="absolute inset-2 rounded-full"
              style={{
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.05) 50%, transparent 100%)',
                backdropFilter: 'blur(10px)'
              }}
            />
            
            {/* Voice activity ring */}
            {(isListening || isSpeaking) && (
              <div 
                className="absolute inset-0 rounded-full border-2 transition-all duration-200"
                style={{
                  borderColor: `rgba(147, 51, 234, ${voiceIntensity * 0.8})`,
                  transform: `scale(${1.1 + voiceIntensity * 0.2})`,
                  boxShadow: `0 0 30px rgba(147, 51, 234, ${voiceIntensity * 0.5})`
                }}
              />
            )}
          </div>
        </div>

        {/* Minimal status text - Tesla/Apple style */}
        <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2">
          <div className="text-white/50 text-sm font-light tracking-wide">
            {isConnecting && "Connecting..."}
            {!isConnected && !isConnecting && "Tap to connect"}
            {isConnected && !isListening && !isSpeaking && "Tap to speak"}
            {isListening && "Listening"}
            {isSpeaking && "Speaking"}
          </div>
        </div>

        {/* Error state */}
        {connectionError && (
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 max-w-sm">
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2 text-red-300 text-sm text-center">
              {connectionError}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VoiceChatModal; 