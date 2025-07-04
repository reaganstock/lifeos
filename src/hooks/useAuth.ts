import { useState, useEffect } from 'react'
import { User, Session, AuthError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  initialized: boolean
}

export interface AuthActions {
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: AuthError | null }>
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signOut: () => Promise<{ error: AuthError | null }>
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>
}

export function useAuth(): AuthState & AuthActions {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    let mounted = true

    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (mounted) {
          if (error) {
            console.error('Error getting session:', error)
          } else {
            setSession(session)
            setUser(session?.user ?? null)
          }
          setLoading(false)
          setInitialized(true)
        }
      } catch (error) {
        console.error('Error in getInitialSession:', error)
        if (mounted) {
          setLoading(false)
          setInitialized(true)
        }
      }
    }

    getInitialSession()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (mounted) {
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
        setInitialized(true)

        // Handle profile creation on sign up only  
        if ((event as string) === 'SIGNED_UP' && session?.user) {
          await createProfile(session.user)
        }
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const createProfile = async (user: User) => {
    try {
      console.log('👤 Creating/updating profile for user:', user.email)
      
      const { error } = await supabase
        .from('profiles')
        .upsert([
          {
            id: user.id,
            email: user.email!,
            full_name: user.user_metadata?.full_name || '',
            avatar_url: user.user_metadata?.avatar_url || null,
            has_completed_onboarding: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ], {
          onConflict: 'id',
          ignoreDuplicates: false
        })

      if (error) {
        console.error('❌ Error creating/updating profile:', error)
      } else {
        console.log('✅ Profile created/updated successfully for:', user.email)
      }
    } catch (error) {
      console.error('❌ Exception in createProfile:', error)
    }
  }

  const signUp = async (email: string, password: string, fullName?: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName || '',
          },
        },
      })

      return { error }
    } catch (error) {
      console.error('Error in signUp:', error)
      return { error: error as AuthError }
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      return { error }
    } catch (error) {
      console.error('Error in signIn:', error)
      return { error: error as AuthError }
    }
  }

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      return { error }
    } catch (error) {
      console.error('Error in signOut:', error)
      return { error: error as AuthError }
    }
  }

  const resetPassword = async (email: string) => {
    try {
      const isDevelopment = process.env.NODE_ENV === 'development'
      const redirectTo = isDevelopment 
        ? `${window.location.origin}/reset-password`
        : `https://app.lifely.dev/reset-password`
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      })

      return { error }
    } catch (error) {
      console.error('Error in resetPassword:', error)
      return { error: error as AuthError }
    }
  }

  return {
    user,
    session,
    loading,
    initialized,
    signUp,
    signIn,
    signOut,
    resetPassword,
  }
}