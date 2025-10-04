import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import PropTypes from 'prop-types'
import { auth, db } from '../firebase/config.js'

const AuthContext = createContext({
  user: null,
  profile: null,
  loading: true,
  signOutUser: async () => {},
})

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true)
      setError(null)
      try {
        if (!firebaseUser) {
          setUser(null)
          setProfile(null)
          setLoading(false)
          return
        }

        const userDocRef = doc(db, 'users', firebaseUser.uid)
        const userDocSnap = await getDoc(userDocRef)

        if (!userDocSnap.exists()) {
          setError('ユーザープロファイルが見つかりません。管理者に連絡してください。')
          setUser(firebaseUser)
          setProfile(null)
        } else {
          setUser(firebaseUser)
          setProfile(userDocSnap.data())
        }
      } catch (fetchError) {
        console.error('Failed to load user profile', fetchError)
        setError('プロファイル情報の取得に失敗しました。通信状況を確認してください。')
        setUser(firebaseUser ?? null)
        setProfile(null)
      } finally {
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [])

  const signOutUser = async () => {
    await signOut(auth)
  }

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      error,
      signOutUser,
    }),
    [user, profile, loading, error],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
}

export const useAuth = () => useContext(AuthContext)

export default AuthContext
