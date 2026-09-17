/**
 * Ask supported browsers to treat a pronunciation request as media playback.
 * iOS Safari exposes this API as navigator.audioSession; unsupported browsers
 * simply continue with their normal Web Speech behaviour.
 */
export function configureJapanesePlaybackAudioSession(navigatorObject=globalThis.navigator){
  const audioSession=navigatorObject?.audioSession;
  if(!audioSession)return false;
  try{
    audioSession.type='playback';
    return audioSession.type==='playback';
  }catch{
    return false;
  }
}
