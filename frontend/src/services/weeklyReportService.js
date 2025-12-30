import { collectionGroup, doc, onSnapshot, orderBy, query, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config.js'

export const saveWeeklyReport = async (userId, reportId, payload) => {
  const reportRef = doc(db, 'users', userId, 'weeklyReports', reportId)
  await setDoc(
    reportRef,
    {
      ...payload,
      userId,
      updatedAt: serverTimestamp(),
      submittedAt: payload.status === 'submitted' ? serverTimestamp() : null,
    },
    { merge: true },
  )
}

export const listenToAllWeeklyReports = (callback) => {
  const reportQuery = query(collectionGroup(db, 'weeklyReports'), orderBy('start', 'desc'))
  return onSnapshot(reportQuery, (snapshot) => {
    const rows = snapshot.docs.map((docSnap) => ({
      ...docSnap.data(),
      userId: docSnap.data().userId ?? docSnap.ref.parent.parent?.id ?? null,
      id: docSnap.id,
    }))
    callback(rows)
  })
}
