import { collection, doc, getDoc, getDocs, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../firebase/config.js'

export const getUserProfile = async (userId) => {
  const userDoc = await getDoc(doc(db, 'users', userId))
  return userDoc.exists() ? userDoc.data() : null
}

export const listenToEmployees = (callback) => {
  const usersQuery = query(collection(db, 'users'), where('role', '==', 'employee'))
  return onSnapshot(usersQuery, (snapshot) => {
    callback(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })))
  })
}

export const listenToAdmins = (callback) => {
  const usersQuery = query(collection(db, 'users'), where('role', '==', 'admin'))
  return onSnapshot(usersQuery, (snapshot) => {
    callback(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })))
  })
}

export const fetchAllUsers = async () => {
  const snapshot = await getDocs(collection(db, 'users'))
  return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
}
