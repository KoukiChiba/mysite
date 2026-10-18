"""音色・拍子・奏法の異なる休憩用オリジナル3曲。依存はnumpyのみ。"""
from pathlib import Path
import wave
import numpy as np

RATE = 24000
DURATION = 100
DEST = Path(__file__).resolve().parents[1] / 'audio' / 'break'


def frequency(midi):
    return 440 * 2 ** ((midi - 69) / 12)


def voice(midi, seconds, instrument, rng):
    t = np.arange(int(seconds * RATE)) / RATE
    f = frequency(midi)
    if instrument == 'piano':
        # 打鍵の立ち上がりと、弦ごとに少しずれる倍音・減衰。
        sound = np.zeros(len(t))
        for h in range(1, 13):
            partial = f * h * np.sqrt(1 + .00012 * h*h)
            if partial > RATE * .45:
                break
            sound += (1 / h**1.6) * np.sin(2*np.pi*partial*t) * np.exp(-t*(.48+.17*h))
        sound *= 1 - np.exp(-t/.003)
        sound += rng.normal(0, .012, len(t)) * np.exp(-t/ .009)
    elif instrument == 'guitar':
        # 弦を弾く位置による倍音の節、速い高域減衰、胴の短い共鳴。
        sound = np.zeros(len(t))
        for h in range(1, 27):
            if f*h > RATE * .45:
                break
            amplitude = np.sin(np.pi*h*.19) / h
            sound += amplitude*np.cos(2*np.pi*f*h*t)*np.exp(-t*(.65+.20*h))
        sound *= 1 - np.exp(-t/.0015)
        sound += .10*np.sin(2*np.pi*185*t)*np.exp(-t/.045)
        sound += rng.normal(0,.026,len(t))*np.exp(-t/.012)
    elif instrument == 'pad':
        # 打鍵音のない長いアタック、広いステレオに配置する持続和音。
        sound = sum(np.sin(2*np.pi*f*ratio*t + .12*np.sin(2*np.pi*.09*t)) * weight
                    for ratio,weight in [(1, .5),(1.0018,.25),(.9982,.25),(2,.08)])
        sound *= np.sin(np.pi*np.minimum(t/seconds,1))**1.7
    else:
        # アンビエント用の息の長いフルート旋律。
        sound = np.sin(2*np.pi*f*t + .035*np.sin(2*np.pi*4.3*t))
        sound += .08*np.sin(2*np.pi*2*f*t)
        sound *= (1-np.exp(-t/.65))*np.exp(-t/2.7)
    sound *= np.minimum(1, (seconds-t)/.16)
    return sound


class Piece:
    def __init__(self, seed):
        self.rng = np.random.default_rng(seed)
        self.audio = np.zeros((RATE*DURATION,2))

    def note(self, midi, at, seconds, volume, instrument, pan=.5):
        offset = int(at*RATE)
        size = min(int(seconds*RATE),len(self.audio)-offset)
        if size <= 0:
            return
        tone = voice(midi,seconds,instrument,self.rng)[:size]*volume
        self.audio[offset:offset+size,0] += tone*np.sqrt(1-pan)
        self.audio[offset:offset+size,1] += tone*np.sqrt(pan)

    def write(self, filename, echoes):
        dry = self.audio.copy()
        for delay, level in echoes:
            shift = int(delay*RATE)
            self.audio[shift:] += dry[:-shift,::-1]*level
        t = np.arange(len(self.audio))/RATE
        self.audio *= np.minimum(1,t/.3)[:,None]
        self.audio *= np.minimum(1,(DURATION-t)/4)[:,None]
        rms = np.sqrt(np.mean(self.audio**2))
        self.audio *= min(.085/max(rms,1e-9), .7/max(abs(self.audio).max(),1e-9))
        with wave.open(str(DEST/filename),'wb') as f:
            f.setnchannels(2)
            f.setsampwidth(2)
            f.setframerate(RATE)
            f.writeframes((self.audio*32767).astype('<i2').tobytes())


def piano():
    # 68 BPM・3拍子。左手の低音と和音に、間を空けた高音の旋律。
    p = Piece(101)
    beat = 60/68
    chords = [[48,55,60,64],[45,52,57,60],[41,48,53,57],[43,50,55,59],
              [48,55,59,64],[50,57,60,65],[41,48,57,60],[43,50,59,62]]
    melody = [[76,0,79],[77,76,0],[72,74,76],[74,0,71],
              [79,0,83],[81,77,0],[76,72,69],[71,74,0]]
    for bar in range(36):
        at = .1+bar*beat*3
        chord = chords[bar%8]
        p.note(chord[0]-12,at,3,.34,'piano',.32)
        for b in [1,2]:
            for i,n in enumerate(chord[1:]):
                p.note(n,at+b*beat+i*.025,2.6,.15,'piano',.43)
        for b,n in enumerate(melody[bar%8]):
            if n:
                p.note(n,at+b*beat+.05,3.3,.31 if b==0 else .23,'piano',.65)
    p.write('quiet-piano-v2.wav',[(.13,.10),(.29,.06)])


def guitar():
    # 84 BPM・4拍子。低めの音域で、交互のベースと8分音符の指弾き。
    p = Piece(202)
    beat = 60/84
    chords = [[43,50,55,59,62,67],[40,47,52,55,59,64],
              [48,52,55,60,64,67],[38,45,50,54,57,62],
              [45,52,57,60,64,69],[40,47,52,55,59,64],
              [48,55,60,64,67,71],[38,45,50,57,62,66]]
    pattern = [0,3,2,4,1,3,2,5]
    for bar in range(34):
        at=.1+bar*4*beat
        chord=chords[bar%8]
        for step,string in enumerate(pattern):
            # 各弦を左右に配置。ピアノとは和音進行・リズム・音域も分ける。
            offset = p.rng.uniform(-.012,.012)
            p.note(chord[string],at+step*beat/2+offset,2.8,
                   (.38 if step in [0,4] else .28)*p.rng.uniform(.87,1.05),
                   'guitar',.25+string*.09)
        if bar%4==3:
            for string,n in enumerate(chord[2:]):
                p.note(n,at+3.4*beat+string*.018,2,.10,'guitar',.5)
    p.write('acoustic-guitar-v2.wav',[(.07,.07),(.16,.035)])


def ambient():
    # 拍のない音楽。12秒単位で重なる和音と、疎らなフルート旋律。
    p = Piece(303)
    chords = [[38,50,57,64,69],[34,46,53,60,65],
              [41,53,60,67,72],[36,48,55,62,67]]
    for section in range(12):
        at = section*8
        for i,n in enumerate(chords[section%4]):
            p.note(n,at+i*.13,14,.12 if i else .17,'pad',.1+i*.19)
    melody = [74,77,81,79,72,74,69,72,77,76,74,69]
    for i,n in enumerate(melody):
        p.note(n,2.5+i*7.7,6.5,.14,'flute',.5+.25*np.sin(i))
    p.write('evening-drift-v2.wav',[(.43,.22),(.81,.16),(1.37,.10)])


if __name__ == '__main__':
    DEST.mkdir(parents=True,exist_ok=True)
    piano()
    guitar()
    ambient()
