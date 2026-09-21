import {firebaseConfig} from './firebase-config.mjs';

const SDK='https://www.gstatic.com/firebasejs/10.14.1';

export async function createAuthService(onUser){
  const [appSdk,authSdk,firestoreSdk]=await Promise.all([
    import(`${SDK}/firebase-app.js`),import(`${SDK}/firebase-auth.js`),import(`${SDK}/firebase-firestore.js`)
  ]);
  const app=appSdk.getApps().length?appSdk.getApp():appSdk.initializeApp(firebaseConfig);
  const auth=authSdk.getAuth(app),db=firestoreSdk.getFirestore(app);
  await authSdk.setPersistence(auth,authSdk.browserLocalPersistence);
  authSdk.onAuthStateChanged(auth,onUser);
  return {
    auth,db,firestoreSdk,
    async signIn(){
      const provider=new authSdk.GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});
      try{return await authSdk.signInWithPopup(auth,provider);}
      catch(error){
        if(['auth/popup-closed-by-user','auth/cancelled-popup-request'].includes(error.code))throw new Error('已取消 Google 登入。');
        if(error.code==='auth/popup-blocked')throw new Error('登入視窗被封鎖，請允許彈出視窗後重試。');
        throw new Error('Google 登入失敗，請稍後再試。');
      }
    },
    signOut:()=>authSdk.signOut(auth)
  };
}
