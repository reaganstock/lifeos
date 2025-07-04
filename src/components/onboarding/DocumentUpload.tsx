import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, File, Trash2, Plus, ArrowRight, Youtube, Copy, X } from 'lucide-react';

export default function DocumentUpload() {
  const navigate = useNavigate();
  const [uploadedFiles, setUploadedFiles] = useState<Array<{id: string, name: string, content: string, type: 'file' | 'text' | 'youtube'}>>([]);
  const [textInput, setTextInput] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [showTextInput, setShowTextInput] = useState(false);
  const [showYoutubeInput, setShowYoutubeInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      if (file.type === 'text/plain' || file.type === 'application/pdf' || file.name.endsWith('.md')) {
        const content = await file.text();
        const newFile = {
          id: Date.now().toString() + Math.random(),
          name: file.name,
          content,
          type: 'file' as const
        };
        setUploadedFiles(prev => [...prev, newFile]);
      }
    }
    
    // Reset the input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleTextAdd = () => {
    if (textInput.trim()) {
      const newText = {
        id: Date.now().toString(),
        name: `Text Note ${uploadedFiles.filter(f => f.type === 'text').length + 1}`,
        content: textInput.trim(),
        type: 'text' as const
      };
      setUploadedFiles(prev => [...prev, newText]);
      setTextInput('');
      setShowTextInput(false);
    }
  };

  const handleYoutubeAdd = () => {
    if (youtubeUrl.trim()) {
      // Extract video ID and create placeholder (in real implementation, would fetch transcript)
      const videoId = youtubeUrl.includes('watch?v=') 
        ? youtubeUrl.split('watch?v=')[1]?.split('&')[0]
        : youtubeUrl.split('youtu.be/')[1]?.split('?')[0];
      
      const newYoutube = {
        id: Date.now().toString(),
        name: `YouTube Video ${uploadedFiles.filter(f => f.type === 'youtube').length + 1}`,
        content: youtubeUrl.trim(),
        type: 'youtube' as const
      };
      setUploadedFiles(prev => [...prev, newYoutube]);
      setYoutubeUrl('');
      setShowYoutubeInput(false);
    }
  };

  const removeFile = (id: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleContinue = () => {
    // Save uploaded content to localStorage
    if (uploadedFiles.length > 0) {
      localStorage.setItem('lifely_onboarding_documents', JSON.stringify(uploadedFiles));
    }
    
    // Navigate to integrations
    localStorage.setItem('lifely_onboarding_progress', '/onboarding/integrations');
    navigate('/onboarding/integrations');
  };

  const handleSkip = () => {
    localStorage.setItem('lifely_onboarding_progress', '/onboarding/integrations');
    navigate('/onboarding/integrations');
  };

  const getFileIcon = (type: string) => {
    if (type === 'youtube') return <Youtube className="w-5 h-5" />;
    if (type === 'text') return <Copy className="w-5 h-5" />;
    return <FileText className="w-5 h-5" />;
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
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-8">
        <div className="w-full max-w-4xl">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="w-20 h-20 bg-gradient-to-br from-lifeos-primary to-lifeos-secondary rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl transition-all duration-300 hover:scale-110 hover:rotate-6">
              <Upload className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-lifeos-dark mb-4 tracking-tight">
              Add Context for Your AI Agent
            </h1>
            <p className="text-lifeos-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
              Upload documents, paste text, or add YouTube videos to help our AI build a more personalized dashboard for you.
            </p>
          </div>

          {/* Upload Options */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {/* File Upload */}
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-white/20 hover:border-lifeos-primary/30 hover:shadow-xl hover:scale-105 transition-all duration-300 group">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-lifeos-primary/20 to-lifeos-secondary/20 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                  <File className="w-8 h-8 text-lifeos-primary" />
                </div>
                <h3 className="text-lifeos-dark font-semibold mb-2">Upload Files</h3>
                <p className="text-lifeos-gray-400 text-sm mb-4">PDF, TXT, or Markdown files</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full bg-gradient-to-r from-lifeos-primary to-lifeos-secondary hover:from-lifeos-primary/90 hover:to-lifeos-secondary/90 text-white py-3 px-4 rounded-xl font-medium transition-all duration-200 hover:scale-105 shadow-lg hover:shadow-xl"
                >
                  Choose Files
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".txt,.pdf,.md"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            </div>

            {/* Text Input */}
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-white/20 hover:border-green-400/30 hover:shadow-xl hover:scale-105 transition-all duration-300 group">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-green-400/20 to-green-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Copy className="w-8 h-8 text-green-500" />
                </div>
                <h3 className="text-lifeos-dark font-semibold mb-2">Paste Text</h3>
                <p className="text-lifeos-gray-400 text-sm mb-4">Goals, notes, or any context</p>
                <button
                  onClick={() => setShowTextInput(true)}
                  className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-500/90 hover:to-green-600/90 text-white py-3 px-4 rounded-xl font-medium transition-all duration-200 hover:scale-105 shadow-lg hover:shadow-xl"
                >
                  Add Text
                </button>
              </div>
            </div>

            {/* YouTube */}
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-white/20 hover:border-red-400/30 hover:shadow-xl hover:scale-105 transition-all duration-300 group">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-red-400/20 to-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Youtube className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-lifeos-dark font-semibold mb-2">YouTube Video</h3>
                <p className="text-lifeos-gray-400 text-sm mb-4">We'll extract the transcript</p>
                <button
                  onClick={() => setShowYoutubeInput(true)}
                  className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-500/90 hover:to-red-600/90 text-white py-3 px-4 rounded-xl font-medium transition-all duration-200 hover:scale-105 shadow-lg hover:shadow-xl"
                >
                  Add Video
                </button>
              </div>
            </div>
          </div>

          {/* Uploaded Files Display */}
          {uploadedFiles.length > 0 && (
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-white/20 mb-8 shadow-lg">
              <h3 className="text-lifeos-dark font-semibold mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-lifeos-primary" />
                Added Content ({uploadedFiles.length})
              </h3>
              <div className="space-y-3">
                {uploadedFiles.map((file) => (
                  <div key={file.id} className="flex items-center justify-between bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-white/20 hover:shadow-md transition-all duration-200">
                    <div className="flex items-center gap-3">
                      <div className="text-lifeos-primary">
                        {getFileIcon(file.type)}
                      </div>
                      <div>
                        <p className="text-lifeos-dark font-medium">{file.name}</p>
                        <p className="text-lifeos-gray-400 text-sm">
                          {file.type === 'youtube' ? 'YouTube Video' : 
                           file.type === 'text' ? `${file.content.length} characters` :
                           'Document'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFile(file.id)}
                      className="text-lifeos-gray-400 hover:text-red-500 transition-colors duration-200 p-2 rounded-lg hover:bg-red-50"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Text Input Modal */}
          {showTextInput && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white/95 backdrop-blur-sm rounded-3xl p-8 w-full max-w-2xl shadow-2xl border border-white/20">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold text-lifeos-dark">Add Text Content</h3>
                  <button
                    onClick={() => setShowTextInput(false)}
                    className="text-lifeos-gray-400 hover:text-lifeos-dark transition-colors duration-200 p-2 rounded-lg hover:bg-lifeos-gray-100"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Paste your goals, notes, or any context that would help personalize your dashboard..."
                  className="w-full h-40 p-4 border border-white/20 bg-white/60 backdrop-blur-sm rounded-xl resize-none focus:ring-2 focus:ring-lifeos-primary/50 focus:border-transparent text-lifeos-dark placeholder-lifeos-gray-400 transition-all duration-200"
                />
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={handleTextAdd}
                    disabled={!textInput.trim()}
                    className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-500/90 hover:to-green-600/90 disabled:from-gray-300 disabled:to-gray-300 text-white py-3 px-4 rounded-xl font-medium transition-all duration-200 hover:scale-105 disabled:scale-100 shadow-lg hover:shadow-xl"
                  >
                    Add Content
                  </button>
                  <button
                    onClick={() => setShowTextInput(false)}
                    className="px-6 py-3 bg-white/60 backdrop-blur-sm hover:bg-white/80 text-lifeos-dark border border-white/20 rounded-xl font-medium transition-all duration-200 hover:scale-105"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* YouTube Input Modal */}
          {showYoutubeInput && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white/95 backdrop-blur-sm rounded-3xl p-8 w-full max-w-2xl shadow-2xl border border-white/20">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold text-lifeos-dark">Add YouTube Video</h3>
                  <button
                    onClick={() => setShowYoutubeInput(false)}
                    className="text-lifeos-gray-400 hover:text-lifeos-dark transition-colors duration-200 p-2 rounded-lg hover:bg-lifeos-gray-100"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <input
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full p-4 border border-white/20 bg-white/60 backdrop-blur-sm rounded-xl focus:ring-2 focus:ring-red-500/50 focus:border-transparent text-lifeos-dark placeholder-lifeos-gray-400 transition-all duration-200"
                />
                <p className="text-lifeos-gray-400 text-sm mt-3">
                  We'll extract the transcript to understand the content and help personalize your experience.
                </p>
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={handleYoutubeAdd}
                    disabled={!youtubeUrl.trim()}
                    className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-500/90 hover:to-red-600/90 disabled:from-gray-300 disabled:to-gray-300 text-white py-3 px-4 rounded-xl font-medium transition-all duration-200 hover:scale-105 disabled:scale-100 shadow-lg hover:shadow-xl"
                  >
                    Add Video
                  </button>
                  <button
                    onClick={() => setShowYoutubeInput(false)}
                    className="px-6 py-3 bg-white/60 backdrop-blur-sm hover:bg-white/80 text-lifeos-dark border border-white/20 rounded-xl font-medium transition-all duration-200 hover:scale-105"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Continue/Skip Buttons */}
          <div className="flex gap-4 justify-center">
            <button
              onClick={handleSkip}
              className="px-8 py-4 bg-white/60 backdrop-blur-sm hover:bg-white/80 text-lifeos-dark rounded-2xl font-semibold transition-all duration-200 border border-white/20 hover:scale-105 shadow-lg hover:shadow-xl"
            >
              Skip for Now
            </button>
            {uploadedFiles.length > 0 ? (
              <button
                onClick={handleContinue}
                className="bg-gradient-to-r from-lifeos-primary to-lifeos-secondary hover:from-lifeos-primary/90 hover:to-lifeos-secondary/90 text-white px-12 py-4 rounded-2xl font-semibold transition-all duration-200 hover:scale-105 flex items-center gap-3 shadow-xl hover:shadow-2xl hover:shadow-lifeos-primary/25"
              >
                Continue Setup
                <ArrowRight className="w-6 h-6" />
              </button>
            ) : (
              <button
                disabled
                className="bg-gray-300 text-gray-500 px-12 py-4 rounded-2xl font-semibold cursor-not-allowed flex items-center gap-3 shadow-lg"
              >
                Continue Setup
                <ArrowRight className="w-6 h-6" />
              </button>
            )}
          </div>

          {/* Helper Text */}
          <div className="text-center mt-8">
            <p className="text-lifeos-gray-400 text-sm leading-relaxed">
              This helps our AI agent understand your context and build a more personalized dashboard.
              <br />
              You can always add more content later in the app.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}