import assert from 'node:assert/strict';
import {configureJapanesePlaybackAudioSession} from '../src/japanese-speech.mjs';

assert.equal(configureJapanesePlaybackAudioSession({}),false,'Unsupported browsers must continue safely.');

const supported={audioSession:{type:'ambient'}};
assert.equal(configureJapanesePlaybackAudioSession(supported),true);
assert.equal(supported.audioSession.type,'playback','Pronunciation must request media playback before speech.');
supported.audioSession.type='ambient';
assert.equal(configureJapanesePlaybackAudioSession(supported),true,'Consecutive pronunciation requests must reapply playback mode.');
assert.equal(supported.audioSession.type,'playback');

const denied={audioSession:{get type(){return 'ambient';},set type(_value){throw new Error('blocked');}}};
assert.equal(configureJapanesePlaybackAudioSession(denied),false,'A rejected audio-session setting must not prevent Web Speech playback.');

console.log('Japanese speech audio-session tests passed.');
