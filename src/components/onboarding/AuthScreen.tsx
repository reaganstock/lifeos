import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

interface AuthScreenProps {
  onAuthSuccess?: () => void
}

export function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [currentFeature, setCurrentFeature] = useState(0)

  const features = [
    {
      title: "Organize everything with AI",
      description: "Natural language commands, smart categorization, and intelligent insights help you stay on top of your goals, tasks, and routines.",
      preview: (
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="flex items-center mb-4">
            <div className="w-3 h-3 bg-red-400 rounded-full mr-2"></div>
            <div className="w-3 h-3 bg-yellow-400 rounded-full mr-2"></div>
            <div className="w-3 h-3 bg-green-400 rounded-full"></div>
          </div>
          <div className="space-y-3">
            <div className="h-2 bg-gray-100 rounded w-3/4"></div>
            <div className="h-2 bg-blue-100 rounded w-1/2"></div>
            <div className="h-2 bg-gray-100 rounded w-5/6"></div>
            <div className="mt-4 flex space-x-2">
              <div className="w-6 h-6 bg-green-100 rounded flex items-center justify-center">
                <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="h-2 bg-gray-100 rounded flex-1 self-center"></div>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Voice notes and commands",
      description: "Speak your thoughts and let AI turn them into organized notes, tasks, and calendar events automatically.",
      preview: (
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="flex items-center mb-4">
            <div className="w-3 h-3 bg-red-400 rounded-full mr-2"></div>
            <div className="w-3 h-3 bg-yellow-400 rounded-full mr-2"></div>
            <div className="w-3 h-3 bg-green-400 rounded-full"></div>
          </div>
          <div className="flex items-center justify-center py-8">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <div className="text-center">
            <div className="h-2 bg-blue-100 rounded w-2/3 mx-auto mb-2"></div>
            <div className="h-2 bg-gray-100 rounded w-1/2 mx-auto"></div>
          </div>
        </div>
      )
    },
    {
      title: "Smart scheduling",
      description: "AI automatically finds the best times for your tasks and goals, integrating with your existing calendar seamlessly.",
      preview: (
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="flex items-center mb-4">
            <div className="w-3 h-3 bg-red-400 rounded-full mr-2"></div>
            <div className="w-3 h-3 bg-yellow-400 rounded-full mr-2"></div>
            <div className="w-3 h-3 bg-green-400 rounded-full"></div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-xs">
            {Array.from({ length: 21 }, (_, i) => (
              <div key={i} className={`h-4 rounded ${
                i % 7 === 0 || i % 7 === 6 ? 'bg-gray-100' : 
                i === 9 || i === 10 || i === 16 ? 'bg-blue-100' :
                'bg-gray-50'
              }`}></div>
            ))}
          </div>
          <div className="mt-3 space-y-1">
            <div className="h-1.5 bg-blue-100 rounded w-3/4"></div>
            <div className="h-1.5 bg-green-100 rounded w-1/2"></div>
          </div>
        </div>
      )
    }
  ]

  // Auto-advance features every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFeature((prev) => (prev + 1) % features.length)
    }, 3000)

    return () => clearInterval(interval)
  }, [features.length])

  const handleOAuthSignIn = async (provider: 'github' | 'google') => {
    setLoading(true)
    setError('')

    try {
      console.log(`🔐 Starting ${provider} OAuth flow...`)
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `https://app.lifely.dev/dashboard`,
        },
      })

      if (error) {
        console.error('OAuth error:', error)
        setError(error.message)
        setLoading(false)
      } else {
        console.log(`✅ ${provider} OAuth initialized successfully`)
      }
      // Don't set loading to false here - let the redirect happen
    } catch (err) {
      console.error('OAuth exception:', err)
      setError('An unexpected error occurred. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-blue-100 to-purple-50 flex">
      {/* Main content - Full width on mobile, left side on desktop */}
      <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          {/* Logo */}
          <div className="mb-8">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center mr-3">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
                </svg>
              </div>
              <span className="text-2xl font-bold text-gray-900">Lifely</span>
            </div>
          </div>

          {/* Main heading */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 leading-tight mb-3">
              Your life,
              <br />
              <span className="text-gray-600">organized</span>
            </h1>
            <p className="text-lg text-gray-500 leading-relaxed">
              The only life management app that understands natural language. Organize calendars, tasks, notes, goals, and routines by simply talking to AI.
            </p>
          </div>

          {/* Auth buttons */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => handleOAuthSignIn('google')}
              disabled={loading}
              className="relative w-full flex justify-center items-center px-4 py-3 border border-gray-300 rounded-lg shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:scale-105 hover:shadow-lg"
            >
              <img 
                src="/google.svg" 
                alt="Google" 
                className="w-5 h-5 mr-3"
              />
              Continue with Google
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">OR</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleOAuthSignIn('github')}
              disabled={loading}
              className="relative w-full flex justify-center items-center px-4 py-3 border border-gray-300 rounded-lg shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:scale-105 hover:shadow-lg"
            >
              <img 
                src="/github.svg" 
                alt="GitHub" 
                className="w-5 h-5 mr-3"
              />
              Continue with GitHub
            </button>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {loading && (
            <div className="mt-4 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2"></div>
              <span className="text-sm text-gray-500">Signing you in...</span>
            </div>
          )}

          {/* Feature dots - visible on mobile, hidden on desktop */}
          <div className="mt-8 flex justify-center space-x-2 lg:hidden">
            {features.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentFeature(index)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentFeature ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              />
            ))}
          </div>

          {/* Mobile feature preview */}
          <div className="mt-6 lg:hidden">
            <div className="max-w-xs mx-auto">
              {features[currentFeature].preview}
              <div className="mt-4 text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {features[currentFeature].title}
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {features[currentFeature].description}
                </p>
              </div>
            </div>
          </div>

          {/* Terms */}
          <p className="mt-8 text-xs text-gray-400 leading-relaxed">
            By continuing, you agree to our{' '}
            <a href="https://lifely.dev/terms" target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-gray-900 underline">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="https://lifely.dev/privacy" target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-gray-900 underline">
              Privacy Policy
            </a>
            , and acknowledge our{' '}
            <a href="https://lifely.dev/privacy" target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-gray-900 underline">
              Privacy Notice
            </a>
            .
          </p>
        </div>
      </div>

      {/* Right side - Preview/Demo - Hidden on mobile and tablet, visible on desktop */}
      <div className="hidden xl:block relative flex-1 bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="absolute inset-0 flex items-center justify-center p-12">
          <div className="max-w-md">
            {features[currentFeature].preview}
            
            <div className="mt-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {features[currentFeature].title}
              </h3>
              <p className="text-gray-600 leading-relaxed">
                {features[currentFeature].description}
              </p>
            </div>

            {/* Desktop feature dots */}
            <div className="mt-8 flex justify-center space-x-2">
              {features.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentFeature(index)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === currentFeature ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AuthScreen; 